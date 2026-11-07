// Transporte, clasificación y normalización de la respuesta (design §14.2). invocarCompanion sigue el patrón de
// invokeForge (sb.functions.invoke con signal y timeout 130_000). La clasificación es pura y se prueba sola;
// normalizarRespuesta y motivoForma son la defensa en profundidad del cliente con las reglas de parseCompanion
// (§13.4): toda salida de la Edge pasa, y una forma inválida se descarta. Nada se reintenta solo (CA-38).
import { getSupabase } from "@/sync/client";
import { recortar, type Artefacto, type CompanionReply, type PasoPlan } from "./tipos";

/** Timeout de invoke (§14.2): cubre el intento primario y el de respaldo de Azure más la red. */
export const TIMEOUT_MS = 130_000;

/** Techos de normalizarRespuesta, iguales a los de parseCompanion con recortar (§13.4, §14.2). */
const TECHO = { respuesta: 8_000, titulo: 120, fuente: 4_000, md: 24_000, planTitulo: 120, planDetalle: 400, provider: 40 } as const;

/** La respuesta normalizada que el cliente acepta (§14.2). */
export type RespuestaNormalizada = CompanionReply & { provider: string };

/** El resultado de clasificar una respuesta de la Edge (§14.2). */
export type Clasificacion =
  | { tipo: "ok"; data: RespuestaNormalizada }
  | { tipo: "sin-sesion" }
  | { tipo: "limite"; esperaS: number }
  | { tipo: "edge-vieja" }
  | { tipo: "invalida"; campo: string }
  | { tipo: "filtrado"; texto: string }
  | { tipo: "no-disponible" }
  | { tipo: "sin-red" }
  | { tipo: "cancelada" };

const esArregloDeCadenas = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === "string");

function artefactoValido(a: unknown): a is Artefacto {
  if (!a || typeof a !== "object") return false;
  const o = a as Record<string, unknown>;
  if (typeof o.titulo !== "string" || o.titulo.length > TECHO.titulo) return false;
  if (o.tipo === "diagrama") return typeof o.fuente === "string" && o.fuente.length <= TECHO.fuente;
  if (o.tipo === "ejercicios") return typeof o.md === "string" && o.md.length <= TECHO.md;
  return false;
}

function planValido(p: unknown): p is PasoPlan {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return typeof o.titulo === "string" && o.titulo.length <= TECHO.planTitulo && typeof o.detalle === "string" && o.detalle.length <= TECHO.planDetalle;
}

/**
 * Nombre del primer campo inválido de una respuesta de la Edge, o null si la forma es válida (§14.2). Revisa en orden
 * fijo respuesta, citas, avisos, artefactos, plan y provider. Un campo ausente cuenta como [] salvo respuesta y
 * provider. La prueba de contrato de salida de §13.4 usa este nombre en su mensaje.
 */
export function motivoForma(data: unknown): string | null {
  if (!data || typeof data !== "object") return "respuesta";
  const o = data as Record<string, unknown>;
  if (typeof o.respuesta !== "string" || o.respuesta.length > TECHO.respuesta) return "respuesta";
  if (o.citas !== undefined && !esArregloDeCadenas(o.citas)) return "citas";
  if (o.avisos !== undefined && !esArregloDeCadenas(o.avisos)) return "avisos";
  const art = o.artefactos ?? [];
  if (!Array.isArray(art) || art.length > 2 || !art.every(artefactoValido)) return "artefactos";
  const plan = o.plan ?? [];
  if (!Array.isArray(plan) || plan.length > 5 || !plan.every(planValido)) return "plan";
  if (typeof o.provider !== "string" || o.provider.length < 1 || o.provider.length > TECHO.provider) return "provider";
  return null;
}

/**
 * Normaliza una respuesta de la Edge (§14.2): devuelve null si la forma es inválida; si no, un objeto reconstruido
 * sólo con respuesta, citas, artefactos, plan, avisos y provider (un campo extra se descarta).
 */
export function normalizarRespuesta(data: unknown): RespuestaNormalizada | null {
  if (motivoForma(data) !== null) return null;
  const o = data as Record<string, unknown>;
  return {
    respuesta: o.respuesta as string,
    citas: esArregloDeCadenas(o.citas) ? o.citas : [],
    artefactos: (Array.isArray(o.artefactos) ? o.artefactos : []).filter(artefactoValido) as Artefacto[],
    plan: (Array.isArray(o.plan) ? o.plan : []).filter(planValido) as PasoPlan[],
    avisos: esArregloDeCadenas(o.avisos) ? o.avisos : [],
    provider: o.provider as string,
  };
}

/** Lo que clasificar() necesita saber de un intento de invoke. */
export interface EntradaClasificar {
  /** signal.aborted del AbortController del compañero (cancelar o el corte de 130 s) */
  abortado: boolean;
  enLinea: boolean;
  /** el error que devolvió invoke (null si no hubo) */
  error: ErrorInvoke | null;
  /** el cuerpo JSON de un 2xx (de data), si lo hubo */
  data: unknown;
}

/** El error que devuelve functions.invoke (§14.2): nombre y, para HTTP/relay, el estado y el JSON leídos. */
export interface ErrorInvoke {
  clase: "fetch" | "http" | "relay";
  status?: number;
  cuerpo?: unknown;
}

/**
 * Clasifica una respuesta en el orden de §14.2 (iteración 3): (1) abortado → cancelada; (2) http/relay → estado y JSON;
 * (3) fetch sin red → sin-red; (4) fetch con red (incluye el corte de 130 s) → no-disponible. Un 2xx con forma válida
 * → ok. `normalizar` es inyectable sólo para el red-check (§23.3): la identidad deja pasar una forma inválida.
 */
export function clasificar(e: EntradaClasificar, normalizar: (d: unknown) => RespuestaNormalizada | null = normalizarRespuesta): Clasificacion {
  if (e.abortado) return { tipo: "cancelada" };
  if (!e.error) {
    const data = normalizar(e.data);
    return data ? { tipo: "ok", data } : { tipo: "no-disponible" };
  }
  if (e.error.clase === "http") {
    const status = e.error.status ?? 0;
    const err = typeof (e.error.cuerpo as { error?: unknown })?.error === "string" ? (e.error.cuerpo as { error: string }).error : "";
    if (status === 401) return { tipo: "sin-sesion" };
    if (status === 429) return { tipo: "limite", esperaS: 60 };
    if (status === 400 && /Acción desconocida/.test(err)) return { tipo: "edge-vieja" };
    if (status === 400 && /Entrada inválida/.test(err)) return { tipo: "invalida", campo: err.replace(/^Entrada inválida:\s*/, "") };
    if (status === 422) return { tipo: "filtrado", texto: err || "El proveedor de IA bloqueó el contenido por su política de seguridad; reformúlalo." };
    if (status >= 200 && status < 300 && !err) {
      const data = normalizar(e.error.cuerpo);
      return data ? { tipo: "ok", data } : { tipo: "no-disponible" };
    }
    return { tipo: "no-disponible" }; // 503, otro estado, forma inválida
  }
  if (e.error.clase === "relay") return { tipo: "no-disponible" };
  // fetch
  return e.enLinea ? { tipo: "no-disponible" } : { tipo: "sin-red" };
}

/** Lee el error de invoke a la forma pura ErrorInvoke (§14.2); asíncrono porque un Response se lee con .json(). */
async function leerError(error: unknown): Promise<ErrorInvoke> {
  const nombre = (error as { name?: string })?.name ?? "";
  const ctx = (error as { context?: unknown })?.context;
  if (ctx instanceof Response) {
    let cuerpo: unknown = null;
    try {
      cuerpo = await ctx.clone().json();
    } catch {
      cuerpo = null;
    }
    return { clase: "http", status: ctx.status, cuerpo };
  }
  if (nombre === "FunctionsRelayError") return { clase: "relay" };
  return { clase: "fetch" };
}

/**
 * Invoca la acción companion de la Edge (§14.2). Nunca lanza: devuelve una Clasificacion. `signal` cancela; el timeout
 * de 130 s lo hace la propia librería. `deps` inyecta el cliente y `enLinea` para las pruebas.
 */
export async function invocarCompanion(
  context: unknown,
  signal: AbortSignal,
  deps: {
    invoke?: (body: unknown, signal: AbortSignal) => Promise<{ data: unknown; error: unknown }>;
    enLinea?: () => boolean;
  } = {},
): Promise<Clasificacion> {
  const enLinea = deps.enLinea ?? (() => typeof navigator === "undefined" || navigator.onLine !== false);
  const invoke =
    deps.invoke ??
    ((body: unknown, s: AbortSignal) => getSupabase().functions.invoke("ai-router", { body, signal: s, timeout: TIMEOUT_MS } as never) as Promise<{ data: unknown; error: unknown }>);
  try {
    const { data, error } = await invoke({ action: "companion", context }, signal);
    if (signal.aborted) return { tipo: "cancelada" };
    if (!error) return clasificar({ abortado: false, enLinea: enLinea(), error: null, data });
    const e = await leerError(error);
    if (signal.aborted) return { tipo: "cancelada" };
    return clasificar({ abortado: false, enLinea: enLinea(), error: e, data: null });
  } catch {
    if (signal.aborted) return { tipo: "cancelada" };
    return clasificar({ abortado: false, enLinea: enLinea(), error: { clase: "fetch" }, data: null });
  }
}

/** Mensajes del panel por tipo de clasificación (§14.2). */
export const TEXTO_CLASIFICACION: Record<Clasificacion["tipo"], string> = {
  ok: "",
  "sin-sesion": "Inicia sesión para usar la IA",
  limite: "Llegaste al límite de consultas por minuto; podrás preguntar en 60 s.",
  "edge-vieja": "El compañero necesita la versión nueva del evaluador, pendiente de despliegue. El buscador funciona.",
  invalida: "Error del compañero: la solicitud no pasó la validación.",
  filtrado: "",
  "no-disponible": "La IA no está disponible ahora.",
  "sin-red": "La IA requiere conexión",
  cancelada: "Cancelado",
};

/** Recorte de la respuesta con la regla única (§12.5), por si el panel la trunca al pintar. */
export const recortarRespuesta = (s: string) => recortar(s, TECHO.respuesta);
