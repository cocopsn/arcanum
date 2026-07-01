// Classify a REAL source URL so the viewer can decide HONESTLY how to bring it INTO Arcanum:
//   youtube / vimeo → embed the official privacy-friendly player (real, works inside the lesson)
//   image           → render the image directly
//   page            → server-side fetch + extract (many sites block iframing; we never fake it)
// Pure (no I/O) → unit-testable. The viewer + /api/fetch-source consume this; nothing is invented.

export type SourceKind = "youtube" | "vimeo" | "image" | "page";

export interface ClassifiedSource {
  url: string;
  kind: SourceKind;
  /** video id (youtube/vimeo) when applicable */
  videoId?: string;
  /** privacy-friendly embed URL (youtube-nocookie / player.vimeo) — real, embeddable */
  embedUrl?: string;
  /** short human label: host + a path hint */
  label: string;
}

const YT = [
  /(?:youtube\.com|youtube-nocookie\.com)\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{6,})/i,
  /youtu\.be\/([A-Za-z0-9_-]{6,})/i,
  /(?:youtube\.com|youtube-nocookie\.com)\/embed\/([A-Za-z0-9_-]{6,})/i,
];
const VIMEO = /vimeo\.com\/(?:video\/)?(\d{6,})/i;
const IMG = /\.(png|jpe?g|gif|svg|webp|avif)(?:[?#].*)?$/i;

function labelFor(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const seg = u.pathname.split("/").filter(Boolean).slice(-1)[0] ?? "";
    const hint = decodeURIComponent(seg).replace(/[-_]/g, " ").slice(0, 40);
    return hint ? `${host} · ${hint}` : host;
  } catch {
    return url.replace(/^https?:\/\//, "").slice(0, 48);
  }
}

export function classifySource(url: string): ClassifiedSource {
  const label = labelFor(url);
  for (const re of YT) {
    const m = url.match(re);
    if (m) return { url, kind: "youtube", videoId: m[1], embedUrl: `https://www.youtube-nocookie.com/embed/${m[1]}`, label };
  }
  const vm = url.match(VIMEO);
  if (vm) return { url, kind: "vimeo", videoId: vm[1], embedUrl: `https://player.vimeo.com/video/${vm[1]}`, label };
  if (IMG.test(url)) return { url, kind: "image", label };
  return { url, kind: "page", label };
}
