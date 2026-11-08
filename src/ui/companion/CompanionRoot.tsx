"use client";
// Entrada del chunk companion-ui (design §3.2, §4, §5, §6, §7): máquina de estados de la UI, colocación, reloj de 1 s
// con la firma de superficies, atajo Ctrl+., capa de ceremonia y región viva. Lee el store sólo por lectura.ts.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ReadModel } from "@/core/read-model";
import { cargarUi, guardarUi, transicion, type EstadoUi, type EventoUi, type Vista } from "@/lib/companion/estado-ui";
import { loadResume } from "@/lib/resume";
import { themeForGoal, worldVars } from "@/lib/subject-themes";
import { ORBE, PESTILLO, colocar, firmaSuperficies, leerControles, type Colocacion, type Marco } from "./colocacion";
import { ESTILOS } from "./estilos";
import { Globo } from "./Globo";
import { useLecturaArcanum } from "./lectura";
import { Orbe } from "./Orbe";
import { Panel } from "./Panel";
import { Pestillo } from "./Pestillo";
import { Motor, entradaBase } from "./motor";
import { AlmacenMemoria, type AlmacenCompanero } from "@/lib/companion/db";
import type { ConversacionDeps } from "./Conversacion";

type TipoMundo = "forge" | "inicio" | "mundo";
interface Mundo {
  tipo: TipoMundo;
  titulo: string | null;
}

/** Mundo activo (§7): Forge por body[data-world]; si no, el goal del resume si existe en el read model; si no, inicio. */
function leerMundo(rm: ReadModel): Mundo {
  if (document.body.dataset.world === "forge") return { tipo: "forge", titulo: null };
  const id = loadResume()?.world;
  const goal = id ? rm.goals.find((g) => g.id === id) : undefined;
  return goal ? { tipo: "mundo", titulo: goal.title } : { tipo: "inicio", titulo: null };
}

const ANUNCIOS: Record<Vista, string> = {
  panel: "Compañero abierto",
  orbe: "Compañero minimizado",
  oculto: "Compañero oculto; el pestillo queda en el borde",
};

function leerMarco(el: HTMLElement | null): Marco {
  const cs = el ? getComputedStyle(el) : null;
  const sa = (n: string) => {
    const v = parseFloat(cs?.getPropertyValue(n) ?? "");
    return Number.isFinite(v) ? v : 0;
  };
  return { ancho: window.innerWidth, alto: window.innerHeight, sa: { t: sa("--cmp-sa-t"), r: sa("--cmp-sa-r"), b: sa("--cmp-sa-b"), l: sa("--cmp-sa-l") } };
}

const igualColocacion = (a: Colocacion, b: Colocacion) => a.esquina === b.esquina && a.dy === b.dy && a.colision === b.colision;

export function CompanionRoot() {
  const { readModel, ceremonia } = useLecturaArcanum();
  const [ui, setUi] = useState<EstadoUi>(cargarUi);
  const [mundo, setMundo] = useState<Mundo>(() => leerMundo(readModel));
  const [col, setCol] = useState<Colocacion>(() => ({ esquina: ui.esquina, dy: 0, colision: false }));
  const [anuncio, setAnuncio] = useState("");
  const [oculta, setOculta] = useState(() => document.hidden);
  const raiz = useRef<HTMLDivElement>(null);
  const vistaPrevia = useRef<Vista>(ui.vista);
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const rmRef = useRef(readModel);
  rmRef.current = readModel;

  const despachar = useCallback((e: EventoUi) => setUi((s) => transicion(s, e)), []);
  const cerrarGlobo = useCallback(() => despachar({ t: "globoVisto" }), [despachar]);

  // motor y almacén de la sesión del panel (se crean una vez; el almacén cae a memoria si Dexie no abre, §19.1)
  const motorRef = useRef<Motor | null>(null);
  motorRef.current ??= new Motor();
  const almacenRef = useRef<AlmacenCompanero>(new AlmacenMemoria());
  const precargarPartes = useCallback(() => {
    motorRef.current!.precargar(mundo.tipo === "forge" ? "Engineering Forge" : mundo.titulo);
    return Promise.resolve();
  }, [mundo.tipo, mundo.titulo]);
  const convDeps: ConversacionDeps = {
    conversacionId: "actual",
    almacen: almacenRef.current,
    armarEntrada: (texto, pedido, fase) => entradaBase(texto, pedido, fase, mundo.tipo),
    consultar: (entrada, signal) => motorRef.current!.consultar(entrada, signal),
    faseInferida: "general",
  };

  const recolocar = useCallback(() => {
    const { vista, esquina } = uiRef.current;
    if (vista === "panel") return;
    const n = colocar(esquina, vista === "oculto" ? PESTILLO : ORBE, leerMarco(raiz.current), leerControles());
    setCol((p) => (igualColocacion(p, n) ? p : n));
  }, []);

  const releerMundo = useCallback(() => {
    const m = leerMundo(rmRef.current);
    setMundo((p) => (p.tipo === m.tipo && p.titulo === m.titulo ? p : m));
  }, []);

  useEffect(() => guardarUi(ui), [ui]);

  // anuncios, globo al abrir y mundo al abrir; al cerrar el panel se recalcula la colocación
  useEffect(() => {
    if (vistaPrevia.current === ui.vista) return;
    vistaPrevia.current = ui.vista;
    setAnuncio(ANUNCIOS[ui.vista]);
    if (ui.vista === "panel") {
      if (!uiRef.current.globoVisto) despachar({ t: "globoVisto" });
      releerMundo();
    }
  }, [ui.vista, despachar, releerMundo]);

  // al cargar, al soltar, al mover y al cerrar el panel
  useEffect(() => {
    recolocar();
  }, [ui.esquina, ui.vista, recolocar]);

  // resize y orientationchange, con 150 ms de espera
  useEffect(() => {
    let t = 0;
    const alCambiar = () => {
      window.clearTimeout(t);
      t = window.setTimeout(recolocar, 150);
    };
    window.addEventListener("resize", alCambiar);
    window.addEventListener("orientationchange", alCambiar);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", alCambiar);
      window.removeEventListener("orientationchange", alCambiar);
    };
  }, [recolocar]);

  useEffect(() => {
    const alCambiar = () => setOculta(document.hidden);
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, []);

  // reloj de 1 s: firma de superficies y mundo; detenido con el panel abierto, la pestaña oculta o una ceremonia
  useEffect(() => {
    if (ui.vista === "panel" || oculta || ceremonia) return;
    let firma = firmaSuperficies();
    const id = window.setInterval(() => {
      const f = firmaSuperficies();
      if (f !== firma) {
        firma = f;
        recolocar();
      }
      releerMundo();
    }, 1000);
    return () => window.clearInterval(id);
  }, [ui.vista, oculta, ceremonia, recolocar, releerMundo]);

  // Ctrl+. en captura sobre window: funciona dentro del editor o de la trampa de otro diálogo y no escribe el punto
  useEffect(() => {
    if (ceremonia) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.code !== "Period" || !e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.repeat) return;
      e.preventDefault();
      e.stopPropagation();
      despachar({ t: "atajo" });
    };
    window.addEventListener("keydown", alTeclear, { capture: true });
    return () => window.removeEventListener("keydown", alTeclear, { capture: true });
  }, [ceremonia, despachar]);

  const vieneDelPanel = vistaPrevia.current === "panel" && ui.vista === "orbe";
  const estilo: CSSProperties = {
    ...(mundo.tipo === "mundo" && mundo.titulo !== null ? worldVars(themeForGoal(mundo.titulo)) : {}),
    ...(ceremonia ? { visibility: "hidden" } : {}),
  };

  return (
    <div ref={raiz} className="cmp-raiz" data-companion-chunk="cmp-ui-v1" data-cmp-mundo={mundo.tipo} style={estilo}>
      <style>{ESTILOS}</style>
      {ui.vista === "orbe" && (
        <Orbe esquina={col.esquina} dy={col.dy} colision={col.colision} globo={!ui.globoVisto} enfocarAlMontar={vieneDelPanel} despachar={despachar} />
      )}
      {ui.vista === "orbe" && !ui.globoVisto && <Globo esquina={col.esquina} dy={col.dy} alCerrar={cerrarGlobo} />}
      {ui.vista === "oculto" && <Pestillo esquina={col.esquina} dy={col.dy} colision={col.colision} despachar={despachar} />}
      {ui.vista === "panel" && <Panel esquina={ui.esquina} activo={!ceremonia} despachar={despachar} precargar={precargarPartes} conversacion={convDeps} />}
      <div role="status" aria-live="polite" className="cmp-sr">
        {anuncio}
      </div>
    </div>
  );
}
