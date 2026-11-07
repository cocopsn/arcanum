"use client";

// ATLAS P0 mínimo (design §11): entrada con el conteo real del manifiesto, árbol producto → capacidad desde
// `manifest.particiones`, cada partición se baja en perezoso al expandirla, y búsqueda por título y migas SÓLO sobre
// las particiones ya cargadas (lo dice en pantalla: no hay búsqueda global todavía). Sólo metadatos: título, migas
// y enlace saliente ↗. Ningún cuerpo de texto. Nada del Atlas entra al bundle: todo llega por fetch same-origin.
//
// Bordes (design poblar §7.2, §7.4, §6.6): barra superior fija con el inset de arriba y «Cerrar» siempre visible; al
// abrir se pide sólo la partición de la raíz (`<lang>/foundry/_index_`, 3 KB) para mover la raíz del sitio a «Utilidades
// del sitio»; una partición que falla sin red dice que no está descargada y, con red, ofrece Reintentar.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ATLAS_BASE,
  ATLAS_MANIFEST_PATH,
  ATLAS_LANGS,
  normalizeAtlasText,
  type AtlasLang,
  type AtlasManifest,
  type AtlasPage,
  type AtlasPartitionFile,
  type AtlasPartitionRef,
} from "@/forge/atlas/types";
import { atlasGroups, capabilityPages, rootPartitionId, utilitiesLabel, utilityName } from "@/forge/atlas/groups";
import { isDocsUrl } from "@/lib/fetch-policy";
import { PARTITION_NOT_DOWNLOADED } from "@/lib/offline-texts";

type ManifestState = { status: "cargando" } | { status: "listo"; manifest: AtlasManifest } | { status: "error" };

const LANG_LABEL: Record<AtlasLang, string> = { en: "English", jp: "日本語", zh: "中文", kr: "한국어" };

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function capturedNote(capturado: string): string {
  return `capturado el ${capturado}; la página viva puede haber cambiado`;
}

/** Carga el manifiesto (35 KB) una vez. Si falla (sin red, sin fetch), lo dice; nunca inventa un conteo. */
export function useAtlasManifest(): ManifestState {
  const [state, setState] = useState<ManifestState>({ status: "cargando" });
  useEffect(() => {
    let alive = true;
    if (typeof fetch !== "function") {
      setState({ status: "error" });
      return;
    }
    fetch(ATLAS_MANIFEST_PATH)
      .then((r) => (r.ok ? (r.json() as Promise<AtlasManifest>) : Promise.reject(new Error(`http-${r.status}`))))
      .then((m) => {
        if (alive) setState({ status: "listo", manifest: m });
      })
      .catch(() => {
        if (alive) setState({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** Entrada al Atlas desde ForgeWorld: el conteo sale del manifiesto o no se pinta. */
export function AtlasEntry({ state, onOpen }: { state: ManifestState; onOpen: () => void }) {
  const label =
    state.status === "listo"
      ? `ATLAS · ${fmt(state.manifest.capas.docs.paginas)} páginas`
      : state.status === "cargando"
        ? "ATLAS · cargando índice"
        : "ATLAS · no disponible sin conexión";
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={state.status !== "listo"}
      className="forge-label min-h-11 border border-[var(--forge-control)] px-3 text-[12px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forge-text)] disabled:border-dashed disabled:text-text-muted"
    >
      {label} ↗
    </button>
  );
}

type PartitionState = AtlasPage[] | "cargando" | "error" | "sin-red";

function capLabel(id: string): string {
  const cap = id.split("/")[2] ?? "";
  return cap === "_index_" ? "(índice)" : cap;
}

function PageRow({ page, capturado }: { page: AtlasPage; capturado: string }) {
  const safe = isDocsUrl(page.u);
  return (
    <li className="border-t border-[rgba(255,255,255,0.08)] py-2">
      {safe ? (
        <a
          href={page.u}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 min-w-11 items-center gap-1 text-[13px] text-text underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forge-text)]"
        >
          {page.t} <span aria-hidden="true">↗</span>
          <span className="sr-only"> (se abre en palantir.com)</span>
        </a>
      ) : (
        <span className="text-[13px] text-text">{page.t}</span>
      )}
      {page.b.length > 0 && <div className="mt-0.5 text-[11px] text-text-muted">{page.b.join(" › ")}</div>}
      <div className="forge-label mt-0.5 text-[10px] text-text-muted">{capturedNote(capturado)}</div>
    </li>
  );
}

export function AtlasPanel({ manifest, onClose }: { manifest: AtlasManifest; onClose: () => void }) {
  const [lang, setLang] = useState<AtlasLang>("en");
  const [loaded, setLoaded] = useState<Record<string, PartitionState>>({});
  // the same map, read synchronously: two loads of one partition never run at once and a loaded one is never refetched
  const loadedRef = useRef<Record<string, PartitionState>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");

  const loadPartition = useCallback(async (ref: AtlasPartitionRef) => {
    const cur = loadedRef.current[ref.id];
    if (Array.isArray(cur) || cur === "cargando") return;
    const put = (v: PartitionState) => {
      loadedRef.current = { ...loadedRef.current, [ref.id]: v };
      setLoaded(loadedRef.current);
    };
    put("cargando");
    try {
      const files = await Promise.all(
        ref.files.map(async (f) => {
          const r = await fetch(`${ATLAS_BASE}/${f}`);
          if (!r.ok) throw new Error(`http-${r.status}`);
          return (await r.json()) as AtlasPartitionFile;
        }),
      );
      put(files.flatMap((x) => x.pages));
    } catch {
      // sin red: no está descargada (§6.6); con red: un error que se puede reintentar
      put(typeof navigator !== "undefined" && navigator.onLine === false ? "sin-red" : "error");
    }
  }, []);

  // the site root lives in <lang>/foundry/_index_ (H12): load ONLY that partition on open so its page can move to
  // «Utilidades del sitio». While it loads or if it fails, rootPages = 0 and the root stays counted inside Foundry.
  const rootId = rootPartitionId(lang);
  const rootRef = useMemo(() => manifest.particiones.find((p) => p.id === rootId), [manifest, rootId]);
  useEffect(() => {
    if (rootRef) void loadPartition(rootRef);
  }, [rootRef, loadPartition]);
  const rootState = loaded[rootId];
  const rootPagesList = useMemo(() => (Array.isArray(rootState) ? rootState.filter((p) => p.k === "") : []), [rootState]);
  const rootPages = rootPagesList.length;
  const { products, utilidades } = useMemo(() => atlasGroups(manifest, lang, rootPages), [manifest, lang, rootPages]);

  function toggle(ref: AtlasPartitionRef) {
    const next = !open[ref.id];
    setOpen((s) => ({ ...s, [ref.id]: next }));
    if (next) void loadPartition(ref);
  }

  // the pages a capability paints: the root partition leaves its site-root page to Utilidades
  const pagesOf = (ref: AtlasPartitionRef, st: AtlasPage[]) => (ref.id === rootId ? st.filter((p) => p.k !== "") : st);

  function capBody(c: AtlasPartitionRef) {
    const st = loaded[c.id];
    return (
      <div className="pl-4">
        {st === "cargando" && <p className="text-[12px] text-text-muted">cargando partición…</p>}
        {st === "sin-red" && <p className="text-[12px] text-text-muted">✕ {PARTITION_NOT_DOWNLOADED}</p>}
        {st === "error" && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12px] text-text-muted">✕ No se pudo cargar la partición:</p>
            <button
              type="button"
              onClick={() => void loadPartition(c)}
              className="tap border border-[var(--forge-control)] px-3 text-[12px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forge-text)]"
            >
              Reintentar
            </button>
          </div>
        )}
        {Array.isArray(st) && (
          <ul>
            {pagesOf(c, st).map((p) => (
              <PageRow key={p.u} page={p} capturado={manifest.capturado} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  function capButton(c: AtlasPartitionRef, label: string) {
    return (
      <button
        type="button"
        aria-expanded={!!open[c.id]}
        onClick={() => toggle(c)}
        className="min-h-11 w-full text-left text-[13px] text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forge-text)]"
      >
        {open[c.id] ? "▼" : "→"} {label} · <span className="tnum">{fmt(capabilityPages(c, lang, rootPages))}</span>
      </button>
    );
  }

  const loadedIds = Object.keys(loaded).filter((id) => Array.isArray(loaded[id]) && id.startsWith(`${lang}/`));
  const query = normalizeAtlasText(q.trim(), lang);
  const hits = useMemo(() => {
    if (!query) return [];
    const out: AtlasPage[] = [];
    for (const id of loadedIds) {
      for (const p of loaded[id] as AtlasPage[]) {
        if (normalizeAtlasText([p.t, ...p.b].join(" "), lang).includes(query)) out.push(p);
      }
    }
    return out.slice(0, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, loaded, lang]);

  return (
    <section
      className="fixed inset-0 z-[60] overflow-y-auto bg-[#0a0a0b]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forge-atlas-title"
      data-forge-atlas=""
    >
      <div className="mx-auto w-full max-w-4xl px-safe sm:px-safe-lg" style={{ paddingBottom: "calc(var(--safe-bottom) + 6rem)" }}>
        {/* the bar with the eyebrow and «Cerrar» stays on top while scrolling, below the status bar (§7.2) */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[var(--forge-void)] pb-2 pt-safe">
          <div className="forge-label min-w-0 text-[11px] text-text-muted">Engineering Forge · Atlas</div>
          <button
            type="button"
            onClick={onClose}
            className="tap shrink-0 border border-[var(--forge-control)] px-3 text-[13px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forge-text)]"
          >
            Cerrar
          </button>
        </header>
        <h2 id="forge-atlas-title" className="mt-1 text-[24px] font-light text-text">
          Atlas de palantir.com/docs
        </h2>
        <p className="mt-1 text-[12px] text-text-muted">
          {fmt(manifest.capas.docs.paginas)} páginas · {capturedNote(manifest.capturado)}. Sólo título y migas; el texto se
          lee en la página de origen.
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Idioma">
          {ATLAS_LANGS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={l === lang}
              onClick={() => setLang(l)}
              className={`forge-label min-h-11 border px-3 text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forge-text)] ${
                l === lang ? "border-[var(--forge-text)] text-text" : "border-dashed border-[var(--forge-control)] text-text-muted"
              }`}
            >
              {LANG_LABEL[l]} · {fmt(manifest.capas.docs.por_idioma[l] ?? 0)}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label htmlFor="forge-atlas-q" className="forge-label text-[11px] text-text-muted">
            Buscar por título y migas
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="forge-atlas-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="min-h-11 min-w-0 flex-1 border border-[var(--forge-control)] bg-[#1e2124] px-3 text-[16px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forge-text)]"
            />
            {/* the native clear button is hidden (§7.3); this one is ≥ 44 px */}
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Limpiar búsqueda"
                className="tap shrink-0 border border-[var(--forge-control)] px-3 text-[13px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forge-text)]"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-text-muted" data-atlas-search-scope="">
          La búsqueda cubre sólo las particiones cargadas en esta sesión ({loadedIds.length}); abre una capacidad
          para sumarla. Aún no hay búsqueda sobre todo el Atlas.
        </p>

        {query ? (
          <div className="mt-3" aria-live="polite">
            <div className="forge-label text-[11px] text-text-muted">{hits.length} resultados</div>
            <ul>
              {hits.map((p) => (
                <PageRow key={p.u} page={p} capturado={manifest.capturado} />
              ))}
            </ul>
          </div>
        ) : (
          <ul className="mt-4" aria-label="Productos">
            {products.map((g) => (
              <li key={g.product} className="border-t border-[rgba(255,255,255,0.12)] py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[15px] text-text">{g.product}</h3>
                  <span className="forge-label tnum text-[10px] text-text-muted">{fmt(g.pages)} páginas</span>
                </div>
                <ul className="mt-1">
                  {g.caps.map((c) => (
                    <li key={c.id} className="pl-3">
                      {capButton(c, capLabel(c.id))}
                      {open[c.id] && capBody(c)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {/* service pages and the site root, at the end and folded (§7.4); products + this = the language total */}
            {utilidades && (
              <li className="border-t border-[rgba(255,255,255,0.12)] py-2" data-atlas-utilidades="">
                <button
                  type="button"
                  aria-expanded={!!open["__utilidades__"]}
                  onClick={() => setOpen((s) => ({ ...s, __utilidades__: !s["__utilidades__"] }))}
                  className="min-h-11 w-full text-left text-[13px] text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forge-text)]"
                >
                  {open["__utilidades__"] ? "▼" : "→"} {utilitiesLabel(utilidades)}
                </button>
                {open["__utilidades__"] && (
                  <ul className="mt-1">
                    {utilidades.refs.map((c) => (
                      <li key={c.id} className="pl-3">
                        {capButton(c, utilityName(c))}
                        {open[c.id] && capBody(c)}
                      </li>
                    ))}
                    {rootPagesList.length > 0 && (
                      <li className="pl-3">
                        <div className="forge-label pt-2 text-[10px] text-text-muted">raíz del sitio</div>
                        <ul className="pl-4">
                          {rootPagesList.map((p) => (
                            <PageRow key={p.u} page={p} capturado={manifest.capturado} />
                          ))}
                        </ul>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
