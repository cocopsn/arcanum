import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { autorizar, construir, RECURSOS, validar } from "./estado-v1";
// @ts-ignore
import { buscarCanarios } from "../../contracts/estado/v1/validar.mjs";
// @ts-ignore
import { firmarToken } from "../../contracts/estado/v1/token.mjs";

describe("contrato estado/v1 en Arcanum (Milla 12)", () => {
  const snap: any = {
    stats: { totalXp: 1200, currentStreak: 5, longestStreak: 9, shields: 1 },
    counts: { modules: 30, mastered: 4, active: 3, reviewDue: 2, sealed: 7 },
    activeModules: [{ title: "TITULO-PRIVADO-DE-MODULO" }],
  };
  it("la copia del contrato es la canónica", () => {
    expect(() => execFileSync(process.execPath, ["contracts/estado/v1/verificar.mjs"], { stdio: "pipe" })).not.toThrow();
  });
  it("todas las respuestas cumplen el esquema y no llevan títulos de módulos", () => {
    for (const r of RECURSOS) {
      const c = construir(r, snap, { VERCEL_GIT_COMMIT_SHA: "a17897e00" } as any);
      expect(validar(r, c), r).toEqual([]);
      expect(buscarCanarios(c, ["TITULO-PRIVADO"]), r).toEqual([]);
    }
    expect((construir("metricas", snap) as any).conteos.por_repasar).toBe(2);
  });
  it("auth por par: audiencia equivocada 401, sin config 503", () => {
    const L = "a".repeat(48);
    const env = { ESTADO_V1_AUDIENCIA: "arcanum", ESTADO_V1_LLAVES: JSON.stringify({ kee: L }) } as any;
    expect(autorizar("Bearer x", {} as any)).toEqual({ ok: false, status: 503 });
    expect(autorizar(`Bearer ${firmarToken({ iss: "kee", aud: "pendy" }, L)}`, env)).toEqual({ ok: false, status: 401 });
    expect(autorizar(`Bearer ${firmarToken({ iss: "kee", aud: "arcanum" }, L)}`, env)).toEqual({ ok: true, emisor: "kee" });
  });
});
