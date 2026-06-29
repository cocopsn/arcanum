import { describe, it, expect } from "vitest";
import { buildTutorContext } from "@/lib/tutor";
import { project } from "@/core/projector";
import { makeEvent } from "@/core/event";
import { SEED_EVENTS, SEED_MODULE_ID } from "@/lib/seed";

const D0 = Date.UTC(2026, 5, 28, 12, 0, 0);

describe("buildTutorContext — local-first RAG retrieval", () => {
  it("retrieves topic, prereqs, mastery and the user's own notes for the module", () => {
    const events = [
      makeEvent("goal.upserted", { title: "G", priority: 1, color: "#fff", sigil: "s" }, { ts: D0, deviceId: "d", goalId: "g" }),
      makeEvent("module.upserted", { title: "Root", prereqs: [], kind: "core" }, { ts: D0, deviceId: "d", goalId: "g", moduleId: "root" }),
      makeEvent("module.upserted", { title: "Child", prereqs: [], kind: "core" }, { ts: D0, deviceId: "d", goalId: "g", moduleId: "child" }),
      makeEvent("roadmap.edge.upserted", { from: "root", to: "child" }, { ts: D0, deviceId: "d" }),
      makeEvent("note.created", { note_id: "n1", title: "Mis apuntes", markdown: "# AVL\nrotaciones para balance" }, { ts: D0, deviceId: "d", moduleId: "child" }),
    ];
    const rm = project(events);
    const ctx = buildTutorContext(rm, "child", "  ¿por qué rota?  ", D0)!;
    expect(ctx.question).toBe("¿por qué rota?"); // trimmed
    expect(ctx.topicTitle).toBe("Child");
    expect(ctx.prereqTitles).toEqual(["Root"]);
    expect(ctx.notes).toHaveLength(1);
    expect(ctx.notes[0]!.title).toBe("Mis apuntes");
    expect(ctx.notes[0]!.excerpt).toContain("rotaciones para balance");
    expect(typeof ctx.masteryPct).toBe("number");
    expect(ctx.topicSummary).toBeNull(); // custom module → no authored content
  });

  it("anchors a seed cell's canonical source into the RAG context; null module → null", () => {
    const rm = project(SEED_EVENTS);
    const ctx = buildTutorContext(rm, SEED_MODULE_ID, "q", D0)!;
    expect(ctx.sources.length).toBeGreaterThan(0); // real extracted source URLs
    expect(ctx.sources.every((u) => u.startsWith("http"))).toBe(true);
    expect(buildTutorContext(rm, "ghost", "q", D0)).toBeNull();
  });
});
