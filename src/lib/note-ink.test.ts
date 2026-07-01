import { describe, it, expect } from "vitest";
import { serializeInk, parseInk, splitInk, joinInk, type InkDrawing } from "@/lib/note-ink";

const drawing = (id: string): InkDrawing => ({
  id,
  w: 300,
  h: 200,
  strokes: [
    { color: "#0669F2", size: 2.5, points: [{ x: 10, y: 20, p: 0.5 }, { x: 12, y: 22, p: 0.8 }] },
    { color: "#fff", size: 1, points: [{ x: 99, y: 5, p: 1 }] },
  ],
});

describe("note-ink — serialize/parse round-trip", () => {
  it("a drawing survives serialize → parse with quantized values", () => {
    const ink = drawing("d1");
    const back = parseInk(serializeInk(ink).replace(/^```arcanum-ink\n/, "").replace(/\n```$/, ""))!;
    expect(back.id).toBe("d1");
    expect(back.strokes.length).toBe(2);
    expect(back.strokes[0]!.points[0]).toEqual({ x: 10, y: 20, p: 0.5 });
    expect(back.strokes[0]!.color).toBe("#0669F2");
  });

  it("drops malformed / empty drawings (never invents)", () => {
    expect(parseInk("not json")).toBeNull();
    expect(parseInk(JSON.stringify({ id: "x", strokes: [] }))).toBeNull(); // no strokes
    expect(parseInk(JSON.stringify({ strokes: [{ pts: [[1, 2, 1]] }] }))).toBeNull(); // no id
  });
});

describe("note-ink — splitInk / joinInk round-trip (ink rides in the markdown)", () => {
  it("prose + drawings recombine without loss", () => {
    const prose = "# Título\n\nUn párrafo con [[Enlace]].";
    const inks = [drawing("a"), drawing("b")];
    const md = joinInk(prose, inks);
    const out = splitInk(md);
    expect(out.prose).toBe(prose);
    expect(out.inks.map((i) => i.id)).toEqual(["a", "b"]);
    expect(out.inks[0]!.strokes.length).toBe(2);
  });

  it("a note with no drawings is just its prose (idempotent)", () => {
    const prose = "solo texto\n\ncon dos párrafos";
    expect(joinInk(prose, [])).toBe(prose);
    const out = splitInk(prose);
    expect(out.prose).toBe(prose);
    expect(out.inks).toEqual([]);
  });

  it("splitInk preserves prose spacing (regression: no space-stripping)", () => {
    const md = joinInk("frase con  espacios y palabras", [drawing("a")]);
    expect(splitInk(md).prose).toBe("frase con  espacios y palabras");
  });

  it("re-serializing is stable (split→join→split fixed point)", () => {
    const md1 = joinInk("texto", [drawing("a")]);
    const { prose, inks } = splitInk(md1);
    const md2 = joinInk(prose, inks);
    expect(splitInk(md2)).toEqual({ prose, inks });
  });
});
