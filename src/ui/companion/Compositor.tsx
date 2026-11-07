// Compositor del compañero (design §12.5, §14.4): el campo donde el aprendiz escribe, el selector de fase, los chips de
// pedido/nivel y el botón que se vuelve «Cancelar» (cuadrado) mientras hay una consulta. El compositor cuenta 1-2,000
// caracteres. Sólo clases cmp-*. No lee el value de ningún otro campo: es su propio textarea controlado.
"use client";
import { useState } from "react";
import { FASES, PEDIDOS, type Fase, type Pedido } from "@/lib/companion/tipos";

export interface CompositorProps {
  /** hay una consulta en curso: el botón es «Cancelar» */
  enCurso: boolean;
  fase: Fase;
  faseInferida: Fase;
  onFase: (f: Fase) => void;
  onEnviar: (texto: string, pedido: Pedido) => void;
  onCancelar: () => void;
}

const MAX = 2_000;

export function Compositor({ enCurso, fase, faseInferida, onFase, onEnviar, onCancelar }: CompositorProps) {
  const [texto, setTexto] = useState("");
  const [pedido, setPedido] = useState<Pedido>("explicar");
  const limpio = texto.trim();
  const puedeEnviar = limpio.length >= 1 && limpio.length <= MAX && !enCurso;

  return (
    <form
      className="cmp-compositor"
      onSubmit={(e) => {
        e.preventDefault();
        if (!puedeEnviar) return;
        onEnviar(limpio, pedido);
        setTexto("");
      }}
    >
      <div className="cmp-fase-fila">
        <label className="cmp-fase-label">
          Fase
          <select
            className="cmp-fase-select"
            value={fase}
            onChange={(e) => onFase(e.target.value as Fase)}
          >
            {FASES.map((f) => (
              <option key={f} value={f}>
                {f}
                {f === faseInferida ? " (inferida)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="cmp-pedido-fila">
        {PEDIDOS.map((p) => (
          <button
            key={p}
            type="button"
            className={p === pedido ? "cmp-chip cmp-chip-activo" : "cmp-chip"}
            aria-pressed={p === pedido}
            onClick={() => setPedido(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <textarea
        className="cmp-entrada"
        aria-label="Tu pregunta al compañero"
        value={texto}
        maxLength={MAX}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escribe tu pregunta…"
      />
      <div className="cmp-compositor-pie">
        <span className="cmp-contador">
          {limpio.length}/{MAX}
        </span>
        {enCurso ? (
          <button type="button" className="cmp-boton cmp-cancelar" aria-label="Cancelar" onClick={onCancelar}>
            <span className="cmp-cuadro" aria-hidden="true" />
          </button>
        ) : (
          <button type="submit" className="cmp-boton cmp-enviar" disabled={!puedeEnviar}>
            Enviar
          </button>
        )}
      </div>
    </form>
  );
}
