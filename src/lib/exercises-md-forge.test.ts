import { describe, expect, it } from "vitest";
import { explainExercisesMd, parseExercisesMd } from "@/lib/exercises-md";
import { validateBank } from "@/lib/exercises-validate";
import { FORGE_TYPES, type ForgeBankItem } from "@/forge/bank/registry";
import { VARIACION_RECHAZO } from "@/forge/bank/types/entrevista";
import { BLOCKS, MANDATORY, MODULE_ID, bankMd, withoutField } from "@/forge/__tests__/fixtures/forge-blocks";

// CA-30 (schema of the 16 Forge types, design §9.2-§9.3): a valid block parses; removing ANY mandatory field
// rejects the WHOLE bank (all-or-nothing, even next to a valid block); plus the common rules (id:, rol:, ####,
// ### Variación in entrevista, unique ids).

const forgeItems = (md: string) => (parseExercisesMd(md)?.exercises ?? []).filter((e): e is ForgeBankItem => e.kind === "forge");

describe("exercises-md · the 16 Forge types (schema)", () => {
  it("the registry lists exactly the 16 types of §9.1", () => {
    expect([...FORGE_TYPES].sort()).toEqual(Object.keys(BLOCKS).sort());
    expect(FORGE_TYPES).toHaveLength(16);
  });

  describe.each(FORGE_TYPES.map((t) => [t]))("%s", (type) => {
    it("a valid block parses with its id, rol and statement", () => {
      const r = explainExercisesMd(bankMd([BLOCKS[type]]));
      expect(r.ok, r.ok ? "" : r.error).toBe(true);
      const items = forgeItems(bankMd([BLOCKS[type]]));
      expect(items).toHaveLength(1);
      const it0 = items[0]!;
      expect(it0.type).toBe(type);
      expect(it0.id).toBe(`${MODULE_ID}:${it0.itemId}`);
      expect(it0.statement).not.toMatch(/^(type|id|rol)\s*:/m);
      expect(it0.statement.length).toBeGreaterThan(0);
    });

    it.each(MANDATORY[type].map((f) => [f]))("without %s the whole bank is rejected", (field) => {
      const broken = withoutField(BLOCKS[type], field);
      expect(broken, `the fixture of ${type} did not contain ${field}`).not.toBe(BLOCKS[type]);
      // next to a valid giro: the bank is still rejected entirely (all-or-nothing)
      const md = bankMd([BLOCKS.giro.replace("id: giro-fuente", "id: giro-otro"), broken]);
      const r = explainExercisesMd(md);
      expect(r.ok, `quitar ${field} de ${type} no rechazó el banco`).toBe(false);
      expect(parseExercisesMd(md)).toBeNull();
      if (!r.ok) expect(r.error).toContain("«");
    });

    it("an empty statement rejects", () => {
      const lines = BLOCKS[type].split("\n");
      const firstSection = lines.findIndex((l) => l.startsWith("### "));
      const keep = lines.slice(0, firstSection).filter((l) => /^(##\s|[a-z_]+\s*:)/.test(l));
      const md = bankMd([[...keep, "", ...lines.slice(firstSection)].join("\n")]);
      expect(parseExercisesMd(md)).toBeNull();
    });
  });
});

describe("exercises-md · common Forge rules (§9.2)", () => {
  it("id: is mandatory and must match ^[a-z0-9][a-z0-9-]{1,63}$", () => {
    expect(parseExercisesMd(bankMd([BLOCKS.giro.replace("id: giro-fuente", "id: Giro_Fuente")]))).toBeNull();
    expect(parseExercisesMd(bankMd([BLOCKS.giro.replace("id: giro-fuente\n", "")]))).toBeNull();
  });

  it("two blocks with the same id: reject the bank", () => {
    const r = explainExercisesMd(bankMd([BLOCKS.giro, BLOCKS.expediente.replace("id: exp-colas", "id: giro-fuente")]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/repetido/);
  });

  it("rol: defaults to practica and rejects unknown values", () => {
    expect(forgeItems(bankMd([BLOCKS.expediente]))[0]!.rol).toBe("practica");
    expect(forgeItems(bankMd([BLOCKS.giro]))[0]!.rol).toBe("transferencia");
    expect(parseExercisesMd(bankMd([BLOCKS.giro.replace("rol: transferencia", "rol: examen")]))).toBeNull();
  });

  it("#### only exists inside ### Mutantes", () => {
    const md = bankMd([BLOCKS.expediente.replace("### Pasada 3", "#### suelto\n\n### Pasada 3")]);
    const r = explainExercisesMd(md);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/####/);
  });

  it("entrevista rejects ### Variación: the variation of an interview is the bank's giro (type j)", () => {
    const md = bankMd([`${BLOCKS.entrevista}\n\n### Variación\nSe elimina una fuente.`]);
    const r = explainExercisesMd(md);
    expect(r.ok, "un bloque entrevista con ### Variación se aceptó: la celda tendría dos giros").toBe(false);
    if (!r.ok) expect(r.error).toContain(VARIACION_RECHAZO);
  });

  it("type-specific lines are removed from the statement; unknown lines stay", () => {
    const item = forgeItems(bankMd([BLOCKS.senal.replace("Elige el patrón", "nota: libre\nElige el patrón")]))[0]!;
    expect(item.statement).not.toMatch(/semilla\s*:/);
    expect(item.statement).toContain("nota: libre");
  });

  it("a repeated section or a repeated line rejects", () => {
    expect(parseExercisesMd(bankMd([`${BLOCKS.giro}\n\n### Rúbrica\n- otra`]))).toBeNull();
    expect(parseExercisesMd(bankMd([BLOCKS.senal.replace("semilla: 7", "semilla: 7\nsemilla: 8")]))).toBeNull();
  });

  it("id: and rol: on the existing kinds are optional and change the id only when present", () => {
    const choice = `## Elige\ntype: choice\nid: elige-uno\nrol: recuperacion\n\n¿Cuál?\n\n### Opciones\n- [x] A\n- B\n\n### Justificación\nPorque A.`;
    const ex = parseExercisesMd(bankMd([choice]))!.exercises[0]!;
    expect(ex.id).toBe(`${MODULE_ID}:elige-uno`);
    expect(ex.itemId).toBe("elige-uno");
    expect(ex.rol).toBe("recuperacion");
    expect((ex as { statement: string }).statement).toBe("¿Cuál?");
    const plain = parseExercisesMd(bankMd([choice.replace("id: elige-uno\nrol: recuperacion\n", "")]))!.exercises[0]!;
    expect(plain.id).toBe(`${MODULE_ID}:0-elige`);
    expect("itemId" in plain).toBe(false);
    expect("rol" in plain).toBe(false);
  });

  it("desvanecido: code regions and prose steps; lang without a template rejects", () => {
    const item = forgeItems(bankMd([BLOCKS.desvanecido]))[0]!;
    if (item.type !== "desvanecido") throw new Error("tipo");
    expect(Object.keys(item.data.plantilla!.regiones)).toEqual(["1", "2"]);
    expect(item.data.plantilla!.functionName).toBe("suma");
    expect(parseExercisesMd(bankMd([BLOCKS.desvanecido.replace("- 2: 1, 2", "- 2: 1, 9")]))).toBeNull();
  });

  it("historial proteger needs ### Protocolos with a reference protocol that exists", () => {
    const proteger = BLOCKS.historial
      .replace("objetivo: violar", "objetivo: proteger")
      .replace(
        /### Referencia[\s\S]*$/,
        '### Protocolos\n~~~json\n{ "candado": { "A": ["bloquear r", "leer cupo -> a", "liberar r"], "B": ["bloquear r", "leer cupo -> b", "liberar r"] }, "ingenuo": { "A": ["leer cupo -> a"], "B": ["leer cupo -> b"] } }\n~~~\n\n### Referencia\n~~~json\n{ "protocolo": "candado" }\n~~~',
      );
    expect(explainExercisesMd(bankMd([proteger])).ok).toBe(true);
    expect(parseExercisesMd(bankMd([proteger.replace('"protocolo": "candado"', '"protocolo": "otro"')]))).toBeNull();
    expect(parseExercisesMd(bankMd([dropProtocolos(proteger)]))).toBeNull();
  });

  it("sql fixtures need -- fixture: <nombre> with unique names", () => {
    expect(parseExercisesMd(bankMd([BLOCKS.sql.replace("-- fixture: duplicados", "-- fixture: base")]))).toBeNull();
    expect(parseExercisesMd(bankMd([BLOCKS.sql.replace("-- fixture: base\n", "")]))).toBeNull();
  });

  it("retencion forma defensa needs a rubric; dias out of 1..120 rejects", () => {
    const defensa = `## Variante en defensa\ntype: retencion\nid: ret-def\ndias: 21\nvariante_de: mision\nforma: defensa\n\nDefiende el timeout con resultado desconocido.\n\n### Rúbrica\n- Nombra el estado desconocido.`;
    expect(explainExercisesMd(bankMd([defensa])).ok).toBe(true);
    expect(parseExercisesMd(bankMd([defensa.replace("dias: 21", "dias: 121")]))).toBeNull();
    expect(parseExercisesMd(bankMd([defensa.replace(/### Rúbrica[\s\S]*$/, "")]))).toBeNull();
  });
});

describe("exercises-md · code extension RF-E1 (### Generador, ### Casos generados, ### Comprobador)", () => {
  const code = (extra: string) => `## Trabajos
type: code
id: trabajos

Elige trabajos.

### Casos generados
~~~json
[{ "semilla": 1, "esperado": 3 }]
~~~

### Firma
~~~javascript
function elegir(trabajos) {}
~~~
~~~python
def elegir(trabajos):
    pass
~~~

### Casos
~~~json
[{ "input": [[1, 2]], "expected": 3 }]
~~~

### Solución
~~~javascript
function elegir(trabajos) { return trabajos.reduce((a, b) => a + b, 0); }
~~~
~~~python
def elegir(trabajos):
    return sum(trabajos)
~~~
${extra}`;
  const gen = `\n### Generador\n~~~javascript\nfunction generate(seed) { return [[seed, 2]]; }\n~~~\n\n### Comprobador\n~~~javascript\nfunction check(args, salida, esperado) { return salida === esperado; }\n~~~\n`;

  it("parses per language: the language with a generator gets it, the other says nothing; ### Casos is not confused", () => {
    const ex = parseExercisesMd(bankMd([code(gen)]))!.exercises as { lang: string; generator?: string; generatedCases?: unknown[]; checker?: string; testCases: unknown[] }[];
    const js = ex.find((e) => e.lang === "js")!;
    const py = ex.find((e) => e.lang === "python")!;
    expect(js.generator).toMatch(/generate/);
    expect(js.generatedCases).toEqual([{ semilla: 1, esperado: 3 }]);
    expect(js.checker).toMatch(/check/);
    expect(js.testCases).toEqual([{ input: [[1, 2]], expected: 3 }]);
    expect(py.generator).toBeUndefined();
    expect(py.generatedCases).toBeUndefined();
  });

  it("at import, generated cases are rejected honestly (no worker harness yet); in the seed they are trusted", async () => {
    const bank = parseExercisesMd(bankMd([code(gen)]))!;
    const passingPy = async (_c: string, _f: string, cases: { input: unknown[]; expected: unknown }[]) => ({
      syntaxError: null,
      cases: cases.map((c) => ({ input: c.input, expected: c.expected, output: c.expected, pass: true })),
    });
    const imported = await validateBank(bank, { source: "import", pyRun: passingPy });
    expect(imported.ok, "un banco importado con casos generados se aceptó sin validarlos").toBe(false);
    if (!imported.ok) expect(imported.errors.join(" ")).toMatch(/casos generados aún no se pueden validar/);
    expect((await validateBank(bank, { source: "seed", trustPython: true })).ok).toBe(true);
  });

  it("### Casos generados without ### Generador (or the reverse) rejects", () => {
    expect(parseExercisesMd(bankMd([code("")]))).toBeNull();
    expect(parseExercisesMd(bankMd([code(gen).replace(/### Casos generados\n~~~json\n.*\n~~~\n/, "")]))).toBeNull();
  });
});

function dropProtocolos(block: string): string {
  return block.replace(/### Protocolos\n~~~json\n[\s\S]*?\n~~~\n\n/, "");
}
