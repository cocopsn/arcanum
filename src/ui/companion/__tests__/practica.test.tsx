// Corredor de práctica: protección (c) y CA-33/CA-34 (design §18.3, §18.4, §18.5). Aprobar tres ejercicios generados
// NO toca la maestría: ni el log de eventos (getEvents del mismo largo), ni la proyección (project() igual en
// profundidad), ni los bancos curados (listBanks() sin cambios). El corredor no usa ExerciseMode, useActions, useReward
// ni audio, y los lotes viven en arcanum-companion, nunca en arcanum-exercises. Red-checks: un alAprobar que llama
// passLesson → «un ejercicio generado cambió la maestría»; un db que llama saveExerciseBank → «un lote generado entró a
// arcanum-exercises»; una copia del editor con aria-label y sin label → «el editor de práctica no tiene nombre
// accesible».
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ArcanumProvider } from "@/app/providers";
import { createDb, type ArcanumDB } from "@/db/schema";
import { listBanks, saveExerciseBank } from "@/lib/exercise-store";
import { project } from "@/core/projector";
import { armarLote, validarLote, type LoteAceptado } from "@/lib/companion/lote";
import { Practica } from "../practica/Practica";
import type { ExecRunner } from "@/lib/exercises-validate";
import type { RunResult, TestCase } from "@/lib/exercise";

afterEach(cleanup);

// jsRun de prueba que corre la referencia de verdad en Node (happy-dom no tiene Worker). Hace pasar toda referencia
// correcta; el corredor sólo aprueba un ejercicio cuando todos sus casos pasan.
const jsRun: ExecRunner = async (code, functionName, cases: TestCase[]): Promise<RunResult> => {
  let fn: unknown;
  try {
    fn = new Function(`${code}\n;return typeof ${functionName}==="function"?${functionName}:undefined;`)();
  } catch (e) {
    return { syntaxError: String(e), cases: [] };
  }
  if (typeof fn !== "function") return { syntaxError: "sin función", cases: [] };
  return {
    syntaxError: null,
    cases: cases
      .filter((c) => !c.hint)
      .map((c) => {
        const out = (fn as (...a: unknown[]) => unknown)(...c.input);
        return { input: c.input, expected: c.expected, output: out, pass: JSON.stringify(out) === JSON.stringify(c.expected) };
      }),
  };
};

const META = { tema: "práctica", mundo: "inicio", lenguaje: "javascript" as const };

// Un lote con un ejercicio de cada tipo practicable (code, multiple_choice, production). Un solo `code` evita que dos
// editores compartan el id fijo cmp-editor-practica de §18.5 (sólo hay un EditorPlano montado a la vez).
function loteTres(): string {
  const code = ["## Duplicar", "", "type: code", "Devuelve el doble de n.", "", "### Firma", "```js", "function duplica(n) {}", "```", "", "### Casos", "```json", '[{ "input": [2], "expected": 4 }, { "input": [5], "expected": 10 }]', "```", "", "### Solución", "```js", "function duplica(n) { return n * 2; }", "```", ""].join("\n");
  const choice = ["## Elegir", "", "type: multiple_choice", "¿Cuál de estos números es par?", "", "### Opciones", "- 3", "- [x] 4", "- 7", "", "### Justificación", "4 es divisible entre 2, los demás no.", ""].join("\n");
  const prod = ["## Explicar", "", "type: production", "Explica qué es un invariante de lazo.", "", "### Modelo", "Un invariante es una condición verdadera antes y después de cada iteración.", "", "### Regla", "Nombra la condición que no cambia durante el lazo.", "", "### Rúbrica", "- Define qué es un invariante", ""].join("\n");
  return [code, choice, prod].join("\n");
}

async function aceptarLote(): Promise<LoteAceptado> {
  const armado = armarLote(loteTres(), META);
  if (!armado.ok) throw new Error("armarLote falló: " + armado.motivo);
  const r = await validarLote(armado.md, { jsRun });
  if (!r.ok) throw new Error("validarLote falló: " + r.motivo);
  return { md: r.md, banco: r.banco, practicables: r.practicables, etiquetas: r.etiquetas };
}

async function eventos(db: ArcanumDB) {
  return db.events.orderBy("ts").toArray();
}

// Aprueba los tres ejercicios del corredor (uno de cada tipo): code (teclear la referencia y Ejecutar), choice (elegir
// la opción correcta y Comprobar) y production (Ver modelo, marcar la rúbrica y Me autoevalúo).
async function aprobarTres(lote: LoteAceptado) {
  // code
  const code = lote.practicables.find((e) => e.kind === "code") as { referenceSolution?: string } | undefined;
  const editor = screen.getByRole("textbox", { name: "Editor de práctica" }) as HTMLTextAreaElement;
  await act(async () => {
    fireEvent.input(editor, { target: { value: code?.referenceSolution ?? "" } });
  });
  await act(async () => {
    screen.getByRole("button", { name: "Ejecutar" }).click();
    await new Promise((r) => setTimeout(r, 10));
  });

  // choice: elegir «4» (la opción marcada [x]) y comprobar
  await act(async () => {
    screen.getByLabelText("4").click();
  });
  await act(async () => {
    screen.getByRole("button", { name: "Comprobar" }).click();
    await new Promise((r) => setTimeout(r, 10));
  });

  // production: abrir el modelo, marcar la rúbrica y autoevaluarse
  await act(async () => {
    screen.getByRole("button", { name: "Ver modelo y regla" }).click();
  });
  await act(async () => {
    screen.getByLabelText("Define qué es un invariante").click();
  });
  await act(async () => {
    screen.getByRole("button", { name: "Me autoevalúo" }).click();
    await new Promise((r) => setTimeout(r, 10));
  });
}

describe("protección (c): aprobar ejercicios generados no toca la maestría (CA-33)", () => {
  it("getEvents del mismo largo, project() igual y listBanks() sin cambios tras aprobar tres", { timeout: 30_000 }, async () => {
    const db = createDb(`cmp-practica-${Math.random()}`);
    const lote = await aceptarLote();

    render(
      <ArcanumProvider db={db}>
        <Practica lote={lote} alAprobar={() => {}} deps={{ jsRun }} />
      </ArcanumProvider>,
    );
    // asienta el arranque del provider (hidrata, seedBooks, seedExerciseBanks) ANTES de medir la línea base, para
    // aislar el efecto de aprobar ejercicios del ruido del arranque.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    const evAntes = await eventos(db);
    const projAntes = project(evAntes);
    const bancosAntes = await listBanks();

    await aprobarTres(lote);
    // el code aprobó (señal visible de que el flujo corrió de verdad)
    expect(screen.getByText("¡Pasa todos los casos!")).toBeTruthy();

    const evDespues = await eventos(db);
    const projDespues = project(evDespues);
    const bancosDespues = await listBanks();

    expect(evDespues.length, "un ejercicio generado cambió la maestría (el log creció)").toBe(evAntes.length);
    expect(projDespues, "un ejercicio generado cambió la maestría (project() cambió)").toEqual(projAntes);
    expect(bancosDespues, "un lote generado entró a arcanum-exercises (listBanks() cambió)").toEqual(bancosAntes);
  });
});

describe("CA-34: el lote vive en arcanum-companion, nunca en arcanum-exercises", () => {
  it("listBanks() no cambia tras practicar el lote", { timeout: 30_000 }, async () => {
    const db = createDb(`cmp-practica-banks-${Math.random()}`);
    const lote = await aceptarLote();
    render(
      <ArcanumProvider db={db}>
        <Practica lote={lote} alAprobar={() => {}} deps={{ jsRun }} />
      </ArcanumProvider>,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    const antes = await listBanks();
    await aprobarTres(lote);
    expect(await listBanks()).toEqual(antes);
  });
});

describe("red-checks de protección (c), §18.3 y §18.5", () => {
  // Red-check CA-33: un alAprobar que llama passLesson sube la maestría → el log crece.
  it("red-check: un alAprobar que escribe en el log hace crecer getEvents", { timeout: 30_000 }, async () => {
    const db = createDb(`cmp-practica-rc1-${Math.random()}`);
    const lote = await aceptarLote();
    // Escribe un evento al aprobar (lo que haría passLesson): modela la protección quitada.
    const alAprobar = () => {
      void db.events.add({
        id: `ev-${Math.random()}`,
        type: "checkpoint.passed",
        ts: Date.now(),
        device_id: "test",
        goal_id: null,
        module_id: "cel",
        payload: { score: 1 },
        v: 1,
        synced: 1,
      } as never);
    };
    render(
      <ArcanumProvider db={db}>
        <Practica lote={lote} alAprobar={alAprobar} deps={{ jsRun }} />
      </ArcanumProvider>,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const antes = (await eventos(db)).length;
    await aprobarTres(lote);
    const despues = (await eventos(db)).length;
    const hallazgo = despues > antes ? "un ejercicio generado cambió la maestría" : "";
    expect(hallazgo).toBe("un ejercicio generado cambió la maestría");
  });

  // Red-check CA-34: un db que llama saveExerciseBank al guardar el lote → un banco generado entra a arcanum-exercises.
  it("red-check: guardar el lote con saveExerciseBank lo mete a arcanum-exercises", { timeout: 30_000 }, async () => {
    const antes = (await listBanks()).length;
    const lote = await aceptarLote();
    // «sin la protección» = un almacén que además guarda el lote en arcanum-exercises (lo que §18.3 prohíbe).
    await saveExerciseBank(lote.md, { source: "import" });
    const despues = (await listBanks()).length;
    const hallazgo = despues > antes ? "un lote generado entró a arcanum-exercises" : "";
    expect(hallazgo).toBe("un lote generado entró a arcanum-exercises");
    // limpieza: quita el banco que el red-check metió para no contaminar a otras pruebas
    const { getBanksForModule, deleteBank } = await import("@/lib/exercise-store");
    const armado = armarLote(loteTres(), META);
    if (armado.ok) {
      const moduleId = armado.md.match(/module_id:\s*(\S+)/)?.[1];
      if (moduleId) for (const b of await getBanksForModule(moduleId)) await deleteBank(b.id);
    }
  });

  // Red-check protección h / §18.5 (nombre accesible): una copia del editor con aria-label (que cae en el <div>) y sin
  // <label> para el <textarea> no tiene nombre accesible: getByRole("textbox", { name }) no lo encuentra.
  it("red-check: un editor con aria-label en el div y sin label no tiene nombre accesible", () => {
    // La copia insegura pone el aria-label donde react-simple-code-editor lo repartiría: el <div> exterior. El
    // <textarea> queda sin nombre accesible.
    render(
      <div aria-label="Editor de práctica">
        <textarea defaultValue="x" />
      </div>,
    );
    const porNombre = screen.queryByRole("textbox", { name: "Editor de práctica" });
    const hallazgo = porNombre === null ? "el editor de práctica no tiene nombre accesible" : "";
    expect(hallazgo).toBe("el editor de práctica no tiene nombre accesible");
  });
});
