"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useFocusTrap } from "@/ui/use-focus-trap";
import { parseBook, type BookSection } from "@/lib/book";
import { getProgress, setProgress, type BookRow } from "@/lib/book-store";
import { CodeBlock } from "@/ui/books/CodeBlock";
import { themeForGoal, worldVars } from "@/lib/subject-themes";
import { readableAccent } from "@/lib/accent";
import { cellById } from "@/lib/spines";

// The mini-book reader: full-screen, reading typography (EB Garamond body via .book-prose), tinted by
// the spine's WORLD, with a navigable TOC, the "pregunta raíz" up top, offline-highlighted code, and a
// visually-distinct Conexiones (it is expansion, not canon). Reading progress is device-local session
// state (scroll %), NEVER the log and NEVER mastery — reading is Phase 1 input, not a demonstration.

const MD = {
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const m = /language-(\w+)/.exec(className ?? "");
    return m ? <CodeBlock code={String(children)} lang={m[1]!} /> : <code className="book-code-inline">{children}</code>;
  },
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
  ),
};

export function BookReader({ book, onClose }: { book: BookRow; onClose: () => void }) {
  const parsed = useMemo(() => parseBook(book.md), [book.md]);
  const theme = themeForGoal(book.spine);
  const accent = theme.accent;
  const ink = readableAccent(accent);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);
  const saveTimer = useRef<number | undefined>(undefined);

  useFocusTrap(rootRef);
  useEffect(() => {
    void getProgress(book.id).then((p) => {
      if (p) setPct(p.scrollPct);
    });
  }, [book.id]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
    setPct(p);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void setProgress(book.id, { scrollPct: p, completed: p > 0.9 }), 500);
  }

  const cellTitle = book.moduleId ? cellById(book.moduleId)?.title ?? null : null;

  if (!parsed) {
    return (
      <div className="fixed inset-0 z-[75] grid place-items-center bg-ink p-6 text-center">
        <div>
          <p className="font-serif text-[14px] text-text-muted">Este .md no cumple el contrato de libro (falta frontmatter o título). No se inventa contenido.</p>
          <button onClick={onClose} className="mt-4 min-h-11 rounded-[var(--r-sm)] border border-line px-5 text-sm text-text-muted">Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={parsed.meta.title}
      tabIndex={-1}
      className="fixed inset-0 z-[75] flex flex-col outline-none"
      style={{ ...worldVars(theme), background: `linear-gradient(178deg, ${theme.bg2}, ${theme.bg})`, paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" } as CSSProperties}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      {/* top bar + reading progress */}
      <div className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-3 px-4">
        <button onClick={onClose} aria-label="Cerrar el libro" className="-ml-1 min-h-11 px-1 text-2xl leading-none text-text-faint transition hover:text-text">×</button>
        <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--world-fog) 80%, transparent)" }}>
          <div className="h-full origin-left rounded-full transition-transform duration-200" style={{ transform: `scaleX(${pct})`, background: accent }} />
        </div>
        {parsed.meta.readingMinutes != null && (
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-text-faint tnum">{parsed.meta.readingMinutes} min</span>
        )}
      </div>

      <main ref={scrollRef} onScroll={onScroll} className="scroll-touch mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-16 pt-4">
        {/* title block */}
        <div className="text-[10px] uppercase tracking-[0.28em] text-text-faint">{parsed.meta.spine} · lectura profunda</div>
        <h1 className="mt-1 font-display text-[26px] leading-tight" style={{ color: ink, textShadow: `0 0 20px ${theme.glow}` }}>{parsed.meta.title}</h1>
        {parsed.meta.subtitle && <p className="mt-1 font-serif text-[15px] italic text-text-muted">{parsed.meta.subtitle}</p>}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-wider text-text-faint">
          {cellTitle && <span>ancla · {cellTitle.slice(0, 40)}</span>}
          {parsed.meta.depth && <span>profundidad · {parsed.meta.depth}</span>}
          {parsed.meta.generatedBy && <span>{parsed.meta.generatedBy.slice(0, 40)}</span>}
        </div>

        {/* root question */}
        {parsed.rootQuestion && (
          <blockquote className="mt-4 rounded-[var(--r-md)] border-l-2 p-4" style={{ borderColor: accent, background: "color-mix(in srgb, var(--world-fog) 45%, transparent)" }}>
            <div className="text-[9px] uppercase tracking-[0.22em] text-text-faint">Pregunta raíz</div>
            <p className="mt-1 font-serif text-[16px] italic leading-snug text-text">{parsed.rootQuestion}</p>
          </blockquote>
        )}

        {/* TOC */}
        {parsed.toc.length > 1 && (
          <nav className="mt-4 rounded-[var(--r-sm)] border border-line p-3">
            <div className="text-[9px] uppercase tracking-[0.22em] text-text-faint">Índice</div>
            <ol className="mt-1.5 space-y-1">
              {parsed.toc.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => scrollRef.current?.querySelector(`#${CSS.escape(t.id)}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="min-h-8 text-left text-[13px] transition hover:underline"
                    style={{ color: t.kind === "connections" ? "var(--topic)" : "var(--text-muted)" }}
                  >
                    {t.kind === "connections" ? "↔ " : "· "}{t.title}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* lead prose (before the first ## / a headingless book) — preserved, never dropped */}
        {parsed.lead && (
          <div className="book-prose mt-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{parsed.lead}</ReactMarkdown>
          </div>
        )}

        {/* sections */}
        <div className="mt-6 space-y-6">
          {parsed.sections.map((s) => (
            <Section key={s.id} section={s} accent={accent} />
          ))}
        </div>

        <div className="mt-10 border-t border-line pt-3 text-center text-[10px] uppercase tracking-wider text-text-faint">
          fin · {parsed.wordCount} palabras{parsed.meta.version ? ` · ${parsed.meta.version}` : ""}
        </div>
      </main>
    </div>
  );
}

function Section({ section, accent }: { section: BookSection; accent: string }) {
  const isConnections = section.kind === "connections";
  return (
    <section
      id={section.id}
      className={isConnections ? "rounded-[var(--r-md)] border p-4" : ""}
      style={isConnections ? { borderColor: "color-mix(in srgb, var(--topic) 40%, var(--line))", background: "color-mix(in srgb, var(--topic) 6%, transparent)" } : undefined}
    >
      <h2 className="font-display text-[19px] leading-tight" style={{ color: isConnections ? "var(--topic)" : "var(--text)" }}>
        {isConnections ? "↔ " : ""}{section.title}
      </h2>
      {isConnections && <div className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-text-faint">expansión cross-domain · no es canon</div>}
      <div className="book-prose mt-2">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{section.markdown}</ReactMarkdown>
      </div>
    </section>
  );
}
