"use client";
// Globo (design §5, RF-B6): «¿Te echo una mano?» junto al orbe la primera vez que aparece en el dispositivo. Se cierra
// al tocarlo, al abrir el panel, con Escape desde el orbe (teclado.ts) o solo a los 6 s; sin foco propio.
import { useEffect, type CSSProperties } from "react";
import type { Esquina } from "@/lib/companion/estado-ui";

export const GLOBO_MS = 6000;

export function Globo({ esquina, dy, alCerrar }: { esquina: Esquina; dy: number; alCerrar: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(alCerrar, GLOBO_MS);
    return () => window.clearTimeout(t);
  }, [alCerrar]);
  const estilo = { ["--cmp-dy" as string]: `${dy}px` } as CSSProperties;
  return (
    <div role="status" className="cmp-globo" data-cmp-esquina={esquina} style={estilo} onClick={alCerrar}>
      ¿Te echo una mano?
    </div>
  );
}
