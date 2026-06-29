"use client";

import { useState } from "react";
import type { ModuleRM } from "@/core/read-model";
import { useActions } from "@/ui/use-actions";
import { BlankChallenge } from "@/ui/BlankChallenge";
import { FireTest } from "@/ui/FireTest";

const STATUS: Record<ModuleRM["status"], string> = {
  idle: "Sin iniciar",
  started: "En curso",
  completed: "Cerrado",
};

function ModuleSigil({ charge }: { charge: number }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, charge));
  return (
    <svg viewBox="0 0 32 32" width={32} height={32} aria-hidden className="shrink-0">
      <circle cx="16" cy="16" r={r} fill="none" stroke="var(--line)" strokeWidth="2" />
      <circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke="var(--topic)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - f)}
        transform="rotate(-90 16 16)"
        style={{ transition: "stroke-dashoffset 600ms ease" }}
      />
      <circle cx="16" cy="16" r="2.5" fill="var(--topic)" opacity={0.4 + 0.6 * f} />
    </svg>
  );
}

export function ModuleCard({
  module,
  retrievability,
  goalId,
}: {
  module: ModuleRM;
  retrievability: number;
  goalId: string;
}) {
  const { startModule, completeModule } = useActions();
  const [open, setOpen] = useState(false);
  const charge = Math.round(retrievability * 100);

  return (
    <div className="overflow-hidden rounded-[var(--r-md)] border border-line bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-3 p-4 text-left transition hover:bg-surface-raised"
      >
        <ModuleSigil charge={retrievability} />
        <div className="flex-1">
          <div className="font-serif text-base text-text">{module.title}</div>
          <div className="text-[11px] uppercase tracking-[0.15em] text-topic">
            {STATUS[module.status]}
          </div>
        </div>
        <div className="tnum font-sans text-sm text-topic">{charge}%</div>
      </button>

      {open && (
        <div className="border-t border-line p-4">
          {module.status === "idle" ? (
            <div className="space-y-4">
              <FireTest goalId={goalId} moduleId={module.id} title={module.title} />
              <button
                onClick={() => startModule({ goalId, moduleId: module.id })}
                className="min-h-11 w-full rounded-[var(--r-sm)] border border-line px-4 py-2 text-sm text-text-muted transition hover:border-topic hover:text-topic"
              >
                Iniciar módulo
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <BlankChallenge goalId={goalId} moduleId={module.id} title={module.title} />
              {module.status === "started" && (
                <button
                  onClick={() => completeModule({ goalId, moduleId: module.id })}
                  className="text-sm text-text-faint transition hover:text-text"
                >
                  Cerrar módulo · +150 XP
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
