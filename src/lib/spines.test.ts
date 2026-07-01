import { describe, it, expect } from "vitest";
import { SPINES, cellById, isAllowedSource, isAllowedSourceHost } from "@/lib/spines";

describe("spines — the curated course skeleton (real, fixed)", () => {
  it("every cell has at least one real https source anchored", () => {
    for (const s of SPINES) {
      for (const c of s.cells) {
        const anchored = (c.sourceUrls ?? []).length + (c.videoUrls ?? []).length + (c.references ?? []).length;
        expect(anchored, `${c.title} has no anchor`).toBeGreaterThan(0);
        for (const u of c.sourceUrls ?? []) expect(u).toMatch(/^https:\/\//);
      }
    }
  });

  it("cellById resolves a real cell", () => {
    const first = SPINES[0]!.cells[0]!;
    expect(cellById(first.id)?.title).toBe(first.title);
    expect(cellById("nope")).toBeNull();
  });
});

describe("spines — the fetch-source SSRF guard (allowlist)", () => {
  it("isAllowedSource is EXACT-match against curated URLs only (no internal/arbitrary)", () => {
    const real = SPINES[0]!.cells[0]!.sourceUrls[0]!;
    expect(isAllowedSource(real)).toBe(true);
    expect(isAllowedSource("http://localhost:9999/secret")).toBe(false);
    expect(isAllowedSource("https://evil.example.com/x")).toBe(false);
    expect(isAllowedSource(real + "?x=1")).toBe(false); // not a substring/prefix match
  });

  it("isAllowedSourceHost gates redirect hops to https trusted hosts (no IPs/internal)", () => {
    const real = SPINES[0]!.cells[0]!.sourceUrls[0]!;
    const host = new URL(real).hostname;
    expect(isAllowedSourceHost(`https://${host}/some/other/path`)).toBe(true); // same trusted host, new path (redirect ok)
    expect(isAllowedSourceHost("https://169.254.169.254/latest/meta-data")).toBe(false); // cloud metadata
    expect(isAllowedSourceHost("http://" + host + "/x")).toBe(false); // http downgrade blocked
    expect(isAllowedSourceHost("https://evil.example.com")).toBe(false);
  });
});
