import { describe, it, expect, vi } from "vitest";
import { pickVoice, spanishVoices, type VoiceInfo } from "@/lib/speech";
import { bookToSpeech } from "@/lib/book-speech";
import { parseBook } from "@/lib/book";

const V = (lang: string, name: string, local = true): VoiceInfo => ({ name, lang, voiceURI: `${name}::${lang}`, localService: local });

describe("speech — voice selection (Spanish first, local/offline)", () => {
  const voices = [V("en-US", "Alex"), V("es-ES", "Mónica"), V("es-MX", "Paulina"), V("es-AR", "Diego"), V("fr-FR", "Amelie")];

  it("prioritizes es-MX > es-ES > other es > non-es", () => {
    expect(pickVoice(voices)!.lang).toBe("es-MX");
    expect(pickVoice(voices.filter((v) => v.lang !== "es-MX"))!.lang).toBe("es-ES");
    expect(pickVoice([V("en-US", "Alex"), V("es-AR", "Diego")])!.lang).toBe("es-AR"); // any es beats en
  });

  it("an explicit preferred voice wins over the default order", () => {
    expect(pickVoice(voices, "Diego::es-AR")!.lang).toBe("es-AR");
    expect(pickVoice(voices, "does-not-exist")!.lang).toBe("es-MX"); // stale pref → falls back to best es
  });

  it("prefers a LOCAL (offline) voice when two share the same language rank", () => {
    const chosen = pickVoice([V("es-MX", "Cloud", false), V("es-MX", "OnDevice", true)]);
    expect(chosen!.name).toBe("OnDevice");
  });

  it("empty list → null (honest: no voice, the UI says so — never a fake)", () => {
    expect(pickVoice([])).toBeNull();
  });

  it("spanishVoices keeps only es-* (es-MX, es_ES, …), drops the rest", () => {
    expect(spanishVoices(voices).map((v) => v.lang).sort()).toEqual(["es-AR", "es-ES", "es-MX"]);
    expect(spanishVoices([V("es_ES", "underscore")]).length).toBe(1); // es_ES normalized form still counts
  });

  it("OFFLINE: building the speech script + picking a voice makes ZERO network calls (voices are on-device)", () => {
    const g = globalThis as unknown as { fetch?: unknown; XMLHttpRequest?: unknown };
    const fetchSpy = vi.fn();
    const xhrSpy = vi.fn();
    const orig = { fetch: g.fetch, XMLHttpRequest: g.XMLHttpRequest };
    g.fetch = fetchSpy;
    g.XMLHttpRequest = class {
      constructor() {
        xhrSpy();
      }
    };
    try {
      const book = parseBook("---\nmodule_id: cb000000-0000-4000-8000-000000000009\nspine: FrED\ntitle: T\n---\n\n> raíz\n\n## X\ntexto real.\n\n```py\na = 1\n```")!;
      const items = bookToSpeech(book, { codeMode: "announce" });
      const voice = pickVoice([V("es-MX", "Paulina")]);
      expect(items.length).toBeGreaterThan(0);
      expect(voice).not.toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled(); // Web Speech uses local voices; text is the already-downloaded book
      expect(xhrSpy).not.toHaveBeenCalled();
    } finally {
      g.fetch = orig.fetch;
      g.XMLHttpRequest = orig.XMLHttpRequest;
    }
  });
});
