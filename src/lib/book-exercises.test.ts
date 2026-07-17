import { describe, it, expect } from "vitest";
import { saveBook } from "@/lib/book-store";
import { bookQuestionsForModule } from "@/lib/book-exercises";

// LAYER 3 — the book's "Preguntas que deberías poder responder" surfaced as conceptual self-checks.
// End-to-end over the real parser + the offline book store (fake-indexeddb): a downloaded book yields
// its question bullets anchored to the module; no book yields [] (honest empty, never invented).

const HANDLE = "itc-c4-layer3-prueba"; // a friendly handle → resolves to the ITC C4 cell
const CELL = "ca000000-0000-4000-8000-000000000005"; // ITC C4
const MD = [
  "---",
  `module_id: ${HANDLE}`,
  "spine: ITC",
  "title: Prueba Layer 3",
  "---",
  "> la pregunta raíz",
  "",
  "## Núcleo",
  "algún cuerpo de la sección",
  "",
  "## Preguntas que deberías poder responder",
  "- ¿Por qué la búsqueda binaria es O(log n)?",
  "- Demuestra la invariante del lazo de inserción.",
  "- x",
  "",
  "## Fuentes",
  "- CLRS cap. 12",
].join("\n");

describe("book-exercises — Layer 3 conceptual self-checks", () => {
  it("extracts the question bullets for a downloaded module's book", async () => {
    const saved = await saveBook(MD, "seed");
    expect(saved?.id).toBe(CELL); // the handle resolved → book anchored to ITC C4
    const qs = await bookQuestionsForModule(CELL);
    expect(qs).toContain("¿Por qué la búsqueda binaria es O(log n)?");
    expect(qs).toContain("Demuestra la invariante del lazo de inserción.");
    expect(qs.includes("x")).toBe(false); // trivial one-char line filtered — no noise
    expect(qs.includes("CLRS cap. 12")).toBe(false); // a DIFFERENT section, not pulled in
  });

  it("returns [] when no book is downloaded for the module (honest empty, never fabricated)", async () => {
    const qs = await bookQuestionsForModule("ca000000-0000-4000-8000-0000000000ff");
    expect(qs).toEqual([]);
  });
});
