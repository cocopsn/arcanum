"use client";

import { useEffect, useRef, useState } from "react";
import { useArcanum } from "@/app/providers";
import { useOnline } from "@/lib/use-online";
import { getStorageStatus, requestPersist, type StorageStatus } from "@/lib/storage";
import { listDownloadedSpines, deleteSpineDownloadSafe, type OfflineSpineRow } from "@/lib/offline-store";
import { downloadSpine } from "@/lib/offline-download";
import { buildInventory, type Inventory } from "@/lib/download-inventory";
import { SPINES } from "@/lib/spines";

// Honest offline surface: a header pill (connection + N pendientes) that opens a panel with the
// storage guarantee, the pending AI queue, and per-spine "Descargar para offline" (Spotify model).
// Nothing here fakes: it reports the REAL online state, the REAL persisted flag, and the REAL count.

const MB = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);

export function OfflinePill({ onOpen }: { onOpen: () => void }) {
  const online = useOnline();
  const pending = useArcanum((s) => s.readModel.pendingAi.length);
  return (
    <button onClick={onOpen} className="flex items-center gap-1.5 text-[11px] tracking-wide text-text-faint transition hover:text-text-muted" aria-label="Estado offline">
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: online ? "var(--topic)" : "var(--amber)" }} />
      {online ? "en línea" : "sin conexión"}
      {pending > 0 && <span style={{ color: "var(--amber)" }}> · {pending} pend.</span>}
    </button>
  );
}

export function OfflineSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const online = useOnline();
  const pendingAi = useArcanum((s) => s.readModel.pendingAi);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [downloaded, setDownloaded] = useState<OfflineSpineRow[]>([]);
  const [inv, setInv] = useState<Inventory | null>(null);
  const [freed, setFreed] = useState<{ goalId: string; bytes: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ id: string; done: number; total: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    setStorage(await getStorageStatus());
    setDownloaded(await listDownloadedSpines());
    setInv(await buildInventory());
  }
  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  if (!open) return null;

  const byGoal = new Map(downloaded.map((d) => [d.goalId, d]));

  async function download(goalId: string, title: string, urls: string[]) {
    setBusy(goalId);
    setProgress({ id: goalId, done: 0, total: urls.length });
    try {
      await downloadSpine(goalId, title, urls, (done, total) => setProgress({ id: goalId, done, total }));
      await refresh();
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }
  async function remove(goalId: string) {
    setBusy(goalId);
    try {
      const { freedBytes } = await deleteSpineDownloadSafe(goalId); // frees only EXCLUSIVE bytes, keeps shared
      setFreed({ goalId, bytes: freedBytes });
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" style={{ background: "var(--overlay-scrim)" }} onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Offline"
        className="scroll-touch flex max-h-[88vh] w-full max-w-md flex-col overflow-y-auto rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 sm:rounded-[var(--r-lg)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg tracking-[0.14em] text-rank">OFFLINE</h2>
          <button onClick={onClose} aria-label="Cerrar" className="-mr-2 min-h-11 px-2 text-2xl leading-none text-text-faint transition hover:text-text">×</button>
        </div>

        {/* connection */}
        <div className="mt-3 flex items-center gap-2 text-[13px]">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: online ? "var(--topic)" : "var(--amber)" }} />
          <span className="text-text">{online ? "En línea — sync + IA activos" : "Sin conexión — el tronco funciona; la IA se difiere"}</span>
        </div>

        {/* storage guarantee (honest) */}
        <div className="mt-4 rounded-[var(--r-md)] border border-line bg-surface p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-text-faint">Almacenamiento local</div>
          <p className="mt-1 text-[13px] text-text-muted">
            {storage?.persisted === true ? (
              <>Durabilidad <span className="text-topic">GARANTIZADA</span> — el navegador no desalojará tu bitácora.</>
            ) : storage?.persisted === false ? (
              <>Durabilidad <span style={{ color: "var(--amber)" }}>no garantizada</span> — bajo presión de espacio el navegador podría desalojarla. El espejo en la nube es el respaldo (con red).</>
            ) : (
              <>Tu navegador no reporta el estado de durabilidad (honesto: desconocido). El espejo en la nube respalda con red.</>
            )}
            {storage?.usageMB != null && <> · <span className="tnum">{storage.usageMB}</span> MB usados{storage?.quotaMB ? <> de ~{storage.quotaMB} MB</> : null}.</>}
          </p>
          {storage?.persisted !== true && (
            <button
              onClick={async () => {
                await requestPersist();
                await refresh();
              }}
              className="mt-2 min-h-11 rounded-[var(--r-sm)] border border-rank px-3 text-[12px] text-rank transition hover:bg-rank-soft"
            >
              Solicitar almacenamiento durable
            </button>
          )}
        </div>

        {/* pending AI queue (honest — the gate never opens by queuing) */}
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-text-faint">Cola de evaluación IA</div>
          {pendingAi.length === 0 ? (
            <p className="mt-1 text-[13px] text-text-faint">Nada pendiente.</p>
          ) : (
            <>
              <p className="mt-1 text-[13px] text-text-muted">
                <span className="tnum" style={{ color: "var(--amber)" }}>{pendingAi.length}</span> acción{pendingAi.length === 1 ? "" : "es"} guardada{pendingAi.length === 1 ? "" : "s"} sin evaluar. Tu trabajo está a salvo; la IA real las evalúa al reconectar. Ningún gate se abre por estar en la cola.
              </p>
              <ul className="mt-2 space-y-1">
                {pendingAi.map((p) => (
                  <li key={p.queueId} className="text-[12px] text-text-faint">· {p.kind === "gate" ? "justificación de compuerta" : "evidencia de misión"} — pendiente</li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* ── DESCARGAS — inventario EXACTO, medido del store al KB, sin doble conteo ── */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.2em] text-text-faint">Descargas · almacenamiento</div>
            {inv && (
              <div className="text-[11px] text-text-muted">
                Total <span className="tnum text-rank">{MB(inv.grandTotal)}</span>
              </div>
            )}
          </div>
          {inv && (
            <p className="mt-1 text-[11px] leading-snug text-text-faint">
              Suma verificable: cada fuente cuenta UNA vez aunque dos espinas la compartan.
              {inv.storageUsageBytes != null && (
                <> El navegador reporta <span className="tnum">{MB(inv.storageUsageBytes)}</span> en total (incluye tu bitácora).</>
              )}
            </p>
          )}

          {/* bundled content (always offline) + the runtime/shell — measured line items */}
          {inv && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Line label="Libros" sub={`${inv.books.count} · incluidos`} bytes={inv.books.bytes} />
              <Line label="Ejercicios" sub={`${inv.banks.count} bancos · incluidos`} bytes={inv.banks.bytes} />
              <Line label="Runtime Python" sub={inv.runtime.present ? "Pyodide · en caché" : "no descargado"} bytes={inv.runtime.bytes} />
              <Line label="App (shell)" sub="precacheada" bytes={inv.shell.bytes} />
            </div>
          )}

          {/* audio — synthesized, so it is literally 0 bytes of assets (honest) */}
          <div className="mt-2 rounded-[var(--r-sm)] border border-line bg-surface px-3 py-2 text-[11px] text-text-faint">
            Audio (SFX + música): <span className="text-text-muted">sintetizado en el dispositivo</span> — 0 KB de archivos, funciona offline sin descargar nada.
          </div>
        </div>

        {/* spine source downloads (Spotify model) — the user-managed part, with the shared/unique split */}
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-text-faint">Fuentes por espina (offline)</div>
          <p className="mt-1 text-[12px] leading-snug text-text-faint">
            Precachea el texto extraído de las fuentes curadas (los diagramas y la estructura ya son locales; el video se ve con conexión).
          </p>
          <div className="mt-2 space-y-2">
            {SPINES.map((s) => {
              const urls = s.cells.flatMap((c) => [...(c.sourceUrls ?? []), ...(c.videoUrls ?? [])]);
              const dl = byGoal.get(s.goalId);
              const acct = inv?.spines.find((a) => a.goalId === s.goalId);
              const isBusy = busy === s.goalId;
              const prog = progress?.id === s.goalId ? progress : null;
              return (
                <div key={s.goalId} className="rounded-[var(--r-sm)] border border-line bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-serif text-[14px] text-text">{s.goalTitle}</span>
                    {acct && <span className="shrink-0 tnum text-[10px] uppercase tracking-wider text-topic">{MB(acct.footprintBytes)}</span>}
                  </div>
                  {acct && (acct.uniqueBytes > 0 || acct.sharedBytes > 0) && (
                    <div className="mt-1 text-[11px] text-text-faint">
                      <span className="tnum text-text-muted">{MB(acct.uniqueBytes)}</span> únicos
                      {acct.sharedBytes > 0 && (
                        <>
                          {" · "}
                          <span className="tnum text-text-muted">{MB(acct.sharedBytes)}</span> compartidos con {acct.sharedWith.map((w) => w.title).join(", ")}
                        </>
                      )}
                    </div>
                  )}
                  {freed?.goalId === s.goalId && !dl && (
                    <div className="mt-1 text-[11px] text-topic">
                      {freed.bytes > 0 ? (
                        <>Liberados <span className="tnum">{MB(freed.bytes)}</span>.</>
                      ) : (
                        <>Todo era compartido con otra espina — nada exclusivo que liberar (no se rompió la otra).</>
                      )}
                    </div>
                  )}
                  {prog ? (
                    <div className="mt-2 text-[12px] text-text-muted">Descargando… <span className="tnum">{prog.done}</span>/<span className="tnum">{prog.total}</span></div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => void download(s.goalId, s.goalTitle, urls)}
                        disabled={isBusy || !online}
                        className="min-h-11 rounded-[var(--r-sm)] border border-rank px-3 text-[12px] text-rank transition hover:bg-rank-soft disabled:opacity-40"
                      >
                        {dl ? "Actualizar" : "Descargar para offline"}
                      </button>
                      {dl && (
                        <button onClick={() => void remove(s.goalId)} disabled={isBusy} className="min-h-11 px-2 text-[12px] text-text-faint transition hover:text-amber disabled:opacity-40">
                          Borrar{acct && acct.uniqueBytes > 0 ? ` · libera ${MB(acct.uniqueBytes)}` : ""}
                        </button>
                      )}
                      {!online && !dl && <span className="self-center text-[11px] text-text-faint">necesita conexión para descargar</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A measured line item — a label, a sub-line, and its exact size. */
function Line({ label, sub, bytes }: { label: string; sub: string; bytes: number }) {
  const size = bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(0, Math.round(bytes / 1e3))} KB`;
  return (
    <div className="rounded-[var(--r-sm)] border border-line bg-surface px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-text">{label}</span>
        <span className="tnum text-[12px] text-text-muted">{size}</span>
      </div>
      <div className="text-[10px] text-text-faint">{sub}</div>
    </div>
  );
}
