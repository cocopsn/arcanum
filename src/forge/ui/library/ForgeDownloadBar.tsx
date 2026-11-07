"use client";
// La barra de descarga de Lecturas (design poblar §5.4, §5.5 y §6.4; anexo r2 [17]). Sólo con Engineering Forge elegido:
// con una ruta, «Descargar ruta <código>»; sin ruta, «Descargar mundo». Todo pasa por la fachada (src/lib/offline/api.ts):
// el estado sale de forgeRouteStatus / forgeWorldStatus, verificado contra el almacenamiento, nunca de una bandera.
// Al desmontarse (cerrar Lecturas o cambiar de alcance) cancela la descarga en curso: lo ya guardado se conserva.
// Monocromo (D4): data-world="forge" y sólo tokens --forge-*.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ReadModel } from "@/core/read-model";
import {
  deleteForgeRoute,
  deleteForgeWorld,
  downloadForgeRoute,
  downloadForgeWorld,
  forgeRouteStatus,
  forgeWorldStatus,
  storageReport,
} from "@/lib/offline/api";
import { listRouteRows } from "@/lib/offline-store";
import type { DownloadOptions, DownloadResult, OfflineKind, ScopeStatus } from "@/lib/offline/types";
import { routeKey, WORLD_KEY } from "@/forge/offline/plan";
import { chunkErrorText } from "@/lib/chunk-error";
import { chunkContext } from "@/ui/books/library/use-lazy-module";
import { SUBJECT_THEMES, worldVars } from "@/lib/subject-themes";
import { APP_NO_INSTALADA, barView, downloadLabel, figurasText, freedText, IOS_SIN_INSTALAR, progressText } from "./download-bar-text";

type Fase = { k: "cargando" } | { k: "listo"; st: ScopeStatus; registrada: boolean; parcial: string | null } | { k: "error"; texto: string };
type Aviso = { motivo: Exclude<DownloadResult, { ok: true }>["motivo"]; texto: string; figurasExtra: number; conFiguras: boolean };
type Progreso = { hecho: number; total: number; tipo: OfflineKind | null };

const btn = "tap min-h-11 border border-[var(--forge-control)] px-3 text-[13px] text-text disabled:opacity-50";

export function ForgeDownloadBar({
  slug,
  code,
  readModel,
  rev = 0,
  onChanged,
}: {
  /** slug de la ruta elegida en el índice de descarga; null = el mundo entero */
  slug: string | null;
  /** código visible de la ruta («S1»); null con el mundo */
  code: string | null;
  readModel: ReadModel;
  /** sube cuando algo fuera de la barra cambió el dispositivo (borrar un libro desde su fila): se vuelve a verificar */
  rev?: number;
  /** después de descargar o borrar: el catálogo vuelve a leer Dexie y la caché */
  onChanged(): void | Promise<void>;
}) {
  const key = slug ? routeKey(slug) : WORLD_KEY;
  const [fase, setFase] = useState<Fase>({ k: "cargando" });
  const [prog, setProg] = useState<Progreso | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [liberado, setLiberado] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [ios, setIos] = useState(false);
  const alive = useRef(true);
  const ac = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    try {
      const [st, rows, verify] = await Promise.all([
        slug ? forgeRouteStatus(slug) : forgeWorldStatus(),
        listRouteRows().catch(() => []),
        import("@/forge/offline/verify"),
      ]);
      if (!alive.current) return;
      setFase({ k: "listo", st, registrada: rows.some((r) => r.key === key), parcial: verify.partialText(st) });
    } catch (e) {
      console.warn("[lecturas] no se pudo leer el estado de la descarga", e);
      if (alive.current) setFase({ k: "error", texto: chunkErrorText(chunkContext()).texto });
    }
  }, [slug, key]);

  useEffect(() => {
    alive.current = true;
    void storageReport()
      .then((r) => alive.current && setIos(r.iosSinInstalar))
      .catch(() => {});
    return () => {
      alive.current = false;
      // anexo r2 [17]: la barra cancela al cerrarse; runDownload conserva lo guardado y la fila de routes
      ac.current?.abort();
    };
  }, []);
  useEffect(() => {
    void load();
  }, [load, rev]);

  async function descargar(o: { figuras?: boolean; forzar?: boolean } = {}) {
    ac.current?.abort();
    const ctl = new AbortController();
    ac.current = ctl;
    setAviso(null);
    setLiberado(null);
    setCancelando(false);
    setProg({ hecho: 0, total: 0, tipo: null });
    const opts: DownloadOptions = {
      readModel,
      figuras: o.figuras,
      forzar: o.forzar,
      signal: ctl.signal,
      onProgress: (hecho, total, tipo) => {
        if (alive.current && !ctl.signal.aborted) setProg({ hecho, total, tipo });
      },
    };
    let r: DownloadResult;
    try {
      r = slug ? await downloadForgeRoute(slug, opts) : await downloadForgeWorld(opts);
    } catch (e) {
      console.warn("[lecturas] la descarga no pudo empezar", e);
      r = { ok: false, motivo: "no-disponible", detalle: chunkErrorText(chunkContext()).texto };
    }
    if (!alive.current) return;
    if (ac.current === ctl) ac.current = null;
    setProg(null);
    setCancelando(false);
    if (!r.ok) setAviso({ motivo: r.motivo, texto: r.detalle, figurasExtra: r.espacio?.figuras ?? 0, conFiguras: o.figuras !== false });
    await load();
    await onChanged();
  }

  function cancelar() {
    setCancelando(true);
    ac.current?.abort();
  }

  async function borrar() {
    setBorrando(true);
    setAviso(null);
    setLiberado(null);
    const python = fase.k === "listo" && fase.st.python !== null;
    try {
      const r = slug ? await deleteForgeRoute(slug) : await deleteForgeWorld();
      if (alive.current) setLiberado(freedText(r, { python }));
    } catch (e) {
      console.warn("[lecturas] no se pudo borrar la descarga", e);
      if (alive.current) setLiberado(chunkErrorText(chunkContext()).texto);
    }
    if (!alive.current) return;
    setBorrando(false);
    await load();
    await onChanged();
  }

  const theme = SUBJECT_THEMES.forge;
  const style = (theme ? worldVars(theme) : {}) as CSSProperties;
  return (
    <div data-world="forge" data-lecturas-descarga={key} style={style} className="mt-2 space-y-1.5 text-[12px] text-text-muted">
      {fase.k === "cargando" && <p role="status">Comprobando este dispositivo…</p>}
      {fase.k === "error" && (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <p>{fase.texto}</p>
          <button type="button" onClick={() => void load()} className={btn}>
            Reintentar
          </button>
        </div>
      )}
      {fase.k === "listo" && (
        <Listo
          fase={fase}
          code={code}
          prog={prog}
          cancelando={cancelando}
          borrando={borrando}
          aviso={aviso}
          liberado={liberado}
          ios={ios}
          onDescargar={(o) => void descargar(o)}
          onCancelar={cancelar}
          onBorrar={() => void borrar()}
        />
      )}
    </div>
  );
}

function Listo({
  fase,
  code,
  prog,
  cancelando,
  borrando,
  aviso,
  liberado,
  ios,
  onDescargar,
  onCancelar,
  onBorrar,
}: {
  fase: Extract<Fase, { k: "listo" }>;
  code: string | null;
  prog: Progreso | null;
  cancelando: boolean;
  borrando: boolean;
  aviso: Aviso | null;
  liberado: string | null;
  ios: boolean;
  onDescargar(o?: { figuras?: boolean; forzar?: boolean }): void;
  onCancelar(): void;
  onBorrar(): void;
}) {
  const { st } = fase;
  const view = barView(st, fase.registrada, fase.parcial);
  const figuras = figurasText(st);
  const ocupado = borrando;
  return (
    <>
      {prog ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onCancelar} disabled={cancelando} className={btn}>
              {cancelando ? "Cancelando…" : "Cancelar"}
            </button>
            <p role="status" aria-live="polite" className="min-w-0 flex-1">
              {progressText(prog)}
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="Progreso de la descarga"
            aria-valuemin={0}
            aria-valuemax={prog.total || 1}
            aria-valuenow={prog.hecho}
            className="h-1 w-full bg-[var(--forge-line)]"
          >
            <div className="h-full bg-[var(--forge-text)]" style={{ width: `${prog.total ? Math.round((prog.hecho / prog.total) * 100) : 0}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {view.k === "sin-descargar" && (
            <button type="button" onClick={() => onDescargar()} disabled={ocupado} className={btn}>
              {downloadLabel(code, st.bytesPrevistos)}
            </button>
          )}
          {view.k === "parcial" && (
            <button type="button" onClick={() => onDescargar()} disabled={ocupado} className={btn}>
              Reintentar
            </button>
          )}
          {view.k !== "sin-descargar" && (
            <button type="button" onClick={onBorrar} disabled={ocupado} className={btn}>
              {borrando ? "Borrando…" : "Borrar descarga"}
            </button>
          )}
          <p role="status" aria-live="polite" className={`min-w-0 flex-1 ${view.k === "completa" ? "text-text" : ""}`} data-lecturas-descarga-estado={view.k}>
            {view.texto}
          </p>
        </div>
      )}
      {!prog && view.k === "sin-descargar" && st.app === null && <p>{APP_NO_INSTALADA}</p>}
      {aviso && (
        <div className="space-y-1.5" role="alert">
          <p>{aviso.texto}</p>
          {aviso.motivo === "sin-espacio" && (
            <div className="flex flex-wrap gap-2">
              {aviso.conFiguras && aviso.figurasExtra > 0 && (
                <button type="button" onClick={() => onDescargar({ figuras: false })} className={btn}>
                  Descargar sin figuras
                </button>
              )}
              <button type="button" onClick={() => onDescargar({ figuras: aviso.conFiguras, forzar: true })} className={btn}>
                {aviso.conFiguras && aviso.figurasExtra > 0 ? "Descargar todo" : "Descargar de todos modos"}
              </button>
            </div>
          )}
        </div>
      )}
      {liberado && <p role="status">{liberado}</p>}
      {figuras && <p className="text-text-faint">{figuras}</p>}
      {ios && <p className="text-text-faint">{IOS_SIN_INSTALAR}</p>}
    </>
  );
}
