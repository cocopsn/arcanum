"use client";
// La única lectura del store de Arcanum desde el compañero (design §3.4). Ningún otro archivo del compañero importa
// useArcanum ni useArcanumStore (importaciones.test.ts, §19.4). Sólo selectores: el compañero nunca escribe aquí.
import { useArcanum } from "@/app/providers";

export function useLecturaArcanum() {
  const readModel = useArcanum((s) => s.readModel);
  const viewModel = useArcanum((s) => s.viewModel);
  const ceremonia = useArcanum((s) => s.ceremonyQueue[0] ?? null);
  return { readModel, viewModel, ceremonia };
}
