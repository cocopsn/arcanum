"use client";

// The Engineering Forge world (design §14.5): the operations console. It applies the monochrome theme to its subtree
// (worldVars + data-world="forge") and, while mounted, marks <body> so the layers painted outside it (reward overlay,
// ascension ceremony) inherit the monochrome too (§14.2). Every figure comes from the read model (forgeConsoleStats).
import { useEffect, useMemo, useState } from "react";
import { useArcanum } from "@/app/providers";
import { useLayoutMode } from "@/ui/layout-mode";
import { TopicDetailSheet } from "@/ui/subject/TopicDetailSheet";
import { SUBJECT_THEMES, worldVars } from "@/lib/subject-themes";
import { FORGE_FAMILIES, FORGE_SPINE } from "@/lib/spines-forge";
import { FORGE_DISCLAIMER } from "@/forge/disclaimer";
import { forgeConsoleStats } from "@/forge/model/console-stats";
import { ForgeAtmosphere } from "@/forge/ui/atmosphere";
import { ForgeRouteMap } from "@/forge/ui/ForgeRouteMap";
import { Glyph } from "@/forge/ui/glyphs";
import { AtlasEntry, AtlasPanel, useAtlasManifest } from "@/forge/ui/atlas/AtlasPanel";

const THEME = SUBJECT_THEMES.forge!;

/** While the world is mounted, <body data-world="forge">; removed on cleanup only if it still says "forge". */
export function useForgeBodyWorld() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.world = "forge";
    return () => {
      if (document.body.dataset.world === "forge") delete document.body.dataset.world;
    };
  }, []);
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

export function ForgeWorld({ initialCellId = null, onClose }: { initialCellId?: string | null; onClose: () => void }) {
  const readModel = useArcanum((s) => s.readModel);
  const desktop = useLayoutMode().mode === "desktop";
  const reduced = useReducedMotion();
  useForgeBodyWorld();

  const firstSlug = FORGE_SPINE.paths[0]!.slug;
  const initialSlug = useMemo(() => {
    const c = initialCellId ? FORGE_SPINE.cells.find((x) => x.id === initialCellId) : undefined;
    return c?.pathSlug ?? firstSlug;
  }, [initialCellId, firstSlug]);
  const [slug, setSlug] = useState<string>(initialSlug);
  const [family, setFamily] = useState<string>(
    () => FORGE_FAMILIES.find((f) => f.paths.includes(initialSlug))?.family ?? FORGE_FAMILIES[0]!.family,
  );
  const [cellId, setCellId] = useState<string | null>(initialCellId);
  const atlas = useAtlasManifest();
  const [atlasOpen, setAtlasOpen] = useState(false);

  const stats = useMemo(() => forgeConsoleStats(readModel), [readModel]);
  const path = FORGE_SPINE.paths.find((p) => p.slug === slug) ?? FORGE_SPINE.paths[0]!;
  const famPaths = FORGE_FAMILIES.find((f) => f.family === family)?.paths ?? [];
  const route = stats.porRuta[path.slug] ?? { dominadas: 0, total: 0 };

  return (
    <div
      className="scroll-touch fixed inset-0 z-50 overflow-y-auto"
      data-world="forge"
      data-motion={reduced ? "off" : "on"}
      style={worldVars(THEME)}
      role="region"
      aria-label="Engineering Forge"
    >
      <ForgeAtmosphere />
      {/* áreas seguras (design poblar §7.2): la ceja y «Salir del mundo» quedan bajo la Dynamic Island sin el inset;
          var(--safe-*) y no env() para que la matriz de bordes pueda simular el teléfono */}
      <div
        className="relative z-10 mx-auto w-full max-w-5xl px-safe sm:px-safe-lg"
        style={{ paddingTop: "calc(var(--safe-top) + 1rem)", paddingBottom: "calc(var(--safe-bottom) + 6rem)" }}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="forge-label text-[11px] text-text-muted">Arcanum · mundo</div>
            <h1 className="mt-1 text-[28px] font-light leading-tight text-text">Engineering Forge</h1>
            <p className="forge-label mt-1 text-[11px] text-text-muted">
              <Glyph name="enter" size={10} className="mr-1 inline-block align-[-1px]" />
              {THEME.temper}
            </p>
            <p className="mt-2 max-w-xl text-[13px] leading-snug text-text-muted">{THEME.tagline}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 shrink-0 border border-[var(--forge-control)] px-3 text-[13px] text-text"
          >
            Salir del mundo
          </button>
        </header>

        <p className="mt-3 max-w-3xl border-l border-[var(--forge-control)] pl-3 text-[11px] leading-snug text-text-muted" data-forge-disclaimer="">
          {FORGE_DISCLAIMER}
        </p>

        <div className="mt-3">
          <AtlasEntry state={atlas} onOpen={() => setAtlasOpen(true)} />
        </div>

        {/* live counts — all from the read model */}
        <dl className="mt-4 grid grid-cols-2 gap-px border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.08)] sm:grid-cols-5" aria-label="Conteos del mundo">
          {[
            ["Dominadas", stats.porEstado.dominado],
            ["En curso", stats.porEstado["en-curso"]],
            ["Disponibles", stats.porEstado.disponible],
            ["Selladas", stats.porEstado.sellado],
            ["IA en cola", stats.pendientesIa],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface px-3 py-2">
              <dt className="forge-label text-[10px] text-text-muted">{k}</dt>
              <dd className="tnum mt-0.5 text-[20px] font-light text-text">{v}</dd>
            </div>
          ))}
        </dl>

        {/* route selector: six family tabs and the chips of that family, both wrap (no hidden overflow, CA-75) */}
        <nav className="mt-5" aria-label="Rutas">
          <div role="tablist" aria-label="Familias" className="flex flex-wrap gap-1.5">
            {FORGE_FAMILIES.map((f) => (
              <button
                key={f.family}
                role="tab"
                type="button"
                aria-selected={f.family === family}
                onClick={() => {
                  setFamily(f.family);
                  if (!f.paths.includes(slug)) setSlug(f.paths[0]!);
                }}
                className={`min-h-11 border px-3 text-[12px] ${
                  f.family === family ? "border-[var(--forge-text)] bg-[var(--forge-surface-raised)] text-text" : "border-[rgba(255,255,255,0.12)] bg-surface text-text-muted"
                }`}
              >
                {f.family}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Rutas de la familia">
            {famPaths.map((s) => {
              const p = FORGE_SPINE.paths.find((x) => x.slug === s);
              if (!p) return null;
              const on = s === slug;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSlug(s)}
                  className={`forge-label tap border px-2.5 text-[11px] ${on ? "border-[var(--forge-text)] text-text" : "border-dashed border-[var(--forge-control)] text-text-muted"}`}
                >
                  {p.name.split(" · ")[0]}
                </button>
              );
            })}
          </div>
        </nav>

        <section className="mt-5 border border-[rgba(255,255,255,0.08)] bg-[rgba(30,33,36,0.92)] p-4" aria-labelledby="forge-route-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="forge-route-title" className="text-[20px] font-light text-text">
              {path.name}
            </h2>
            <span className="forge-label tnum text-[11px] text-text-muted">
              {route.dominadas} de {route.total} dominadas
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-text-muted">{path.description}</p>
          <p className="forge-label mt-3 flex items-center gap-1.5 text-[10px] text-text-muted">
            <span aria-hidden="true" className="inline-block h-px w-5 bg-[var(--forge-text)]" /> secuencia · el único vínculo que bloquea
          </p>
          <div className="mt-3">
            <ForgeRouteMap slug={path.slug} readModel={readModel} desktop={desktop} onOpen={setCellId} />
          </div>
        </section>
      </div>

      {atlasOpen && atlas.status === "listo" && <AtlasPanel manifest={atlas.manifest} onClose={() => setAtlasOpen(false)} />}
      {cellId && <TopicDetailSheet key={cellId} moduleId={cellId} accent={THEME.accent} onClose={() => setCellId(null)} />}
    </div>
  );
}
