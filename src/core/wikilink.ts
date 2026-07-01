// Pure [[wikilink]] target extraction (Obsidian syntax). Used by the projector
// to derive the note graph (links → backlinks). The WYSIWYG editor styles the same
// [[…]] syntax via a ProseMirror decoration (lib/note-editor.ts) — matching == storage.

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
