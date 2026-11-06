import { describe, expect, it } from "vitest";
import { gradeSenal, senalOrder, senalWords } from "@/forge/eval/signal";

// §9.3 f: correcto when the pattern matches, the overlap with `senal` is ≥ 50 % of it and the span is ≤ 3× its length.

const item = { enunciado: "Dado un arreglo ordenado, encuentra el primer índice mayor o igual a x en tiempo logarítmico.", patron: "busqueda binaria", senal: "arreglo ordenado" };
const at = item.enunciado.indexOf(item.senal);
const len = item.senal.length;

describe("gradeSenal", () => {
  it("exact span and right pattern → correct; wrong pattern → incorrect", () => {
    expect(gradeSenal(item, { patron: "busqueda binaria", start: at, end: at + len })).toBe(true);
    expect(gradeSenal(item, { patron: "dos punteros", start: at, end: at + len })).toBe(false);
  });

  it("marking the whole statement does not pass (span ≤ 3× senal)", () => {
    expect(gradeSenal(item, { patron: "busqueda binaria", start: 0, end: item.enunciado.length }), "marcar todo el enunciado aprobó la señal").toBe(false);
  });

  it("overlap below 50 % does not pass", () => {
    expect(gradeSenal(item, { patron: "busqueda binaria", start: at + len - 3, end: at + len + 4 })).toBe(false);
    expect(gradeSenal(item, { patron: "busqueda binaria", start: at, end: at + Math.ceil(len / 2) })).toBe(true);
  });

  it("the order is deterministic per seed and words keep their ranges", () => {
    expect(senalOrder([1, 2, 3, 4, 5], 7)).toEqual(senalOrder([1, 2, 3, 4, 5], 7));
    const w = senalWords(item.enunciado);
    expect(item.enunciado.slice(w[2]!.start, w[2]!.end)).toBe("arreglo");
  });
});
