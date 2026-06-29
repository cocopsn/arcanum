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
import { ModuleCard } from "@/ui/ModuleCard";
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
        <Goals
          readModel={readModel}
          viewModel={viewModel}
          onNotes={(moduleId) => setNotes({ open: true, moduleId })}
          onOpenSubject={(goalId) => setSubjectGoal(goalId)}
        />
        <InstallCoachMark />
        <Footer
          onMapa={() => setMapOpen(true)}
          onAgenda={() => setAgendaOpen(true)}
          onCodice={() => setCodiceOpen(true)}
          onNotes={() => setNotes({ open: true, moduleId: null })}
          onVigilia={() => setVigiliaOpen(true)}
        />
      </main>

      <RoadmapCanvas open={mapOpen} onClose={() => setMapOpen(false)} />
      <AgendaSheet open={agendaOpen} onClose={() => setAgendaOpen(false)} />
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
    <section className="relative flex items-center justify-between rounded-[var(--r-lg)] border border-line bg-surface p-5 shadow-aura">
      <GradeSigil stats={stats} />
      <StreakFlame
        streak={stats.currentStreak}
        shields={stats.shields}
        alive={viewModel.streakAlive}
      />
      <div className="pointer-events-none absolute right-6 top-4">
        <AnimatePresence>
          {bursts.map((b) => (
            <XpBurst key={b.id} amount={b.amount} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function Goals({
  readModel,
  viewModel,
  onNotes,
  onOpenSubject,
}: {
  readModel: ReadModel;
  viewModel: ViewModel;
  onNotes: (moduleId: string) => void;
  onOpenSubject: (goalId: string) => void;
}) {
  const rByModule = new Map(viewModel.modules.map((m) => [m.id, m.retrievability]));
  const noteCount = (moduleId: string) =>
    readModel.notes.filter((n) => n.moduleId === moduleId).length;
  return (
    <div className="space-y-5">
      {readModel.goals
        .filter((g) => !g.archived)
        .map((goal) => {
          const mods = readModel.modules.filter(
            (m) => m.goalId === goal.id && !m.archived,
          );
          return (
            <section
              key={goal.id}
              style={{ ["--topic"]: goal.color } as CSSProperties}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-display text-lg text-topic">
                  <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--topic)" }} />
                  {goal.title}
                </h2>
                <button
                  onClick={() => onOpenSubject(goal.id)}
                  className="inline-flex min-h-11 items-center px-1 text-[11px] uppercase tracking-[0.18em] text-text-faint transition hover:text-topic"
                >
                  Ruta →
                </button>
              </div>
              <div className="space-y-2">
                {mods.map((m) => (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    retrievability={rByModule.get(m.id) ?? 0}
                    goalId={goal.id}
                    noteCount={noteCount(m.id)}
                    onNotes={() => onNotes(m.id)}
                  />
                ))}
              </div>
            </section>
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
}: {
  onMapa: () => void;
  onAgenda: () => void;
  onCodice: () => void;
  onNotes: () => void;
  onVigilia: () => void;
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
      <button onClick={onCodice} className={`${item} hover:text-rank`}>
        Códice
      </button>
      {sep}
      <button onClick={() => void rebuild()} className={`${item} hover:text-text-muted`}>
        Reconstruir índice
      </button>
    </div>
  );
}
