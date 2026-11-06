import { describe, it, expect } from "vitest";
import { project } from "@/core/projector";
import type { ArcanumEvent } from "@/core/event";
import fixture from "@/core/__fixtures__/rm-0098936.json";

// CA-13 — the read model of a test log WITHOUT Forge events equals the one captured on HEAD 0098936 (before the
// fold was touched) for everything that is not Forge. The log (the whole 0098936 seed plus user events of every
// existing type) and its read model were captured together, so this compares the new fold against the old one.
const FORGE_ONLY = ["evidence", "forgeVerdicts", "nativeGates"] as const;

function firstDiff(a: unknown, b: unknown, path: string): string | null {
  if (a === b) return null;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) {
    return `${path}: ${JSON.stringify(a)?.slice(0, 160)} != ${JSON.stringify(b)?.slice(0, 160)}`;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return `${path}.length: ${a.length} != ${b.length}`;
  for (const k of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) {
    const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

describe("CA-13 — the fold is unchanged outside Forge (photo of 0098936)", () => {
  it("project(log of 0098936) equals the captured read model, minus the three Forge collections (which are empty)", () => {
    const { head, events, rm: captured } = fixture as unknown as { head: string; events: ArcanumEvent[]; rm: Record<string, unknown> };
    expect(head).toBe("0098936");
    expect(events.length).toBeGreaterThan(150);
    const rm = JSON.parse(JSON.stringify(project(events))) as Record<string, unknown>;
    for (const k of FORGE_ONLY) {
      expect(rm[k], k).toEqual([]);
      delete rm[k];
    }
    const d = firstDiff(rm, captured, "rm");
    expect(d, `el pliegue cambió fuera de Forge (CA-13) en ${d}`).toBeNull();
    expect(rm).toEqual(captured);
  });
});
