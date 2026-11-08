# Coordinación entre sesiones

## Milla 12 · contrato de estado v1 (2026-11-04)

- Nuevos: `contracts/estado/v1/**` (copia por huella del canónico de `Auctorum/auctorum`; no se edita aquí), `src/lib/estado-v1.ts` (+ prueba), `src/app/api/estado/v1/[recurso]/route.ts`.
- No toca nada de la rama `codex/amoxtli-formacion` (trabajo en vuelo de otro agente en el checkout principal).
- Sale sólo progreso como CONTEOS (xp, rachas, módulos, por repasar); ningún título ni nota.

## Engineering Forge (feat/palantir-forge, 2026-11-06)
- Espacios reservados: goal `-006`, paths `-007` a `-025`, ids `cf000000-*` y `b5000000-*`, `ts` de siembra desde `1793901600000`. Ningún otro mundo debe usarlos.
- Archivos compartidos que Forge toca: `src/lib/spines.ts` (Forge va último), `src/lib/seed.ts`, `src/lib/cell-slugs.ts`, `src/lib/seed-frozen.test.ts` (sólo líneas nuevas), `src/lib/seed.test.ts`, `src/lib/subject-themes.ts`, `next.config.mjs`, `src/app/api/fetch-source/route.ts` y `src/app/sw.ts` (estos dos, previstos por el diseño, quedaron sin cambios en este PR).
- Huella del bloque Forge (rama `forge/seed-frozen-forge`, 2026-11-06, después de la sonda de producción de `8f9d723`): `src/lib/seed-frozen.test.ts` sólo ganó líneas al final (`FORGE_FROZEN_COUNT` 296, `FORGE_FROZEN_SHA256`, `isForgeBlockEvent` y la prueba «the Forge block is frozen by its own fingerprint»). Los 296 eventos de siembra de Forge ya no cambian. Un bloque nuevo se agrega aparte y se excluye en ese predicado, sin tocar la huella.
- Si Amoxtli mergea antes con `HISTORICAL_SPINES`, se reemplaza por `POSITIONAL_SPINES` y se marca `AMOXTLI_SPINE.ownSeedBlock = true`; el efecto es el mismo. No se toca `D:\projects\arcanum` ni `D:\projects\arcanum-m12`.
- Cambio visible en `estado/v1`: el día del despliegue suben `goals` en 1, `modules` en 168 y `sealed` por las celdas selladas de Forge (el diseño estima 108; la cifra real la da la sonda). No es una regresión.
- `SourceViewer` en otros mundos: la lista de reproducción de Alemán A1.2 en `www.youtube.com` pierde «Ver dentro» y sale de la descarga por spine, porque los hosts de video nunca se piden por servidor (`src/lib/fetch-policy.ts`).

## Compañero (feat/companion-r3, 2026-11-07)

- **Espacios reservados** (design §26.3). Ningún otro flujo debe pisarlos:
  - Base IndexedDB `arcanum-companion` (separada del log de eventos de la app).
  - Llaves de `localStorage` `arcanum_companion_ui` (incluye `globoVisto`, §4; no hay llave aparte para el globo) y
    `arcanum_companion_rl`; candado web `arcanum-companion-rl` (el límite de 10 llamadas por minuto compartido entre
    pestañas).
  - Id del contenedor `#arcanum-companion`, montado en la raíz en **capa 92** (encima de la app, debajo de la
    ceremonia; §28, DC-14). Atajo global **Ctrl+.** (abre/enfoca el compañero).
  - Acción `companion` de la Edge `ai-router`; carpeta `src/lib/companion/generated/` (índice generado, sólo su
    `.gitignore` se versiona); chunks `companion-*` del bundle; prefijo `companion` de los scripts de `package.json`
    (el generador del índice va justo antes del comando final de cada script, §2.2).
- **`--companion-reserve-right`: no se fija.** `globals.css` (de `3a68e97`) ya declara `--companion-reserve-right: 0px`
  en `:root`. El compañero **no la fija** (§5): lee las áreas seguras por sus propias variables `--cmp-sa-*`, que
  heredan de `--safe-*`, y coloca el orbe sin reservar un carril a la derecha. Si algún día el compañero necesitara
  reservar ancho, se decide aquí antes de cambiarla, para no mover el layout de otros mundos.
- **Aviso a «poblar».** El contenido nuevo (libros, bancos, rutas) se **indexa solo en el siguiente build**: el
  generador corre en `build`/`test`/`typecheck`/`dev` y parte las particiones grandes por sí mismo (§8.5), así que
  «poblar» no necesita tocar nada del compañero. Si una partición pasa su techo por el tamaño del contenido ajeno,
  lo reporta `budget.mjs` en el flujo del compañero, no bloquea el build de «poblar».
- **Archivos compartidos que el compañero toca:** sólo una línea de `src/app/page.tsx` (`<CompanionMount />` dentro de
  `ArcanumProvider`, después de `<HomeView />`; `AppUpdate` no se mueve) y líneas nuevas al final de las acciones de
  la Edge y sus pruebas de candados (debajo de las de Forge). `globals.css`, `sw.ts`, `next.config.mjs`,
  `src/lib/csp.mjs` y el proyector **no cambian**.