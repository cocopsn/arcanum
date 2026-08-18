import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { splitSpeakable, bookToSpeech, MAX_FRAGMENT_CHARS } from "@/lib/book-speech";
import { useBookSpeech } from "@/lib/speech";
import { parseBook } from "@/lib/book";
import type { SpeechItem } from "@/lib/book-speech";

// THE PAUSE FIX, structurally verified. Two halves: (1) prose fragments to SENTENCE level (pure,
// deterministic — a pause can lose at most one sentence, and every utterance stays under Chrome's
// silent ~15s kill); (2) the player's fragment INDEX survives pause → resume re-speaks the CURRENT
// fragment, never item 0. The actual sound is the user's phone's to judge — the index arithmetic
// and the no-restart guarantee are provable here.

describe("splitSpeakable — sentence-level fragmentation (pure)", () => {
  it("splits sentences and never drops a word (the audiobook may fragment, never truncate)", () => {
    const text = "La primera frase habla del patrón. La segunda lo discrimina. ¿La tercera pregunta algo? Sí.";
    const frags = splitSpeakable(text, 40);
    expect(frags.length).toBeGreaterThan(1);
    expect(frags.join(" ")).toBe(text);
  });

  it("keeps every fragment within the cap (merging small sentences, splitting monsters)", () => {
    const long = Array.from({ length: 12 }, (_, i) => `Frase número ${i} con contenido real del libro.`).join(" ");
    for (const f of splitSpeakable(long)) expect(f.length).toBeLessThanOrEqual(MAX_FRAGMENT_CHARS);
  });

  it("does NOT split on Spanish abbreviations followed by lowercase (p. ej. sobrevive entero)", () => {
    const frags = splitSpeakable("El caso usa, p. ej. un dict para contar. Después ordena el resultado final.", 60);
    expect(frags[0]).toContain("p. ej. un dict");
  });

  it("hard-splits a monster sentence at punctuation/space windows, preserving all words", () => {
    const monster = `Un enunciado interminable ${Array.from({ length: 60 }, (_, i) => `que sigue y sigue parte ${i},`).join(" ")} y por fin termina.`;
    const frags = splitSpeakable(monster);
    expect(frags.length).toBeGreaterThan(1);
    for (const f of frags) expect(f.length).toBeLessThanOrEqual(MAX_FRAGMENT_CHARS);
    const words = (s: string) => s.replace(/[,;]/g, " ").split(/\s+/).filter(Boolean);
    expect(words(frags.join(" "))).toEqual(words(monster));
  });

  it("is deterministic — a saved listen index means the same fragment on every device", () => {
    const text = "Uno dos tres. Cuatro cinco seis. Siete ocho nueve.";
    expect(splitSpeakable(text, 20)).toEqual(splitSpeakable(text, 20));
  });
});

describe("bookToSpeech — paragraphs become sentence fragments, titles stay whole", () => {
  const md = [
    "---",
    "module_id: ce000000-0000-4000-8000-000000000001",
    "spine: OA Amazon",
    "title: Libro de prueba",
    "---",
    "",
    "> La pregunta raíz del libro, corta.",
    "",
    "## Sección uno",
    `${"Una frase completa del cuerpo con contenido técnico real. ".repeat(12).trim()}`,
    "",
  ].join("\n");

  it("a long paragraph yields MULTIPLE body items under the SAME section, each within the cap", () => {
    const book = parseBook(md)!;
    const items = bookToSpeech(book, { codeMode: "announce" });
    const bodyS1 = items.filter((i) => i.kind === "body" && i.sectionId !== "__intro__");
    expect(bodyS1.length).toBeGreaterThan(1); // the paragraph fragmented — a pause now loses ≤1 sentence
    for (const i of bodyS1) expect(i.text.length).toBeLessThanOrEqual(MAX_FRAGMENT_CHARS);
    expect(new Set(bodyS1.map((i) => i.sectionId)).size).toBe(1); // highlight/scroll still section-true
    const titles = items.filter((i) => i.kind === "title");
    expect(titles.length).toBeGreaterThanOrEqual(2); // book title + section title, un-fragmented
  });
});

// ── the hook: pause preserves the fragment index; resume NEVER restarts from zero ──────────────────
class FakeUtterance {
  text: string;
  voice: unknown = null;
  lang = "";
  rate = 1;
  pitch = 1;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

describe("useBookSpeech — pause keeps the fragment index (the reported restart-from-zero bug)", () => {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speak: vi.fn((u: FakeUtterance) => spoken.push(u)),
    cancel: vi.fn(),
    getVoices: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  beforeEach(() => {
    spoken.length = 0;
    vi.clearAllMocks();
    (window as unknown as Record<string, unknown>).speechSynthesis = synth;
    (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance;
  });
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).speechSynthesis;
    delete (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance;
  });

  const items: SpeechItem[] = ["frag cero.", "frag uno.", "frag dos.", "frag tres."].map((text, i) => ({
    id: `u${i}`,
    sectionId: "s1",
    kind: "body",
    text,
  }));

  it("advances by fragment on onend; pause() cancels but REMEMBERS; play() resumes at the SAME fragment", () => {
    const { result, unmount } = renderHook(() => useBookSpeech(items, { rate: 1, voiceURI: null }));
    act(() => result.current.play());
    expect(spoken.at(-1)!.text).toBe("frag cero.");
    act(() => spoken[0]!.onend?.()); // → frag 1
    act(() => spoken[1]!.onend?.()); // → frag 2
    expect(result.current.index).toBe(2);

    act(() => result.current.pause());
    expect(synth.cancel).toHaveBeenCalled();
    expect(result.current.index).toBe(2); // the index SURVIVES the pause
    const spokenBefore = spoken.length;

    act(() => result.current.play());
    expect(spoken.length).toBe(spokenBefore + 1);
    expect(spoken.at(-1)!.text).toBe("frag dos."); // resumes the CURRENT fragment — never frag cero
    expect(result.current.index).toBe(2);
    unmount(); // explicit, while the speechSynthesis mock is still alive
  });

  it("goTo restores a saved listen index and playing picks up THERE (cross-session resume path)", () => {
    const { result, unmount } = renderHook(() => useBookSpeech(items, { rate: 1, voiceURI: null }));
    act(() => result.current.goTo(3));
    expect(result.current.index).toBe(3);
    act(() => result.current.play());
    expect(spoken.at(-1)!.text).toBe("frag tres.");
    unmount();
  });

  it("stop() is the ONLY reset to zero (explicit, never implicit)", () => {
    const { result, unmount } = renderHook(() => useBookSpeech(items, { rate: 1, voiceURI: null }));
    act(() => result.current.play());
    act(() => spoken[0]!.onend?.());
    expect(result.current.index).toBe(1);
    act(() => result.current.stop());
    expect(result.current.index).toBe(0);
    unmount();
  });
});
