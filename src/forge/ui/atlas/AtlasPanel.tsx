"use client";

// ATLAS P0 mínimo (design §11): entrada con el conteo real del manifiesto, árbol producto → capacidad desde
// `manifest.particiones`, cada partición se baja en perezoso al expandirla, y búsqueda por título y migas SÓLO sobre
// las particiones ya cargadas (lo dice en pantalla: no hay búsqueda global todavía). Sólo metadatos: título, migas
// y enlace saliente ↗. Ningún cuerpo de texto. Nada del Atlas entra al bundle: todo llega por fetch same-origin.
import { useEffect, useMemo, useState } from "react";
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
import { isDocsUrl } from "@/lib/fetch-policy";

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

interface Group {
  product: string;
  caps: AtlasPartitionRef[];
  pages: number;
}

function groupsFor(manifest: AtlasManifest, lang: AtlasLang): Group[] {
  const by = new Map<string, AtlasPartitionRef[]>();
  for (const p of manifest.particiones) {
    const [l, product] = p.id.split("/");
    if (l !== lang || !product) continue;
    const list = by.get(product) ?? [];
    list.push(p);
    by.set(product, list);
  }
  return [...by.entries()]
    .map(([product, caps]) => ({ product, caps, pages: caps.reduce((a, c) => a + c.pages, 0) }))
    .sort((a, b) => a.product.localeCompare(b.product));
}

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
          className="text-[13px] text-text underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forge-text)]"
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
  const [loaded, setLoaded] = useState<Record<string, AtlasPage[] | "cargando" | "error">>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const groups = useMemo(() => groupsFor(manifest, lang), [manifest, lang]);

  async function loadPartition(ref: AtlasPartitionRef) {
    if (loaded[ref.id] && loaded[ref.id] !== "error") return;
    setLoaded((s) => ({ ...s, [ref.id]: "cargando" }));
    try {
      const files = await Promise.all(
        ref.files.map(async (f) => {
          const r = await fetch(`${ATLAS_BASE}/${f}`);
          if (!r.ok) throw new Error(`http-${r.status}`);
          return (await r.json()) as AtlasPartitionFile;
        }),
      );
      setLoaded((s) => ({ ...s, [ref.id]: files.flatMap((x) => x.pages) }));
    } catch {
      setLoaded((s) => ({ ...s, [ref.id]: "error" }));
    }
  }

  function toggle(ref: AtlasPartitionRef) {
    const next = !open[ref.id];
    setOpen((s) => ({ ...s, [ref.id]: next }));
    if (next) void loadPartition(ref);
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
      <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-4 sm:px-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="forge-label text-[11px] text-text-muted">Engineering Forge · Atlas</div>
            <h2 id="forge-atlas-title" className="mt-1 text-[24px] font-light text-text">
              Atlas de palantir.com/docs
            </h2>
            <p className="mt-1 text-[12px] text-text-muted">
              {fmt(manifest.capas.docs.paginas)} páginas · {capturedNote(manifest.capturado)}. Sólo título y migas; el
              texto se lee en la página de origen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 shrink-0 border border-[var(--forge-control)] px-3 text-[13px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forge-text)]"
          >
            Cerrar
          </button>
        </header>

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

        <label className="mt-4 block">
          <span className="forge-label text-[11px] text-text-muted">Buscar por título y migas</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 min-h-11 w-full border border-[var(--forge-control)] bg-[#1e2124] px-3 text-[14px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forge-text)]"
          />
        </label>
        <p className="mt-1 text-[11px] text-text-muted" data-atlas-search-scope="">
          La búsqueda cubre sólo las particiones cargadas en este dispositivo ({loadedIds.length}); abre una capacidad
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
            {groups.map((g) => (
              <li key={g.product} className="border-t border-[rgba(255,255,255,0.12)] py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[15px] text-text">{g.product}</h3>
                  <span className="forge-label tnum text-[10px] text-text-muted">{fmt(g.pages)} páginas</span>
                </div>
                <ul className="mt-1">
                  {g.caps.map((c) => {
                    const st = loaded[c.id];
                    return (
                      <li key={c.id} className="pl-3">
                        <button
                          type="button"
                          aria-expanded={!!open[c.id]}
                          onClick={() => toggle(c)}
                          className="min-h-11 w-full text-left text-[13px] text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forge-text)]"
                        >
                          {open[c.id] ? "▼" : "→"} {capLabel(c.id)} · <span className="tnum">{fmt(c.pages)}</span>
                        </button>
                        {open[c.id] && (
                          <div className="pl-4">
                            {st === "cargando" && <p className="text-[12px] text-text-muted">cargando partición…</p>}
                            {st === "error" && (
                              <p className="text-[12px] text-text-muted">
                                ✕ Partición no descargada en este dispositivo (sin conexión o error). Ciérrala y vuelve
                                a abrirla con red.
                              </p>
                            )}
                            {Array.isArray(st) && (
                              <ul>
                                {st.map((p) => (
                                  <PageRow key={p.u} page={p} capturado={manifest.capturado} />
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
