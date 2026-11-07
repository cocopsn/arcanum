// Lo que la página le pregunta al SW (design poblar §6.2): cuántas entradas del precache están guardadas.
import { PRECACHE_STATUS_MSG } from "@/app/sw-rules";

/** `{ listos, total }` del precache según el SW que controla; null sin controlador, sin respuesta en `ms` (un SW
 *  anterior a este diseño no contesta) o con una respuesta que no tiene esa forma. */
export function precacheStatus(ms = 3000): Promise<{ listos: number; total: number } | null> {
  const ctl = typeof navigator !== "undefined" ? navigator.serviceWorker?.controller : null;
  if (!ctl || typeof MessageChannel === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const end = (v: { listos: number; total: number } | null) => {
      clearTimeout(t);
      ch.port1.onmessage = null;
      ch.port1.close();
      resolve(v);
    };
    const t = setTimeout(() => end(null), ms);
    ch.port1.onmessage = (e: MessageEvent) => {
      const d = e.data as { listos?: unknown; total?: unknown } | null;
      end(d && typeof d.listos === "number" && typeof d.total === "number" ? { listos: d.listos, total: d.total } : null);
    };
    try {
      ctl.postMessage({ type: PRECACHE_STATUS_MSG }, [ch.port2]);
    } catch {
      end(null);
    }
  });
}
