import { describe, it, expect } from "vitest";
import { foldLast24h } from "@/core/sleep-cycle";
import { makeEvent } from "@/core/event";

const NOW = Date.UTC(2026, 5, 28, 18, 0, 0);
const H = 3_600_000;
const dev = (ts: number) => ({ ts, deviceId: "d" });

describe("foldLast24h", () => {
  it("counts the day's learning acts within the 24h window", () => {
    const events = [
      makeEvent("error.resolved", { insight: "a" }, dev(NOW - 2 * H)),
      makeEvent("error.resolved", { insight: "b" }, dev(NOW - 1 * H)),
      makeEvent("checkpoint.passed", { score: 0.9 }, dev(NOW - 3 * H)),
      makeEvent("module.completed", {}, dev(NOW - 4 * H)),
      makeEvent("session.ended", { duration_ms: 30 * 60000 }, dev(NOW - 5 * H)),
      makeEvent("note.created", { note_id: "n", title: "AVL", markdown: "x" }, dev(NOW - 6 * H)),
    ];
    const d = foldLast24h(events, NOW);
    expect(d.errorsResolved).toBe(2);
    expect(d.checkpointsPassed).toBe(1);
    expect(d.modulesCompleted).toBe(1);
    expect(d.sessionMinutes).toBe(30);
    expect(d.notesCreated).toBe(1);
    expect(d.noteTitles).toEqual(["AVL"]);
  });

  it("excludes events older than 24h", () => {
    const events = [
      makeEvent("error.resolved", { insight: "old" }, dev(NOW - 25 * H)),
      makeEvent("error.resolved", { insight: "recent" }, dev(NOW - 1 * H)),
    ];
    expect(foldLast24h(events, NOW).errorsResolved).toBe(1);
  });

  it("is pure (now is explicit) and deterministic", () => {
    const events = [makeEvent("error.resolved", { insight: "x" }, dev(NOW - H))];
    expect(foldLast24h(events, NOW)).toEqual(foldLast24h(events, NOW));
  });
});
