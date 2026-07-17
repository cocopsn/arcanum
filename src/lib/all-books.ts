// FOLDER INGESTION — every .md the user drops in content/books/ is bundled at BUILD time (webpack
// require.context), so they ship offline with the app exactly like the two seed examples did. Drop a
// file, rebuild, and it's in the PWA — no per-file wiring. In non-webpack contexts (vitest) require.context
// doesn't exist → returns [] and the tests use inline fixtures instead. The .md → asset/source rule
// (next.config.mjs) makes each import resolve to the raw string.

interface BookContext {
  keys(): string[];
  (id: string): string | { default?: string };
}
interface RequireWithContext {
  context(dir: string, recursive: boolean, re: RegExp): BookContext;
}

export function allBookMd(): string[] {
  try {
    // require.context MUST be written SYNTACTICALLY (the cast is erased at compile → the emitted JS is
    // `require.context(...)`, which webpack detects and bundles). In non-webpack runtimes (vitest / SSR
    // without the loader) require or .context is undefined → this throws → the catch returns [].
    const ctx = (require as unknown as RequireWithContext).context("../../content/books", false, /\.md$/);
    return ctx
      .keys()
      .map((k) => {
        const m = ctx(k);
        return typeof m === "string" ? m : m?.default ?? "";
      })
      .filter((s): s is string => typeof s === "string" && s.length > 0);
  } catch {
    return [];
  }
}
