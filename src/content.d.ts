// Raw .md imports (content/books/*.md) — bundled as strings via the next.config webpack asset/source
// rule, so the seed books ship offline with the app (no CDN, no fs).
declare module "*.md" {
  const content: string;
  export default content;
}
