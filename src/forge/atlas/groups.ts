// Grupos del árbol del Atlas (design poblar §7.4). Puro: sin fetch ni React. Los productos van en orden alfabético; las
// páginas de servicio del sitio (`500`, `feedback`, `versions`) y la raíz `https://www.palantir.com/docs` (clave "",
// guardada en `<lang>/foundry/_index_`) van al final como «Utilidades del sitio». El conteo es honesto: productos más
// utilidades suman siempre `manifest.capas.docs.por_idioma[lang]`, cargue o no la partición de la raíz.
import type { AtlasLang, AtlasManifest, AtlasPartitionRef } from "@/forge/atlas/types";

export const UTILITY_PRODUCTS = ["500", "feedback", "versions"] as const;

/** Nombre de cada producto de servicio en el encabezado de Utilidades. */
const UTILITY_LABEL: Record<(typeof UTILITY_PRODUCTS)[number], string> = { "500": "error", feedback: "feedback", versions: "versiones" };
const ROOT_LABEL = "raíz del sitio";

export interface AtlasGroup {
  product: string;
  caps: AtlasPartitionRef[];
  pages: number;
}

export interface AtlasUtilities {
  refs: AtlasPartitionRef[];
  /** Páginas de las particiones de servicio más la raíz. */
  pages: number;
  /** Páginas de la raíz del sitio que se movieron aquí desde Foundry. */
  raiz: number;
}

/** Nombre de una partición de Utilidades en la lista: «error», «feedback», «versiones». */
export function utilityName(ref: AtlasPartitionRef): string {
  const product = ref.id.split("/")[1] ?? "";
  return isUtility(product) ? UTILITY_LABEL[product] : product;
}

/** Partición que guarda la raíz del sitio en cada idioma (H12). En jp, zh y kr no la trae. */
export function rootPartitionId(lang: AtlasLang): string {
  return `${lang}/foundry/_index_`;
}

function isUtility(product: string): product is (typeof UTILITY_PRODUCTS)[number] {
  return (UTILITY_PRODUCTS as readonly string[]).includes(product);
}

/**
 * `rootPages`: páginas con `k === ""` en la partición de la raíz ya cargada; 0 mientras carga o si falló. Nunca se resta
 * de Foundry más de lo que la partición de la raíz tiene.
 */
export function atlasGroups(
  manifest: AtlasManifest,
  lang: AtlasLang,
  rootPages: number,
): { products: AtlasGroup[]; utilidades: AtlasUtilities | null; total: number } {
  const by = new Map<string, AtlasPartitionRef[]>();
  const util: AtlasPartitionRef[] = [];
  const rootId = rootPartitionId(lang);
  let rootRef: AtlasPartitionRef | undefined;
  for (const p of manifest.particiones) {
    const [l, product] = p.id.split("/");
    if (l !== lang || !product) continue;
    if (p.id === rootId) rootRef = p;
    if (isUtility(product)) {
      util.push(p);
      continue;
    }
    const list = by.get(product) ?? [];
    list.push(p);
    by.set(product, list);
  }
  const raiz = rootRef ? Math.min(Math.max(0, Math.floor(rootPages)), rootRef.pages) : 0;
  const products = [...by.entries()]
    .map(([product, caps]) => ({
      product,
      caps,
      pages: caps.reduce((a, c) => a + c.pages, 0) - (caps.some((c) => c.id === rootId) ? raiz : 0),
    }))
    .sort((a, b) => a.product.localeCompare(b.product));
  const order = (r: AtlasPartitionRef) => UTILITY_PRODUCTS.indexOf(r.id.split("/")[1] as (typeof UTILITY_PRODUCTS)[number]);
  const refs = util.sort((a, b) => order(a) - order(b) || a.id.localeCompare(b.id));
  const utilidades = refs.length > 0 || raiz > 0 ? { refs, pages: refs.reduce((a, c) => a + c.pages, 0) + raiz, raiz } : null;
  return { products, utilidades, total: manifest.capas.docs.por_idioma[lang] ?? 0 };
}

/** Páginas que muestra una capacidad: la de la raíz descuenta las páginas que se fueron a Utilidades. */
export function capabilityPages(ref: AtlasPartitionRef, lang: AtlasLang, rootPages: number): number {
  return ref.id === rootPartitionId(lang) ? Math.max(0, ref.pages - Math.max(0, Math.floor(rootPages))) : ref.pages;
}

function joinEs(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** «Utilidades del sitio · 3 páginas · error, feedback y versiones»; con la raíz, «… · 4 páginas · …, versiones y raíz del sitio». */
export function utilitiesLabel(u: AtlasUtilities): string {
  const names = [...new Set(u.refs.map(utilityName))];
  if (u.raiz > 0) names.push(ROOT_LABEL);
  const n = u.pages.toLocaleString("en-US");
  return `Utilidades del sitio · ${n} ${u.pages === 1 ? "página" : "páginas"} · ${joinEs(names)}`;
}
