import { describe, it, expect } from "vitest";
import { parseCanvasObligations } from "@/lib/canvas-parse";
import assignments from "@/lib/__fixtures__/canvas-assignments.json";
import courses from "@/lib/__fixtures__/canvas-courses.json";

describe("parseCanvasObligations — tolerant against real Canvas JSON fixtures", () => {
  const obs = parseCanvasObligations(assignments, courses);
  const byId = new Map(obs.map((o) => [o.id, o]));

  it("drops junk (null, non-objects, blank/absent titles) and keeps the rest", () => {
    // 11 fixture rows → 7 valid (4 dropped: no-title course-22011 row, blank title,
    // null, and the bare string).
    expect(obs).toHaveLength(7);
    expect(obs.every((o) => o.id && o.title)).toBe(true);
  });

  it("namespaces ids by course and resolves course names", () => {
    const t4 = byId.get("21534:778001")!;
    expect(t4.title).toBe("Tarea 4 — Árboles AVL");
    expect(t4.course).toBe("Estructuras de Datos y Algoritmos");
    expect(t4.due_ts).toBe(Date.parse("2026-07-02T05:59:00Z"));
    expect(t4.url).toContain("/assignments/778001");
    expect(t4.status).toBe("pending");
  });

  it("derives status from the submission shape", () => {
    expect(byId.get("21534:778002")!.status).toBe("graded"); // has grade
    expect(byId.get("21890:990123")!.status).toBe("missing"); // missing:true
    expect(byId.get("21534:778004")!.status).toBe("late"); // submitted + late
  });

  it("parses the planner-item shape (plannable/context_name)", () => {
    const serie = byId.get("21890:990456")!;
    expect(serie.title).toBe("Serie 12 — Integrales de superficie");
    expect(serie.course).toBe("Cálculo Multivariable"); // from context_name
    expect(serie.due_ts).toBe(Date.parse("2026-07-10T05:59:00Z"));
  });

  it("degrades a missing/garbage date to null without dropping the row", () => {
    expect(byId.get("21534:778003")!.due_ts).toBeNull(); // due_at: null
    expect(byId.get("21534:778100")!.due_ts).toBeNull(); // due_at: "no-es-fecha"
    expect(byId.get("21534:778100")!.title).toBe("Fecha basura");
  });

  it("returns [] for non-array / junk input, never throws", () => {
    expect(parseCanvasObligations(null)).toEqual([]);
    expect(parseCanvasObligations("nope")).toEqual([]);
    expect(parseCanvasObligations({})).toEqual([]);
    expect(parseCanvasObligations([])).toEqual([]);
  });

  it("de-dups by id (last snapshot wins)", () => {
    const dup = parseCanvasObligations([
      { id: 1, course_id: 9, name: "v1", due_at: null },
      { id: 1, course_id: 9, name: "v2", due_at: null },
    ]);
    expect(dup).toHaveLength(1);
    expect(dup[0]!.title).toBe("v2");
  });
});
