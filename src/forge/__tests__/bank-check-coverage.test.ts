// D9 / D11.3 (integrar-fase0): bank-check registers in verification/<code>.json EVERY executable item of ANY type
// (an item with a javascript, python or sql fence, the rule of src/forge/model/authoring.ts). JS steps shaped like
// `code` (desvanecido, retencion forma codigo) run under node:vm; Python/SQL without a harness stay «sin-verificar».
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkBank, parseBank } from "../../../scripts/forge/bank-check.mjs";

const J = "```";
const BANK = `---
kind: exercises
module_id: forge-p2-06
---

## Versión del contrato
type: desvanecido
id: p206-desv-version

Completa los pasos.

### Pasos
1. Lee la versión.
2. Compárala.

### Plantilla
${J}javascript
function esMayor(a, b) {
  // <paso 1>
  const x = a;
  // </paso 1>
  // <paso 2>
  return x > b;
  // </paso 2>
}
${J}

### Casos
${J}json
[{ "input": [2, 1], "expected": true }, { "input": [1, 2], "expected": false }]
${J}

### Niveles
- 1: 2
- 2: 1, 2

## Reintento con timeout
type: retencion
id: p206-ret-timeout
dias: 7
variante_de: mision
forma: codigo

Reescribe el reintento.

### Firma
${J}javascript
function doble(n) {}
${J}

### Casos
${J}json
[{ "input": [2], "expected": 4 }]
${J}

### Solución
${J}javascript
function doble(n) { return n * 2; }
${J}

## Mutante del contrato
type: mutantes
id: p206-mut

Encuentra el mutante.

### Referencia
${J}javascript
function f(x) { return x; }
${J}

## Consulta de linaje
type: sql
id: p206-sql

### Solución
${J}sql
SELECT 1;
${J}

## Lectura del contrato
type: giro
id: p206-giro

Sin código: sólo prosa.
`;

const root = mkdtempSync(path.join(tmpdir(), "bank-check-cov-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(path.join(root, "content/forge/exercises"), { recursive: true });
writeFileSync(path.join(root, "content/forge/exercises/p2-06.md"), BANK);

const EXEC_FENCE = /^\s*(?:```|~~~)\s*(js|javascript|mjs|py|python|python3|sql|sqlite)\s*$/im;

describe("bank-check · no executable item of the bank is left without an entry (D9)", () => {
  const items = parseBank(BANK) as { id: string; tipo: string; secciones: { cuerpo: string }[] }[];
  const executable = items.filter((it) => it.secciones.some((s) => EXEC_FENCE.test(`\n${s.cuerpo}`))).map((it) => it.id);
  const r = checkBank(root, "P2-06") as { ok: boolean; error?: string; ver: { items: { id: string; lenguaje: string; resultado: string; detalle?: string }[] } };

  it("the bank has executable items of several types", () => {
    expect(r.error).toBeUndefined();
    expect(executable.sort()).toEqual(["p206-desv-version", "p206-mut", "p206-ret-timeout", "p206-sql"]);
  });

  it("every executable item has an entry in verification", () => {
    const withEntry = new Set(r.ver.items.map((e) => e.id));
    const missing = executable.filter((id) => !withEntry.has(id));
    expect(missing, `ejecutables sin entrada en verification: ${missing.join(", ")}`).toEqual([]);
  });

  it("D11.7: the function name comes from ### Firma, not from a helper defined first in the solution", () => {
    const helperBank = `---
kind: exercises
module_id: forge-f0-03
---

## Conciliar
type: code
id: f003-conciliar

Concilia.

### Firma
${J}javascript
function conciliar(xs) {}
${J}
${J}python
def conciliar(xs):
    pass
${J}

### Casos
${J}json
[{ "input": [[1, 2]], "expected": 3 }]
${J}

### Solución
${J}javascript
function _leer(xs) { return xs; }
function conciliar(xs) { return _leer(xs).reduce((a, b) => a + b, 0); }
${J}
${J}python
def _leer(xs):
    return xs

def conciliar(xs):
    return sum(_leer(xs))
${J}
`;
    writeFileSync(path.join(root, "content/forge/exercises/f0-03.md"), helperBank);
    const h = checkBank(root, "F0-03") as { ver: { items: { lenguaje: string; resultado: string; detalle?: string }[] } };
    const fallos = h.ver.items.filter((e) => e.resultado !== "paso").map((e) => `${e.lenguaje}: ${e.detalle ?? e.resultado}`);
    expect(fallos, `falso negativo con helper antes de la función principal: ${fallos.join(" | ")}`).toEqual([]);
    expect(h.ver.items.map((e) => e.lenguaje).sort()).toEqual(["javascript", "python"]);
  });

  it("JS types with a verifier (code shaped and contraejemplo/mutantes/fallas) run under node:vm; Python/SQL without a harness stays «sin-verificar»", () => {
    const by = (id: string) => r.ver.items.filter((e) => e.id === id).map((e) => `${e.lenguaje}:${e.resultado}`);
    const detail = (id: string) => r.ver.items.filter((e) => e.id === id).map((e) => e.detalle ?? "");
    expect(by("p206-desv-version")).toEqual(["javascript:paso"]);
    expect(by("p206-ret-timeout")).toEqual(["javascript:paso"]);
    // p206-mut has only ### Referencia (no Firma, no Mutantes, no Casos dorados): the JS verifier runs and fails,
    // naming the missing section — never «sin-verificar», which would hide a broken item behind «Verificado».
    expect(by("p206-mut")).toEqual(["javascript:fallo"]);
    expect(detail("p206-mut").join(" ")).toContain("secciones de mutantes");
    expect(by("p206-sql")).toEqual(["sql:sin-verificar"]);
    expect(by("p206-giro")).toEqual([]);
  });
});
