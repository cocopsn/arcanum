"use client";

import ReactMarkdown from "react-markdown";
import wikiLinkPlugin from "remark-wiki-link";
import type { ComponentPropsWithoutRef } from "react";

/** Markdown preview with REAL Obsidian [[wikilinks]] via remark-wiki-link. */
export function NotePreview({
  markdown,
  onNavigate,
}: {
  markdown: string;
  onNavigate: (title: string) => void;
}) {
  return (
    <div className="note-prose space-y-2 text-[15px] leading-relaxed text-text">
      <ReactMarkdown
        urlTransform={(u) => u}
        remarkPlugins={[
          [
            wikiLinkPlugin,
            {
              aliasDivider: "|",
              pageResolver: (name: string) => [name.trim()],
              hrefTemplate: (permalink: string) => permalink,
              wikiLinkClassName: "wikilink",
            },
          ],
        ]}
        components={{
          a({ className, href, children, ...rest }: ComponentPropsWithoutRef<"a">) {
            const cls = typeof className === "string" ? className : "";
            if (cls.includes("wikilink")) {
              const target = (href ?? "").trim() || String(children);
              return (
                <button
                  type="button"
                  className="text-topic underline-offset-2 hover:underline"
                  onClick={() => onNavigate(target)}
                >
                  [[{children}]]
                </button>
              );
            }
            return (
              <a href={href} className="text-topic underline" target="_blank" rel="noreferrer" {...rest}>
                {children}
              </a>
            );
          },
        }}
      >
        {markdown || "_nota vacía_"}
      </ReactMarkdown>
    </div>
  );
}
