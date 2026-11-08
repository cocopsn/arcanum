// Un mensaje de la conversación (design §10, §14.1, §15). Pinta el turno del aprendiz o del compañero: el markdown
// seguro (Markdown.tsx, ya redactado), la línea «Fuentes: …» de las citas válidas (citas.ts, nunca texto del modelo) y,
// si el modelo devolvió plan, la tarjeta «Siguientes pasos». Sólo clases cmp-* (colores.test.ts, regla 5). Los enlaces
// de cita abren el visor por `alAbrirCita`.
"use client";
import { Markdown } from "./Markdown";
import { Artefactos, BotonPdf } from "./Artefactos";
import { citasValidas, enlazarCitas, idsEnviados, lineaFuentes } from "@/lib/companion/citas";
import type { MensajeRow } from "@/lib/companion/db";

export function Mensaje({ mensaje, alAbrirCita, celdaId }: { mensaje: MensajeRow; alAbrirCita?: (id: string) => void; celdaId?: string | null }) {
  const esAprendiz = mensaje.rol === "aprendiz";
  const texto = mensaje.textoEditado ?? mensaje.texto;

  if (esAprendiz) {
    return (
      <div className="cmp-mensaje cmp-mensaje-aprendiz">
        <p className="cmp-mensaje-texto">{texto}</p>
      </div>
    );
  }

  const enviados = idsEnviados(mensaje.pasajesEnviados);
  const resueltas = citasValidas(mensaje.citas, mensaje.pasajesEnviados);
  const md = enlazarCitas(texto, enviados);

  return (
    <div className="cmp-mensaje cmp-mensaje-companero">
      <Markdown texto={md} citasValidas={enviados} alAbrirCita={alAbrirCita} />
      <p className="cmp-fuentes">{lineaFuentes(resueltas)}</p>
      {mensaje.artefactos.length > 0 && <Artefactos artefactos={mensaje.artefactos} celdaId={celdaId} />}
      {mensaje.plan.length > 0 && (
        <div className="cmp-plan">
          <p className="cmp-plan-titulo">Siguientes pasos</p>
          <ol className="cmp-plan-lista">
            {mensaje.plan.map((p, i) => (
              <li key={i} className="cmp-plan-item">
                <span className="cmp-plan-paso-titulo">{p.titulo}</span>
                <span className="cmp-plan-paso-detalle">{p.detalle}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <BotonPdf respuesta={texto} titulo="Respuesta del compañero" citas={resueltas.map((c) => ({ titulo: c.titulo, seccion: c.seccion }))} />
    </div>
  );
}
