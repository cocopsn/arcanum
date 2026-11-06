# Coordinación entre sesiones

## Milla 12 · contrato de estado v1 (2026-11-04)

- Nuevos: `contracts/estado/v1/**` (copia por huella del canónico de `Auctorum/auctorum`; no se edita aquí), `src/lib/estado-v1.ts` (+ prueba), `src/app/api/estado/v1/[recurso]/route.ts`.
- No toca nada de la rama `codex/amoxtli-formacion` (trabajo en vuelo de otro agente en el checkout principal).
- Sale sólo progreso como CONTEOS (xp, rachas, módulos, por repasar); ningún título ni nota.

## Engineering Forge (feat/palantir-forge, 2026-11-06)
- Espacios reservados: goal `-006`, paths `-007` a `-025`, ids `cf000000-*` y `b5000000-*`, `ts` de siembra desde `1793901600000`. Ningún otro mundo debe usarlos.
- Archivos compartidos que Forge toca: `src/lib/spines.ts` (Forge va último), `src/lib/seed.ts`, `src/lib/cell-slugs.ts`, `src/lib/seed-frozen.test.ts` (sólo líneas nuevas), `src/lib/seed.test.ts`, `src/lib/subject-themes.ts`, `next.config.mjs`, `src/app/api/fetch-source/route.ts` y `src/app/sw.ts` (estos dos, previstos por el diseño, quedaron sin cambios en este PR).
- Si Amoxtli mergea antes con `HISTORICAL_SPINES`, se reemplaza por `POSITIONAL_SPINES` y se marca `AMOXTLI_SPINE.ownSeedBlock = true`; el efecto es el mismo. No se toca `D:\projects\arcanum` ni `D:\projects\arcanum-m12`.
- Cambio visible en `estado/v1`: el día del despliegue suben `goals` en 1, `modules` en 168 y `sealed` por las celdas selladas de Forge (el diseño estima 108; la cifra real la da la sonda). No es una regresión.
- `SourceViewer` en otros mundos: la lista de reproducción de Alemán A1.2 en `www.youtube.com` pierde «Ver dentro» y sale de la descarga por spine, porque los hosts de video nunca se piden por servidor (`src/lib/fetch-policy.ts`).