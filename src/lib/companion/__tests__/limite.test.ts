// Límite de consultas del cliente (design §14.3, CA-37). Reloj, almacenamiento y candado falsos; dos instancias con el
// mismo almacén simulan dos pestañas. Lee RATE del fuente de la Edge y exige que la ventana del cliente sea la misma y
// su máximo menor. Red-checks: max Infinity pasa de 10; sin candado dos pestañas se atropellan.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Limite, MAX, VENTANA_MS, LLAVE_RL, type AlmacenRL, type Candado } from "../limite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/** Un almacén en memoria compartible entre dos instancias (dos pestañas). */
function almacen(): AlmacenRL {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

/** Un candado serializado de verdad (como navigator.locks): una cola por nombre. */
function candadoReal(): Candado {
  const colas = new Map<string, Promise<unknown>>();
  return <T>(nombre: string, trabajo: () => Promise<T>): Promise<T> => {
    const prev = colas.get(nombre) ?? Promise.resolve();
    const corrida = prev.then(trabajo, trabajo);
    colas.set(
      nombre,
      corrida.then(
        () => undefined,
        () => undefined,
      ),
    );
    return corrida;
  };
}

describe("ventana y máximo (§14.3)", () => {
  it("la ventana del cliente es 60 s y su máximo (10) es menor que RATE.max de la Edge (12)", () => {
    const src = readFileSync(path.join(ROOT, "supabase/functions/ai-router/index.ts"), "utf8");
    const m = src.match(/const RATE = \{\s*windowMs:\s*([0-9_]+),\s*max:\s*([0-9_]+)\s*\}/);
    expect(m, "no encontré RATE en el fuente de la Edge").not.toBeNull();
    const windowMs = Number(m![1]!.replace(/_/g, ""));
    const max = Number(m![2]!.replace(/_/g, ""));
    expect(VENTANA_MS, "la ventana del compañero debe ser la de la Edge").toBe(windowMs);
    expect(MAX, "el límite del compañero no deja margen bajo el de la Edge").toBeLessThan(max);
  });
});

describe("reservar (CA-37)", () => {
  it("deja pasar MAX en la ventana y luego niega con esperaS", async () => {
    let t = 1_000_000;
    const lim = new Limite({ ahora: () => t, almacen: almacen(), candado: candadoReal() });
    for (let i = 0; i < MAX; i++) expect((await lim.reservar()).ok).toBe(true);
    const r = await lim.reservar();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.esperaS).toBeGreaterThan(0);
  });

  it("al avanzar la ventana vuelve a dejar pasar", async () => {
    let t = 0;
    const lim = new Limite({ ahora: () => t, almacen: almacen(), candado: candadoReal() });
    for (let i = 0; i < MAX; i++) await lim.reservar();
    expect((await lim.reservar()).ok).toBe(false);
    t += VENTANA_MS + 1;
    expect((await lim.reservar()).ok).toBe(true);
  });

  it("dos pestañas con el mismo almacén y candado no pasan juntas de 10 (CA-37)", async () => {
    let t = 500;
    const comun = almacen();
    const candado = candadoReal();
    const a = new Limite({ ahora: () => t, almacen: comun, candado });
    const b = new Limite({ ahora: () => t, almacen: comun, candado });
    // 20 reservas alternadas entre dos pestañas; sólo 10 pasan
    const resultados = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).reservar()));
    expect(resultados.filter((r) => r.ok).length).toBe(MAX);
  });

  it("marcarLleno niega el resto de la ventana", async () => {
    let t = 10;
    const lim = new Limite({ ahora: () => t, almacen: almacen(), candado: candadoReal() });
    lim.marcarLleno();
    expect((await lim.reservar()).ok).toBe(false);
  });
});

describe("control del red-check (g, §23.2)", () => {
  it("con el max real nunca pasa de 10; con max Infinity sí (red-check demostrado en redchecks.md)", async () => {
    const t = 0;
    const real = new Limite({ ahora: () => t, almacen: almacen(), candado: candadoReal() });
    let ok = 0;
    for (let i = 0; i < 15; i++) if ((await real.reservar()).ok) ok++;
    expect(ok).toBe(MAX);
    const sinTope = new Limite({ ahora: () => t, almacen: almacen(), candado: candadoReal(), max: Number.POSITIVE_INFINITY });
    let pasaron = 0;
    for (let i = 0; i < 15; i++) if ((await sinTope.reservar()).ok) pasaron++;
    expect(pasaron).toBeGreaterThan(MAX);
  });

  it("marcas basura en el almacén se descartan", async () => {
    let t = 1_000;
    const al = almacen();
    al.setItem(LLAVE_RL, "no-es-json");
    const lim = new Limite({ ahora: () => t, almacen: al, candado: candadoReal() });
    expect((await lim.reservar()).ok).toBe(true);
  });
});
