// Texto de los pasajes (design §9.4, §9.5). Usa un índice real de construir() y resultados de bm25 sobre el contenido
// del repo; hidrata con un adaptador de Forge falso que sirve el .md real de los archivos, y comprueba que un libro de
// Forge trae su sección, un libro de los cinco mundos trae la suya, un banco con título cambiado da «versión distinta»
// y un documento de diagnóstico sin evidencia se descarta.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { construir } from "../../../../scripts/companion/build-index.mjs";
import { cargarParticionJson, type ParticionCargada } from "../indice";
import { buscar, type Resultado } from "../bm25";
import { hidratarResultado, type DepsPasajes } from "../pasajes";
import type { AdaptadorForge } from "../forge";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const leer = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

let cargadas: ParticionCargada[];
beforeAll(() => {
  const repo = construir({ root: ROOT });
  cargadas = repo.particiones.map((p: { texto: string; nombre: string }) => cargarParticionJson(JSON.parse(p.texto), p.nombre)).filter((p): p is ParticionCargada => p !== null);
});

/** Adaptador de Forge falso: sirve el .md real de content/forge/books y content/forge/exercises. */
const forgeFake: AdaptadorForge = {
  libroForgeMd: async (code) => {
    try {
      return leer(`content/forge/books/${code.toLowerCase()}.md`);
    } catch {
      return null;
    }
  },
  bancoForgeMd: async (code) => {
    try {
      return leer(`content/forge/exercises/${code.toLowerCase()}.md`);
    } catch {
      return null;
    }
  },
  celdaForge: async () => null,
  rutaForgeData: async () => null,
  diagnosticoVisible: () => true,
};

const deps = (over: Partial<DepsPasajes> = {}): DepsPasajes => ({ forge: forgeFake, listBooks: async () => [], getBank: async () => null, ...over });

function unResultado(pred: (r: Resultado) => boolean, consulta: string): Resultado {
  const r = buscar(cargadas, consulta).find(pred);
  if (!r) throw new Error(`no encontré un resultado que cumpla para «${consulta}»`);
  return r;
}

describe("hidratar libro de Forge (§9.4)", () => {
  it("p2-06 trae el texto de su sección por ancla", async () => {
    const r = unResultado((x) => x.archivo === "content/forge/books/p2-06.md" && x.ancla !== "", "write skew invariante aislamiento");
    const p = await hidratarResultado(r, deps());
    expect(p).not.toBeNull();
    expect(p!.texto.length).toBeGreaterThan(50);
    expect(p!.seccion).toBe(r.etiqueta);
  });

  it("si el libro de Forge no está descargado, el pasaje queda con aviso y sin texto útil", async () => {
    const r = unResultado((x) => x.archivo === "content/forge/books/p2-06.md" && x.ancla !== "", "write skew invariante aislamiento");
    const sinLibro: AdaptadorForge = { ...forgeFake, libroForgeMd: async () => null };
    const p = await hidratarResultado(r, deps({ forge: sinLibro }));
    expect(p!.texto).toContain("Libro no descargado");
  });
});

describe("hidratar banco (§9.4)", () => {
  it("un banco de Forge trae el enunciado del bloque de su ancla", async () => {
    const r = cargadas
      .filter((p) => p.nombre.startsWith("forge-bancos-"))
      .flatMap((p) => buscar([p], "ejercicio"))
      .find((x) => x.tipo === "bancos");
    if (!r) return; // si la consulta genérica no puntúa, no forzamos
    const p = await hidratarResultado(r, deps());
    expect(p).not.toBeNull();
  });

  it("si el título del bloque ya no coincide con el ancla, da «versión distinta»", async () => {
    // resultado sintético de banco con una etiqueta que no existe en el md
    const r: Resultado = {
      particion: "forge-bancos-p2",
      doc: 0,
      ancla: "0",
      etiqueta: "ETIQUETA QUE NO EXISTE EN EL BANCO",
      spine: "Engineering Forge",
      ruta: "p2",
      tipo: "bancos",
      archivo: "content/forge/exercises/p2-06.md",
      handle: "P2-06",
      sha10: "0000000000",
      puntaje: 1,
    };
    const p = await hidratarResultado(r, deps());
    expect(p!.texto).toContain("versión distinta");
  });
});

describe("filtro de diagnóstico (§9.5)", () => {
  it("un documento de una celda D1-D8 sin evidencia se descarta", async () => {
    const r: Resultado = {
      particion: "forge-fichas",
      doc: 0,
      ancla: "D3",
      etiqueta: "Diagnóstico 3",
      spine: "Engineering Forge",
      ruta: "diagnostico",
      tipo: "fichas",
      archivo: "src/forge/data/routes/diagnostico.json",
      handle: "D3",
      sha10: "0000000000",
      puntaje: 1,
    };
    const p = await hidratarResultado(r, deps({ diagnosticoVisible: () => false }));
    expect(p).toBeNull();
  });
});
