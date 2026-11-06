// MONO_PRISM — the monochrome Prism theme of Engineering Forge (design §14.2, D4). Only the world's text tiers
// (var(--text), var(--text-muted), var(--text-faint)), weight and italics: code is monochrome too and follows
// the light reading mode because the variables resolve inside the world's subtree. CodeBlock and CodeEditor use
// it when they receive `mono` (theme.monochrome); without the prop they keep themes.vsDark.
import type { PrismTheme } from "prism-react-renderer";

export const MONO_PRISM: PrismTheme = {
  plain: { color: "var(--text)", backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "var(--text-faint)", fontStyle: "italic" } },
    { types: ["keyword", "builtin", "important", "atrule", "selector", "tag"], style: { color: "var(--text)", fontWeight: "600" } },
    { types: ["string", "char", "attr-value", "regex", "url", "inserted"], style: { color: "var(--text-muted)" } },
    { types: ["number", "boolean", "constant", "symbol"], style: { color: "var(--text-muted)" } },
    { types: ["function", "class-name", "property", "attr-name", "variable"], style: { color: "var(--text)" } },
    { types: ["punctuation", "operator"], style: { color: "var(--text-muted)" } },
    { types: ["deleted"], style: { color: "var(--text-faint)", textDecorationLine: "line-through" } },
  ],
};
