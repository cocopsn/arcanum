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
import { bookToSpeech, INTRO_SECTION } from "@/lib/book-speech";
import { useBookSpeech, type BookSpeechState } from "@/lib/speech";
import { AudioAnchor } from "@/lib/audio-anchor";
import { bindAudiobookMediaSession, setAudiobookMetadata, setAudiobookPlaybackState } from "@/lib/media-session";
import { saveResume } from "@/lib/resume";
import { audio, type AudioConfig } from "@/lib/audio";

// The mini-book reader: full-screen, reading typography (EB Garamond body via .book-prose), tinted by the
// spine's WORLD, with a navigable TOC, the "pregunta raíz" up top, offline-highlighted code, and a visually-
// distinct Conexiones. Reading + LISTENING progress are device-local session state, NEVER the log and NEVER
// mastery — reading/listening are Phase-1 input (passive absorption), not a demonstration. The AUDIOBOOK
// (Escuchar) reads the book with the device's offline voices; code is announced, never read literally.

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

  // audio config (voice / rate / code-mode) — device-local, shared with the global audio panel
  const [cfg, setCfg] = useState<AudioConfig>(() => audio.getConfig());
  useEffect(() => audio.subscribe(setCfg), []);

  // resume: an open reader survives a reload (the podcast case: reconnecting mid-listen used to
  // reboot the app to home — now boot reopens THIS book, and the stored listen index resumes the
  // fragment). Deliberate close runs the cleanup and clears; reloads never run cleanups.
  useEffect(() => {
    saveResume({ bookId: book.id });
    return () => saveResume({ bookId: null });
  }, [book.id]);
  const items = useMemo(() => (parsed ? bookToSpeech(parsed, { codeMode: cfg.ttsCodeMode }) : []), [parsed, cfg.ttsCodeMode]);
  const listenTimer = useRef<number | undefined>(undefined);
  const player = useBookSpeech(items, {
    rate: cfg.ttsRate,
    voiceURI: cfg.ttsVoiceURI || null,
    onIndex: (i) => {
      // remember where the listener is — device-local, debounced, NEVER the log
      window.clearTimeout(listenTimer.current);
      listenTimer.current = window.setTimeout(() => void setProgress(book.id, { listenIndex: i }), 800);
    },
  });
  const [showPlayer, setShowPlayer] = useState(false);

  // latest-player ref → the media-session handlers (bound ONCE per book) always drive the live hook
  const playerRef = useRef(player);
  playerRef.current = player;
  // the silent AUDIO ANCHOR that holds OS audio focus while speech plays (lock-screen controls +
  // background survival where the platform allows). Created lazily ON a user gesture (autoplay rules).
  const anchorRef = useRef<AudioAnchor | null>(null);
  const armAnchor = () => {
    anchorRef.current ??= new AudioAnchor();
    void anchorRef.current.start();
  };

  useFocusTrap(rootRef);
  useEffect(() => {
    void getProgress(book.id).then((p) => {
      if (!p) return;
      setPct(p.scrollPct);
      if (typeof p.listenIndex === "number" && p.listenIndex > 0) player.goTo(p.listenIndex); // resume where the audio was
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  // follow the audio with your eyes (or close them): highlight + smooth-scroll to the section being read
  useEffect(() => {
    if (!player.playing) return;
    const reduce = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    const id = player.sectionId;
    if (id && id !== INTRO_SECTION) {
      (scrollRef.current?.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null)?.scrollIntoView({ behavior, block: "start" });
    } else {
      scrollRef.current?.scrollTo({ top: 0, behavior });
    }
  }, [player.sectionId, player.playing]);

  // MEDIA SESSION — real lock-screen controls, anchored to the silent audio element. Bound ONCE per
  // book via the shared module (play/pause + section skips + ±3-fragment seeks); unbound + anchor torn
  // down when the reader closes, so a dead reader never keeps lock-screen buttons or audio focus alive.
  // Honest platform limits (stated in the UI too): Android/desktop keep speaking with the screen off;
  // iOS may still cut speechSynthesis on lock — Media Session helps, it does not override the OS.
  useEffect(() => {
    if (!parsed) return;
    const unbind = bindAudiobookMediaSession({
      play: () => {
        setShowPlayer(true);
        void anchorRef.current?.start(); // lock-screen play carries user activation on Android
        playerRef.current.play();
      },
      pause: () => playerRef.current.pause(),
      nextSection: () => playerRef.current.next(),
      prevSection: () => playerRef.current.prev(),
      seekForward: () => playerRef.current.goTo(playerRef.current.index + 3),
      seekBackward: () => playerRef.current.goTo(playerRef.current.index - 3),
    });
    return () => {
      unbind();
      anchorRef.current?.stop();
    };
  }, [parsed]);

  // lock-screen metadata follows the reading: book title · current section · spine + PWA artwork
  useEffect(() => {
    if (!parsed || !showPlayer) return;
    const sec =
      !player.sectionId || player.sectionId === INTRO_SECTION
        ? "Portada"
        : parsed.toc.find((t) => t.id === player.sectionId)?.title ?? "Lectura";
    setAudiobookMetadata({
      title: parsed.meta.title,
      section: sec,
      spine: parsed.meta.spine || book.spine || "ARCANUM",
      artwork: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
  }, [parsed, showPlayer, player.sectionId, book.spine]);

  // playback state + anchor follow the player: playing re-arms the anchor, pausing HOLDS it (the
  // element stays → the lock screen keeps showing paused controls instead of vanishing)
  useEffect(() => {
    if (!showPlayer) return;
    setAudiobookPlaybackState(player.playing ? "playing" : "paused");
    if (player.playing) void anchorRef.current?.start();
    else anchorRef.current?.hold();
  }, [player.playing, showPlayer]);

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

  const speaking = player.playing ? player.sectionId : null;

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
      {/* top bar: close · Escuchar · reading progress */}
      <div className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-2 px-4">
        <button onClick={onClose} aria-label="Cerrar el libro" className="-ml-1 min-h-11 px-1 text-2xl leading-none text-text-faint transition hover:text-text">×</button>
        {player.supported && (
          <button
            onClick={() => {
              if (!showPlayer) {
                setShowPlayer(true);
                armAnchor(); // the tap is the user gesture: it arms speech AND the audio-focus anchor
                player.play();
              } else if (player.playing) {
                player.pause();
              } else {
                armAnchor();
                player.play();
              }
            }}
            aria-pressed={showPlayer}
            aria-label="Escuchar el libro"
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--r-pill)] border px-3 text-[12px] transition"
            style={{ borderColor: showPlayer ? accent : "var(--line)", color: showPlayer ? ink : "var(--text-muted)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 14v-3a9 9 0 0 1 18 0v3" />
              <path d="M21 16.5a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2zM3 16.5a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2z" />
            </svg>
            {showPlayer && player.playing ? "Escuchando" : "Escuchar"}
          </button>
        )}
        <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--world-fog) 80%, transparent)" }}>
          <div className="h-full origin-left rounded-full transition-transform duration-200" style={{ transform: `scaleX(${pct})`, background: accent }} />
        </div>
        {parsed.meta.readingMinutes != null && (
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-text-faint tnum">{parsed.meta.readingMinutes} min</span>
        )}
      </div>

      <main ref={scrollRef} onScroll={onScroll} className="scroll-touch mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-16 pt-4">
        <div className="text-[10px] uppercase tracking-[0.28em] text-text-faint">{parsed.meta.spine} · lectura profunda</div>
        <h1 className="mt-1 font-display text-[26px] leading-tight" style={{ color: ink, textShadow: `0 0 20px ${theme.glow}` }}>{parsed.meta.title}</h1>
        {parsed.meta.subtitle && <p className="mt-1 font-serif text-[15px] italic text-text-muted">{parsed.meta.subtitle}</p>}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-wider text-text-faint">
          {cellTitle && <span>ancla · {cellTitle.slice(0, 40)}</span>}
          {parsed.meta.depth && <span>profundidad · {parsed.meta.depth}</span>}
          {parsed.meta.generatedBy && <span>{parsed.meta.generatedBy.slice(0, 40)}</span>}
        </div>

        {parsed.rootQuestion && (
          <blockquote className="mt-4 rounded-[var(--r-md)] border-l-2 p-4" style={{ borderColor: accent, background: "color-mix(in srgb, var(--world-fog) 45%, transparent)" }}>
            <div className="text-[9px] uppercase tracking-[0.22em] text-text-faint">Pregunta raíz</div>
            <p className="mt-1 font-serif text-[16px] italic leading-snug text-text">{parsed.rootQuestion}</p>
          </blockquote>
        )}

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

        {parsed.lead && (
          <div className="book-prose mt-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>{parsed.lead}</ReactMarkdown>
          </div>
        )}

        <div className="mt-6 space-y-6">
          {parsed.sections.map((s) => (
            <Section key={s.id} section={s} accent={accent} speaking={s.id === speaking} />
          ))}
        </div>

        <div className="mt-10 border-t border-line pt-3 text-center text-[10px] uppercase tracking-wider text-text-faint">
          fin · {parsed.wordCount} palabras{parsed.meta.version ? ` · ${parsed.meta.version}` : ""}
        </div>
      </main>

      {player.supported && showPlayer && (
        <PlayerBar
          player={player}
          rate={cfg.ttsRate}
          accent={accent}
          total={items.length}
          onPlay={() => {
            armAnchor(); // the transport tap is a user gesture too — re-arm focus before speaking
            player.play();
          }}
          onStop={() => {
            player.stop();
            anchorRef.current?.hold();
            setAudiobookPlaybackState("none");
            setShowPlayer(false);
          }}
        />
      )}
    </div>
  );
}

function Section({ section, accent, speaking }: { section: BookSection; accent: string; speaking: boolean }) {
  const isConnections = section.kind === "connections";
  const base = isConnections ? "rounded-[var(--r-md)] border p-4" : "";
  return (
    <section
      id={section.id}
      className={`${base} scroll-mt-4 transition-[box-shadow,background] duration-300`}
      style={{
        ...(isConnections
          ? { borderColor: "color-mix(in srgb, var(--topic) 40%, var(--line))", background: "color-mix(in srgb, var(--topic) 6%, transparent)" }
          : {}),
        ...(speaking
          ? { boxShadow: `-3px 0 0 ${accent}`, background: "color-mix(in srgb, var(--world-fog) 30%, transparent)", borderRadius: "var(--r-md)", padding: "0.75rem 0.75rem 0.75rem 1rem", marginLeft: "-0.5rem" }
          : {}),
      }}
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

/** The audiobook transport, tinted by the world. Fixed to the bottom, iPhone-first. */
function PlayerBar({ player, rate, accent, total, onPlay, onStop }: { player: BookSpeechState; rate: number; accent: string; total: number; onPlay: () => void; onStop: () => void }) {
  const ink = readableAccent(accent);
  const btn = "grid min-h-11 min-w-11 place-items-center rounded-[var(--r-pill)] text-text-muted transition hover:text-text";
  return (
    <div
      role="group"
      aria-label="Reproductor de audiolibro"
      className="mx-auto w-full max-w-2xl shrink-0 border-t px-4 pt-2"
      style={{ borderColor: "color-mix(in srgb, var(--world-fog) 70%, var(--line))", background: "color-mix(in srgb, var(--world-fog) 22%, transparent)" }}
    >
      <div className="flex items-center gap-1">
        <button className={btn} aria-label="Sección anterior" onClick={player.prev}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
        </button>
        <button
          className="grid min-h-12 min-w-12 place-items-center rounded-full border-2 transition"
          style={{ borderColor: accent, color: ink }}
          aria-label={player.playing ? "Pausar" : "Reproducir"}
          onClick={() => (player.playing ? player.pause() : onPlay())}
        >
          {player.playing ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <button className={btn} aria-label="Sección siguiente" onClick={player.next}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" /></svg>
        </button>
        <button className={btn} aria-label="Detener" onClick={onStop}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[11px] text-text-faint" htmlFor="tts-rate">Vel.</label>
          <input
            id="tts-rate"
            type="range"
            min={0.75}
            max={2}
            step={0.05}
            value={rate}
            onChange={(e) => audio.setConfig({ ttsRate: Number(e.target.value) })}
            aria-label="Velocidad de lectura"
            className="w-24 accent-[color:var(--accent)]"
            style={{ accentColor: accent }}
          />
          <span className="tnum w-10 text-right text-[11px] text-text-muted">{rate.toFixed(2)}×</span>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between pb-1 text-[10px] text-text-faint">
        <span className="tnum">{Math.min(player.index + 1, total)} / {total}</span>
        {/* honest platform limits — Media Session + the audio anchor keep background playback where
            the OS allows; iOS throttles speechSynthesis on lock and may still cut it */}
        <span>voz del dispositivo · offline · Android/desktop sigue en bloqueo · iPhone: pantalla encendida</span>
      </div>
    </div>
  );
}
