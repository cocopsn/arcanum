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
import { AuthSheet } from "@/ui/AuthSheet";
import { CodiceSheet } from "@/ui/CodiceSheet";
import { NotesSheet } from "@/ui/NotesSheet";
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
      <main
        className="scroll-touch mx-auto flex min-h-full max-w-md flex-col gap-6 px-5 pb-10"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        <header className="flex items-center justify-between">
          <span className="font-display text-sm tracking-[0.4em] text-text-muted">
            ARCANUM
          </span>
          <SyncStatus onOpen={() => setAuthOpen(true)} />
        </header>

        <Hero stats={readModel.stats} viewModel={viewModel} />
        <RitoDelDia pending={viewModel.ritoPending} />
        <WorldPortals
          readModel={readModel}
          onOpen={(goalId) => {
            audio.unlock();
            setSubjectGoal(goalId);
          }}
        />
        <InstallCoachMark />
        <Footer
          onMapa={() => setMapOpen(true)}
          onAgenda={() => setAgendaOpen(true)}
          onCodice={() => setCodiceOpen(true)}
          onNotes={() => setNotes({ open: true, moduleId: null })}
          onVigilia={() => setVigiliaOpen(true)}
          onAudio={() => setAudioOpen(true)}
        />
      </main>

      <RoadmapCanvas open={mapOpen} onClose={() => setMapOpen(false)} />
      <AgendaSheet open={agendaOpen} onClose={() => setAgendaOpen(false)} />
      <AudioConfig open={audioOpen} onClose={() => setAudioOpen(false)} />
      {subjectGoal && <SubjectMap goalId={subjectGoal} onClose={() => setSubjectGoal(null)} />}

      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
      <CodiceSheet open={codiceOpen} onClose={() => setCodiceOpen(false)} />
      <VigiliaSheet open={vigiliaOpen} onClose={() => setVigiliaOpen(false)} />
      <NotesSheet
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

function Hero({ stats, viewModel }: { stats: Stats; viewModel: ViewModel }) {
  const [bursts, setBursts] = useState<{ id: number; amount: number }[]>([]);
  const prev = useRef(stats.totalXp);
  const counter = useRef(0);

  useEffect(() => {
    const delta = stats.totalXp - prev.current;
    prev.current = stats.totalXp;
    if (delta <= 0) return;
    const id = ++counter.current;
    setBursts((b) => [...b, { id, amount: delta }]);
    const t = window.setTimeout(
      () => setBursts((b) => b.filter((x) => x.id !== id)),
      1100,
    );
    return () => window.clearTimeout(t);
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

function WorldPortals({ readModel, onOpen }: { readModel: ReadModel; onOpen: (goalId: string) => void }) {
  const byId = new Map(readModel.modules.map((m) => [m.id, m]));
  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-[0.3em] text-text-faint">Los mundos · elige territorio</div>
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
  );
}

function Footer({
  onMapa,
  onAgenda,
  onCodice,
  onNotes,
  onVigilia,
  onAudio,
}: {
  onMapa: () => void;
  onAgenda: () => void;
  onCodice: () => void;
  onNotes: () => void;
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
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <button onClick={onMapa} className={`${item} hover:text-topic`}>
        Mapa
      </button>
      {sep}
      <button onClick={onAgenda} className={`${item} hover:text-topic`}>
        Agenda
      </button>
      {sep}
      <button onClick={onNotes} className={`${item} hover:text-topic`}>
        Notas
      </button>
      {sep}
      <button onClick={onVigilia} className={`${item} hover:text-gold`}>
        Vigilia
      </button>
      {sep}
      <button onClick={onAudio} className={`${item} hover:text-rank`}>
        Audio
      </button>
      {sep}
      <button onClick={onCodice} className={`${item} hover:text-rank`}>
        Códice
      </button>
      {sep}
      <button onClick={() => void rebuild()} className={`${item} hover:text-text-muted`}>
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
