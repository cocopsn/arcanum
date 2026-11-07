// Carga perezosa con reintento (design poblar §5.7). No `next/dynamic`: en Next 14 es React.lazy + Suspense (H23), que
// guarda el rechazo de un import() y falla hasta recargar aunque vuelva la red. Webpack 5 borra de installedChunks el
// chunk que falló, así que llamar otra vez al cargador lo vuelve a pedir.
import { useCallback, useEffect, useRef, useState } from "react";

export type LazyState<T> = { estado: "cargando" } | { estado: "listo"; mod: T } | { estado: "error"; err: unknown; reintentar(): void };

export function useLazyModule<T>(load: () => Promise<T>): LazyState<T> {
  const loadRef = useRef(load);
  loadRef.current = load;
  const [n, setN] = useState(0);
  const reintentar = useCallback(() => setN((x) => x + 1), []);
  const [state, setState] = useState<LazyState<T>>({ estado: "cargando" });
  useEffect(() => {
    let alive = true;
    setState({ estado: "cargando" });
    loadRef
      .current()
      .then((mod) => {
        if (alive) setState({ estado: "listo", mod });
      })
      .catch((err: unknown) => {
        console.warn("[lecturas] un módulo perezoso no cargó", err);
        if (alive) setState({ estado: "error", err, reintentar });
      });
    return () => {
      alive = false;
    };
  }, [n, reintentar]);
  return state;
}

/** Lo que el navegador dice para chunkErrorText(): controlador del SW y red. */
export function chunkContext(): { controlled: boolean; online: boolean } {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  return { controlled: !!nav?.serviceWorker?.controller, online: nav?.onLine !== false };
}
