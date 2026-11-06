// D11.1 (integrar-fase0): books-publish reads maestro-urls.json in both shapes â€” the design's `{ code: [urls] }`
// (Â§5.1, Â§6.2) and c0-nucleo's `{ maestro_sha10, urls: { code: [urls] } }` â€” and never takes metadata keys as codes.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { codesFromMaestroUrls, publish } from "../../../scripts/forge/books-publish.mjs";

const BOOK = "---\ntitle: Expediente 1\nmodule_id: forge-sd-01\nreading_minutes: 5\n---\n\n# Expediente 1\n";
const URLS = { "SD-01": ["https://www.palantir.com/docs/foundry/"], "P2-06": ["https://www.palantir.com/docs/"] };

type Published = { ok: boolean; errors?: (string | undefined)[]; books?: number };
const roots: string[] = [];
function makeRoot(maestro: unknown): string {
  const root = mkdtempSync(path.join(tmpdir(), "books-publish-"));
  roots.push(root);
  mkdirSync(path.join(root, "src/forge/data"), { recursive: true });
  mkdirSync(path.join(root, "content/forge/books"), { recursive: true });
  writeFileSync(path.join(root, "src/forge/data/maestro-urls.json"), JSON.stringify(maestro));
  writeFileSync(path.join(root, "content/forge/books/sd-01.md"), BOOK);
  return root;
}
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("books-publish Â· maestro-urls.json in both shapes (D11.1)", () => {
  it("c0-nucleo shape { maestro_sha10, urls }: SD-01 is a code of the master program", () => {
    const r: Published = publish(makeRoot({ maestro_sha10: "38cbc7da42", urls: URLS }));
    expect(r.errors ?? [], "SD-01 must be read from data.urls").toEqual([]);
    expect(r).toMatchObject({ ok: true, books: 1 });
  });

  it("design shape { code: [urls] }: SD-01 is a code of the master program", () => {
    const r: Published = publish(makeRoot(URLS));
    expect(r.errors ?? []).toEqual([]);
    expect(r).toMatchObject({ ok: true, books: 1 });
  });

  it("metadata keys are never codes", () => {
    const codes = codesFromMaestroUrls({ maestro_sha10: "38cbc7da42", urls: URLS }) as Set<string>;
    expect([...codes].sort()).toEqual(["P2-06", "SD-01"]);
    const flat = codesFromMaestroUrls({ maestro_sha10: "38cbc7da42", ...URLS }) as Set<string>;
    expect([...flat].sort()).toEqual(["P2-06", "SD-01"]);
  });
});
