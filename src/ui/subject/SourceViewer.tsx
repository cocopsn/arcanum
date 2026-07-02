"use client";

import { useState } from "react";
import { classifySource } from "@/lib/source-kind";
import { diagramFor } from "@/ui/subject/ConceptDiagram";
import { getOfflineSource } from "@/lib/offline-store";
import { readableAccent } from "@/lib/accent";
import type { ExtractedBlock } from "@/lib/extract";

// The WEB VIEWER — content comes INTO Arcanum honestly, per what the origin permits:
//   video   → official privacy-player embed (youtube-nocookie / vimeo) — real, plays in the lesson
//   image   → rendered directly
//   diagram → a hand-authored SVG abstraction of the concept (zero API cost)
//   page    → server-side fetch + extraction (rendered themed inside); NEVER a forced iframe that
//             the origin blocks. If extraction is thin / fails → honest preview + "abrir fuente".
// Each resource DECLARES what it did. Zero broken viewer.

interface FetchResult {
  mode: "extracted" | "thin" | "error";
  framable?: boolean;
  title?: string;
  blocks?: ExtractedBlock[];
  wordCount?: number;
  reason?: string;
  sourceUrl: string;
}

export function SourceViewer({ cellTitle, sources, accent }: { cellTitle: string; sources: string[]; accent: string }) {
  const diagram = diagramFor(cellTitle);
  return (
    <div className="space-y-3">
      {diagram}
      {sources.length === 0 && <p className="text-[12px] text-text-faint">Esta celda no tiene fuentes ancladas.</p>}
      {sources.map((url) => (
        <SourceItem key={url} url={url} accent={accent} />
      ))}
    </div>
  );
}

function OpenLink({ url, accent, label }: { url: string; accent: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex min-h-11 items-center text-[12px] transition hover:underline"
      style={{ color: readableAccent(accent) }}
    >
      {label ?? "Abrir la fuente"} ↗
    </a>
  );
}

function SourceItem({ url, accent }: { url: string; accent: string }) {
  const c = classifySource(url);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);

  async function bringInside() {
    if (result || fetching) {
      setOpen((v) => !v);
      return;
    }
    setFetching(true);
    setOpen(true);
    try {
      // OFFLINE-FIRST: a downloaded spine cached this extraction → read it locally, no network
      const cached = await getOfflineSource(url);
      if (cached) {
        setResult({ ...(cached as FetchResult), sourceUrl: url });
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setResult({ mode: "error", reason: "offline-not-downloaded", sourceUrl: url });
        return;
      }
      const r = await fetch(`/api/fetch-source?url=${encodeURIComponent(url)}`).then((res) => res.json());
      setResult(r as FetchResult);
    } catch {
      setResult({ mode: "error", reason: "network", sourceUrl: url });
    } finally {
      setFetching(false);
    }
  }

  const tag = (t: string) => (
    <span className="rounded-[var(--r-xs,4px)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider" style={{ color: readableAccent(accent), background: `color-mix(in srgb, ${accent} 12%, transparent)` }}>
      {t}
    </span>
  );

  // ── VIDEO — real embed ──
  if ((c.kind === "youtube" || c.kind === "vimeo") && c.embedUrl) {
    return (
      <div className="rounded-[var(--r-sm)] border border-line p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-[12px] text-text-muted">{c.label}</span>
          {tag("video · embebido")}
        </div>
        {open ? (
          <div className="overflow-hidden rounded-[var(--r-xs,4px)] border border-line" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              src={c.embedUrl}
              title={c.label}
              className="h-full w-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <button onClick={() => setOpen(true)} className="min-h-11 w-full rounded-[var(--r-sm)] border px-3 text-[13px] transition hover:brightness-125" style={{ borderColor: accent, color: readableAccent(accent) }}>
            ▶ Reproducir aquí
          </button>
        )}
      </div>
    );
  }

  // ── IMAGE — direct render ──
  if (c.kind === "image") {
    return (
      <div className="rounded-[var(--r-sm)] border border-line p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-[12px] text-text-muted">{c.label}</span>
          {tag("imagen")}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={c.label} loading="lazy" className="h-auto w-full rounded-[var(--r-xs,4px)] border border-line" />
      </div>
    );
  }

  // ── PAGE — server-side fetch + extraction (honest embed-vs-open) ──
  return (
    <div className="rounded-[var(--r-sm)] border border-line p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-[12px] text-text-muted">{c.label}</span>
        {result
          ? tag(
              result.mode === "extracted"
                ? "página · dentro"
                : result.mode === "thin" && result.framable
                  ? "página · iframe dentro"
                  : result.mode === "thin"
                    ? "preview · abre fuera"
                    : "abre fuera",
            )
          : tag("página")}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => void bringInside()} disabled={fetching} className="min-h-11 rounded-[var(--r-sm)] border px-3 text-[13px] transition hover:brightness-125 disabled:opacity-40" style={{ borderColor: accent, color: readableAccent(accent) }}>
          {fetching ? "Trayendo…" : result ? (open ? "Ocultar" : "Ver dentro") : "Ver dentro"}
        </button>
        <OpenLink url={url} accent={accent} />
      </div>

      {open && result && (
        <div className="mt-3">
          {result.mode === "extracted" && result.blocks ? (
            <ExtractedView title={result.title} blocks={result.blocks} accent={accent} />
          ) : result.mode === "thin" && result.framable ? (
            // extraction was thin (JS-rendered) BUT the origin permits framing → embed the REAL page inside
            <div>
              <div className="overflow-hidden rounded-[var(--r-sm)] border border-line bg-white" style={{ height: "56vh" }}>
                <iframe src={url} title={result.title ?? url} className="h-full w-full" loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-text-faint">Página real embebida · el origen permite iframe</div>
            </div>
          ) : result.mode === "thin" ? (
            <div className="rounded-[var(--r-sm)] border border-dashed border-line bg-surface p-3">
              {result.title && <div className="font-serif text-[14px] text-text">{result.title}</div>}
              <p className="mt-1 text-[12px] leading-snug text-text-muted">
                Esta fuente se renderiza con JavaScript y su origen bloquea el iframe — no se puede traer limpio ni embeber. Ábrela para verla completa (honesto, no finjo un embed roto).
              </p>
              {(result.blocks ?? []).filter((b) => b.type === "p").slice(0, 2).map((b, i) => (
                <p key={i} className="mt-2 text-[12px] leading-relaxed text-text-muted">{b.text}</p>
              ))}
            </div>
          ) : result.reason === "offline-not-downloaded" ? (
            <p className="text-[12px] text-text-muted">Sin conexión y esta fuente no está descargada. Descarga la espina con red (botón «Descargar para offline») para leerla en el avión, o reconéctate.</p>
          ) : (
            <p className="text-[12px] text-text-muted">No se pudo traer la página ({result.reason ?? "error"}). Ábrela en su sitio.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ExtractedView({ title, blocks, accent }: { title?: string; blocks: ExtractedBlock[]; accent: string }) {
  return (
    <div className="scroll-touch max-h-[52vh] overflow-y-auto rounded-[var(--r-sm)] border border-line bg-ink p-3">
      {title && <h4 className="font-display text-[15px] leading-tight text-text">{title}</h4>}
      <div className="mt-2 space-y-2">
        {blocks.map((b, i) => {
          if (b.type === "h") return <div key={i} className="mt-2 font-serif text-[14px] font-semibold text-text">{b.text}</div>;
          if (b.type === "p") return <p key={i} className="font-serif text-[13px] leading-relaxed text-text-muted">{b.text}</p>;
          if (b.type === "code") return <pre key={i} className="scroll-touch overflow-x-auto rounded-[var(--r-xs,4px)] border border-line bg-surface p-2 font-mono text-[11px] text-text">{b.text}</pre>;
          if (b.type === "img" && b.src) return (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={b.src} alt={b.alt ?? ""} loading="lazy" className="h-auto w-full rounded-[var(--r-xs,4px)] border border-line" />
          );
          return null;
        })}
      </div>
      <div className="mt-2 border-t border-line pt-2 text-[10px] uppercase tracking-wider text-text-faint">Extraído de la fuente real · <span style={{ color: readableAccent(accent) }}>dentro de Arcanum</span></div>
    </div>
  );
}
