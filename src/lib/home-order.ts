// Orden de los mundos en el inicio (diseño poblar §8.1). Es una preferencia del dispositivo, como `arcanum_layout`:
// vive en localStorage, nunca en el log, no crea eventos y no toca `goal.upserted.priority` (§8.3). Un valor corrupto o
// con ids que ya no existen nunca rompe el inicio: se descarta lo que no vale y el resto se completa.

export const HOME_ORDER_KEY = "arcanum.home.order.v1";
const MAX_IDS = 64;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** null si falta, no es JSON, no es { v: 1, order: string[] }, trae más de 64 ids o alguno no es UUID. */
export function parseStoredOrder(raw: string | null): string[] | null {
  if (raw == null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const { v, order } = value as { v?: unknown; order?: unknown };
  if (v !== 1 || !Array.isArray(order) || order.length > MAX_IDS) return null;
  if (!order.every((id): id is string => typeof id === "string" && UUID.test(id))) return null;
  return order;
}

/** Ids guardados que siguen vivos, en su orden y sin repetir; después los vivos que no estaban, en el orden por omisión. */
export function applyOrder(liveIds: readonly string[], stored: readonly string[] | null): string[] {
  const live = new Set(liveIds);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of stored ?? []) {
    if (!live.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of liveIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Intercambia con el vecino; en un extremo (o si el id no está) devuelve el mismo arreglo. */
export function moveId(order: readonly string[], id: string, dir: -1 | 1): string[] {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order as string[];
  const next = order.slice();
  next[i] = order[j]!;
  next[j] = id;
  return next;
}

export function isDefaultOrder(order: readonly string[], liveIds: readonly string[]): boolean {
  const def = applyOrder(liveIds, null);
  return order.length === def.length && order.every((id, k) => id === def[k]);
}

/** try/catch: sin localStorage (modo privado, cuota, SSR) → null. */
export function loadHomeOrder(): string[] | null {
  try {
    return parseStoredOrder(globalThis.localStorage?.getItem(HOME_ORDER_KEY) ?? null);
  } catch {
    return null;
  }
}

/** Guarda { v: 1, order }; si falla, el orden sigue vivo en memoria hasta recargar. */
export function saveHomeOrder(order: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(HOME_ORDER_KEY, JSON.stringify({ v: 1, order: order.slice(0, MAX_IDS) }));
  } catch {
    /* el orden vive en memoria */
  }
}

export function clearHomeOrder(): void {
  try {
    globalThis.localStorage?.removeItem(HOME_ORDER_KEY);
  } catch {
    /* nada que borrar */
  }
}
