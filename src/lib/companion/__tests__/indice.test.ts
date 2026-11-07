// Índice del compañero: carga perezosa y validación (design §9.1). Usa particiones reales de construir() en un
// directorio temporal, carga por un cargador inyectado que simula los import() generados, y comprueba que una
// partición inválida queda en `faltantes` y que el vocabulario y los postings se decodifican bien.
import { describe, expect, it, vi } from "vitest";
import { construir } from "../../../../scripts/companion/build-index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Indice, cargarParticionJson, decodificarPostings, precargar } from "../indice";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

type Construido = ReturnType<typeof construir>;
const repo: Construido = construir({ root: ROOT });
/** Un cargador que simula CARGAR: devuelve { default: json } como lo hace un import() de JSON por webpack. */
function cargadorDe(particiones: { nombre: string; texto: string }[]): Record<string, () => Promise<unknown>> {
  const c: Record<string, () => Promise<unknown>> = {};
  for (const p of particiones) c[p.nombre] = () => Promise.resolve({ default: JSON.parse(p.texto) });
  return c;
}

describe("decodificar postings (§8.4)", () => {
  it("delta base36 acumulado y tf base36 (1 si falta)", () => {
    expect(decodificarPostings("0,1,2:3")).toEqual([
      [0, 1],
      [1, 1],
      [3, 3],
    ]);
    expect(decodificarPostings("")).toEqual([]);
  });
});

describe("validación al cargar (§9.1)", () => {
  it("acepta una partición bien formada y la deja consultable", async () => {
    const indice = new Indice(cargadorDe(repo.particiones));
    const p = await indice.cargar("forge-libros-p2");
    expect(p).not.toBeNull();
    expect(p!.N).toBe(p!.docs.length);
    // un término del vocabulario devuelve postings; uno ausente, null
    expect(p!.postings("write") === null || Array.isArray(p!.postings("write"))).toBe(true);
    expect(p!.postings("zzzznoexiste")).toBeNull();
  });

  it("una partición con N que no cuadra con los documentos no valida", () => {
    const json = JSON.parse(repo.particiones.find((p) => p.nombre === "forge-libros-p2")!.texto);
    json.N = json.N + 1;
    expect(cargarParticionJson(json, "forge-libros-p2")).toBeNull();
  });

  it("una partición con v y q de distinto largo no valida", () => {
    const json = JSON.parse(repo.particiones[0]!.texto);
    json.v = json.v + " colgado";
    expect(cargarParticionJson(json, repo.particiones[0]!.nombre)).toBeNull();
  });

  it("una partición que no es del formato esperado no valida", () => {
    expect(cargarParticionJson({ f: "otro/9", p: "x", N: 0, s: [], d: [], v: "", q: "" })).toBeNull();
    expect(cargarParticionJson(null)).toBeNull();
  });

  it("una partición que no carga (import rechaza) queda en faltantes con motivo no-carga", async () => {
    const cargador = { "forge-fichas": () => Promise.reject(new Error("chunk")) };
    const indice = new Indice(cargador);
    const p = await indice.cargar("forge-fichas");
    expect(p).toBeNull();
    expect(indice.faltantes).toEqual([{ nombre: "forge-fichas", motivo: "no-carga" }]);
  });

  it("una partición cuyo JSON no valida queda en faltantes con motivo invalida", async () => {
    const malo = { "libros-itc": () => Promise.resolve({ default: { f: "roto" } }) };
    const indice = new Indice(malo);
    expect(await indice.cargar("libros-itc")).toBeNull();
    expect(indice.faltantes).toEqual([{ nombre: "libros-itc", motivo: "invalida" }]);
  });
});

describe("gestor perezoso (§9.1)", () => {
  it("carga cada partición una sola vez y memoriza lo cargado", async () => {
    const importar = vi.fn(() => Promise.resolve({ default: JSON.parse(repo.particiones[0]!.texto) }));
    const indice = new Indice({ [repo.particiones[0]!.nombre]: importar });
    await indice.cargar(repo.particiones[0]!.nombre);
    await indice.cargar(repo.particiones[0]!.nombre);
    expect(importar).toHaveBeenCalledTimes(1);
    expect(indice.listas).toHaveLength(1);
  });

  it("nombresDeSpine lista las particiones de un mundo por el manifiesto", () => {
    const indice = new Indice(cargadorDe(repo.particiones));
    const forge = indice.nombresDeSpine("Engineering Forge");
    expect(forge).toContain("forge-libros-p2");
    expect(forge.every((n) => n.startsWith("forge-"))).toBe(true);
  });

  it("precargar carga en reposo las particiones del mundo activo", async () => {
    const indice = new Indice(cargadorDe(repo.particiones));
    const pedir = vi.fn();
    precargar(indice, "ITC", pedir);
    await new Promise((r) => setTimeout(r, 10));
    expect(pedir).toHaveBeenCalled();
    expect(indice.listas.some((p) => p.spine === "ITC")).toBe(true);
  });
});
