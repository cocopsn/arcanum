import type { Lang } from "@/lib/exercise";
import {
  codeFence,
  deriveFunctionName,
  eachObj,
  fail,
  fencesByLang,
  getSection,
  isInt,
  isNoJson,
  isObj,
  isStr,
  jsonFence,
  okData,
  type ForgeBlock,
  type SchemaResult,
} from "./_shared";

// c · historial (§9.3 c). Schema only; the simulator, the step-language parser and the exhaustive enumeration are
// the owner's (e2-datos: eval/history-dsl.ts, eval/history-sim.ts, bank/check/historial.ts).
// Mode `traza`: `objetivo: violar | proteger`, `chequeo: final | cada-paso` (default final); ### Estado (JSON of
// integer variables), ### Actores (JSON actor → steps), ### Invariante (`text` fence), ### Protocolos (JSON, only
// with proteger: name → actors), ### Referencia (JSON { historia } with violar, { protocolo } with proteger).
// Limits: ≤ 3 actors and ≤ 14 steps in total. Mode `fallas`: ### Firma, ### Arnés, ### Calendarios (JSON),
// ### Solución, ### Ingenua (fences per language).

export type Actores = Record<string, string[]>;

export type HistorialData =
  | {
      modo: "traza";
      objetivo: "violar" | "proteger";
      chequeo: "final" | "cada-paso";
      estado: Record<string, number>;
      actores: Actores;
      invariante: string;
      protocolos: Record<string, Actores> | null;
      referencia: { historia: string[] } | { protocolo: string };
    }
  | {
      modo: "fallas";
      firma: Partial<Record<Lang, string>>;
      arnes: Partial<Record<Lang, string>>;
      calendarios: { nombre: string; eventos: unknown[]; espera: Record<string, boolean> }[];
      solucion: Partial<Record<Lang, string>>;
      ingenua: Partial<Record<Lang, string>>;
      functionName: Partial<Record<Lang, string>>;
    };

export const lines = ["modo", "objetivo", "chequeo"] as const;

export const MAX_ACTORES = 3;
export const MAX_PASOS = 14;

function actoresOf(v: unknown, what: string): Actores | string {
  if (!isObj(v)) return `${what} debe ser un objeto JSON actor → pasos`;
  const out: Actores = {};
  let total = 0;
  for (const [actor, pasos] of Object.entries(v)) {
    if (!actor.trim()) return `${what}: actor sin nombre`;
    if (!Array.isArray(pasos) || pasos.length === 0 || !pasos.every(isStr)) return `${what}: «${actor}» necesita una lista de pasos`;
    out[actor] = pasos as string[];
    total += pasos.length;
  }
  const n = Object.keys(out).length;
  if (n < 2) return `${what}: se necesitan al menos 2 actores`;
  if (n > MAX_ACTORES) return `${what}: como máximo ${MAX_ACTORES} actores`;
  if (total > MAX_PASOS) return `${what}: como máximo ${MAX_PASOS} pasos en total`;
  return out;
}

function parseTraza(b: ForgeBlock): SchemaResult<HistorialData> {
  const objetivo = b.lines.objetivo;
  if (objetivo !== "violar" && objetivo !== "proteger") return fail("objetivo: debe ser violar o proteger");
  const chequeo = b.lines.chequeo ?? "final";
  if (chequeo !== "final" && chequeo !== "cada-paso") return fail("chequeo: debe ser final o cada-paso");
  const estado = jsonFence(getSection(b, "estado"));
  if (isNoJson(estado) || !isObj(estado)) return fail("falta ### Estado (cerca json con variables enteras)");
  for (const [k, val] of Object.entries(estado)) if (!isInt(val)) return fail(`### Estado: «${k}» debe ser entero`);
  const actores = actoresOf(jsonFence(getSection(b, "actores")), "### Actores");
  if (typeof actores === "string") return fail(actores);
  const invariante = codeFence(getSection(b, "invariante"), ["text", ""]);
  if (!invariante || !invariante.trim()) return fail("falta ### Invariante (cerca text con la expresión)");
  let protocolos: Record<string, Actores> | null = null;
  const protoSec = getSection(b, "protocolos");
  if (objetivo === "proteger") {
    const p = jsonFence(protoSec);
    if (isNoJson(p) || !isObj(p)) return fail("con objetivo proteger falta ### Protocolos (cerca json nombre → actores)");
    protocolos = {};
    for (const [name, acts] of Object.entries(p)) {
      const a = actoresOf(acts, `### Protocolos «${name}»`);
      if (typeof a === "string") return fail(a);
      protocolos[name] = a;
    }
    if (Object.keys(protocolos).length < 2) return fail("### Protocolos necesita al menos 2 protocolos (uno seguro y otro que viola)");
  } else if (protoSec) {
    return fail("### Protocolos sólo existe con objetivo proteger");
  }
  const ref = jsonFence(getSection(b, "referencia"));
  if (isNoJson(ref) || !isObj(ref)) return fail("falta ### Referencia (cerca json)");
  let referencia: { historia: string[] } | { protocolo: string };
  if (objetivo === "violar") {
    if (!Array.isArray(ref.historia) || ref.historia.length === 0 || !ref.historia.every(isStr)) {
      return fail("### Referencia necesita { \"historia\": [ … ] } con objetivo violar");
    }
    referencia = { historia: ref.historia as string[] };
  } else {
    if (!isStr(ref.protocolo)) return fail("### Referencia necesita { \"protocolo\": \"…\" } con objetivo proteger");
    if (!protocolos || !(ref.protocolo in protocolos)) return fail(`### Referencia cita el protocolo «${ref.protocolo}», que no está en ### Protocolos`);
    referencia = { protocolo: ref.protocolo };
  }
  return okData({ modo: "traza", objetivo, chequeo, estado: estado as Record<string, number>, actores, invariante, protocolos, referencia });
}

function parseFallas(b: ForgeBlock): SchemaResult<HistorialData> {
  const firma = fencesByLang(getSection(b, "firma"));
  const langs = Object.keys(firma) as Lang[];
  if (langs.length === 0) return fail("falta ### Firma con una cerca javascript o python");
  const arnes = fencesByLang(getSection(b, "arnes"));
  const solucion = fencesByLang(getSection(b, "solucion"));
  const ingenua = fencesByLang(getSection(b, "ingenua"));
  const functionName: Partial<Record<Lang, string>> = {};
  for (const l of langs) {
    if (!arnes[l]) return fail(`### Arnés no trae la cerca de ${l}`);
    if (!/\barnes\b/.test(arnes[l]!)) return fail(`### Arnés (${l}) debe definir arnes(calendario)`);
    if (!solucion[l]) return fail(`### Solución no trae la cerca de ${l}`);
    if (!ingenua[l]) return fail(`### Ingenua no trae la cerca de ${l}`);
    const fnName = deriveFunctionName(firma[l]!, l);
    if (!fnName) return fail(`### Firma (${l}) no declara una función`);
    functionName[l] = fnName;
  }
  const cal = jsonFence(getSection(b, "calendarios"));
  if (isNoJson(cal) || !Array.isArray(cal) || cal.length === 0) return fail("falta ### Calendarios (cerca json con al menos un calendario)");
  const err = eachObj(cal, "### Calendarios", (o) => {
    if (!isStr(o.nombre)) return "necesita nombre";
    if (!Array.isArray(o.eventos)) return "necesita eventos (lista)";
    if (!isObj(o.espera) || Object.keys(o.espera).length === 0) return "necesita espera (objeto de propiedades)";
    for (const [k, v] of Object.entries(o.espera)) if (typeof v !== "boolean") return `espera.${k} debe ser booleano`;
    return null;
  });
  if (err) return fail(err);
  const names = new Set(cal.map((c) => (c as { nombre: string }).nombre));
  if (names.size !== cal.length) return fail("### Calendarios: nombres repetidos");
  return okData({
    modo: "fallas",
    firma,
    arnes,
    calendarios: cal as { nombre: string; eventos: unknown[]; espera: Record<string, boolean> }[],
    solucion,
    ingenua,
    functionName,
  });
}

export function parse(b: ForgeBlock): SchemaResult<HistorialData> {
  if (b.lines.modo === "traza") return parseTraza(b);
  if (b.lines.modo === "fallas") return parseFallas(b);
  return fail("modo: debe ser traza o fallas");
}
