// Red-checks de la protección (a) (design §3.4, §23.3; regla 2 de evidencia). Cada bloque quita UNA protección por la
// costura que nombra el diseño y la escena de §3.4 debe salir ROJA con el mensaje que nombra lo protegido. En la corrida
// normal, rojoEscena afirma que la escena falla con ese mensaje; con CMP_REDCHECK=1 corre la escena sin envolverla para
// que vitest muestre el ROJO real (su salida va a redchecks.md). Si al quitar la protección la escena queda verde, es un
// HALLAZGO (rojoEscena lanza) y F2 no cierra.
//
// Costuras: los tres módulos propios del compañero (lectura.ts, teclado.ts, foco.ts) se reemplazan con vi.mock sobre un
// interruptor mutable `ctrl` —por defecto delegan en el módulo real, y cada prueba enciende sólo su costura, así el
// componente real usa la versión alterada sin duplicar React— o un montaje alterno rompe el dueño o el contenedor.
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode, type RefObject } from "react";

/** Interruptor de costuras: una prueba enciende una sola. */
const ctrl: {
  escribeStore: boolean;
  escribeResume: boolean;
  tecladoSinParar: boolean;
  focoEscribeBody: boolean;
} = { escribeStore: false, escribeResume: false, tecladoSinParar: false, focoEscribeBody: false };

vi.mock("@/ui/companion/lectura", async () => {
  const react = await import("react");
  const { useArcanum, useArcanumStore } = await import("@/app/providers");
  const { saveResume } = await import("@/lib/resume");
  return {
    useLecturaArcanum() {
      const readModel = useArcanum((s) => s.readModel);
      const viewModel = useArcanum((s) => s.viewModel);
      const ceremonia = useArcanum((s) => s.ceremonyQueue[0] ?? null);
      const store = useArcanumStore();
      // las escrituras van fuera de render (setInterval) para no caer en un bucle write→render→write ni romper el
      // planificador de React. La escena de §3.4 las detecta dejando correr el reloj (esperar).
      react.useEffect(() => {
        if (!ctrl.escribeStore && !ctrl.escribeResume) return;
        const id = setInterval(() => {
          if (ctrl.escribeStore) store.getState().refreshPresent(Date.now() + Math.floor(Math.random() * 1e6));
          if (ctrl.escribeResume) saveResume({ bookId: "visor-del-companero" });
        }, 25);
        return () => clearInterval(id);
      }, [store]);
      return { readModel, viewModel, ceremonia };
    },
  };
});

vi.mock("@/ui/companion/teclado", async () => {
  const real = await vi.importActual<typeof import("@/ui/companion/teclado")>("@/ui/companion/teclado");
  return {
    ...real,
    consumirEscape(e: { key: string; stopPropagation(): void }, s: Parameters<typeof real.consumirEscape>[1]) {
      if (ctrl.tecladoSinParar) {
        // la costura: decide igual pero ya no detiene el evento, así que el Escape nativo sube a los oyentes de window
        if (e.key !== "Escape") return null;
        return real.decidirEscape(s);
      }
      return real.consumirEscape(e, s);
    },
  };
});

vi.mock("@/ui/companion/foco", async () => {
  const real = await vi.importActual<typeof import("@/ui/companion/foco")>("@/ui/companion/foco");
  const react = await import("react");
  return {
    ...real,
    useTrampaCompanero(ref: RefObject<HTMLElement | null>, activo: boolean) {
      // el hook real siempre corre (orden de hooks estable); la costura añade una escritura en <body>
      real.useTrampaCompanero(ref, activo && !ctrl.focoEscribeBody);
      react.useEffect(() => {
        if (!ctrl.focoEscribeBody || !activo) return;
        document.body.style.overflow = "hidden";
        return () => {
          document.body.style.overflow = "";
        };
      }, [activo]);
    },
  };
});

// La escena y las piezas se importan DESPUÉS de los vi.mock (hoisted), así ven los módulos reemplazados.
const { CompanionRoot } = await import("@/ui/companion/CompanionRoot");
const { Hermanos, RESUME, correrEscena, montar, esperarListo, esperar, orbe, panel, contarCompaneros } = await import("./escena");
const { rojoEscena } = await import("./rojo");

/** Abre el panel y deja correr el reloj `ms`, para que una costura con escrituras periódicas alcance a disparar. */
async function abrirYEsperar(m: Awaited<ReturnType<typeof montar>> | ReturnType<typeof montar>, ms: number): Promise<void> {
  await esperarListo();
  await esperar(400);
  const o = orbe();
  if (!o) throw new Error("la escena no avanzó: no apareció el orbe");
  act(() => {
    o.click();
  });
  await esperar(50);
  if (panel() === null) throw new Error("la escena no avanzó: no abrió el panel");
  await esperar(ms);
}

const T = 30_000;

beforeEach(() => {
  ctrl.escribeStore = false;
  ctrl.escribeResume = false;
  ctrl.tecladoSinParar = false;
  ctrl.focoEscribeBody = false;
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("red-checks de la protección (a) (design §3.4, §23.3)", () => {
  it(
    "(i) lectura que escribe refreshPresent en el store → «re-renderizó la vista de abajo»",
    async () => {
      ctrl.escribeStore = true;
      await rojoEscena(async () => {
        const m = montar(Hermanos);
        try {
          await abrirYEsperar(m, 200);
          let notificaciones = 0;
          const unsub = m.tienda.store!.subscribe(() => notificaciones++);
          const commits0 = m.commits.n;
          await esperar(200); // deja correr el reloj: la costura escribe en el store cada 25 ms
          unsub();
          if (m.commits.n !== commits0) throw new Error(`abrir el compañero re-renderizó la vista de abajo (${m.commits.n - commits0} commits)`);
          if (notificaciones !== 0) throw new Error(`el compañero escribió en el store: ${notificaciones} notificaciones`);
        } finally {
          m.r.unmount();
        }
      }, /re-renderizó la vista de abajo|escribió en el store/);
    },
    T,
  );

  it(
    "(ii) un envolvente que desmonta la vista al abrir → «desmontó la vista de abajo»",
    async () => {
      // Envolvente: cuando aparece el panel, deja de pintar la vista de abajo (la desmonta), como haría montar el
      // compañero dentro del árbol de HomeView en lugar de en un portal hermano.
      function Envolvente({ children }: { children: ReactNode }) {
        const [abierto, setAbierto] = useState(false);
        useEffect(() => {
          const t = setInterval(() => setAbierto(document.getElementById("cmp-panel") !== null), 30);
          return () => clearInterval(t);
        }, []);
        return <>{!abierto && children}</>;
      }
      await rojoEscena(async () => {
        const m = montar(({ vista }) => <Hermanos vista={<Envolvente>{vista}</Envolvente>} />);
        try {
          await esperarListo();
          await esperar(400);
          const o = orbe();
          if (!o) throw new Error("la escena no avanzó: no apareció el orbe");
          act(() => {
            o.click();
          });
          await esperar(150);
          if (panel() === null) throw new Error("la escena no avanzó: no abrió el panel");
          if (document.querySelector('[data-testid="vista-abajo"]') === null)
            throw new Error("abrir el compañero desmontó la vista de abajo");
        } finally {
          m.r.unmount();
        }
      }, "abrir el compañero desmontó la vista de abajo");
    },
    T,
  );

  it(
    "(iii) dos CompanionRoot sin el dueño de módulo → «hay más de un compañero pintado: 2 [data-companion-chunk]»",
    async () => {
      // Sin el dueño: dos montajes crean, cada uno, su CompanionRoot en el mismo contenedor → dos [data-companion-chunk].
      function RaizSinDueno() {
        const [host, setHost] = useState<HTMLElement | null>(null);
        useEffect(() => {
          let el = document.getElementById("arcanum-companion");
          if (!el) {
            el = document.createElement("div");
            el.id = "arcanum-companion";
            document.body.appendChild(el);
          }
          setHost(el);
        }, []);
        return host ? createPortal(<CompanionRoot />, host) : null;
      }
      await rojoEscena(async () => {
        const m = montar(({ vista }) => (
          <>
            {vista}
            <RaizSinDueno />
            <RaizSinDueno />
          </>
        ));
        try {
          await esperarListo();
          await esperar(250);
          contarCompaneros();
        } finally {
          m.r.unmount();
        }
      }, "hay más de un compañero pintado: 2 [data-companion-chunk]");
    },
    T,
  );

  it(
    "(iv) dos contenedores con su propio #arcanum-companion → «hay más de un #arcanum-companion»",
    async () => {
      // Sin la reutilización del contenedor por id, cada montaje crea su propio #arcanum-companion.
      function RaizConContenedorPropio() {
        const [host, setHost] = useState<HTMLElement | null>(null);
        useEffect(() => {
          const el = document.createElement("div");
          el.id = "arcanum-companion";
          document.body.appendChild(el);
          setHost(el);
          return () => el.remove();
        }, []);
        return host ? createPortal(<span data-companion-chunk="cmp-ui-v1" />, host) : null;
      }
      await rojoEscena(async () => {
        const m = montar(({ vista }) => (
          <>
            {vista}
            <RaizConContenedorPropio />
            <RaizConContenedorPropio />
          </>
        ));
        try {
          await esperarListo();
          await esperar(250);
          contarCompaneros();
        } finally {
          m.r.unmount();
        }
      }, "hay más de un #arcanum-companion");
    },
    T,
  );

  it(
    "(v) un visor que escribe el resume al abrir (como montar BookReader) → «cambió el resume»",
    async () => {
      ctrl.escribeResume = true;
      await rojoEscena(async () => {
        localStorage.setItem("arcanum_resume", RESUME);
        const m = montar(Hermanos);
        try {
          await abrirYEsperar(m, 200);
          if (localStorage.getItem("arcanum_resume") !== RESUME) throw new Error("el compañero cambió el resume");
        } finally {
          m.r.unmount();
        }
      }, "el compañero cambió el resume");
    },
    T,
  );

  it(
    "(vi) teclado sin stopPropagation → «un Escape del compañero cerró la vista de abajo»",
    async () => {
      ctrl.tecladoSinParar = true;
      await rojoEscena(() => correrEscena(Hermanos, 3), "un Escape del compañero cerró la vista de abajo");
    },
    T,
  );

  it(
    "(vii) foco que escribe en body.style → «el compañero escribió en <body>: style»",
    async () => {
      ctrl.focoEscribeBody = true;
      await rojoEscena(() => correrEscena(Hermanos, 3), "el compañero escribió en <body>: style");
    },
    T,
  );
});
