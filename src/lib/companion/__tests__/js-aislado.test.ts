// @vitest-environment node
// Ejecución aislada de los guiones del compañero (design §13.8, §22, CA-31). `vm` no es una frontera de seguridad: el
// código de prueba escapa del contexto a propósito (`this.constructor.constructor("return process")()`), como podría
// hacerlo el código del modelo, y lo que se mide es lo que protege de verdad: el entorno vacío del hijo, el modelo de
// permisos de Node (sin lectura de disco) y los dos relojes (el de vm y el del padre).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { correrAislado } from "../../../../scripts/companion/js-aislado.mjs";

/** Un archivo ajeno al hijo, que existe en el repo. */
const AJENO = join(process.cwd(), "package.json").replace(/\\/g, "/");
const ESCAPE = 'var P = this.constructor.constructor("return process")();\n';

type Resultado = Awaited<ReturnType<typeof correrAislado>>;
const primero = (r: Resultado) => r.resultados?.[0];

export async function lazoFindings(opciones?: Parameters<typeof correrAislado>[1]): Promise<string[]> {
  const r = await correrAislado({ codigo: "function f() { while (true) {} }", funcion: "f", casos: [{ input: [], expected: 0 }] }, opciones);
  const out: string[] = [];
  if (r.estado !== "tiempo") out.push(`el lazo infinito no lo cortó el reloj de vm (estado ${r.estado})`);
  if (r.ms > 5000) out.push(`el lazo infinito tardó ${r.ms} ms en volver`);
  return out;
}

export async function entornoFindings(opciones?: Parameters<typeof correrAislado>[1]): Promise<string[]> {
  const r = await correrAislado(
    { codigo: ESCAPE + "function f() { return Object.keys(P.env).length; }", funcion: "f", casos: [{ input: [], expected: 0 }] },
    opciones,
  );
  const n = primero(r)?.obtenido;
  return r.estado === "ok" && n === 0 ? [] : [`el código del modelo ve el entorno del proceso (${String(n ?? r.estado)} variables)`];
}

/** Las variables que libuv agrega en Windows a un hijo aunque el padre pase un entorno vacío (src/win/process.c). */
const LIBUV_WINDOWS = ["HOMEDRIVE", "HOMEPATH", "LOGONSERVER", "PATH", "SYSTEMDRIVE", "SYSTEMROOT", "TEMP", "USERDOMAIN", "USERNAME", "USERPROFILE", "WINDIR"];

/** El padre pasa un entorno vacío: el hijo nace sin variables (en Windows, sólo las que libuv agrega). */
export async function entornoPadreFindings(opciones?: Parameters<typeof correrAislado>[1]): Promise<string[]> {
  const r = await correrAislado({ codigo: "function f() { return 1; }", funcion: "f", casos: [{ input: [], expected: 1 }] }, opciones);
  const permitidas = process.platform === "win32" ? LIBUV_WINDOWS : [];
  const ajenas = (r.entornoAlNacer ?? ["(sin respuesta)"]).filter((k) => !permitidas.includes(k.toUpperCase()));
  return ajenas.length ? [`el hijo nació con variables del padre: ${ajenas.slice(0, 5).join(", ")}${ajenas.length > 5 ? "…" : ""}`] : [];
}

export async function lecturaFindings(opciones?: Parameters<typeof correrAislado>[1]): Promise<string[]> {
  const codigo =
    ESCAPE +
    `function f() { try { P.getBuiltinModule("fs").readFileSync(${JSON.stringify(AJENO)}, "utf8"); return "leyó"; } catch (e) { return e.code; } }`;
  const r = await correrAislado({ codigo, funcion: "f", casos: [{ input: [], expected: "ERR_ACCESS_DENIED" }] }, opciones);
  const p = primero(r);
  return r.estado === "ok" && p?.pasa === true ? [] : [`el código del modelo leyó un archivo ajeno (${String(p?.obtenido ?? r.estado)})`];
}

describe("js-aislado.mjs (§13.8)", () => {
  it("corre una función contra sus casos y compara afuera lo esperado", async () => {
    const r = await correrAislado({
      codigo: "function suma(a, b) { return a + b; }",
      funcion: "suma",
      casos: [
        { input: [1, 2], expected: 3 },
        { input: [2, 2], expected: 5 },
        { input: [{ x: 1 }, 0], expected: "[object Object]0" },
      ],
    });
    expect(r.estado).toBe("ok");
    expect(r.resultados?.map((x) => x.pasa)).toEqual([true, false, true]);
  });

  it("un lazo infinito vuelve como tiempo agotado en 5 s o menos", async () => {
    expect(await lazoFindings()).toEqual([]);
  });

  it("process.env llega vacío al hijo", async () => {
    expect(await entornoFindings()).toEqual([]);
  });

  it("el padre no le pasa su entorno al hijo", async () => {
    expect(await entornoPadreFindings()).toEqual([]);
  });

  it("leer un archivo ajeno falla con ERR_ACCESS_DENIED", async () => {
    expect(await lecturaFindings()).toEqual([]);
  });

  it("el padre mata al hijo que no vuelve a tiempo", async () => {
    const sinRespuesta = new Promise<Resultado>((res) => setTimeout(() => res({ estado: "error", error: "sin respuesta a los 8 s", ms: 8000 }), 8000));
    const corrida = correrAislado({ codigo: "function f() { while (true) {} }", funcion: "f", casos: [{ input: [], expected: 0 }] }, { vmMs: 60_000, matarMs: 1500 });
    const r = await Promise.race([corrida, sinRespuesta]);
    expect(r.estado, "el padre no mató al hijo colgado").toBe("matado");
    expect(r.ms).toBeLessThan(5000);
  });

  it("red-check: sin el reloj de vm → «el lazo infinito no lo cortó el reloj de vm (estado matado)»", async () => {
    expect(await lazoFindings({ vmMs: 60_000 })).toContain("el lazo infinito no lo cortó el reloj de vm (estado matado)");
  });

  it("red-check: el entorno del padre heredado y sin limpiar → «el código del modelo ve el entorno del proceso»", async () => {
    const f = await entornoFindings({ entorno: { ...process.env } as Record<string, string>, limpiar: false });
    expect(f[0]).toMatch(/^el código del modelo ve el entorno del proceso \(\d+ variables\)$/);
  });

  it("red-check: el padre pasa su entorno → «el hijo nació con variables del padre»", async () => {
    const f = await entornoPadreFindings({ entorno: { ...process.env } as Record<string, string> });
    expect(f[0]).toMatch(/^el hijo nació con variables del padre: /);
  });

  it.runIf(process.platform === "win32")("red-check (Windows): el hijo sin limpiar → ve las variables que libuv agrega", async () => {
    const f = await entornoFindings({ limpiar: false });
    expect(f[0]).toMatch(/^el código del modelo ve el entorno del proceso \(\d+ variables\)$/);
  });

  it("red-check: sin --permission → «el código del modelo leyó un archivo ajeno (leyó)»", async () => {
    expect(await lecturaFindings({ banderas: [] })).toContain("el código del modelo leyó un archivo ajeno (leyó)");
  });
}, 30_000);
