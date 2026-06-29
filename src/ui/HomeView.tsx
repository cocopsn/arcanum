"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence } from "framer-motion";
import { useArcanum } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { RankAura } from "@/ui/RankAura";
import { GradeSigil } from "@/ui/GradeSigil";
import { StreakFlame } from "@/ui/StreakFlame";
import { XpBurst } from "@/ui/XpBurst";
import { RitoDelDia } from "@/ui/RitoDelDia";
import { ModuleCard } from "@/ui/ModuleCard";
import { SyncStatus } from "@/ui/SyncStatus";
import { AuthSheet } from "@/ui/AuthSheet";
import { InstallCoachMark } from "@/ui/InstallCoachMark";
import type { ReadModel, Stats } from "@/core/read-model";
import type { ViewModel } from "@/core/present";

export function HomeView() {
  const status = useArcanum((s) => s.status);
  const readModel = useArcanum((s) => s.readModel);
  const viewModel = useArcanum((s) => s.viewModel);
  const [authOpen, setAuthOpen] = useState(false);

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
        <Goals readModel={readModel} viewModel={viewModel} />
        <InstallCoachMark />
        <RebuildButton />
      </main>
      <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
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
}: {
  readModel: ReadModel;
  viewModel: ViewModel;
}) {
  const rByModule = new Map(viewModel.modules.map((m) => [m.id, m.retrievability]));
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
              <h2 className="mb-2 flex items-center gap-2 font-display text-lg text-topic">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--topic)" }}
                />
                {goal.title}
              </h2>
              <div className="space-y-2">
                {mods.map((m) => (
                  <ModuleCard
                    key={m.id}
                    module={m}
                    retrievability={rByModule.get(m.id) ?? 0}
                    goalId={goal.id}
                  />
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}

function RebuildButton() {
  const { rebuild } = useActions();
  return (
    <button
      onClick={() => void rebuild()}
      className="min-h-11 self-center text-[11px] uppercase tracking-[0.2em] text-text-faint transition hover:text-text-muted"
    >
      Reconstruir índice
    </button>
  );
}
