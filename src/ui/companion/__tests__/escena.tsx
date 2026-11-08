// Escena de la protección (a) (design §3.4): la vista de abajo, con un Profiler y un contador de montajes, montada
// junto al compañero dentro de ArcanumProvider con una base Dexie de prueba. La usan montaje.test.tsx,
// montaje.redcheck.test.tsx y montaje-error.test.tsx. No es una prueba (no lleva .test).
import { Profiler, useEffect, type ReactNode } from "react";
import { expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ArcanumProvider, useArcanum, useArcanumStore } from "@/app/providers";
import { createDb } from "@/db/schema";
import type { ArcanumStore } from "@/store/arcanum-store";
import { CompanionMount } from "@/ui/companion/CompanionMount";

export type Montaje = (p: { vista: ReactNode }) => JSX.Element;

/** page.tsx: CompanionMount hermano de la vista dentro de ArcanumProvider. */
export const Hermanos: Montaje = ({ vista }) => (
  <>
    {vista}
    <CompanionMount />
  </>
);

export const RESUME = JSON.stringify({ v: 1, world: null, cell: null, bookId: "libro-de-prueba", library: false, ts: 1730000000000 });
export const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function crearVista() {
  const commits = { n: 0 };
  const montajes = { n: 0 };
  const tienda: { store: ArcanumStore | null } = { store: null };
  function VistaQueCuenta() {
    tienda.store = useArcanumStore();
    useArcanum((s) => s.viewModel); // lee el store como HomeView
    const status = useArcanum((s) => s.status);
    useEffect(() => {
      montajes.n++;
    }, []);
    return (
      <div data-testid="vista-abajo" data-status={status}>
        vista de abajo
      </div>
    );
  }
  const vista = (
    <Profiler id="abajo" onRender={() => commits.n++}>
      <VistaQueCuenta />
    </Profiler>
  );
  return { vista, commits, montajes, tienda };
}

/** Deja pasar todo intervalo salvo el de 30 s de ArcanumProvider (refreshPresent), para que el reloj de la app no
 *  re-renderice la vista durante los ciclos. Devuelve la restauración. */
export function filtrarIntervalo30s(): () => void {
  const real = window.setInterval;
  window.setInterval = ((fn: TimerHandler, ms?: number, ...args: unknown[]) =>
    ms === 30_000 ? 0 : real(fn, ms, ...args)) as typeof window.setInterval;
  return () => {
    window.setInterval = real;
  };
}

const nombreBase = () => `cmp-montaje-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function montar(Montaje: Montaje) {
  const v = crearVista();
  const r = render(
    <ArcanumProvider db={createDb(nombreBase())}>
      <Montaje vista={v.vista} />
    </ArcanumProvider>,
  );
  return { ...v, r };
}

export async function esperarListo(): Promise<void> {
  await waitFor(() => expect(screen.getByTestId("vista-abajo").dataset.status).toBe("ready"), { timeout: 10_000 });
}

const orbe = () => screen.queryByRole("button", { name: "Abrir el compañero" });
const panel = () => document.getElementById("cmp-panel");
const ctrlPunto = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: ".", code: "Period", ctrlKey: true });

/**
 * La escena de §3.4 con `ciclos` vueltas de: tocar el orbe, Escape, menú «Ocultar compañero», tocar el pestillo y
 * Ctrl+. dos veces. Después de cada paso exige, en este orden: montajes.n === 1, commits.n sin cambio, 0
 * notificaciones del store, el resume byte a byte, 0 mutaciones de atributos en <html> y <body> y ningún Escape en
 * window. Lanza con el mensaje que nombra la protección.
 */
export async function correrEscena(Montaje: Montaje, ciclos = 20): Promise<{ pasos: number }> {
  localStorage.clear();
  localStorage.setItem("arcanum_resume", RESUME);
  const restaurar = filtrarIntervalo30s();
  const escapes = { n: 0 };
  const oyente = (e: KeyboardEvent) => {
    if (e.key === "Escape") escapes.n++; // como SubjectMap.tsx:192: un Escape en window cierra la vista de abajo
  };
  window.addEventListener("keydown", oyente);
  const m = montar(Montaje);
  let unsub = () => {};
  let mo: MutationObserver | null = null;
  try {
    await esperarListo();
    await waitFor(() => expect(orbe(), "no apareció el orbe").not.toBeNull(), { timeout: 10_000 });
    await esperar(200);
    const commits0 = m.commits.n;
    let notificaciones = 0;
    unsub = m.tienda.store!.subscribe(() => notificaciones++);
    const mutaciones: string[] = [];
    const nombre = (r: MutationRecord) => `${r.target === document.body ? "<body>" : "<html>"}: ${r.attributeName}`;
    mo = new MutationObserver((rs) => mutaciones.push(...rs.map(nombre)));
    mo.observe(document.documentElement, { attributes: true });
    mo.observe(document.body, { attributes: true });
    let pasos = 0;
    const comprobar = (paso: string) => {
      pasos++;
      if (m.montajes.n !== 1) throw new Error(`abrir el compañero desmontó la vista de abajo (montajes ${m.montajes.n}; ${paso})`);
      if (m.commits.n !== commits0) throw new Error(`abrir el compañero re-renderizó la vista de abajo (${m.commits.n - commits0} commits; ${paso})`);
      if (notificaciones !== 0) throw new Error(`el compañero escribió en el store: ${notificaciones} notificaciones (${paso})`);
      if (localStorage.getItem("arcanum_resume") !== RESUME) throw new Error(`el compañero cambió el resume (${paso})`);
      const todas = [...mutaciones, ...mo!.takeRecords().map(nombre)];
      if (todas.length) throw new Error(`el compañero escribió en ${todas[0]} (${paso})`);
      if (escapes.n !== 0) throw new Error(`un Escape del compañero cerró la vista de abajo (${paso})`);
    };
    const exigir = (ok: boolean, que: string) => {
      if (!ok) throw new Error(`la escena no avanzó: ${que}`);
    };
    for (let i = 1; i <= ciclos; i++) {
      fireEvent.click(orbe()!);
      exigir(panel() !== null, `tocar el orbe no abrió el panel (ciclo ${i})`);
      comprobar(`ciclo ${i}: tocar el orbe`);
      const dentro = panel()!.contains(document.activeElement) ? document.activeElement! : panel()!;
      fireEvent.keyDown(dentro, { key: "Escape", code: "Escape" });
      exigir(panel() === null && orbe() !== null, `Escape no minimizó (ciclo ${i})`);
      comprobar(`ciclo ${i}: Escape`);
      fireEvent.click(orbe()!);
      fireEvent.click(screen.getByRole("button", { name: "Menú del compañero" }));
      fireEvent.click(screen.getByRole("button", { name: "Ocultar compañero" }));
      exigir(screen.queryByRole("button", { name: "Mostrar el compañero" }) !== null, `«Ocultar compañero» no dejó el pestillo (ciclo ${i})`);
      comprobar(`ciclo ${i}: ocultar`);
      fireEvent.click(screen.getByRole("button", { name: "Mostrar el compañero" }));
      exigir(orbe() !== null, `el pestillo no devolvió el orbe (ciclo ${i})`);
      comprobar(`ciclo ${i}: pestillo`);
      ctrlPunto();
      exigir(panel() !== null, `Ctrl+. no abrió (ciclo ${i})`);
      comprobar(`ciclo ${i}: Ctrl+. abre`);
      ctrlPunto();
      exigir(panel() === null, `Ctrl+. no cerró (ciclo ${i})`);
      comprobar(`ciclo ${i}: Ctrl+. cierra`);
    }
    return { pasos };
  } finally {
    unsub();
    mo?.disconnect();
    window.removeEventListener("keydown", oyente);
    restaurar();
    m.r.unmount();
  }
}

/** CA-01: cuenta contenedores y compañeros pintados; primero los contenedores. */
export function contarCompaneros(): void {
  const hosts = document.querySelectorAll("#arcanum-companion").length;
  if (hosts > 1) throw new Error(`hay más de un #arcanum-companion: ${hosts}`);
  const pintados = document.querySelectorAll("[data-companion-chunk]").length;
  if (pintados > 1) throw new Error(`hay más de un compañero pintado: ${pintados} [data-companion-chunk]`);
  if (hosts !== 1 || pintados !== 1) throw new Error(`no hay exactamente un compañero: ${hosts} #arcanum-companion, ${pintados} [data-companion-chunk]`);
}

/** CA-01: dos montajes en la misma escena (en StrictMode, que monta, desmonta y vuelve a montar cada efecto). */
export function DosMontajes({ M }: { M: () => JSX.Element | null }) {
  return (
    <>
      <M />
      <M />
    </>
  );
}

export { orbe, panel };
