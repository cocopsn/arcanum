"use client";

// A video inside a book (design §13.1, §13.3): a typographic facade first (no request to Google before the click),
// then the privacy-enhanced player inside the same 16:9 box (≥ 200 px tall, YouTube's minimum). The id enters the
// URL only after the regex AND only if it is catalogued in videos.json (ids that appear in allowed sources, D1);
// anything else is a plain link marked «video externo», never an iframe. Monochrome (D4): only text tokens.
import { useState } from "react";
import videos from "@/forge/data/videos.json";
import { isAllowedFrameUrl } from "@/lib/csp.mjs";

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const CATALOGUED = new Set<string>(((videos as { youtube?: { id: string }[] }).youtube ?? []).map((v) => v.id));

/** The YouTube id of a book video link, only for the two exact forms of §13.1 (no other parameters); else null. */
export function youtubeIdFromHref(href: string | undefined | null): string | null {
  if (!href) return null;
  const m = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/.exec(href) ?? /^https:\/\/youtu\.be\/([A-Za-z0-9_-]{11})$/.exec(href);
  return m ? m[1]! : null;
}

export function isCataloguedVideo(id: string): boolean {
  return YT_ID.test(id) && CATALOGUED.has(id);
}

export function VideoEmbed({ id, label, href }: { id: string; label: string; href: string }) {
  const [playing, setPlaying] = useState(false);
  if (!isCataloguedVideo(id)) {
    return (
      <p data-video-fallback="">
        <a href={href} target="_blank" rel="noreferrer noopener">
          {label}
        </a>{" "}
        <span className="text-[12px] text-text-muted">· video externo</span>
      </p>
    );
  }
  const src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1`;
  return (
    <figure className="my-4 w-full" data-video={id}>
      <div className="relative w-full overflow-hidden border border-line bg-surface" style={{ aspectRatio: "16 / 9", minHeight: 200 }}>
        {playing && isAllowedFrameUrl(src) ? (
          <iframe
            src={src}
            title={label}
            className="absolute inset-0 h-full w-full"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col justify-between p-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Video · YouTube</div>
              <div className="mt-1 text-[15px] leading-snug text-text">{label}</div>
              <div className="mt-1 text-[11px] text-text-muted">Video no revisado</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setPlaying(true)} className="min-h-11 border border-text px-4 text-[13px] text-text">
                Reproducir aquí
              </button>
              <a href={href} target="_blank" rel="noreferrer noopener" className="text-[12px] text-text-muted underline underline-offset-2">
                Abrir en YouTube
              </a>
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
