import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCsp, isAllowedFrameUrl, isAllowedImageUrl } from "./csp.mjs";

// CA-68 (Forge design §12.1): the exact set of values per directive, the 14 directives present, and next.config.mjs
// applying buildCsp() (one source for the header and for what SafeImage / VideoEmbed / SourceViewer embed).
const EXPECTED: Record<string, string[]> = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", "blob:", "https://cdn.jsdelivr.net"],
  "worker-src": ["'self'", "blob:"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https://www.palantir.com", "https://build.palantir.com"],
  "font-src": ["'self'", "data:"],
  "connect-src": ["'self'", "blob:", "data:", "https://*.supabase.co", "wss://*.supabase.co", "https://cdn.jsdelivr.net"],
  "media-src": ["'self'", "data:", "blob:"],
  "frame-src": ["https://www.youtube-nocookie.com", "https://player.vimeo.com"],
  "manifest-src": ["'self'"],
};

function parse(header: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of header.split(";").map((s) => s.trim()).filter(Boolean)) {
    const [name, ...values] = part.split(/\s+/);
    out.set(name!, values);
  }
  return out;
}

describe("CSP (src/lib/csp.mjs, CA-68)", () => {
  const csp = parse(buildCsp());

  it("has exactly the 14 directives", () => {
    expect([...csp.keys()].sort()).toEqual(Object.keys(EXPECTED).sort());
    expect(csp.size).toBe(14);
  });

  it("each directive carries exactly its values (no new wildcard, no lost origin)", () => {
    for (const [name, values] of Object.entries(EXPECTED)) {
      const got = csp.get(name) ?? [];
      for (const v of values) expect(got.includes(v), `${name} perdió ${v}`).toBe(true);
      for (const v of got) expect(values.includes(v), `${name} ganó ${v}`).toBe(true);
    }
  });

  it("next.config.mjs applies buildCsp() from csp.mjs (no second copy of the policy)", () => {
    const cfg = readFileSync(join(process.cwd(), "next.config.mjs"), "utf8");
    expect(cfg).toMatch(/import\s*\{\s*buildCsp\s*\}\s*from\s*"\.\/src\/lib\/csp\.mjs"/);
    expect(cfg).toMatch(/buildCsp\(\)/);
    expect(cfg.includes("img-src"), "next.config.mjs vuelve a declarar directivas de la CSP").toBe(false);
  });

  it("the embed rules follow the same origins as the header", () => {
    expect(isAllowedImageUrl("https://www.palantir.com/docs/resources/foundry/x.png")).toBe(true);
    expect(isAllowedImageUrl("https://build.palantir.com/a.png")).toBe(true);
    expect(isAllowedImageUrl("http://www.palantir.com/a.png")).toBe(false);
    expect(isAllowedImageUrl("https://evil.example/a.png")).toBe(false);
    expect(isAllowedImageUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedImageUrl("https://www.palantir.com:8443/x.png"), "la figura aceptó un origen con otro puerto que img-src no permite").toBe(false);
    expect(isAllowedFrameUrl("https://www.youtube-nocookie.com/embed/abcdefghijk")).toBe(true);
    expect(isAllowedFrameUrl("https://www.youtube.com/embed/abcdefghijk")).toBe(false);
    expect(isAllowedFrameUrl("https://player.vimeo.com/video/1")).toBe(true);
  });
});
