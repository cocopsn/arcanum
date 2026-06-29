// Pure [[wikilink]] target extraction (Obsidian syntax). Used by the projector
// to derive the note graph (links → backlinks). The PREVIEW renders wikilinks
// via remark-wiki-link; this regex extraction matches the same [[…]] syntax.

const WIKILINK = /\[\[\s*([^\]|#]+?)\s*(?:[#|][^\]]*)?\]\]/g;

/** Unique target titles linked from markdown: [[T]], [[T|alias]], [[T#heading]]. */
export function parseWikilinks(markdown: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of markdown.matchAll(WIKILINK)) {
    const target = m[1]!.trim();
    if (target && !seen.has(target)) {
      seen.add(target);
      out.push(target);
    }
  }
  return out;
}
