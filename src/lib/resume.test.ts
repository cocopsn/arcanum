import { describe, it, expect, beforeEach } from "vitest";
import { loadResume, saveResume, clearResume } from "@/lib/resume";

// RESUME — the device-local "where was I". Load-bearing semantics under test: merge-patch writes
// (one surface updating its field never wipes another's), fail-closed load (garbage/foreign
// version → null, never a crash), and clear.

beforeEach(() => {
  localStorage.clear();
});

describe("resume — round-trip + merge", () => {
  it("starts empty (no stored location → null)", () => {
    expect(loadResume()).toBeNull();
  });

  it("merge-patches: each surface writes ITS field without clobbering the others", () => {
    saveResume({ world: "g-1" });
    saveResume({ cell: "m-1" });
    saveResume({ bookId: "b-1" });
    saveResume({ library: true });
    const r = loadResume()!;
    expect(r.world).toBe("g-1");
    expect(r.cell).toBe("m-1");
    expect(r.bookId).toBe("b-1");
    expect(r.library).toBe(true);
    // a deliberate close clears ONLY its own field
    saveResume({ bookId: null });
    const after = loadResume()!;
    expect(after.bookId).toBeNull();
    expect(after.world).toBe("g-1");
    expect(after.cell).toBe("m-1");
  });

  it("clearResume forgets everything", () => {
    saveResume({ world: "g-1", cell: "m-1" });
    clearResume();
    expect(loadResume()).toBeNull();
  });
});

describe("resume — fail-closed load", () => {
  it("garbage JSON → null (never throws)", () => {
    localStorage.setItem("arcanum_resume", "{not json");
    expect(loadResume()).toBeNull();
  });

  it("a foreign/absent version → null (a future shape never half-parses)", () => {
    localStorage.setItem("arcanum_resume", JSON.stringify({ v: 2, world: "g-1" }));
    expect(loadResume()).toBeNull();
    localStorage.setItem("arcanum_resume", JSON.stringify({ world: "g-1" }));
    expect(loadResume()).toBeNull();
  });

  it("wrong field types are coerced to safe nulls, not passed through", () => {
    localStorage.setItem("arcanum_resume", JSON.stringify({ v: 1, world: 42, cell: {}, bookId: [], library: "yes", ts: "x" }));
    const r = loadResume()!;
    expect(r.world).toBeNull();
    expect(r.cell).toBeNull();
    expect(r.bookId).toBeNull();
    expect(r.library).toBe(false);
  });
});
