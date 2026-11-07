// Python de la fachada offline (design poblar §6.3): estado, calentado y borrado de Pyodide. La fachada (api.ts) lo
// importa con `await import()`, así nada de esto entra al chunk de página.
import { pyodideStatus, resetPy, warmPy, WARM_PY_FAILED, WARM_PY_TIMEOUT, WARM_PY_UNAVAILABLE } from "@/lib/py-runner";
import { PYODIDE_CACHE } from "@/lib/pyodide-files";
import type { DeleteResult, ResourceCount } from "./types";

/** Archivos de Pyodide en arcanum-pyodide (con SQLite si se pide); null sin Cache API. */
export async function pythonStatus(o: { sqlite?: boolean } = {}): Promise<ResourceCount | null> {
  const s = await pyodideStatus({ sqlite: Boolean(o.sqlite) });
  return s ? { listos: s.listos, total: s.total, faltan: s.faltan.slice(0, 20), bytes: s.bytes } : null;
}

const MOTIVO = { "sin-red": WARM_PY_FAILED, tiempo: WARM_PY_TIMEOUT, "no-disponible": WARM_PY_UNAVAILABLE } as const;

/** Descarga Pyodide (y sqlite3 si se pide) en el worker, que guarda él mismo los archivos, y comprueba después en el
 *  almacenamiento que estén todos: un «ok» del worker con algo faltante no cuenta como listo. */
export async function warmPython(o: { sqlite: boolean }): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const r = await warmPy(o.sqlite ? ["sqlite3"] : []);
  if (!r.ok) {
    console.warn(`[offline] Python no se calentó: ${r.reason}`);
    return { ok: false, motivo: MOTIVO[r.reason] };
  }
  const s = await pyodideStatus({ sqlite: o.sqlite });
  if (s === null) return { ok: false, motivo: "Python cargó, pero este navegador no deja guardarlo para usarlo sin red" };
  if (s.faltan.length) {
    console.warn(`[offline] Python incompleto: ${s.faltan.join(", ")}`);
    return { ok: false, motivo: `Python incompleto: faltan ${s.faltan.join(", ")}` };
  }
  return { ok: true };
}

/** Reinicia el worker y DESPUÉS borra arcanum-pyodide: un worker vivo guardaría en el objeto Cache de una caché ya
 *  borrada y creería tener lo que el estado da por faltante. */
export async function deletePython(): Promise<DeleteResult> {
  resetPy();
  const out: DeleteResult = { liberadosBytes: 0, compartidosBytes: 0, figurasBorradas: 0, errores: [] };
  if (typeof caches === "undefined") return { ...out, errores: ["Este navegador no expone la caché: no hay Python guardado que borrar"] };
  const antes = await pyodideStatus({ sqlite: true });
  try {
    await caches.delete(PYODIDE_CACHE);
    out.liberadosBytes = antes?.bytes ?? 0;
  } catch (e) {
    console.warn("[offline] no se pudo borrar arcanum-pyodide", e);
    out.errores.push("No se pudo borrar Python de este dispositivo");
  }
  return out;
}
