import { describe, it, expect } from "vitest";
import { toRow, fromRow, type EventRow } from "@/sync/mapping";
import { makeEvent } from "@/core/event";

const e = makeEvent(
  "checkpoint.passed",
  { score: 0.8 },
  { ts: 1000, deviceId: "dev", goalId: "g1", moduleId: "m1", id: "evt-1" },
);

describe("mapping", () => {
  it("toRow omits user_id so the DB default fills it", () => {
    const row = toRow(e);
    expect("user_id" in row).toBe(false);
    expect(row).toMatchObject({ id: "evt-1", type: "checkpoint.passed", v: 1 });
  });

  it("fromRow strips server-only fields back to the envelope", () => {
    const serverRow: EventRow = {
      ...toRow(e),
      user_id: "user-123",
      seq: 99,
      created_at: "2026-06-28T00:00:00Z",
    };
    const env = fromRow(serverRow);
    expect("user_id" in env).toBe(false);
    expect("seq" in env).toBe(false);
    expect("created_at" in env).toBe(false);
    expect(env).toEqual(e);
  });

  it("round-trips through the server shape", () => {
    expect(fromRow({ ...toRow(e), user_id: "u", seq: 5, created_at: "t" })).toEqual(e);
  });
});
