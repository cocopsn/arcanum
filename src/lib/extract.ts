import { parse, HTMLElement } from "node-html-parser";

// Pull the READABLE content out of a fetched page so it can render INSIDE Arcanum (themed), instead
// of a forced iframe the origin would reject with a blank screen. Pure (HTML string in → blocks out)
// → unit-testable, no network here (the route does the fetch). Honest: if little text comes back
// (a JS-rendered SPA served as a shell), wordCount is low and the caller shows a preview + "open source".

export interface ExtractedBlock {
  type: "h" | "p" | "code" | "img";
  /** heading level (h) */
  level?: number;
  text?: string;
  /** absolute image src (img) */
  src?: string;
  alt?: string;
}
export interface Extracted {
  title: string;
  blocks: ExtractedBlock[];
  wordCount: number;
}

function absUrl(src: string, base: string): string | null {
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

export function extractReadable(html: string, baseUrl: string): Extracted {
  const root = parse(html);
  root.querySelectorAll("script,style,noscript,nav,footer,header,aside,form,svg,iframe,button").forEach((n) => n.remove());
  const title = (root.querySelector("title")?.text ?? root.querySelector("h1")?.text ?? "").trim().replace(/\s+/g, " ");
  const main =
    root.querySelector("article") ??
    root.querySelector("main") ??
    root.querySelector("#content") ??
    root.querySelector('[role="main"]') ??
    root.querySelector("body") ??
    root;

  const blocks: ExtractedBlock[] = [];
  let words = 0;
  const nodes = (main as HTMLElement).querySelectorAll("h1,h2,h3,h4,p,pre,img");
  for (const el of nodes) {
    const tag = el.rawTagName?.toLowerCase();
    if (!tag) continue;
    if (/^h[1-4]$/.test(tag)) {
      const t = el.text.trim().replace(/\s+/g, " ");
      if (t && t.length < 200) blocks.push({ type: "h", level: Number(tag[1]), text: t });
    } else if (tag === "p") {
      const t = el.text.trim().replace(/\s+/g, " ");
      if (t.length >= 40) {
        blocks.push({ type: "p", text: t });
        words += t.split(/\s+/).length;
      }
    } else if (tag === "pre") {
      const t = el.text.replace(/\n{3,}/g, "\n\n").trim();
      if (t) blocks.push({ type: "code", text: t.slice(0, 900) });
    } else if (tag === "img") {
      const raw = el.getAttribute("src") || el.getAttribute("data-src");
      const src = raw ? absUrl(raw, baseUrl) : null;
      if (src && /^https?:/i.test(src)) blocks.push({ type: "img", src, alt: (el.getAttribute("alt") ?? "").slice(0, 120) });
    }
    if (blocks.length >= 80) break; // a themed preview, not a full mirror
  }
  return { title, blocks, wordCount: words };
}
