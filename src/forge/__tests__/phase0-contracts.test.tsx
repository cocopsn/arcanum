import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { FORGE_DISCLAIMER, FORGE_DISCLAIMER_PREFIX } from "@/forge/disclaimer";
import labels from "@/forge/data/labels.json";
import { fnv1a, mulberry32, seededShuffle } from "@/forge/eval/prng";
import { CHECKS } from "@/forge/bank/check/registry";
import { FORGE_TYPES } from "@/forge/bank/registry";
import { STUB_QUEUE_MOTIVO, askSimulatedUser, submitForgeVerdict } from "@/forge/ai-port";
import { ensureForgeBank, ensureForgeBook, loadForgeBankItems, loadForgeBookMd, loadForgeRoute } from "@/forge/loaders";
import { MISCONFIGURED_TEXT, PENDING_TEXT, closingMount, missionConfigError } from "@/forge/ui/flow-contract";
import { RUNNERS, RUNNER_LOADERS, isSelectable } from "@/forge/ui/exercises/registry";
import { FLOWS, FLOW_LOADERS } from "@/forge/ui/flows/registry";
import { project } from "@/core/projector";
import ForgeMission from "@/forge/ui/flows/mision";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";
import { parseExercisesMd } from "@/lib/exercises-md";
import type { ForgeBankItem } from "@/forge/bank/registry";

// Phase-0 contracts of forge/c0-contenido (design §22.3): the notice, the PRNG, the lazy check registry, the honest
// stubs of ai-port and loaders, the closing rule of flows and the stub surfaces.

const items = (md: string) => (parseExercisesMd(md)?.exercises ?? []).filter((e): e is ForgeBankItem => e.kind === "forge");

describe("disclaimer", () => {
  it("disclaimer.ts and labels.json say exactly the same notice, starting with the two sentences of D4", () => {
    expect(FORGE_DISCLAIMER.startsWith(FORGE_DISCLAIMER_PREFIX)).toBe(true);
    expect(labels.aviso, "el aviso de no afiliación difiere entre disclaimer.ts y labels.json").toBe(FORGE_DISCLAIMER);
  });
  it("README.md carries the same paragraph once the integration adds it (§19.5)", () => {
    const readme = join(process.cwd(), "README.md");
    const text = existsSync(readme) ? readFileSync(readme, "utf8") : "";
    if (!text.includes(FORGE_DISCLAIMER_PREFIX)) return; // pending: README.md is the integration's (§22.4)
    expect(text.includes(FORGE_DISCLAIMER), "el aviso de no afiliación difiere entre disclaimer.ts, labels.json y README.md").toBe(true);
  });
});

describe("prng", () => {
  it("mulberry32 is deterministic per seed and in [0, 1)", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const xs = Array.from({ length: 5 }, () => a());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(8)()).not.toBe(xs[0]);
  });
  it("fnv1a is the 32-bit FNV-1a (known vectors) and seededShuffle is a stable permutation", () => {
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
    const s = seededShuffle([1, 2, 3, 4, 5], 42);
    expect([...s].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(seededShuffle([1, 2, 3, 4, 5], 42)).toEqual(s);
  });
});

describe("lazy check registry", () => {
  it("has one loader per type and every loader resolves to a module with check", async () => {
    expect(Object.keys(CHECKS).sort()).toEqual([...FORGE_TYPES].sort());
    for (const t of FORGE_TYPES) {
      const mod = await CHECKS[t]();
      expect(typeof mod.check, `el chequeo de ${t} no exporta check`).toBe("function");
    }
  });
  it("the UI registries' loaders resolve to components, and no registry imports a module statically", async () => {
    for (const [t, load] of Object.entries(RUNNER_LOADERS)) expect(typeof (await load()).default, `el corredor de ${t} no carga`).toBe("function");
    for (const [f, load] of Object.entries(FLOW_LOADERS)) expect(typeof (await load()).default, `el flujo ${f} no carga`).toBe("function");
    expect(Object.keys(FLOW_LOADERS).sort()).toEqual(["diagnostico", "entrevista", "expediente", "gameday", "mision", "ontologia", "proyecto"]);
    expect(Object.keys(RUNNERS).sort()).toEqual(Object.keys(RUNNER_LOADERS).sort());
    expect(Object.keys(FLOWS).sort()).toEqual(Object.keys(FLOW_LOADERS).sort());
    for (const rel of ["ui/exercises/registry.ts", "ui/flows/registry.ts"]) {
      const src = readFileSync(join(process.cwd(), "src", "forge", ...rel.split("/")), "utf8");
      const local = src.split("\n").filter((l) => /^\s*import\s+(?!type\s).*from\s+"\.\//.test(l));
      expect(local, `${rel} importa un módulo de forma estática`).toEqual([]);
      // every dynamic() entry and its test loader point to the same module
      const paths = [...src.matchAll(/import\("(\.\/[^"]+)"\)/g)].map((m) => m[1]!);
      for (const p of new Set(paths)) expect(paths.filter((x) => x === p), `${rel}: ${p} no está a la vez en el registro y en sus cargadores`).toHaveLength(2);
    }
  });
  it("check/registry.ts never imports a check statically", () => {
    const src = readFileSync(join(process.cwd(), "src", "forge", "bank", "check", "registry.ts"), "utf8");
    const staticImports = src.split("\n").filter((l) => /^\s*import\s/.test(l) && !/^\s*import\s+type\s/.test(l));
    expect(staticImports, "un evaluador de Forge se importó de forma estática en check/registry.ts").toEqual([]);
  });
  it("the stub checks answer { disponible: false } and the real ones (7 structural + those Phase 1 replaced) validate the fixtures", async () => {
    // Phase 1 replaces stubs file by file (§22.4): a check that is no longer the shared stub must validate its fixture.
    const { stubCheck } = await import("@/forge/bank/check/_stub");
    for (const t of FORGE_TYPES) {
      const [item] = items(bankMd([BLOCKS[t]]));
      const mod = await CHECKS[t]();
      const r = await mod.check(item!, { source: "seed", jsRun: async () => ({ syntaxError: null, cases: [] }) });
      if (["giro", "expediente", "entrevista", "gameday", "recuperacion", "senal", "prediccion"].includes(t) || mod.check !== stubCheck) expect(r, `el chequeo real de ${t} rechazó su fixture válido`).toEqual({ ok: true });
      else expect(r).toEqual({ disponible: false });
    }
  });
});

describe("honest stubs", () => {
  it("ai-port queues with the honest message and never mints", async () => {
    expect(await submitForgeVerdict({ cellCode: "P2-06", kind: "mision", scope: "local" })).toEqual({ estado: "en-cola", motivo: STUB_QUEUE_MOTIVO });
    expect((await askSimulatedUser({ cellCode: "F1-03", itemId: "x", fase: "preguntas", question: "¿?" })).estado).toBe("sin-ia");
  });
  it("loaders answer «no descargado» or null, never a fabricated book, bank or route", async () => {
    expect(await loadForgeRoute("p2")).toBeNull();
    expect(await loadForgeBookMd("P2-06")).toBeNull();
    expect(await ensureForgeBook("P2-06", project([]))).toEqual({ ok: false, reason: "no-descargado" });
    expect(await ensureForgeBank("P2-06")).toEqual({ ok: false, reason: "no-descargado" });
    expect(await loadForgeBankItems("P2-06")).toBeNull();
  });
  it("stub runner and stub flow paint the pending text and offer no verdict", async () => {
    // Phase 1 replaces runners file by file (§22.4): every runner that is still the Phase-0 stub paints the pending text.
    const dir = join(process.cwd(), "src", "forge", "ui", "exercises");
    const stubs = (Object.keys(RUNNER_LOADERS) as (keyof typeof RUNNER_LOADERS)[]).filter((t) =>
      readFileSync(join(dir, `${t[0]!.toUpperCase()}${t.slice(1)}Runner.tsx`), "utf8").includes("data-forge-stub"),
    );
    for (const t of stubs) {
      const { default: Stub } = await RUNNER_LOADERS[t]();
      const [item] = items(bankMd([BLOCKS[t]]));
      const { unmount } = render(<Stub item={item!} cellCode="P1-02" cellId="x" readModel={project([])} onClose={() => {}} />);
      expect(screen.getByRole("status").textContent, `el corredor stub de ${t} no pinta el texto pendiente`).toBe(PENDING_TEXT);
      unmount();
    }
    render(<ForgeMission cellCode="P2-06" cellId="x" route={{ v: 1, slug: "p2", maestro_sha10: "0000000000", code: "P2", name: "", family: "Plataforma Foundry/AIP", header: { entrada: "", entradaRecomendada: [], evidencia: "", apoyo: [] }, cells: [] }} readModel={project([])} onClose={() => {}} />);
    expect(screen.getByRole("status").textContent).toBe(PENDING_TEXT);
    expect(screen.queryByText(/Pedir veredicto/)).toBeNull();
  });
});

describe("flow contract (§9.5)", () => {
  it("a flow with a gate closes on the mision flow with kind = compuerta; diagnostics close on nothing", () => {
    expect(closingMount("entrevista", ["e1", "e2"])).toEqual({ flujo: "mision", kind: "entrevista", attachments: { eventIds: ["e1", "e2"] } });
    expect(closingMount("mision")).toEqual({ flujo: "mision", kind: "mision" });
    expect(closingMount(null)).toBeNull();
  });
  it("ForgeMission refuses a kind that is not the cell's gate, or artifact mode without eventIds", () => {
    expect(missionConfigError("ontologia", "mision", "completo")).toBe(MISCONFIGURED_TEXT);
    expect(missionConfigError("ontologia", "ontologia", "artefacto")).toBe(MISCONFIGURED_TEXT);
    expect(missionConfigError("ontologia", "ontologia", "artefacto", { eventIds: ["e1"] })).toBeNull();
    expect(missionConfigError(null, "diagnostico", "completo")).toBe(MISCONFIGURED_TEXT);
  });
  it("the «Evaluaciones» list leaves out entrevista, expediente, giro and retencion in defensa", () => {
    const sel = (t: keyof typeof BLOCKS) => isSelectable(items(bankMd([BLOCKS[t]]))[0]!);
    expect(sel("sql")).toBe(true);
    expect(sel("retencion")).toBe(true);
    expect(sel("giro")).toBe(false);
    expect(sel("entrevista")).toBe(false);
    expect(sel("expediente")).toBe(false);
  });
});
