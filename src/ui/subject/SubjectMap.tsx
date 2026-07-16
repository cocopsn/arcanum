"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useArcanum } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { useLayoutMode } from "@/ui/layout-mode";
import { orderTopics } from "@/lib/subject-path";
import { nodeStatus, type NodeStatus } from "@/core/roadmap";
import { themeForGoal, worldVars, type MotifId } from "@/lib/subject-themes";
import { readableAccent } from "@/lib/accent";
import { audio } from "@/lib/audio";
import { TopicDetailSheet } from "@/ui/subject/TopicDetailSheet";
import type { ModuleRM } from "@/core/read-model";

// THE WORLD-MAP — Duolingo bone (a clear serpentine path, the next step always obvious),
// Persona skin (each realm its own atmosphere; nodes are material SIGILS, not gray circles;
// fog-of-war for sealed territory). Engine untouched: nodeStatus/retrievability drive it all.
const W = 340; // mobile/PWA serpentine width (desktop widens it in SubjectMap)
const ROW_H = 116;
const AMP = 60;
const TOP = 56;

function MotifPattern({ id, motif, color }: { id: string; motif: MotifId; color: string }) {
  const s = { stroke: color, strokeWidth: 1.1, fill: "none", opacity: 0.5 } as const;
  if (motif === "circuit") {
    return (
      <pattern id={id} width="58" height="58" patternUnits="userSpaceOnUse">
        <path d="M4 29 H25 M33 29 H54 M29 4 V25 M29 33 V54" {...s} />
        <circle cx="29" cy="29" r="3.5" {...s} />
        <circle cx="4" cy="29" r="1.6" fill={color} opacity={0.5} />
      </pattern>
    );
  }
  if (motif === "runes") {
    return (
      <pattern id={id} width="54" height="66" patternUnits="userSpaceOnUse">
        <path d="M13 10 V42 M13 17 L23 25 M13 30 L23 22" {...s} />
        <path d="M38 32 V60 M38 38 L46 46 M38 54 L46 46" {...s} />
      </pattern>
    );
  }
  if (motif === "cipher") {
    return (
      <pattern id={id} width="50" height="50" patternUnits="userSpaceOnUse">
        <path d="M10 10 L24 24 M24 10 L10 24" {...s} />
        <path d="M38 6 V44 M30 38 H46" {...s} />
        <circle cx="38" cy="38" r="5" {...s} />
      </pattern>
    );
  }
  if (motif === "lattice") {
    return (
      <pattern id={id} width="46" height="46" patternUnits="userSpaceOnUse">
        <path d="M23 4 L42 23 L23 42 L4 23 Z" {...s} />
        <circle cx="23" cy="23" r="1.6" fill={color} opacity={0.45} />
      </pattern>
    );
  }
  return (
    <pattern id={id} width="42" height="42" patternUnits="userSpaceOnUse">
      <circle cx="21" cy="21" r="1.5" fill={color} opacity={0.4} />
    </pattern>
  );
}

const GLYPH: Record<NodeStatus, string> = { sealed: "", available: "❯", started: "◆", completed: "✦" };

/** A material SIGIL — a faceted octagon gem that charges by state. Not a generic circle. */
function TopicSigil({ status, retr, accent, metal }: { status: NodeStatus; retr: number; accent: string; metal: string }) {
  const sealed = status === "sealed";
  const completed = status === "completed";
  const r = 27;
  const c = 2 * Math.PI * r;
  const oct = Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    return `${(34 + 30 * Math.cos(a)).toFixed(1)},${(34 + 30 * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  const stroke = sealed ? "var(--world-fog)" : completed ? metal : accent;
  return (
    <svg viewBox="0 0 68 68" width={64} height={64} aria-hidden>
      <polygon points={oct} fill="none" stroke={stroke} strokeWidth={sealed ? 1.1 : 1.6} strokeLinejoin="round" opacity={sealed ? 0.7 : 0.9} />
      <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
      {!sealed && (
        <circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke={completed ? metal : accent}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={completed ? 0 : c * (1 - Math.max(0, Math.min(1, retr)))}
          transform="rotate(-90 34 34)"
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      )}
      <text
        x="34"
        y="34"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={status === "available" ? 18 : 16}
        fill={sealed ? "var(--world-fog)" : completed ? metal : accent}
        style={{ fontFamily: "var(--font-display)", opacity: sealed ? 0.5 : 1 }}
      >
        {GLYPH[status]}
      </text>
    </svg>
  );
}

function TopicBadge({
  topic,
  status,
  index,
  x,
  y,
  retr,
  accent,
  metal,
  onOpen,
}: {
  topic: ModuleRM;
  status: NodeStatus;
  index: number;
  /** horizontal centre (px) — widens on desktop so the serpentine uses the screen */
  x: number;
  /** vertical position (px) */
  y: number;
  retr: number;
  accent: string;
  metal: string;
  onOpen: () => void;
}) {
  const sealed = status === "sealed";
  const started = status === "started";
  return (
    <button
      onClick={onOpen}
      className="topic-badge absolute flex -translate-x-1/2 flex-col items-center gap-2"
      style={
        {
          left: x,
          top: y,
          ["--accent" as string]: accent,
          animationDelay: `${Math.min(index * 55, 640)}ms`,
        } as CSSProperties
      }
      data-status={status}
      aria-label={`${topic.title} — ${status}`}
    >
      <span className="topic-disc relative grid h-[64px] w-[64px] place-items-center rounded-[var(--r-md)]">
        <TopicSigil status={status} retr={retr} accent={accent} metal={metal} />
        {started && <span className="topic-pulse" style={{ background: accent }} aria-hidden />}
      </span>
      <span
        className="max-w-[136px] text-center font-serif text-[12px] leading-tight"
        style={
          sealed
            ? { filter: "blur(3.5px)", opacity: 0.5, userSelect: "none", color: "var(--text-muted)" }
            : { color: "var(--text)" }
        }
      >
        {topic.title}
      </span>
    </button>
  );
}

export function SubjectMap({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const readModel = useArcanum((s) => s.readModel);
  const vmModules = useArcanum((s) => s.viewModel.modules);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !detailId) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId, onClose]);

  const goal = readModel.goals.find((g) => g.id === goalId) ?? null;
  const theme = themeForGoal(goal?.title ?? "");
  const accent = theme.accent;
  const metal = theme.accent2;

  // PATHS — parallel routes inside this world, each with its OWN cells + fog-of-war. The row is shown
  // whenever the world has paths: with one it names the route and offers the "+" gesture to spawn a
  // second (the Ciberseguridad case). Switching the path switches the map AND its fog-of-war.
  const paths = useMemo(
    () => readModel.paths.filter((p) => p.goalId === goalId && !p.archived).sort((a, b) => a.order - b.order),
    [readModel.paths, goalId],
  );
  const [pathId, setPathId] = useState<string | null>(null);
  const activePathId = pathId && paths.some((p) => p.id === pathId) ? pathId : (paths[0]?.id ?? null);
  const defaultPathId = paths[0]?.id ?? null;
  const showPaths = paths.length > 0;
  const { createPath, createModule } = useActions();
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [cellOpen, setCellOpen] = useState(false);
  const [cellTitle, setCellTitle] = useState("");

  // the realm's ambient drone follows the open world (silent unless the user enables music)
  useEffect(() => {
    audio.setWorld(theme.slug);
    return () => audio.setWorld(null);
  }, [theme.slug]);

  const topics = useMemo(() => {
    // the ACTIVE path's cells — switching the path switches the map AND its fog-of-war (nodeStatus
    // resolves prereqs strictly within the cell's own path). Legacy pathId===null cells (created before
    // paths existed) surface under the DEFAULT path so nothing the user made ever vanishes.
    const mods = readModel.modules.filter(
      (m) => m.goalId === goalId && (activePathId === null || m.pathId === activePathId || (m.pathId === null && activePathId === defaultPathId)),
    );
    return orderTopics(mods, readModel.edges);
  }, [readModel.modules, readModel.edges, goalId, activePathId, defaultPathId]);

  const byId = useMemo(() => new Map(readModel.modules.map((m) => [m.id, m])), [readModel.modules]);
  const retrOf = useMemo(() => new Map(vmModules.map((m) => [m.id, m.retrievability])), [vmModules]);

  // DESKTOP — widen the serpentine so it uses the horizontal space instead of a narrow column marooned in
  // the middle of a wide screen (the "encajonado" complaint). The vertical rhythm is unchanged; only the
  // width + swing grow. Mobile/PWA keeps the tuned iPhone-first geometry.
  const desktop = useLayoutMode().mode === "desktop";
  const w = desktop ? 760 : W;
  const cx = w / 2;
  const amp = desktop ? 210 : AMP;
  const wave = [0, amp, 0, -amp];
  const xOf = (i: number) => cx + wave[i % wave.length]!;

  const height = TOP + topics.length * ROW_H + 96;
  const motifId = `motif-${theme.slug}`;
  const connectorD = topics.map((_, i) => `${i === 0 ? "M" : "L"} ${xOf(i)} ${TOP + i * ROW_H + 32}`).join(" ");

  if (!goal) return null;

  return (
    <div className="fixed inset-0 z-50" style={worldVars(theme)}>
      {/* ── realm atmosphere — layered, not a flat colour ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(170deg, var(--world-bg) 0%, var(--world-bg-2) 100%)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 50% at 50% -8%, var(--world-glow), transparent 58%)", opacity: 0.5 }} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(140% 80% at 50% 120%, rgba(0,0,0,0.55), transparent 55%)" }} />

      {/* extra top room when the path toggle is present, so it never overlaps the first cells */}
      <div className="scroll-touch relative h-full overflow-y-auto" style={{ paddingTop: showPaths ? "max(8.5rem, calc(env(safe-area-inset-top) + 7.5rem))" : "max(5.5rem, calc(env(safe-area-inset-top) + 4.5rem))" }}>
        <div className="relative mx-auto" style={{ height, width: w }}>
          <svg className="pointer-events-none absolute inset-0" width={w} height={height} viewBox={`0 0 ${w} ${height}`} aria-hidden>
            <defs>
              <MotifPattern id={motifId} motif={theme.motif} color={accent} />
            </defs>
            <rect width={w} height={height} fill={`url(#${motifId})`} opacity={0.12} />
            <path d={connectorD} fill="none" stroke={accent} strokeOpacity={0.28} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 13" />
          </svg>

          {topics.map((t, i) => (
            <TopicBadge
              key={t.id}
              topic={t}
              index={i}
              x={xOf(i)}
              y={TOP + i * ROW_H}
              status={nodeStatus(t, readModel.edges, byId)}
              retr={retrOf.get(t.id) ?? 0}
              accent={accent}
              metal={metal}
              onOpen={() => {
                audio.unlock();
                audio.sfx("click");
                setDetailId(t.id);
              }}
            />
          ))}
          {topics.length === 0 && (
            <div className="absolute inset-x-0 px-6 text-center" style={{ top: TOP + 8 }}>
              <p className="font-serif text-[13px] leading-snug text-text-muted">
                Este path aún no tiene celdas. Agrégalas con <span style={{ color: readableAccent(accent) }}>«+ celda»</span> arriba, o llegarán después por ingesta de libros anclados a este path (milla aparte). Nada se inventa aquí.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── PATH switcher — parallel routes over the same territory, each with su propio fog-of-war.
             Shown whenever the world has paths (with one, it names the route + offers "+" to spawn a
             second). Plain buttons with aria-pressed — it isn't a full ARIA tab widget, so it doesn't
             claim to be one. "+ celda" adds a cell to the ACTIVE path so a created path is never a
             dead end (it goes through the path-aware createModule → real fog-of-war). ── */}
      {showPaths && (
        <div
          className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-2 px-4"
          style={{ top: "max(5.4rem, calc(env(safe-area-inset-top) + 4.4rem))" }}
        >
          <div
            role="group"
            aria-label="Paths"
            className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-[var(--r-pill)] border p-1 backdrop-blur-sm"
            style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, var(--line))", background: "rgba(0,0,0,0.35)" }}
          >
            {paths.map((p) => {
              const on = p.id === activePathId;
              return (
                <button
                  key={p.id}
                  aria-pressed={on}
                  title={p.description}
                  onClick={() => {
                    audio.unlock();
                    audio.sfx("click");
                    setPathId(p.id);
                    setCellOpen(false);
                  }}
                  className="min-h-9 shrink-0 rounded-[var(--r-pill)] px-3 text-[11px] uppercase tracking-[0.14em] transition"
                  style={{
                    color: on ? readableAccent(accent) : "var(--text-faint)",
                    background: on ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent",
                  }}
                >
                  {p.name}
                </button>
              );
            })}
            <button
              onClick={() => { setCellOpen((v) => !v); setNewOpen(false); }}
              aria-label="Añadir una celda a este path"
              aria-expanded={cellOpen}
              className="min-h-9 shrink-0 rounded-[var(--r-pill)] px-2 text-[10px] uppercase tracking-wider leading-none transition"
              style={{ color: "var(--text-faint)" }}
            >
              + celda
            </button>
            <button
              onClick={() => { setNewOpen((v) => !v); setCellOpen(false); }}
              aria-label="Crear un path nuevo"
              aria-expanded={newOpen}
              className="min-h-9 min-w-9 shrink-0 rounded-[var(--r-pill)] text-[13px] leading-none transition"
              style={{ color: "var(--text-faint)" }}
            >
              +
            </button>
          </div>

          {cellOpen && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const title = cellTitle.trim();
                if (!title || !activePathId) return;
                await createModule(goalId, title, activePathId); // path-aware → born in THIS path
                setCellTitle("");
                setCellOpen(false);
              }}
              className="pointer-events-auto w-full max-w-[320px] rounded-[var(--r-md)] border p-2 backdrop-blur-sm"
              style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, var(--line))", background: "rgba(0,0,0,0.5)" }}
            >
              <input
                value={cellTitle}
                onChange={(e) => setCellTitle(e.target.value)}
                placeholder="Título de la celda"
                aria-label="Título de la celda"
                className="min-h-11 w-full rounded-[var(--r-sm)] border border-line bg-surface px-3 text-[13px] text-text placeholder:text-text-faint focus:outline-none"
              />
              <button
                type="submit"
                disabled={!cellTitle.trim()}
                className="mt-1 min-h-11 w-full rounded-[var(--r-sm)] border text-[11px] uppercase tracking-[0.16em] transition disabled:opacity-40"
                style={{ borderColor: accent, color: readableAccent(accent) }}
              >
                Añadir celda
              </button>
              <p className="mt-1 text-[10px] leading-snug text-text-faint">
                Nace en este path, con su propio fog-of-war. Su contenido y gate se cargan al abrirla.
              </p>
            </form>
          )}

          {newOpen && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const name = newName.trim();
                if (!name) return;
                const id = await createPath(goalId, name, newDesc);
                setNewName("");
                setNewDesc("");
                setNewOpen(false);
                setPathId(id); // land on the path you just created
              }}
              className="pointer-events-auto w-full max-w-[320px] rounded-[var(--r-md)] border p-2 backdrop-blur-sm"
              style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, var(--line))", background: "rgba(0,0,0,0.5)" }}
            >
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre del path (ej. CompTIA Security+)"
                aria-label="Nombre del path"
                className="min-h-11 w-full rounded-[var(--r-sm)] border border-line bg-surface px-3 text-[13px] text-text placeholder:text-text-faint focus:outline-none"
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Descripción (opcional)"
                aria-label="Descripción del path"
                className="mt-1 min-h-11 w-full rounded-[var(--r-sm)] border border-line bg-surface px-3 text-[13px] text-text placeholder:text-text-faint focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                className="mt-1 min-h-11 w-full rounded-[var(--r-sm)] border text-[11px] uppercase tracking-[0.16em] transition disabled:opacity-40"
                style={{ borderColor: accent, color: readableAccent(accent) }}
              >
                Crear path
              </button>
              <p className="mt-1 text-[10px] leading-snug text-text-faint">
                Nace vacío y con su propio fog-of-war. El progreso no cruza: aquí los gates se ganan de nuevo.
              </p>
            </form>
          )}
        </div>
      )}

      {/* ── realm header — the crest, the temper, the name ── */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <button
          onClick={onClose}
          className="pointer-events-auto min-h-11 rounded-[var(--r-pill)] border px-4 text-[11px] uppercase tracking-[0.2em] backdrop-blur-sm transition"
          style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, var(--line))", color: "var(--text-muted)", background: "rgba(0,0,0,0.25)" }}
        >
          ‹ Salir
        </button>
        <div className="text-center">
          <div className="text-[9px] uppercase tracking-[0.34em] text-text-faint">{theme.temper}</div>
          <div className="font-display text-lg leading-none tracking-[0.14em]" style={{ color: readableAccent(accent) }}>
            {goal.title}
          </div>
          <div className="mt-1 max-w-[200px] font-serif text-[11px] italic leading-snug text-text-muted">{theme.tagline}</div>
        </div>
        <span aria-hidden className="grid min-h-11 min-w-11 place-items-center font-display text-2xl" style={{ color: accent, textShadow: "0 0 16px var(--world-glow)" }}>
          {theme.glyph}
        </span>
      </header>

      {detailId && <TopicDetailSheet key={detailId} moduleId={detailId} accent={accent} onClose={() => setDetailId(null)} />}
    </div>
  );
}
