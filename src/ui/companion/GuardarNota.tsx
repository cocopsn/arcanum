// Guardar como nota (design §19.3, §19.4, RF-N1). ÚNICO archivo del compañero que importa useActions. Llama a
// createNote({ moduleId, goalId }, titulo, markdown) con «Compañero · <tema>» y el markdown: el texto editado, cada
// diagrama como cerca ```mermaid, los ejercicios sin la referencia salvo que se marque la casilla, y las citas como
// «Fuente: …». Nada se guarda sin ese gesto. Es la única excepción declarada de RF-B3.1 (escribe un note.created).
"use client";
import { useState } from "react";
import { useActions } from "@/ui/use-actions";
import type { MensajeRow } from "@/lib/companion/db";
import { citasValidas } from "@/lib/companion/citas";

/** Arma el markdown de la nota (§19.4). Puro. */
export function markdownNota(mensaje: MensajeRow, incluirRef: boolean): string {
  const partes: string[] = [mensaje.textoEditado ?? mensaje.texto];
  for (const a of mensaje.artefactos) {
    if (a.tipo === "diagrama") partes.push("```mermaid\n" + a.fuente + "\n```");
    else if (a.tipo === "ejercicios" && incluirRef) partes.push(a.md);
  }
  const citas = citasValidas(mensaje.citas, mensaje.pasajesEnviados);
  for (const c of citas) partes.push(`Fuente: ${c.titulo}${c.seccion ? ` · ${c.seccion}` : ""}`);
  return partes.join("\n\n");
}

export function GuardarNota({ mensaje, tema, celdaId, goalId }: { mensaje: MensajeRow; tema: string; celdaId?: string | null; goalId?: string | null }) {
  const { createNote } = useActions();
  const [incluirRef, setIncluirRef] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const tieneEjercicios = mensaje.artefactos.some((a) => a.tipo === "ejercicios");

  return (
    <div className="cmp-guardar-nota">
      {tieneEjercicios && (
        <label className="cmp-casilla">
          <input type="checkbox" className="cmp-casilla-input" checked={incluirRef} onChange={(e) => setIncluirRef(e.target.checked)} /> Incluir la referencia
        </label>
      )}
      <button
        type="button"
        className="cmp-boton cmp-guardar"
        onClick={async () => {
          const titulo = `Compañero · ${tema}`.slice(0, 80);
          await createNote({ moduleId: celdaId ?? null, goalId: goalId ?? null }, titulo, markdownNota(mensaje, incluirRef));
          setGuardado(true);
        }}
      >
        {guardado ? "Guardado" : "Guardar como nota"}
      </button>
    </div>
  );
}
