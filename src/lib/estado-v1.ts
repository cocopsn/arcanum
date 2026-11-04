/**
 * Contrato de estado v1 (Milla 12 del holding) — lo que Arcanum le cuenta a Kee y a La Atalaya.
 * Progreso, rachas y riesgo de olvido son datos del propio dueño: pueden salir, como CONTEOS.
 * Ni títulos de módulos ni notas: el esquema cerrado no tiene dónde ponerlos.
 */
// @ts-ignore — módulos JS puros del contrato (allowJs)
import { validarRespuesta } from "../../contracts/estado/v1/validar.mjs";
// @ts-ignore
import { verificarToken, tokenDeCabecera } from "../../contracts/estado/v1/token.mjs";
import esquemas from "../../contracts/estado/v1/esquemas.json";
import type { McSnapshot } from "@/lib/mc-status";

export type Recurso = "salud" | "version" | "despliegues" | "metricas" | "eventos";
export const RECURSOS: Recurso[] = ["salud", "version", "despliegues", "metricas", "eventos"];
const ARRANQUE = new Date().toISOString();
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : 0);

export function construir(recurso: Recurso, snap: McSnapshot | null, env = process.env): unknown {
  const base = { contrato: "estado/v1", sistema: "arcanum", generado: new Date().toISOString() };
  switch (recurso) {
    case "salud":
      return { ...base, estado: snap ? "vivo" : "degradado", dependencias: [{ nombre: "base", estado: snap ? "vivo" : "caido" }] };
    case "version": {
      const sha = (env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
      return { ...base, commit: /^[0-9a-f]{7}$/.test(sha) ? sha : "0000000", construido: ARRANQUE, runtime: `node ${process.versions.node}` };
    }
    case "despliegues":
      return { ...base, despliegues: [] };
    case "metricas": {
      const s = (snap?.stats ?? {}) as Record<string, unknown>;
      const c = (snap?.counts ?? {}) as Record<string, unknown>;
      return {
        ...base,
        conteos: {
          xp_total: n(s.totalXp), racha_actual: n(s.currentStreak), racha_maxima: n(s.longestStreak),
          escudos: n(s.shields), modulos: n(c.modules), dominados: n(c.mastered), activos: n(c.active),
          por_repasar: n(c.reviewDue), sellados: n(c.sealed),
        },
      };
    }
    case "eventos":
      return { ...base, desde: new Date(Date.now() - 86400_000).toISOString(), eventos: [] };
  }
}

export function validar(recurso: Recurso, cuerpo: unknown): string[] {
  return validarRespuesta(esquemas, recurso, cuerpo);
}

export function autorizar(cabecera: string | null, env = process.env): { ok: true; emisor: string } | { ok: false; status: number } {
  let llaves: Record<string, string> = {};
  try {
    llaves = JSON.parse(env.ESTADO_V1_LLAVES || "{}");
  } catch {
    llaves = {};
  }
  if (!env.ESTADO_V1_AUDIENCIA || Object.keys(llaves).length === 0) return { ok: false, status: 503 };
  const r: { ok: boolean; emisor?: string; status?: number } = verificarToken(tokenDeCabecera(cabecera), { audiencia: env.ESTADO_V1_AUDIENCIA, llaves });
  return r.ok ? { ok: true, emisor: String(r.emisor) } : { ok: false, status: r.status ?? 401 };
}
