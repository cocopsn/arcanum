// Red-check del límite de error del compañero (design §3.1, §20, §23.3; CA-02). Un error de render del compañero apaga
// el compañero y NADA MÁS: la vista de abajo sigue montada. La costura es LimiteCompanero de CompanionMount.tsx.
//
// En la app, sin ese límite el error sube hasta src/app/error.tsx, que reemplaza la página entera por «Algo falló al
// pintar esta pantalla» → también desmonta la vista de abajo (RF-B3). La prueba modela ese segmento con LimiteApp, que
// al atrapar pinta el error en vez de sus hijos. Con LimiteCompanero, LimiteApp nunca se dispara y la vista sigue; sin
// él, el error llega a LimiteApp, que quita la vista.
//
// Un «Unhandled error» reportado por Vitest sería un HALLAZGO (§23.3): el límite dejó escapar el error. Por eso la
// prueba instala un oyente `error` con preventDefault y envuelve el montaje en act asíncrono con vi.dynamicImportSettled.
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { ArcanumProvider } from "@/app/providers";
import { createDb } from "@/db/schema";
import { rojoEscena } from "./rojo";

const nombre = () => `cmp-error-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Límite igual al de CompanionMount.tsx (§3.1): atrapa y apaga el compañero. */
class LimiteCompanero extends Component<{ children: ReactNode }, { roto: boolean }> {
  state = { roto: false };
  static getDerivedStateFromError() {
    return { roto: true };
  }
  componentDidCatch() {}
  render() {
    return this.state.roto ? null : this.props.children;
  }
}

/** Modela src/app/error.tsx: al atrapar, pinta la pantalla de error EN VEZ de sus hijos (que incluyen la vista). */
class LimiteApp extends Component<{ children: ReactNode }, { roto: boolean }> {
  state = { roto: false };
  static getDerivedStateFromError() {
    return { roto: true };
  }
  componentDidCatch() {}
  render() {
    return this.state.roto ? <main role="alert">Algo falló al pintar esta pantalla</main> : this.props.children;
  }
}

/** Compañero que lanza al pintar (como un error de render en un chunk perezoso del compañero: el caso que §20 y §3.1
 *  prometen contener). El error ocurre dentro del render controlado por React, así que el límite más cercano lo atrapa
 *  de forma determinista. */
function BoomAlPintar(): JSX.Element {
  throw new Error("boom del compañero");
}

/** Monta vista + compañero (envuelto o no en el límite) bajo LimiteApp y deja que el Boom lance; devuelve si la vista
 *  sigue montada al terminar. */
async function vistaSobrevive(conLimite: boolean): Promise<boolean> {
  const oyente = (e: ErrorEvent) => e.preventDefault(); // un error de render no es «Unhandled error» del entorno
  window.addEventListener("error", oyente);
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const Companero = conLimite
    ? () => (
        <LimiteCompanero>
          <BoomAlPintar />
        </LimiteCompanero>
      )
    : BoomAlPintar;
  let presente = false;
  let desmontar: () => void = () => {};
  try {
    await act(async () => {
      const r = render(
        <LimiteApp>
          <ArcanumProvider db={createDb(nombre())}>
            <div data-testid="vista-abajo">vista de abajo</div>
            <Companero />
          </ArcanumProvider>
        </LimiteApp>,
      );
      desmontar = r.unmount;
      await new Promise<void>((res) => setTimeout(res, 400));
      await vi.dynamicImportSettled();
    });
    presente = document.querySelector('[data-testid="vista-abajo"]') !== null;
  } finally {
    desmontar();
    window.removeEventListener("error", oyente);
    spy.mockRestore();
  }
  return presente;
}

describe("límite de error del compañero (design §3.1, §23.3)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("con LimiteCompanero: el Boom apaga el compañero y la vista de abajo sigue montada", async () => {
    expect(await vistaSobrevive(true), "el límite no protegió la vista de abajo").toBe(true);
  });

  it("red-check: sin LimiteCompanero, el error desmonta la vista de abajo", async () => {
    await rojoEscena(async () => {
      if (!(await vistaSobrevive(false))) throw new Error("un error del compañero desmontó la vista de abajo");
    }, "un error del compañero desmontó la vista de abajo");
  });
});
