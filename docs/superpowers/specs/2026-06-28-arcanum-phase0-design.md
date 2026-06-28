# ARCANUM — Fase 0 · Spec de diseño validado

> Fecha: 2026-06-28 · Estado: aprobado por el usuario (brainstorming) · Próximo paso: plan de implementación (writing-plans).
> Lenguaje del documento: español; identificadores y stack en inglés.

Este spec es la fuente de verdad para construir **Fase 0** de ARCANUM. Deriva del documento maestro de arquitectura del usuario (decisiones bloqueadas) + las decisiones que esta sesión cerró (ubicación, Supabase live, sistema de color variable). Las decisiones arquitectónicas del documento maestro NO se re-litigan aquí; se asumen.

---

## 1. Qué es y qué debe existir al final de Fase 0

ARCANUM es una **PWA local-first de aprendizaje**, instalable en iPhone y laptop, con un **núcleo event-sourced** como única fuente de verdad. Metodología forzada: aprender por error (el reto va primero, el recurso es on-demand) y aprender por acción (proyectos reales). La gamificación (XP, grado hermético, racha, mastery) **se deriva** del log, nunca se almacena como estado mutable.

Entregables exactos de Fase 0 (gate de "hecho"):

1. Shell PWA Next.js + TS strict, instalable, que pasa el checklist iOS (§8).
2. Núcleo event-sourced: envelope, append a Dexie, proyector puro con rebuild completo.
3. Taxonomía de 14 eventos (§4) implementada y tipada.
4. Sync bidireccional con Supabase **live** (push/pull idempotente, cola offline, backoff).
5. Una meta real (**ITC**) con ≥1 módulo real y su **prueba de fuego** (scoring manual).
6. Motor de XP + grado hermético + racha + escudos (§6), todo derivado.
7. Mastery con decaimiento (§6.4) y `review_queue`.
8. Pantalla de inicio (§10): meta, módulo, rito del día, racha viva, grado con sigilo.
9. Estética arcana (§9) con loop de dopamina mínimo (burst XP, sigilo que carga, llama de racha) y `prefers-reduced-motion`.

**Fuera de Fase 0** (el modelo ya lo contempla): notas/Obsidian + OCR + retro IA (Fase 2), canvas React Flow con fog-of-war (Fase 3), Canvas del Tec vía n8n (Fase 4), Sleep Cycle (Fase 2+).

---

## 2. Principios arquitectónicos innegociables

1. **Event sourcing puro.** Un log append-only de eventos inmutables es la ÚNICA fuente de verdad. Todo estado (XP, grado, racha, mastery, cola de repaso) se deriva con un proyector puro (`fold`) sobre el log. Nunca se almacena estado mutable.
2. **Local-first.** La fuente de verdad es **local** (Dexie/IndexedDB). Supabase es un **espejo** sincronizado por unión idempotente de eventos (upsert por `id`). La app funciona 100% offline; sincroniza al haber red + sesión.
3. **Rebuild siempre posible.** Existe un "Reconstruir índice" que re-foldea TODAS las proyecciones desde el log. Las proyecciones son caché, jamás fuente de verdad.
4. **Core puro y aislado.** `src/core/*` no importa React/Next/Dexie/Supabase. Son funciones puras sobre eventos. Todo lo demás depende del core; el core no depende de nada. Esto hace el rebuild trivialmente correcto y el core 100% testeable sin mocks.
5. **Re-tuneable sin migración.** Umbrales de grado, tabla de XP, constantes de mastery viven en un objeto `config`. Cambiarlos = re-foldear, cero migración de datos.

---

## 3. Decisiones cerradas en esta sesión

| Tema | Decisión |
|---|---|
| Ubicación | Repo nuevo, aislado, en `D:\projects\arcanum` (git init, branch `main`). NO dentro de auctorum-systems. |
| Supabase | **Live ahora.** Proyecto `Arcanum` (`tssmjabfszndxwlpzngv`, us-west-2). Keys en `.env.local` (gitignored). |
| Auth | Single-user, Supabase Auth (email+password). App usable offline/sin sesión; **el sync se activa al firmar sesión**. |
| Aplicar migración | El JWT anon/service por PostgREST no corre DDL. Camino: el usuario pega `0001_events.sql` en el SQL Editor de Supabase (10s), **o** entrega DB password / personal access token (`sbp_`) para aplicarla + verificarla automáticamente. |
| Paleta | **Sistema de color variable de 3 capas** (estructura constante + acento por materia + aura por rango). Sin amarillo/naranja de protagonista. Ver §9. |
| Alcance sesión | Spec → plan → construir Fase 0 completa, con check-in en cada frontera de fase. |
| Secrets | Las llaves `service_role`/`sb_secret` se pegaron en el chat → **requieren rotación** post-Fase 0 (ver §14, Riesgo R1). |

---

## 4. El log de eventos

### 4.1 Envelope (única fuente de verdad)

```ts
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

interface ArcanumEvent {
  id: string;            // UUIDv7 (time-ordered)
  type: EventType;       // namespaced, p.ej. 'error.resolved'
  ts: number;            // epoch ms, UTC
  device_id: string;     // origen del evento (depuración de sync)
  goal_id: string | null;
  module_id: string | null;
  payload: Json;         // específico por tipo
  v: number;             // versión del esquema de ESE tipo de evento
}
```

### 4.2 Orden determinista

La proyección ordena por `(ts, id)`. UUIDv7 incrusta tiempo → el desempate por `id` es estable entre dispositivos. Toda métrica dependiente de orden (racha, mastery) es idéntica en iPhone y laptop tras sync.

### 4.3 Zona horaria

`ts` siempre UTC. Los "días" (rachas, agrupaciones) se calculan en una TZ de config, **default `America/Monterrey`**. Cambiar la TZ re-foldea sin pérdida. (Implementación: conversión epoch-ms → fecha-civil en TZ vía `Intl.DateTimeFormat` con `timeZone`, sin dependencia pesada.)

### 4.4 Taxonomía (14 tipos)

| Tipo | Significado | Payload mínimo |
|---|---|---|
| `goal.upserted` | crear/editar meta | `{title, priority, color, sigil}` |
| `module.upserted` | crear/editar módulo | `{title, prereqs[], kind}` |
| `roadmap.edge.upserted` | arista de prerrequisito | `{from, to}` |
| `node.archived` | retirar meta/módulo/arista | `{ref}` |
| `module.started` | empezar a trabajar un módulo | `{}` |
| `module.completed` | cerrar módulo | `{}` |
| `session.started` | inicia sesión de estudio | `{kind: 'error'|'project'|'review'}` |
| `session.ended` | termina sesión | `{duration_ms}` |
| `error.logged` | se topó con un muro | `{description}` |
| `error.resolved` | superó el muro y entiende el porqué | `{insight}` |
| `checkpoint.passed` | quiz/examen/hito superado | `{score}` (0..1) |
| `firetest.attempted` | prueba de fuego en blanco | `{reached, ceiling}` |
| `note.created` | nota nueva | `{note_id, length}` |
| `note.updated` | edición de nota | `{note_id}` |

Versionar por tipo (`v`) permite evolucionar payloads sin romper histórico: el proyector ramifica por `v`. En Fase 0 todo es `v:1`.

---

## 5. Proyecciones (read-models derivados)

`project(events) -> ReadModel`, reducer **puro**. Incremental con cursor (`last_projected_id`); aplica solo eventos nuevos. **Rebuild completo** siempre posible desde el log (botón "Reconstruir índice").

Tablas proyectadas en Dexie (caché, jamás fuente de verdad):

- `goals(id, title, priority, color, sigil)`
- `modules(id, goal_id, title, status, kind, prereqs[], stability_days, last_reinforced_ts, started_ts)`
- `roadmap_edges(from, to)`
- `stats` (singleton: `total_xp, grade, current_streak, longest_streak, shields, last_active_day`)
- `review_queue(module_id, retrievability, due_ts)` — derivada de §6.4

`note.created/updated` se registran en el log desde Fase 0 (XP +5), pero la proyección de notas (grafo Obsidian) es Fase 2 — en Fase 0 solo cuentan para XP.

---

## 6. Motores de derivación (puros, 100% testeados)

### 6.1 XP — recompensa la fricción, no el tiempo

| Evento | XP base |
|---|---|
| `error.resolved` | **+25** |
| `session.ended` con `duration_ms ≥ 1_500_000` (25min) y `payload.kind ≠ 'review'` | +10 |
| `checkpoint.passed` | +50 |
| `module.completed` | +150 |
| `firetest.attempted` | `+round(reached/ceiling*300)` (clamp ceiling>0; reached≤ceiling) |
| `note.created` con `payload.length ≥ 140` | +5 |
| `error.logged` | +0 |

**Multiplicador de racha** (la consistencia compone):
`xp_efectivo = round(xp_base * (1 + min(streak, 30) * 0.02))` → hasta +60% a los 30 días.
El `streak` usado es el **valor de racha al cierre del día del evento** (determinístico desde el log; el proyector mantiene racha corriente). `round` al final, una vez, para evitar artefactos de float.

### 6.2 Grado — escalera hermética (Golden Dawn)

Grado global = mayor umbral ≤ `total_xp`. Umbrales en `config` (re-tuneables → re-foldea):

| Grado | XP acumulado |
|---|---|
| Neophyte | 0 |
| Zelator | 500 |
| Theoricus | 1,500 |
| Practicus | 3,500 |
| Philosophus | 7,000 |
| Adeptus Minor | 13,000 |
| Adeptus Major | 22,000 |
| Adeptus Exemptus | 36,000 |
| Magister Templi | 58,000 |
| Magus | 95,000 |
| Ipsissimus | 160,000 |

Subir de grado dispara la **ceremonia de ascensión** (§9): no un toast, sino la transmutación del aura de toda la app.

### 6.3 Racha + escudos (sin castigo tóxico)

- **Día calificado** = día (en TZ de config) con `≥1 error.resolved` **O** `≥1 session.ended` con `duration_ms ≥ 25min` **O** `≥1 checkpoint.passed`. Abrir la app NO cuenta.
- **Escudos:** se gana 1 escudo cada 7 días calificados acumulados, máx 2 acumulables. Un día perdido **consume un escudo** antes de romper la racha. Sin escudo disponible → la racha se rompe (vuelve a 0).
- `longest_streak` se preserva siempre como récord histórico.
- Determinístico: el proyector recorre los días calificados ordenados, mantiene `current_streak`, `shields`, `longest_streak`, `last_active_day`.

### 6.4 Mastery con decaimiento (repetición espaciada)

Por módulo: estabilidad `S` (días) y `last_reinforced_ts`.

```
r(t) = exp( -(t - last_reinforced) / S )      // t y last en días; r ∈ (0,1]
mastery_mostrado = r(t)                        // lo que carga el sigilo
```

En cada **evento reforzante** del módulo (`checkpoint.passed`, `error.resolved` de ese módulo, hito de proyecto):

```
S_new = S_old * (1 + bonus)
last_reinforced = ts del evento
```

Defaults en `config` (re-tuneables):
- `S0 = 1.0` día (estabilidad inicial al `module.started`; `last_reinforced = started_ts`).
- `bonus = 0.5 + 0.5 * quality`, con `quality ∈ [0,1]`:
  - `checkpoint.passed` → `quality = payload.score`
  - `error.resolved` → `quality = 0.7` (default)
  - hito de proyecto (`checkpoint.passed` con `kind`/payload de proyecto) → `quality = payload.quality ?? 0.7`

**`review_queue`**: módulos con `status = completed` y `r(t) < 0.8`, ordenados por `due_ts`.
`due_ts` = momento en que `r` cruza 0.8: `0.8 = exp(-(t-last)/S)` → `t = last + (-S * ln(0.8))` días.
(Se evalúa contra "ahora"; un módulo completed con `due_ts ≤ ahora` está vencido y encabeza la cola.)

---

## 7. Supabase: espejo + sync

### 7.1 Esquema (`supabase/migrations/0001_events.sql`)

```sql
create extension if not exists pgcrypto;

create table if not exists public.events (
  id          uuid        primary key,
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  type        text        not null,
  ts          bigint      not null,
  device_id   text        not null,
  goal_id     uuid,
  module_id   uuid,
  payload     jsonb       not null default '{}'::jsonb,
  v           integer     not null default 1,
  created_at  timestamptz not null default now()
);

create index if not exists events_user_ts_idx on public.events (user_id, ts);

alter table public.events enable row level security;

create policy events_select_own on public.events
  for select using (auth.uid() = user_id);
create policy events_insert_own on public.events
  for insert with check (auth.uid() = user_id);
-- Sin policy de update/delete → append-only forzado en la DB.
```

`user_id` es metadata del servidor (default `auth.uid()`), NO parte del envelope inmutable. UUIDv7 es un uuid válido → la columna `uuid` lo acepta. `goal_id`/`module_id` son uuid sin FK (goals/modules viven en el log, no en tablas espejo).

### 7.2 Auth single-user

Supabase Auth email+password. La app es 100% usable offline y sin sesión (todo local). El **sync requiere sesión firmada** → RLS real (`auth.uid()`), no un anon free-for-all. Un solo usuario (el dueño).

### 7.3 Sync (unión de log, sin merge de estado)

Metadata local en Dexie (no en el envelope): cada evento local lleva `synced: 0|1`; un singleton `sync_meta { pull_cursor: number }`.

- **Push:** seleccionar eventos locales con `synced=0`; `supabase.from('events').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })`; al éxito marcar `synced=1`. Idempotente (PK por `id`).
- **Pull:** `select * where ts >= pull_cursor order by ts`; insertar local con `db.events.put` (idempotente por `id`); avanzar `pull_cursor = max(ts)`. El solape por `>=` es inofensivo (dedup por id).
- **Cola offline:** la propia tabla local de eventos ES la cola (fuente de verdad). El sync solo reconcilia.
- **Backoff:** reintentos con backoff exponencial + jitter; cap. Estado de sync visible en UI (para que el usuario sepa que su log está respaldado — mitiga el miedo al desalojo de IndexedDB).
- Tras push/pull, re-foldear (incremental).

---

## 8. PWA "feel nativo" iOS

Requisitos (gate de Fase 0):
- `manifest.webmanifest`: `display: standalone`, `theme_color`, `background_color`, íconos (incl. maskable 512), `apple-touch-icon`.
- Metas iOS: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`.
- Safe areas: `viewport-fit=cover` + `env(safe-area-inset-*)` en layout/nav.
- Scroll: `overscroll-behavior: none` en root (sin bounce del body); inercia en contenedores scrollables (`-webkit-overflow-scrolling: touch`).
- `-webkit-tap-highlight-color: transparent`; touch targets ≥ 44px.
- Service worker (Serwist): offline-first total; precache + runtime caching + fallback offline; sync al reconectar.
- `navigator.storage.persist()` para reducir riesgo de desalojo de IndexedDB.
- Animaciones solo `transform`/`opacity`; `prefers-reduced-motion` respetado.

Caveats iOS (mitigados, no ocultados):
- **Háptica:** Vibration API NO existe en Safari/PWA iOS → háptica solo enhancement en Android/desktop; en iOS feedback visual+sonoro. No prometer vibración en iPhone.
- **Instalación:** iOS no dispara `beforeinstallprompt` → coach-mark que detecta iOS Safari no-standalone y muestra "Compartir → Agregar a inicio".
- **Push:** solo iOS 16.4+ y solo si está instalada en home screen → notificaciones de racha como enhancement, no dependencia del core (fuera de Fase 0).
- **Desalojo de almacenamiento:** mitigado por el espejo Supabase (rehidrata el log) + estado de sync visible.

---

## 9. Sistema de color variable (3 capas)

La paleta NO es un tema fijo: varía por **materia** y sobre todo por **rango** (incentivo de dopamina). Sin amarillo/naranja de protagonista. Todo vía CSS variables (tokens) en `src/styles/tokens.css`, re-tuneables sin tocar lógica.

### 9.1 Capa 1 — Estructura (constante, grimorio oscuro)

Ancla de legibilidad (WCAG AA). Nunca cambia. El off-white cálido del texto es neutro (no acento).

| Token | Hex | Uso |
|---|---|---|
| `--ink` | `#0C0B12` | page bg |
| `--surface` | `#15131F` | superficie |
| `--surface-raised` | `#1E1B2B` | superficie elevada |
| `--line` | `#2C2840` | bordes/hairlines |
| `--text` | `#ECE7DA` | texto pergamino |
| `--text-muted` | `#9A93AE` | texto secundario |

### 9.2 Capa 2 — Acento de materia (`--topic-*`)

Identidad de cada meta, seteada desde `goal.color` (editable con ColorPicker al crear la meta). Tiñe el área de contenido de esa meta: tarjetas de módulo, sigilo de módulo, progreso. Defaults:

| Materia | Hex | Nombre |
|---|---|---|
| ITC | `#25B0C9` | cian |
| FrED Factory | `#1F9E84` | jade |
| Alemán | `#C0455F` | granate |
| Ciberseguridad | `#7C4DE8` | violeta |

### 9.3 Capa 3 — Aura de rango (`--rank-*`) — eje dopamina

Derivada del grado hermético global. Cada grado tiene su aura; la rampa **escala** (frío/humilde → rico → trascendente). Subir de grado intercambia las CSS vars → toda la app se transmuta (la ceremonia). El aura tiñe: sigilo de grado, valor + burst de XP, llama de racha, glow del top-bar.

| Grado | Aura | Hex |
|---|---|---|
| Neophyte | peltre frío | `#8C90A0` |
| Zelator | azul acero | `#5C6BB0` |
| Theoricus | teal | `#2A9D9A` |
| Practicus | viridian | `#2BA35E` |
| Philosophus | azur | `#2E78E0` |
| Adeptus Minor | indigo | `#5A4FE0` |
| Adeptus Major | violeta | `#7C43E8` |
| Adeptus Exemptus | amatista | `#A23BD8` |
| Magister Templi | carmesí | `#C0356B` |
| Magus | violeta-blanco luminoso | `#C9B6FF` |
| Ipsissimus | iridiscente (lila-blanco) | `#E3DCF5` |

Rupturas deliberadas del canon Golden Dawn para honrar la preferencia del usuario: Practicus (Hod) en viridian, no naranja; sin oro/amarillo en Tiphareth/altos grados.

### 9.4 Composición (sin enlodarse)

- **Estructura** = base constante.
- **Contenido** de la meta activa usa `--topic-*` (módulos, sigilo de módulo, su progreso).
- **Chrome + recompensas** usan `--rank-*` (sigilo de grado, XP + burst, llama de racha, top-bar). El **XP se acopla al aura** → ascender recolorea la recompensa.

Doble fuente de dopamina: identidad por materia + prestigio por rango. Separación semántica/espacial (contenido vs chrome) evita choque de color.

### 9.5 Loop de dopamina (mínimo Fase 0)

Burst de XP animado (transform/opacity, 60fps) en color de aura; sigilo de módulo que carga con el mastery; llama de racha (fuego arcano frío violeta/cian, no ámbar) con escudos. Ceremonia de ascensión al subir de grado. Sonido/háptica = progressive enhancement (caveat iOS §8). Todo respeta `prefers-reduced-motion`.

---

## 10. Metodología en la UX

### 10.1 Aprender por error — el reto va primero

Un módulo **no presenta contenido al abrirlo**: presenta un **reto en blanco**. Los recursos (videos, URLs, cursos) existen pero **colapsados/secundarios**; se alcanzan al chocar con un muro. Jerarquía de UI = jerarquía pedagógica. `error.resolved` se registra al superar el muro — ese evento es el latido del sistema.

### 10.2 Aprender por acción

Sesión `kind:'project'`. Los hitos de proyecto cuentan como reforzantes de mastery y pagan XP fuerte.

### 10.3 Prueba de fuego — calibración por ejecución

Al iniciar meta/módulo, ARCANUM emite un **reto en blanco**. Registra `firetest.attempted {reached, ceiling}`. El nivel se **infiere de hasta dónde llegaste**, no de texto externo. Marca prerrequisitos como ya dominados (se saltan en el DAG futuro) y dónde arranca el mastery. Scoring: Fase 0 = autoreporte honesto (sliders `reached`/`ceiling`); Fase 1+ = asistido por IA vía Edge Function.

---

## 11. Pantalla de inicio

La abres mañana y ves: la meta **ITC**, un módulo real, el **rito del día** (el acto calificado pendiente, presentado como rito), la **racha viva** (llama + escudos), el **grado actual** con su sigilo. Todo derivado del log en vivo.

---

## 12. Seed mínimo

Meta "ITC" (priority alta, color cian, sigilo) → módulo "Estructuras de datos: fundamentos" (`kind`, prereqs) → su **prueba de fuego** (reto en blanco + scoring manual). Sembrado como **eventos** (no estado), idempotente: si el log ya contiene el seed (por `id` determinístico del seed), no se duplica.

---

## 13. Estructura de carpetas

```
arcanum/
  src/
    core/            ← motor event-sourced (PURO, sin framework)
      event.ts          envelope, EventType, UUIDv7, orden (ts,id)
      config.ts         umbrales de grado, tabla XP, constantes mastery, TZ
      time.ts           epoch-ms → día civil en TZ (Intl)
      projector.ts      fold puro + cursor incremental + rebuild
      xp.ts             tabla XP + multiplicador de racha
      grade.ts          grado por XP acumulado
      streak.ts         días calificados, escudos, longest
      mastery.ts        S/decay, r(t), review_queue, due_ts
    db/              ← Dexie: log + caché de proyecciones + sync meta
    sync/            ← Supabase push/pull idempotente, backoff, cola
    store/           ← Zustand: read-model derivado; recomputa al append
    app/             ← rutas Next, home, layout PWA
    ui/              ← componentes arcanos (XP burst, sigilo, llama)
    styles/          ← tokens.css (3 capas de color)
  supabase/migrations/0001_events.sql
  public/            ← manifest, íconos PWA, apple-touch-icon
  tests/             ← vitest, co-localizado por preocupación
```

Regla dura: `src/core/*` cero imports de React/Next/Dexie/Supabase.

---

## 14. Riesgos y mitigaciones

- **R1 — Secrets en el chat.** Las llaves `service_role`/`sb_secret` se pegaron en el transcript. Mitigación inmediata: solo en `.env.local` (gitignored), `service_role` jamás en cliente. Mitigación real: **rotar** las llaves en el dashboard de Supabase post-Fase 0 (borrar el mensaje ≠ des-exponer). Recordatorio explícito al cierre.
- **R2 — Aplicar la migración.** PostgREST no corre DDL con los JWT dados. Mitigación: pegar `0001_events.sql` en el SQL Editor (camino default), o entregar DB password / PAT `sbp_` para aplicarla + verificarla automáticamente. El resto del sync se prueba contra la tabla ya creada.
- **R3 — Desalojo de IndexedDB en iOS.** Mitigado por el espejo Supabase (rehidrata) + `navigator.storage.persist()` + estado de sync visible.
- **R4 — Free tier Supabase.** Suficiente para un usuario; sin riesgo en Fase 0.
- **R5 — Determinismo cross-device.** Garantizado por orden `(ts, id)` con UUIDv7 + folds puros. Test de blindaje: misma multiset de eventos en cualquier orden de llegada → read-model idéntico.

---

## 15. Estrategia de testing (vitest, cero placebos)

- **Core puro** (sin mocks): XP por tipo + multiplicador; grado por umbrales (fronteras exactas); racha (día calificado, escudos gana/consume/rompe, longest preservado); mastery (`r(t)`, `S_new`, `due_ts`, `review_queue`); time (epoch→día en TZ, cambios de día, DST-safe Monterrey).
- **Proyector**: determinismo (permutaciones del log → mismo read-model); incremental == rebuild; idempotencia de re-aplicar.
- **Sync**: doble push/pull = sin duplicados (idempotente por id); cursor de pull avanza; cola offline reconcilia.
- **Integración Supabase** (live, con sesión de prueba): round-trip push→pull contra la tabla real; RLS positivo (ve lo propio) y negativo (no ve lo ajeno); cleanup sin residuo.

---

## 16. Secuencia de build (con check-in en cada frontera)

1. **Scaffold** — Next 14 App Router, TS strict, Tailwind, deps (Dexie, Serwist, supabase-js, Zustand, motion, uuidv7, vitest). `next.config` sin `standalone`. Build + dev verde.
2. **Vertical slice** — event core → Dexie append → proyector → Zustand → home renderizando XP/grado/racha **derivados de verdad** de un seed hardcodeado. Prueba la espina end-to-end.
3. **Profundidad de derivación** — tabla XP completa, escudos, mastery decay, review_queue + tests del core.
4. **PWA shell + UI arcana + loop de dopamina** — manifest, Serwist, tokens 3-capas, burst/sigilo/llama, home final, prueba de fuego (scoring manual), reto-en-blanco del módulo.
5. **Supabase live + sync** — aplicar `0001_events.sql`, auth single-user, push/pull idempotente, test de integración contra el proyecto real.
6. **Polish + test pass completo + verify** — `pnpm test` verde, `pnpm build` verde, PWA instalable; commits limpios. Recordatorio de rotación de secrets (R1).

Una milla está cerrada cuando build + tests pasan y la home renderiza datos derivados reales — no cuando "compila".
