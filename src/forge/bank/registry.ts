import type { ExerciseRol, ExerciseSource } from "@/lib/exercise";
import type { ForgeBlock, SchemaResult } from "./types/_shared";
import * as prediccion from "./types/prediccion";
import * as desvanecido from "./types/desvanecido";
import * as historial from "./types/historial";
import * as mutantes from "./types/mutantes";
import * as contraejemplo from "./types/contraejemplo";
import * as senal from "./types/senal";
import * as entrevista from "./types/entrevista";
import * as expediente from "./types/expediente";
import * as retencion from "./types/retencion";
import * as giro from "./types/giro";
import * as sql from "./types/sql";
import * as ontologia from "./types/ontologia";
import * as forense from "./types/forense";
import * as permisos from "./types/permisos";
import * as recuperacion from "./types/recuperacion";
import * as gameday from "./types/gameday";

// SCHEMA REGISTRY of the 16 Forge exercise types (design §9.1-§9.3). EAGER on purpose: parseExercisesMd is
// synchronous, so the schema parsers ship with it. It imports NO evaluator and NO ingestion check: those are lazy
// (src/forge/bank/check/registry.ts). Frozen at the end of Phase 0 (§22.3).

export interface ForgeDataMap {
  prediccion: prediccion.PrediccionData;
  desvanecido: desvanecido.DesvanecidoData;
  historial: historial.HistorialData;
  mutantes: mutantes.MutantesData;
  contraejemplo: contraejemplo.ContraejemploData;
  senal: senal.SenalData;
  entrevista: entrevista.EntrevistaData;
  expediente: expediente.ExpedienteData;
  retencion: retencion.RetencionData;
  giro: giro.GiroData;
  sql: sql.SqlData;
  ontologia: ontologia.OntologiaData;
  forense: forense.ForenseData;
  permisos: permisos.PermisosData;
  recuperacion: recuperacion.RecuperacionData;
  gameday: gameday.GamedayData;
}

export type ForgeType = keyof ForgeDataMap;

/** The 16 types in the order of §9.1 (a … p). */
export const FORGE_TYPES = [
  "prediccion",
  "desvanecido",
  "historial",
  "mutantes",
  "contraejemplo",
  "senal",
  "entrevista",
  "expediente",
  "retencion",
  "giro",
  "sql",
  "ontologia",
  "forense",
  "permisos",
  "recuperacion",
  "gameday",
] as const satisfies readonly ForgeType[];

/** Fields every Forge item has, whatever its type. `id` = `${moduleId}:${itemId}`; `itemId` is the `id:` line. */
export interface ForgeItemBase {
  id: string;
  kind: "forge";
  moduleId: string | null;
  itemId: string;
  rol: ExerciseRol;
  title: string;
  /** the statement (preamble without the recognized lines) */
  statement: string;
  source: ExerciseSource;
  timeTargetMin?: number;
}

/** A parsed Forge bank item, discriminated by `type`, with the schema-parsed `data` of that type. */
export type ForgeBankItem = { [T in ForgeType]: ForgeItemBase & { type: T; data: ForgeDataMap[T] } }[ForgeType];

/** Narrow a ForgeBankItem to one type. */
export type ForgeItemOf<T extends ForgeType> = Extract<ForgeBankItem, { type: T }>;

export interface ForgeSchema<T extends ForgeType = ForgeType> {
  /** type-specific preamble lines (besides type:, tiempo:, id:, rol:) that are removed from the statement */
  lines: readonly string[];
  parse: (block: ForgeBlock) => SchemaResult<ForgeDataMap[T]>;
}

export const FORGE_SCHEMAS: { [T in ForgeType]: ForgeSchema<T> } = {
  prediccion,
  desvanecido,
  historial,
  mutantes,
  contraejemplo,
  senal,
  entrevista,
  expediente,
  retencion,
  giro,
  sql,
  ontologia,
  forense,
  permisos,
  recuperacion,
  gameday,
};

export function isForgeType(t: string): t is ForgeType {
  return (FORGE_TYPES as readonly string[]).includes(t);
}
