"use client";
// Pestillo (design §5, RF-B2): con el compañero oculto queda una caja táctil de 44×44 en el borde lateral, de la que se
// ven 6 px. Tocarlo devuelve el orbe.
import type { CSSProperties } from "react";
import type { Esquina, EventoUi } from "@/lib/companion/estado-ui";

export function Pestillo({
  esquina,
  dy,
  colision,
  despachar,
}: {
  esquina: Esquina;
  dy: number;
  colision: boolean;
  despachar: (e: EventoUi) => void;
}) {
  const estilo = { ["--cmp-dy" as string]: `${dy}px` } as CSSProperties;
  return (
    <button
      type="button"
      className="cmp-pestillo"
      aria-label="Mostrar el compañero"
      data-cmp-esquina={esquina}
      data-cmp-colision={colision ? "1" : undefined}
      style={estilo}
      onClick={() => despachar({ t: "tocarPestillo" })}
    >
      <span className="cmp-pestana" aria-hidden="true" />
    </button>
  );
}
