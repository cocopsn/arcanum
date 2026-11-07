// Hoja de estilos con alcance del compañero (design §5, §6, §7). Un <style> dentro del contenedor; style-src
// 'unsafe-inline' ya lo permite. Tres bloques: el compartido (todos los mundos, Forge incluido), el de Forge y el de
// inicio y los cinco mundos entre los marcadores cmp:otros-mundos. Fuera de ese bloque sólo hay neutros: variables
// --cmp-*, --forge-*, --safe-* y las 13 que reasigna body[data-world="forge"] en globals.css (colores.test.ts, §7).
// Sin interpolaciones: la prueba lee este archivo como texto.

export const ESTILOS = `
#arcanum-companion {
  --cmp-sa-t: var(--safe-top, env(safe-area-inset-top, 0px));
  --cmp-sa-r: var(--safe-right, env(safe-area-inset-right, 0px));
  --cmp-sa-b: var(--safe-bottom, env(safe-area-inset-bottom, 0px));
  --cmp-sa-l: var(--safe-left, env(safe-area-inset-left, 0px));
  accent-color: var(--text);
}
#arcanum-companion ::placeholder {
  color: var(--text-faint);
  opacity: 1;
}
#arcanum-companion .cmp-raiz {
  --cmp-fondo: var(--surface);
  --cmp-elevado: var(--surface-raised);
  --cmp-borde: var(--line);
  --cmp-borde-panel: var(--line);
  --cmp-texto: var(--text);
  --cmp-tenue: var(--text-muted);
  --cmp-acento: var(--text);
  color: var(--cmp-texto);
}
#arcanum-companion .cmp-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
#arcanum-companion .cmp-icono {
  display: block;
  width: 20px;
  height: 20px;
  flex: none;
}
#arcanum-companion .cmp-orbe {
  position: fixed;
  width: 56px;
  height: 56px;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 50%;
  background: #ffffff;
  color: #1e2124;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
  touch-action: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
#arcanum-companion .cmp-ojos {
  display: flex;
  gap: 10px;
}
#arcanum-companion .cmp-ojo {
  display: block;
  width: 7px;
  height: 11px;
  border-radius: 4px;
  background: currentColor;
  animation: cmp-parpadeo 6s infinite;
}
#arcanum-companion .cmp-orbe[data-cmp-esquina="inf-der"] {
  right: calc(var(--cmp-sa-r) + 12px);
  bottom: calc(var(--cmp-sa-b) + 12px + var(--cmp-dy, 0px));
}
#arcanum-companion .cmp-orbe[data-cmp-esquina="inf-izq"] {
  left: calc(var(--cmp-sa-l) + 12px);
  bottom: calc(var(--cmp-sa-b) + 12px + var(--cmp-dy, 0px));
}
#arcanum-companion .cmp-orbe[data-cmp-esquina="sup-der"] {
  right: calc(var(--cmp-sa-r) + 12px);
  top: calc(var(--cmp-sa-t) + 12px + var(--cmp-dy, 0px));
}
#arcanum-companion .cmp-orbe[data-cmp-esquina="sup-izq"] {
  left: calc(var(--cmp-sa-l) + 12px);
  top: calc(var(--cmp-sa-t) + 12px + var(--cmp-dy, 0px));
}
#arcanum-companion .cmp-pestillo {
  position: fixed;
  width: 44px;
  height: 44px;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  pointer-events: auto;
  cursor: pointer;
  display: flex;
  align-items: center;
}
#arcanum-companion .cmp-pestillo[data-cmp-esquina$="der"] {
  right: var(--cmp-sa-r);
  justify-content: flex-end;
}
#arcanum-companion .cmp-pestillo[data-cmp-esquina$="izq"] {
  left: var(--cmp-sa-l);
  justify-content: flex-start;
}
#arcanum-companion .cmp-pestillo[data-cmp-esquina^="inf"] {
  bottom: calc(var(--cmp-sa-b) + 18px + var(--cmp-dy, 0px));
}
#arcanum-companion .cmp-pestillo[data-cmp-esquina^="sup"] {
  top: calc(var(--cmp-sa-t) + 18px + var(--cmp-dy, 0px));
}
#arcanum-companion .cmp-pestana {
  display: block;
  width: 6px;
  height: 28px;
  background: var(--cmp-elevado);
  border: 1px solid var(--cmp-borde-panel);
}
#arcanum-companion .cmp-pestillo[data-cmp-esquina$="der"] .cmp-pestana {
  border-right: 0;
  border-radius: 6px 0 0 6px;
}
#arcanum-companion .cmp-pestillo[data-cmp-esquina$="izq"] .cmp-pestana {
  border-left: 0;
  border-radius: 0 6px 6px 0;
}
#arcanum-companion .cmp-globo {
  position: fixed;
  max-width: 220px;
  padding: 10px 14px;
  border-radius: 14px;
  border: 1px solid var(--cmp-borde-panel);
  background: var(--cmp-elevado);
  color: var(--cmp-texto);
  font-size: 14px;
  line-height: 1.35;
  pointer-events: auto;
  cursor: pointer;
  animation: cmp-entrada 160ms ease-out;
}
#arcanum-companion .cmp-globo[data-cmp-esquina="inf-der"] {
  right: calc(var(--cmp-sa-r) + 76px);
  bottom: calc(var(--cmp-sa-b) + 20px + var(--cmp-dy, 0px));
}
#arcanum-companion .cmp-globo[data-cmp-esquina="inf-izq"] {
  left: calc(var(--cmp-sa-l) + 76px);
  bottom: calc(var(--cmp-sa-b) + 20px + var(--cmp-dy, 0px));
}
#arcanum-companion .cmp-globo[data-cmp-esquina="sup-der"] {
  right: calc(var(--cmp-sa-r) + 76px);
  top: calc(var(--cmp-sa-t) + 20px + var(--cmp-dy, 0px));
}
#arcanum-companion .cmp-globo[data-cmp-esquina="sup-izq"] {
  left: calc(var(--cmp-sa-l) + 76px);
  top: calc(var(--cmp-sa-t) + 20px + var(--cmp-dy, 0px));
}
#arcanum-companion .cmp-scrim {
  position: fixed;
  inset: 0;
  pointer-events: auto;
  touch-action: none;
  background: transparent;
}
#arcanum-companion .cmp-scrim-hoja {
  background: rgba(0,0,0,0.45);
}
#arcanum-companion .cmp-panel {
  position: fixed;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--cmp-borde-panel);
  background: var(--cmp-fondo);
  color: var(--cmp-texto);
  pointer-events: auto;
  animation: cmp-abrir 160ms ease-out;
}
#arcanum-companion .cmp-hoja {
  left: 0;
  right: 0;
  bottom: 0;
  height: min(92dvh, var(--cmp-vv-h, 100dvh) - var(--cmp-sa-t) - 8px);
  border-bottom: 0;
  border-radius: 20px 20px 0 0;
  padding: 0 var(--cmp-sa-r) max(12px, var(--cmp-sa-b)) var(--cmp-sa-l);
}
#arcanum-companion .cmp-flotante {
  width: 420px;
  height: min(680px, 80vh);
  border-radius: 20px;
}
#arcanum-companion .cmp-flotante[data-cmp-esquina="inf-der"] {
  right: calc(var(--cmp-sa-r) + 12px);
  bottom: calc(var(--cmp-sa-b) + 12px);
}
#arcanum-companion .cmp-flotante[data-cmp-esquina="inf-izq"] {
  left: calc(var(--cmp-sa-l) + 12px);
  bottom: calc(var(--cmp-sa-b) + 12px);
}
#arcanum-companion .cmp-flotante[data-cmp-esquina="sup-der"] {
  right: calc(var(--cmp-sa-r) + 12px);
  top: calc(var(--cmp-sa-t) + 12px);
}
#arcanum-companion .cmp-flotante[data-cmp-esquina="sup-izq"] {
  left: calc(var(--cmp-sa-l) + 12px);
  top: calc(var(--cmp-sa-t) + 12px);
}
#arcanum-companion .cmp-asa {
  display: block;
  width: 40px;
  height: 4px;
  margin: 8px auto 0;
  border-radius: 2px;
  background: var(--cmp-borde);
  flex: none;
}
#arcanum-companion .cmp-contenido {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 12px 16px 0;
}
#arcanum-companion .cmp-encabezado {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
#arcanum-companion .cmp-encabezado-texto {
  flex: 1;
  min-width: 0;
}
#arcanum-companion .cmp-titulo {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#arcanum-companion .cmp-subtitulo {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--cmp-tenue);
}
#arcanum-companion .cmp-boton-redondo {
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--cmp-borde);
  background: var(--cmp-elevado);
  color: var(--cmp-texto);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
}
#arcanum-companion .cmp-menu {
  position: absolute;
  top: 48px;
  right: 0;
  z-index: 2;
  min-width: 220px;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid var(--cmp-borde-panel);
  background: var(--cmp-elevado);
  display: flex;
  flex-direction: column;
}
#arcanum-companion .cmp-menu-item {
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--cmp-texto);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
#arcanum-companion .cmp-menu-item:hover {
  background: var(--cmp-fondo);
}
#arcanum-companion .cmp-menu-titulo {
  margin: 6px 12px;
  font-size: 12px;
  color: var(--cmp-tenue);
}
#arcanum-companion .cmp-cuerpo {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
}
#arcanum-companion .cmp-vacio {
  margin: auto;
  padding: 24px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
#arcanum-companion .cmp-vacio-icono {
  width: 40px;
  height: 40px;
  color: var(--cmp-tenue);
}
#arcanum-companion .cmp-vacio-titulo {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
#arcanum-companion .cmp-vacio-texto {
  margin: 0;
  font-size: 14px;
  color: var(--cmp-tenue);
}
#arcanum-companion .cmp-aviso {
  margin: 8px 0;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px dashed var(--cmp-borde-panel);
  color: var(--cmp-texto);
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
#arcanum-companion .cmp-boton {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid var(--cmp-borde);
  background: var(--cmp-elevado);
  color: var(--cmp-texto);
  font: inherit;
  cursor: pointer;
}
@keyframes cmp-parpadeo {
  0%, 96%, 100% { transform: scaleY(1); }
  98% { transform: scaleY(0.1); }
}
@keyframes cmp-entrada {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
@keyframes cmp-abrir {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  #arcanum-companion * {
    animation: none !important;
    transition: none !important;
  }
}
#arcanum-companion [data-cmp-mundo="forge"] {
  --cmp-fondo: var(--forge-surface);
  --cmp-elevado: var(--forge-surface-raised);
  --cmp-borde: var(--forge-control);
  --cmp-borde-panel: var(--forge-control);
  --cmp-texto: var(--forge-text);
  --cmp-tenue: var(--forge-text-muted);
  --cmp-acento: #ffffff;
}
/* cmp:otros-mundos */
#arcanum-companion [data-cmp-mundo]:not([data-cmp-mundo="forge"])[data-cmp-mundo="inicio"] {
  --cmp-acento: var(--rank);
  --cmp-borde-panel: var(--rank);
}
#arcanum-companion [data-cmp-mundo]:not([data-cmp-mundo="forge"])[data-cmp-mundo="mundo"] {
  --cmp-acento: var(--accent);
  --cmp-fondo: var(--surface);
  --cmp-borde-panel: color-mix(in srgb, var(--accent) 28%, var(--line));
}
#arcanum-companion [data-cmp-mundo]:not([data-cmp-mundo="forge"]) .cmp-aviso {
  border-color: var(--amber);
  color: var(--amber);
}
/* /cmp:otros-mundos */
`;
