// Pantalla de conversación (design §14.1, §14.4). Pinta los mensajes (Mensaje.tsx), la tarjeta de pasos y el
// compositor; corre un envío con `consultar` (inyectado) y aplica el resultado por reqId con aplicarResultado
// (turnos.ts), así una respuesta que llega tras cancelar no pinta ni se guarda (CA-39). El guardado pasa por el almacén
// (db.ts), nunca por el log. Las dependencias llegan por props para poder probar sin montar todo el CompanionRoot.
"use client";
import { useRef, useState } from "react";
import { Mensaje } from "./Mensaje";
import { Compositor } from "./Compositor";
import { TarjetaPasos, type PasoEjecutado } from "./TarjetaPasos";
import { aplicarResultado } from "@/lib/companion/turnos";
import type { MensajeRow } from "@/lib/companion/db";
import type { AlmacenCompanero } from "@/lib/companion/db";
import type { EntradaSolicitud, Fase, Pedido } from "@/lib/companion/tipos";
import { textoLimite, type ResultadoConsulta } from "@/lib/companion/consultar";
import type { Clasificacion } from "@/lib/companion/transporte";

export interface ConversacionDeps {
  /** id de la conversación abierta */
  conversacionId: string;
  almacen: AlmacenCompanero;
  /** arma la entrada a partir del texto y el pedido (sensor + ubicación + conversación) */
  armarEntrada: (texto: string, pedido: Pedido, fase: Fase) => EntradaSolicitud;
  /** corre el envío (§14.1); inyectado para las pruebas */
  consultar: (entrada: EntradaSolicitud, signal: AbortSignal) => Promise<ResultadoConsulta>;
  faseInferida: Fase;
  /** uuid por turno; inyectable para las pruebas */
  nuevoId?: () => string;
  /** reloj; inyectable */
  ahora?: () => number;
}

let contador = 0;
const idPorOmision = () => `m-${Date.now()}-${contador++}`;

/**
 * Texto seguro (plano, en español, sin volcar datos crudos del modelo ni del servidor) para una clasificación del
 * transporte que no es `ok` (§14.1-§14.2, CA-38/RF-E5). Devuelve null para `cancelada`: el usuario canceló a propósito
 * y no se pinta nada, igual que el camino de abort. Para `ok` también devuelve null porque esa rama la pinta `enviar`.
 * `invalida` registra el campo en un aviso interno pero el texto visible queda neutro (no se filtra el campo crudo).
 */
export function avisoDeClasificacion(c: Clasificacion): { texto: string; interno?: string } | null {
  switch (c.tipo) {
    case "ok":
    case "cancelada":
      return null;
    case "sin-sesion":
      return { texto: "Inicia sesión para usar la IA." };
    case "limite":
      return { texto: textoLimite(c.esperaS) };
    case "edge-vieja":
      return { texto: "La función del servidor aún no reconoce esta acción; inténtalo de nuevo en un momento." };
    case "invalida":
      return { texto: "No pudimos procesar tu solicitud; inténtalo de nuevo.", interno: `entrada inválida: ${c.campo}` };
    case "filtrado":
      return { texto: c.texto };
    case "no-disponible":
      return { texto: "El compañero no está disponible ahora; inténtalo de nuevo en un momento." };
    case "sin-red":
      return { texto: "El compañero requiere conexión; revisa tu red e inténtalo de nuevo." };
  }
}

export function Conversacion({ deps }: { deps: ConversacionDeps }) {
  const [mensajes, setMensajes] = useState<MensajeRow[]>([]);
  const [pasos, setPasos] = useState<PasoEjecutado[]>([]);
  const [fase, setFase] = useState<Fase>(deps.faseInferida);
  const [enCurso, setEnCurso] = useState(false);
  const reqIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nuevoId = deps.nuevoId ?? idPorOmision;
  const ahora = deps.ahora ?? Date.now;

  const guardar = async (m: MensajeRow) => {
    setMensajes((prev) => [...prev, m]);
    await deps.almacen.guardarMensaje(m);
  };

  const enviar = async (texto: string, pedido: Pedido) => {
    const reqId = nuevoId();
    reqIdRef.current = reqId;
    const ac = new AbortController();
    abortRef.current = ac;
    setEnCurso(true);
    setPasos([{ etiqueta: "Buscando en tus materiales" }]);

    // turno del aprendiz
    await guardar(turno(nuevoId(), deps.conversacionId, mensajes.length, "aprendiz", texto, ahora()));

    const entrada = deps.armarEntrada(texto, pedido, fase);
    let r: ResultadoConsulta;
    try {
      r = await deps.consultar(entrada, ac.signal);
    } catch {
      setEnCurso(false);
      return;
    }

    // CA-39: sólo se aplica si el reqId sigue siendo el vigente.
    const decision = aplicarResultado({ reqIdVigente: reqIdRef.current }, { reqId, valor: r });
    if (!decision.aplicar) {
      setEnCurso(false);
      return;
    }

    if (r.tipo === "respuesta" && r.clasificacion.tipo === "ok") {
      const data = r.clasificacion.data;
      await guardar({
        id: nuevoId(),
        conversacionId: deps.conversacionId,
        orden: mensajes.length + 1,
        rol: "companero",
        mundo: entrada.mundo,
        texto: data.respuesta,
        citas: data.citas,
        pasajesEnviados: [],
        artefactos: data.artefactos,
        plan: data.plan,
        proveedor: data.provider,
        avisos: data.avisos,
        estado: "ok",
        creado: ahora(),
      });
    } else if (r.tipo === "local") {
      await guardar(turno(nuevoId(), deps.conversacionId, mensajes.length + 1, "companero", r.texto, ahora()));
    } else if (r.tipo === "sin-filtro" || r.tipo === "limite") {
      // Resultados terminales del nivel superior (§14.1): su `.texto` ya viene redactado (limite trae textoLimite).
      await guardar(aviso(nuevoId(), deps.conversacionId, mensajes.length + 1, r.texto, ahora()));
    } else if (r.tipo === "respuesta") {
      // Clasificación del transporte distinta de `ok` (§14.2): un aviso seguro por variante; `cancelada` no pinta nada.
      const av = avisoDeClasificacion(r.clasificacion);
      if (av) await guardar(aviso(nuevoId(), deps.conversacionId, mensajes.length + 1, av.texto, ahora(), av.interno));
    }
    setEnCurso(false);
    reqIdRef.current = null;
  };

  const cancelar = () => {
    abortRef.current?.abort();
    reqIdRef.current = null; // cualquier resultado que llegue después se descarta (aplicarResultado)
    setEnCurso(false);
  };

  return (
    <div className="cmp-conversacion">
      <div className="cmp-mensajes">
        {mensajes.map((m) => (
          <Mensaje key={m.id} mensaje={m} />
        ))}
      </div>
      <TarjetaPasos pasos={enCurso ? pasos : []} />
      <Compositor enCurso={enCurso} fase={fase} faseInferida={deps.faseInferida} onFase={setFase} onEnviar={enviar} onCancelar={cancelar} />
    </div>
  );
}

function turno(id: string, conversacionId: string, orden: number, rol: "aprendiz" | "companero", texto: string, creado: number): MensajeRow {
  return { id, conversacionId, orden, rol, mundo: "inicio", texto, citas: [], pasajesEnviados: [], artefactos: [], plan: [], proveedor: "", avisos: [], estado: "ok", creado };
}

/** Un turno del compañero con estado 'aviso' (resultado no-ok del transporte): texto plano, nunca respuesta del modelo. */
function aviso(id: string, conversacionId: string, orden: number, texto: string, creado: number, interno?: string): MensajeRow {
  return { id, conversacionId, orden, rol: "companero", mundo: "inicio", texto, citas: [], pasajesEnviados: [], artefactos: [], plan: [], proveedor: "", avisos: interno ? [interno] : [], estado: "aviso", creado };
}
