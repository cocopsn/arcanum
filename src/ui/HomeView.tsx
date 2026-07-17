"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence } from "framer-motion";
import { useArcanum, useArcanumStore } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { RankAura } from "@/ui/RankAura";
import { GradeSigil } from "@/ui/GradeSigil";
import { StreakFlame } from "@/ui/StreakFlame";
import { XpBurst } from "@/ui/XpBurst";
import { RitoDelDia } from "@/ui/RitoDelDia";
import { SyncStatus } from "@/ui/SyncStatus";
import { OfflinePill, OfflineSheet } from "@/ui/OfflineStatus";
import { AiQueueDrain } from "@/ui/AiQueueDrain";
import { AuthSheet } from "@/ui/AuthSheet";
import { CodiceSheet } from "@/ui/CodiceSheet";
import { NotesModule } from "@/ui/notes/NotesModule";
import { BooksLibrary } from "@/ui/books/BooksLibrary";
import { VigiliaSheet } from "@/ui/VigiliaSheet";
import { AscensionCeremony } from "@/ui/AscensionCeremony";
import { RoadmapCanvas } from "@/ui/roadmap/RoadmapCanvas";
import { SubjectMap } from "@/ui/subject/SubjectMap";
import { AgendaSheet } from "@/ui/AgendaSheet";
import { InstallCoachMark } from "@/ui/InstallCoachMark";
import { AudioConfig } from "@/ui/AudioConfig";
import { themeForGoal, worldVars } from "@/lib/subject-themes";
import { readableAccent } from "@/lib/accent";
import { audio } from "@/lib/audio";
import { useLayoutMode } from "@/ui/layout-mode";
import { LayoutToggle } from "@/ui/LayoutToggle";
import { getSupabase } from "@/sync/client";
import { isMastered, nodeStatus } from "@/core/roadmap";
import type { ReadModel, Stats } from "@/core/read-model";
import type { ViewModel } from "@/core/present";

export function HomeView() {
  const status = useArcanum((s) => s.status);
  const readModel = useArcanum((s) => s.readModel);
  const viewModel = useArcanum((s) => s.viewModel);
  const ceremony = useArcanum((s) => s.ceremonyQueue[0] ?? null);
  const store = useArcanumStore();
  const [authOpen, setAuthOpen] = useState(false);
  const [codiceOpen, setCodiceOpen] = useState(false);
  const [notes, setNotes] = useState<{ open: boolean; moduleId: string | null }>({
    open: false,
    moduleId: null,
  });
  const [vigiliaOpen, setVigiliaOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [booksOpen, setBooksOpen] = useState(false);
  const [subjectGoal, setSubjectGoal] = useState<string | null>(null);

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center font-display text-sm tracking-[0.4em] text-text-faint">
        ARCANUM
      </main>
    );
  }

  return (
    <RankAura grade={readModel.stats.grade}>
      <HomeShell
        readModel={readModel}
        viewModel={viewModel}
        onWorld={(goalId) => {
          audio.cue("nav"); // crossing into a world — the world's drone then swells in (if music is on)
          setSubjectGoal(goalId);
        }}
        header={
          <header className="flex items-center justify-between">
            <span className="font-display text-sm tracking-[0.4em] text-text-muted">ARCANUM</span>
            <div className="flex items-center gap-3">
              <LayoutToggle />
              <OfflinePill onOpen={() => setOfflineOpen(true)} />
              <SyncStatus onOpen={() => setAuthOpen(true)} />
            </div>
          </header>
        }
        footer={
          <Footer
            onMapa={() => setMapOpen(true)}
            onAgenda={() => setAgendaOpen(true)}
            onCodice={() => setCodiceOpen(true)}
            onNotes={() => setNotes({ open: true, moduleId: null })}
            onLecturas={() => setBooksOpen(true)}
            onVigilia={() => setVigiliaOpen(true)}
            onAudio={() => setAudioOpen(true)}
          />
        }
      />

      <RoadmapCanvas open={mapOpen} onClose={() => setMapOpen(false)} />
      <AgendaSheet open={agendaOpen} onClose={() => setAgendaOpen(false)} />
      <AudioConfig open={audioOpen} onClose={() => setAudioOpen(false)} />
      {subjectGoal && <SubjectMap goalId={subjectGoal} onClose={() => setSubjectGoal(null)} />}

      <AiQueueDrain />
      <BooksLibrary open={booksOpen} onClose={() => setBooksOpen(false)} />
      <OfflineSheet open={offlineOpen} onClose={() => setOfflineOpen(false)} />
      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
      <CodiceSheet open={codiceOpen} onClose={() => setCodiceOpen(false)} />
      <VigiliaSheet open={vigiliaOpen} onClose={() => setVigiliaOpen(false)} />
      <NotesModule
        open={notes.open}
        moduleId={notes.moduleId}
        onClose={() => setNotes({ open: false, moduleId: null })}
      />
      {ceremony && (
        <AscensionCeremony grade={ceremony} onDismiss={() => store.getState().dismissCeremony()} />
      )}
    </RankAura>
  );
}

// The home reflows between PWA (mobile, single column — fills an iPhone) and DESKTOP (a wide dashboard:
// the crown as a left rail, the worlds as a 2-col grid — no more empty gutters). Same content + aesthetic.
function HomeShell({
  readModel,
  viewModel,
  onWorld,
  header,
  footer,
}: {
  readModel: ReadModel;
  viewModel: ViewModel;
  onWorld: (goalId: string) => void;
  header: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { mode } = useLayoutMode();
  if (mode !== "desktop") {
    return (
      <main className="scroll-touch mx-auto flex min-h-full max-w-md flex-col gap-6 px-5 pb-10" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
        {header}
        <Hero stats={readModel.stats} viewModel={viewModel} />
        <RitoDelDia pending={viewModel.ritoPending} />
        <WorldPortals readModel={readModel} onOpen={onWorld} />
        <InstallCoachMark />
        {footer}
      </main>
    );
  }
  return (
    <main className="scroll-touch mx-auto min-h-full w-full max-w-6xl px-10 pb-16 pt-8">
      {header}
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(320px,384px)_1fr]">
        <div className="flex flex-col gap-6 lg:sticky lg:top-8">
          <Hero stats={readModel.stats} viewModel={viewModel} />
          <RitoDelDia pending={viewModel.ritoPending} />
        </div>
        <div className="flex flex-col gap-8">
          <WorldPortals readModel={readModel} onOpen={onWorld} grid />
          {footer}
        </div>
      </div>
    </main>
  );
}

function Hero({ stats, viewModel }: { stats: Stats; viewModel: ViewModel }) {
  const [bursts, setBursts] = useState<{ id: number; amount: number }[]>([]);
  const prev = useRef(stats.totalXp);
  const counter = useRef(0);
  // each burst removes itself after its lifetime. The timers are tracked and cleared ONLY on unmount —
  // NOT via the effect's cleanup, or a second XP gain within the window would cancel the first burst's
  // removal (the deps re-run runs the prior cleanup) and bursts would leak/stack forever.
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => {
    const delta = stats.totalXp - prev.current;
    prev.current = stats.totalXp;
    if (delta <= 0) return;
    const id = ++counter.current;
    setBursts((b) => [...b, { id, amount: delta }]);
    timers.current.push(window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1100));
  }, [stats.totalXp]);

  return (
    <section
      className="relative overflow-hidden rounded-[var(--r-lg)] border border-line px-6 pb-7 pt-6 shadow-aura"
      style={{ background: "linear-gradient(168deg, var(--surface-raised) 0%, var(--surface) 100%)" }}
    >
      {/* imperial bloom + gold hairline — the throne hall */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(125% 75% at 50% -12%, var(--rank-soft), transparent 62%)" }} />
      <div aria-hidden className="absolute inset-x-6 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--gold) 55%, transparent), transparent)" }} />
      <div className="absolute right-4 top-4 z-10">
        <StreakFlame streak={stats.currentStreak} shields={stats.shields} alive={viewModel.streakAlive} />
      </div>
      <div className="relative z-[1]">
        <GradeSigil stats={stats} />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-8 -translate-x-1/2">
        <AnimatePresence>
          {bursts.map((b) => (
            <XpBurst key={b.id} amount={b.amount} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function WorldPortals({ readModel, onOpen, grid = false }: { readModel: ReadModel; onOpen: (goalId: string) => void; grid?: boolean }) {
  const byId = new Map(readModel.modules.map((m) => [m.id, m]));
  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-[0.3em] text-text-faint">Los mundos · elige territorio</div>
      <div className={grid ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>
      {readModel.goals
        .filter((g) => !g.archived)
        .map((goal) => {
          const theme = themeForGoal(goal.title);
          const mods = readModel.modules.filter((m) => m.goalId === goal.id && !m.archived);
          const mastered = mods.filter((m) => isMastered(m)).length;
          const available = mods.filter((m) => nodeStatus(m, readModel.edges, byId) === "available").length;
          const frac = mods.length ? mastered / mods.length : 0;
          return (
            <button
              key={goal.id}
              onClick={() => onOpen(goal.id)}
              className="group relative block w-full overflow-hidden rounded-[var(--r-lg)] border p-4 text-left transition hover:brightness-110"
              style={
                {
                  ...worldVars(theme),
                  borderColor: "color-mix(in srgb, var(--accent) 28%, var(--line))",
                  background: "linear-gradient(135deg, color-mix(in srgb, var(--world-bg) 65%, var(--surface)), var(--surface))",
                } as CSSProperties
              }
            >
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 130% at 100% 0%, var(--world-glow), transparent 55%)", opacity: 0.38 }} />
              <div className="relative flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--r-md)] font-display text-2xl"
                  style={{ color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 35%, var(--line))", textShadow: "0 0 14px var(--world-glow)" }}
                >
                  {theme.glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] uppercase tracking-[0.28em] text-text-faint">{theme.temper}</div>
                  <div className="font-display text-base leading-tight" style={{ color: readableAccent(theme.accent) }}>{goal.title}</div>
                  <div className="truncate font-serif text-[11px] italic text-text-muted">{theme.tagline}</div>
                </div>
                <span aria-hidden className="font-display text-base" style={{ color: "var(--accent)" }}>›</span>
              </div>
              <div className="relative mt-3 flex items-center gap-3">
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(frac * 100)}%`, background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }} />
                </div>
                <div className="tnum shrink-0 text-[10px] uppercase tracking-wider text-text-faint">
                  {mastered}/{mods.length} dominados
                  {available > 0 && <span style={{ color: "var(--accent)" }}> · {available} listos</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Footer({
  onMapa,
  onAgenda,
  onCodice,
  onNotes,
  onLecturas,
  onVigilia,
  onAudio,
}: {
  onMapa: () => void;
  onAgenda: () => void;
  onCodice: () => void;
  onNotes: () => void;
  onLecturas: () => void;
  onVigilia: () => void;
  onAudio: () => void;
}) {
  const { rebuild } = useActions();
  const item = "min-h-11 text-[11px] uppercase tracking-[0.2em] text-text-faint transition";
  const sep = (
    <span className="text-text-faint" aria-hidden>
      ·
    </span>
  );
  // every section entry is a NAVIGATION — wired through one cue so a future entry can't land silent
  const go = (fn: () => void) => () => {
    audio.cue("nav");
    fn();
  };
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <button onClick={go(onMapa)} className={`${item} hover:text-topic`}>
        Mapa
      </button>
      {sep}
      <button onClick={go(onAgenda)} className={`${item} hover:text-topic`}>
        Agenda
      </button>
      {sep}
      <button onClick={go(onNotes)} className={`${item} hover:text-topic`}>
        Notas
      </button>
      {sep}
      <button onClick={go(onLecturas)} className={`${item} hover:text-topic`}>
        Lecturas
      </button>
      {sep}
      <button onClick={go(onVigilia)} className={`${item} hover:text-gold`}>
        Vigilia
      </button>
      {sep}
      <button onClick={go(onAudio)} className={`${item} hover:text-rank`}>
        Audio
      </button>
      {sep}
      <button onClick={go(onCodice)} className={`${item} hover:text-rank`}>
        Códice
      </button>
      {sep}
      <button onClick={() => { audio.cue("secondary"); void rebuild(); }} className={`${item} hover:text-text-muted`}>
        Reconstruir índice
      </button>
      {sep}
      <button
        onClick={() => {
          // tear down ALL session state: the env-gate cookie, the offline flag, AND the Supabase session
          void fetch("/api/logout", { method: "POST" }).catch(() => {});
          try {
            getSupabase().auth.signOut();
          } catch {
            /* sync not configured */
          }
          try {
            localStorage.removeItem("arcanum_authed");
          } catch {
            /* private mode */
          }
          window.location.reload();
        }}
        className={`${item} hover:text-amber`}
      >
        Salir
      </button>
    </div>
  );
}
