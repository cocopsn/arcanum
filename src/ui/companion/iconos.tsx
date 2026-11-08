// Íconos del compañero (design §7, «Clases»): SVG de React con fill y stroke en currentColor o none y clases cmp-*.
// El color sale del texto que los rodea; ninguno lleva color propio.

export function IconoNueva() {
  return (
    <svg className="cmp-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </svg>
  );
}

export function IconoMenu() {
  return (
    <svg className="cmp-icono" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true" focusable="false">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

/** Recuadro punteado del estado vacío. */
export function IconoVacio() {
  return (
    <svg className="cmp-vacio-icono" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="32" height="32" rx="8" />
    </svg>
  );
}

/** Aviso: un triángulo de trazo, sin color propio (los errores nunca son rojos, D4). */
export function IconoAviso() {
  return (
    <svg className="cmp-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
