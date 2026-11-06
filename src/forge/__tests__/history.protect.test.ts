import { describe, expect, it } from "vitest";
import { parseExpr, parseStep } from "@/forge/eval/history-dsl";
import { compileActors, compileInvariant, enumerateInterleavings, gradeTraza, simulateHistory, type TrazaData } from "@/forge/eval/history-sim";
import { check } from "@/forge/bank/check/historial";
import { parseExercisesMd } from "@/lib/exercises-md";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";
import type { ForgeBankItem } from "@/forge/bank/registry";

// c · historial, modo traza (design §9.3 c). Protection: the violation is computed by the simulator; the runner's API
// never takes the learner's claim. Red-check in bitacora-e2-datos.md: taking the violation from a learner field →
// «la violación se tomó de la afirmación del alumno».

const RETIRO: TrazaData = {
  objetivo: "proteger",
  chequeo: "final",
  estado: { saldo: 100, retiros: 0 },
  actores: {
    A: ["leer saldo -> s", "validar s >= 100", "escribir saldo = s - 100", "escribir retiros = retiros + 1", "commit"],
    B: ["leer saldo -> s", "validar s >= 100", "escribir saldo = s - 100", "escribir retiros = retiros + 1", "commit"],
  },
  invariante: "saldo >= 0 && retiros <= 1",
  protocolos: {
    ingenuo: {
      A: ["leer saldo -> s", "validar s >= 100", "escribir saldo = s - 100", "escribir retiros = retiros + 1", "commit"],
      B: ["leer saldo -> s", "validar s >= 100", "escribir saldo = s - 100", "escribir retiros = retiros + 1", "commit"],
    },
    candado: {
      A: ["bloquear r", "leer saldo -> s", "validar s >= 100", "escribir saldo = s - 100", "escribir retiros = retiros + 1", "commit"],
      B: ["bloquear r", "leer saldo -> s", "validar s >= 100", "escribir saldo = s - 100", "escribir retiros = retiros + 1", "commit"],
    },
  },
};

describe("historial · la violación la calcula el simulador", () => {
  it("una historia que no viola da «no viola» aunque el alumno la etiquete como violadora", () => {
    const d: TrazaData = { ...RETIRO, objetivo: "violar", protocolos: null };
    const serial = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5"];
    const claim = { historia: serial, viola: true, afirmacion: "viola" } as { historia: string[] };
    const g = gradeTraza(d, claim);
    expect(g.estado).toBe("violar");
    if (g.estado === "violar") expect(g.correcto, "la violación se tomó de la afirmación del alumno").toBe(false);
    const g2 = gradeTraza(d, { historia: ["A1", "B1", "A2", "B2", "A3", "B3", "A4", "B4", "A5", "B5"] });
    expect(g2.estado === "violar" && g2.correcto, "el simulador no vio la doble escritura").toBe(true);
  });
  it("la enumeración marca seguro el protocolo con candado e inseguro el ingenuo", () => {
    const seguro = gradeTraza(RETIRO, { protocolo: "candado" });
    const ingenuo = gradeTraza(RETIRO, { protocolo: "ingenuo" });
    expect(seguro.estado === "proteger" && seguro.correcto, "el protocolo con candado salió inseguro").toBe(true);
    expect(ingenuo.estado === "proteger" && !ingenuo.correcto, "el protocolo ingenuo salió seguro").toBe(true);
    if (ingenuo.estado === "proteger" && !ingenuo.resultado.hasOwnProperty("error") && "historia" in ingenuo.resultado) {
      expect(ingenuo.resultado.historia.length).toBeGreaterThan(0);
    }
  });
  it("una historia que pide un candado tomado es imposible y lo dice", () => {
    const prog = compileActors(RETIRO.protocolos!.candado!);
    if (typeof prog === "string") throw new Error(prog);
    const inv = compileInvariant(RETIRO.invariante, ["saldo", "retiros"]);
    if (typeof inv === "string") throw new Error(inv);
    const r = simulateHistory(prog, RETIRO.estado, inv, "final", ["A1", "B1"]);
    expect(r).toEqual({ factible: false, motivo: "B1 espera el candado r, tomado por A1" });
  });
  it("cada-paso detecta una violación transitoria que final no ve; el abort deja sin efecto los pasos siguientes", () => {
    const actores = { A: ["leer x -> a", "escribir x = a - 1", "escribir x = a", "commit"], B: ["leer x -> b", "validar b > 5", "escribir x = 0", "commit"] };
    const prog = compileActors(actores);
    if (typeof prog === "string") throw new Error(prog);
    const inv = compileInvariant("x >= 1", ["x"]);
    if (typeof inv === "string") throw new Error(inv);
    const h = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"];
    const fin = simulateHistory(prog, { x: 1 }, inv, "final", h);
    const paso = simulateHistory(prog, { x: 1 }, inv, "cada-paso", h);
    expect(fin.factible && fin.viola).toBe(false);
    expect(paso.factible && paso.viola).toBe(true);
    expect(fin.factible && fin.traza.find((t) => t.paso === "B3")?.nota).toBe("no hace nada: B abortó");
    const e = enumerateInterleavings(prog, { x: 1 }, inv, "final");
    expect("intercalaciones" in e && e.intercalaciones).toBeGreaterThan(1);
  });
  it("la gramática es cerrada: lo que no está en el lenguaje se rechaza (sin eval)", () => {
    for (const s of ["escribir x = alert(1)", "leer x", "validar x ** 2", "borrar x", "escribir x = 1; y = 2"]) {
      expect(typeof parseStep(s), `el lenguaje aceptó «${s}»`).toBe("string");
    }
    expect(typeof parseExpr("a + b >= 2 && c != 0")).toBe("object");
  });
});

describe("historial · chequeo de ingesta (sin ejecutar nada)", () => {
  const item = (md: string) => (parseExercisesMd(md)?.exercises ?? []).find((e): e is ForgeBankItem => e.kind === "forge" && e.type === "historial");
  const guard = { source: "seed" as const, jsRun: async () => { throw new Error("check ejecutó código"); } };
  it("el fixture válido pasa el chequeo real", async () => {
    const it0 = item(bankMd([BLOCKS.historial]));
    expect(it0).toBeTruthy();
    const r = await check(it0!, guard);
    expect(r, "el chequeo real de historial rechazó su fixture válido").toEqual(expect.objectContaining({ ok: true }));
  });
  it("una referencia que no viola rechaza el banco", async () => {
    const md = bankMd([`## Doble retiro
type: historial
id: hist-noviola
modo: traza
objetivo: violar

Arma una historia que deje el saldo negativo.

### Estado
~~~json
{ "saldo": 100 }
~~~

### Actores
~~~json
{ "A": ["leer saldo -> s", "validar s >= 100", "escribir saldo = s - 100", "commit"], "B": ["leer saldo -> s", "validar s >= 100", "escribir saldo = s - 100", "commit"] }
~~~

### Invariante
~~~text
saldo >= 0
~~~

### Referencia
~~~json
{ "historia": ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"] }
~~~`]);
    const r = await check(item(md)!, guard);
    expect(r).toEqual({ ok: false, errors: [expect.stringContaining("no viola el invariante")] });
  });
});
