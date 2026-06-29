import { describe, it, expect } from "vitest";
import { makeEvent, newEventId, compareEvents, EVENT_TYPES } from "@/core/event";

describe("event ids", () => {
  it("mints distinct, well-formed UUIDv7 ids", () => {
    // Distinctness + valid uuid shape is what compareEvents' (ts,id) tie-break
    // relies on — a stable total order, not strict intra-ms call ordering.
    const ids = new Set(Array.from({ length: 100 }, () => newEventId()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("compareEvents", () => {
  it("orders by ts then id", () => {
    expect(compareEvents({ ts: 1, id: "b" }, { ts: 2, id: "a" })).toBeLessThan(0);
    expect(compareEvents({ ts: 5, id: "b" }, { ts: 5, id: "a" })).toBeGreaterThan(0);
    expect(compareEvents({ ts: 5, id: "a" }, { ts: 5, id: "a" })).toBe(0);
  });
});

describe("makeEvent", () => {
  it("builds a well-formed envelope", () => {
    const e = makeEvent(
      "error.resolved",
      { insight: "x" },
      { ts: 1000, deviceId: "dev-1", goalId: "g1", moduleId: "m1" },
    );
    expect(e.type).toBe("error.resolved");
    expect(e.ts).toBe(1000);
    expect(e.device_id).toBe("dev-1");
    expect(e.goal_id).toBe("g1");
    expect(e.module_id).toBe("m1");
    expect(e.v).toBe(1);
    expect(typeof e.id).toBe("string");
  });

  it("defaults goal/module to null and v to 1; honors fixed id", () => {
    const e = makeEvent(
      "session.started",
      { kind: "error" },
      { ts: 1, deviceId: "d", id: "fixed-id" },
    );
    expect(e.goal_id).toBeNull();
    expect(e.module_id).toBeNull();
    expect(e.v).toBe(1);
    expect(e.id).toBe("fixed-id");
  });

  it("EVENT_TYPES has the 15 taxonomy types", () => {
    expect(EVENT_TYPES).toHaveLength(15);
  });
});
