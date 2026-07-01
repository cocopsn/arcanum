import { Extension, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// The WYSIWYG editor config — TipTap (ProseMirror) is the EDITING layer; Obsidian-flavoured Markdown
// is the SERIALIZED source of truth that lives in the log. tiptap-markdown handles the standard nodes
// (headings, bold/italic, lists, quotes, code, checkboxes, links) with a verified round-trip; the one
// thing it gets wrong is [[wikilinks]] (it escapes the brackets), so we (a) keep wikilinks as literal
// styled+clickable text via a ProseMirror decoration — a perfect round-trip, no custom node — and
// (b) un-escape the double brackets after serialization. The wikilink graph still derives from the
// same parseWikilinks() the projector uses (matching == storage). Pure where it can be.

const WIKILINK_RE = /\[\[\s*([^[\]]+?)\s*\]\]/g;

/** Resolve a [[Target|alias]] / [[Target#heading]] match to its bare target title. */
function targetOf(raw: string): string {
  return raw.split("|")[0]!.split("#")[0]!.trim();
}

export interface WikilinkOptions {
  onNavigate: (target: string) => void;
}

/** Styles [[...]] spans (clickable) and routes a click to onNavigate. No schema node → the text is
 *  literal [[Title]] and round-trips through markdown untouched. */
export const Wikilink = Extension.create<WikilinkOptions>({
  name: "wikilink",
  addOptions() {
    return { onNavigate: () => {} };
  },
  addProseMirrorPlugins() {
    const onNavigate = this.options.onNavigate;
    return [
      new Plugin({
        key: new PluginKey("wikilink"),
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              const text = node.text;
              WIKILINK_RE.lastIndex = 0;
              let m: RegExpExecArray | null;
              while ((m = WIKILINK_RE.exec(text))) {
                const from = pos + m.index;
                const to = from + m[0].length;
                decos.push(
                  Decoration.inline(from, to, { class: "wikilink", "data-wikilink": targetOf(m[1]!) }),
                );
              }
            });
            return DecorationSet.create(state.doc, decos);
          },
          handleClick(_view, _pos, event) {
            const target = (event.target as HTMLElement | null)?.dataset?.wikilink;
            if (target) {
              onNavigate(target);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

/** The full extension set for a note editor. onNavigate fires when a [[wikilink]] is clicked. */
export function noteExtensions(onNavigate: (target: string) => void) {
  return [
    StarterKit,
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noreferrer noopener", target: "_blank" } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: "Escribe… enlaza con [[Otra nota]]" }),
    Markdown.configure({ html: false, breaks: false, transformPastedText: true, linkify: false }),
    Wikilink.configure({ onNavigate }),
  ];
}

/** Un-escape the double brackets tiptap-markdown escapes, so [[wikilinks]] stay Obsidian-compatible. */
export function unescapeWikilinks(md: string): string {
  return md.replace(/\\\[\\\[/g, "[[").replace(/\\\]\\\]/g, "]]");
}

/** Serialize the editor's prose to Obsidian-flavoured markdown (wikilinks preserved). */
export function serializeProse(editor: Editor): string {
  const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
  const md = storage.markdown?.getMarkdown?.() ?? "";
  return unescapeWikilinks(md).trim();
}
