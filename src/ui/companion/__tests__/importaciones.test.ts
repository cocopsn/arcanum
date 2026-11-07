// Fuentes de importación del compañero (design §19.4, §2.1, §3.4; §23.3). La lista blanca de §19.4: ningún archivo del
// compañero importa las superficies, escritores de resume/libros/bancos ni la sincronización de la app; sólo lectura.ts
// importa useArcanum/useArcanumStore; sólo GuardarNota.tsx importa @/ui/use-actions; sólo forge.ts importa valores de
// src/forge/**; y CompanionMount.tsx no importa estáticamente nada salvo react y react-dom. Excluye __tests__/ y
// *.test.* (importan a propósito lo prohibido). Red-check: una importación prohibida agregada en memoria.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const RAICES = [join(ROOT, "src", "ui", "companion"), join(ROOT, "src", "lib", "companion")];
const LECTURA = join(ROOT, "src", "ui", "companion", "lectura.ts");
const GUARDARNOTA = join(ROOT, "src", "ui", "companion", "GuardarNota.tsx");
const FORGE = join(ROOT, "src", "lib", "companion", "forge.ts");
const MOUNT = join(ROOT, "src", "ui", "companion", "CompanionMount.tsx");

/** Nombres prohibidos en toda importación del compañero (§19.4). */
const PROHIBIDOS = [
  "@/db/repo", "@/db/schema", "@/sync/sync", "makeSyncClient", "saveResume", "clearResume", "saveBook", "deleteBook",
  "setProgress", "saveExerciseBank", "deleteBank", "ensureForgeBook", "ensureForgeBank", "BookReader",
  "TopicDetailSheet", "SubjectMap", "BooksLibrary",
];
/** src/forge/** con valores: sólo forge.ts (import type se permite en cualquier parte, §2.1). */
const FORGE_VALOR = /@\/forge\/(loaders|model\/|ai|data\/|atlas\/|offline\/)/;

function esPrueba(p: string): boolean {
  return /[\\/]__tests__[\\/]/.test(p) || /\.test\.[cm]?tsx?$/.test(p) || /[\\/]generated[\\/]/.test(p);
}
function caminar(dir: string): string[] {
  if (!existsSync(dir)) return [];
  let out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(caminar(p));
    else if (/\.[cm]?tsx?$/.test(p) && !esPrueba(p)) out.push(p);
  }
  return out;
}
const rel = (p: string) => p.replace(ROOT, "").replace(/\\/g, "/");
const lineaEn = (texto: string, idx: number) => texto.slice(0, idx).split("\n").length;

/** Una importación estática: `import … from "x"` o `export … from "x"`. Devuelve [especificador, texto, índice]. */
interface Imp {
  mod: string;
  clausula: string;
  tipo: boolean;
  idx: number;
}
function importaciones(texto: string): Imp[] {
  const out: Imp[] = [];
  const re = /(?:import|export)\s+([^;]*?)\s+from\s+["']([^"']+)["']/g;
  for (const m of texto.matchAll(re)) out.push({ clausula: m[1]!, mod: m[2]!, tipo: /^\s*type\b/.test(m[1]!), idx: m.index! });
  // import "x" sin cláusula
  for (const m of texto.matchAll(/import\s+["']([^"']+)["']/g)) out.push({ clausula: "", mod: m[1]!, tipo: false, idx: m.index! });
  return out;
}

function analizar(sustituciones: Record<string, string> = {}): string[] {
  const archivos = RAICES.flatMap(caminar);
  const bad: string[] = [];
  for (const archivo of archivos) {
    const texto = sustituciones[archivo] ?? readFileSync(archivo, "utf8");
    const imps = importaciones(texto);
    const donde = (i: Imp) => `${rel(archivo)}:${lineaEn(texto, i.idx)}`;
    for (const i of imps) {
      // lista negra por módulo o por nombre importado
      for (const p of PROHIBIDOS) {
        if (i.mod === p || i.clausula.includes(p)) bad.push(`importación prohibida: ${p} en ${donde(i)}`);
      }
      // useArcanum/useArcanumStore sólo en lectura.ts
      if ((/\buseArcanum\b/.test(i.clausula) || /\buseArcanumStore\b/.test(i.clausula)) && archivo !== LECTURA)
        bad.push(`importación prohibida: useArcanum/useArcanumStore fuera de lectura.ts en ${donde(i)}`);
      // @/ui/use-actions sólo en GuardarNota.tsx
      if (i.mod === "@/ui/use-actions" && archivo !== GUARDARNOTA) bad.push(`importación prohibida: @/ui/use-actions fuera de GuardarNota.tsx en ${donde(i)}`);
      // valores de src/forge/** sólo en forge.ts (import type sí se permite)
      if (FORGE_VALOR.test(i.mod) && !i.tipo && archivo !== FORGE) bad.push(`importación prohibida: valor de ${i.mod} fuera de forge.ts en ${donde(i)}`);
      // CompanionMount.tsx: sólo react y react-dom estáticos
      if (archivo === MOUNT && i.mod !== "react" && i.mod !== "react-dom") bad.push(`importación prohibida: CompanionMount importa ${i.mod} en ${donde(i)}`);
    }
  }
  return bad;
}

function redcheck(archivo: string, intacto: string, mutado: string, mensaje: string) {
  expect(analizar({ [archivo]: intacto }), "la copia intacta debe pasar antes del red-check").toEqual([]);
  const bad = analizar({ [archivo]: mutado });
  expect(bad.some((h) => h.includes(mensaje)), `el red-check no dio «${mensaje}»; dio: ${bad.join(" | ") || "nada"}`).toBe(true);
}

describe("importaciones.test.ts (design §19.4)", () => {
  const PANEL = join(ROOT, "src", "ui", "companion", "Panel.tsx");
  const panel = readFileSync(PANEL, "utf8");
  const mount = readFileSync(MOUNT, "utf8");

  it("el compañero respeta la lista blanca de §19.4", () => {
    const bad = analizar();
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("CompanionMount.tsx importa estáticamente sólo react y react-dom", () => {
    const mods = importaciones(mount).map((i) => i.mod);
    expect(mods.filter((m) => m !== "react" && m !== "react-dom"), "CompanionMount importa de más").toEqual([]);
    expect(mount.includes('import(/* webpackChunkName: "companion-ui" */ "./CompanionRoot")'), "el import() dinámico de §3.1 debe seguir").toBe(true);
  });

  it("red-check: una importación de saveResume agregada a Panel.tsx → archivo e importación", () => {
    const mut = panel.replace('import { avisoCarga } from "./aviso-carga";', 'import { avisoCarga } from "./aviso-carga";\nimport { saveResume } from "@/lib/resume";');
    redcheck(PANEL, panel, mut, "importación prohibida: saveResume");
  });

  it("red-check: useArcanum importado fuera de lectura.ts → prohibido", () => {
    const mut = panel.replace('import { avisoCarga } from "./aviso-carga";', 'import { avisoCarga } from "./aviso-carga";\nimport { useArcanum } from "@/app/providers";');
    redcheck(PANEL, panel, mut, "useArcanum/useArcanumStore fuera de lectura.ts");
  });

  it("red-check: un import estático agregado a CompanionMount.tsx → prohibido", () => {
    const mut = mount.replace('import { createPortal } from "react-dom";', 'import { createPortal } from "react-dom";\nimport { ESTILOS } from "./estilos";');
    redcheck(MOUNT, mount, mut, "CompanionMount importa ./estilos");
  });
});
