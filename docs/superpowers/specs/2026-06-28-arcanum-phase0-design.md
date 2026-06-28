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
5. **Re-tuneable sin migración.** Umbrales de grado, tabla de XP, constantes de mastery, mapa rango→aura, todo vive en un objeto `config`. Cambiarlos = re-foldear, cero migración de datos.
6. **El fold es puro y atemporal; `now` entra solo en presentación.** El reducer NUNCA lee el reloj (`Date.now()`) ni usa aleatoriedad. Produce solo estado **invariante en el tiempo** (XP, grado, racha al cierre del último día calificado, `S`/`last_reinforced`/`due_ts` por módulo). Todo lo dependiente de "ahora" (retrievabilidad `r(now)`, si la racha sigue viva hoy, qué módulos están vencidos) se computa en una **capa de presentación** pura que recibe `now` como parámetro EXPLÍCITO (§6.5). Sin esto, iPhone y laptop foldeando el mismo log en instantes distintos darían read-models distintos y `incremental == rebuild` fallaría.

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
| `checkpoint.passed` | quiz/examen/hito de proyecto superado | `{score, kind?: 'checkpoint'\|'project', quality?}` |
| `firetest.attempted` | prueba de fuego en blanco | `{reached, ceiling}` |
| `note.created` | nota nueva | `{note_id, length}` |
| `note.updated` | edición de nota | `{note_id}` |

Versionar por tipo (`v`) permite evolucionar payloads sin romper histórico: el proyector ramifica por `v`. En Fase 0 todo es `v:1`.

**Notas de taxonomía (Fase 0):**
- **`checkpoint.passed.kind`** es el discriminador hito-de-proyecto vs checkpoint normal (resuelve la ambigüedad de mastery, §6.4). `kind:'project'` → usa `payload.quality ?? 0.7`; ausente/`'checkpoint'` → usa `payload.score`. XP es el mismo (+50) en ambos.
- **Eventos registrados-pero-inertes en Fase 0** (se loguean ya, se consumen en fases futuras, CERO placebo en UI): `roadmap.edge.upserted` y `node.archived` (su consumidor, el DAG con fog-of-war, es Fase 3); `note.created/updated` solo cuentan para XP (el grafo Obsidian es Fase 2); `error.logged` paga +0 y solo es antecedente de `error.resolved`.
- **`firetest.attempted` "marca prerrequisitos dominados"** (§10.3) es **registrado-pero-inerte** en Fase 0: el DAG donde se saltarían prereqs es Fase 3. En Fase 0 el firetest solo paga XP y siembra mastery inicial; no oculta nodos (no hay nodos que ocultar todavía).
- **Eventos de seed** usan UUIDs **fijos hardcodeados** (uuid válido, exentos de la generación UUIDv7) para idempotencia del seed (§12).

---

## 5. Proyecciones (read-models derivados)

`project(events) -> ReadModel`, reducer **puro y atemporal** (§2 pp.6). Incremental con cursor `last_projected = (ts, id)` (la tupla de orden de §4.2, no solo `id`); aplica solo eventos nuevos en orden. **Regla de inserts fuera de orden:** si un evento sincronizado aterriza con `(ts, id)` MENOR que el cursor (llegó tarde por sync con clock-skew), la proyección incremental no puede colocarlo en su posición → se dispara **rebuild completo**. Así `incremental == rebuild` se cumple siempre. **Rebuild completo** siempre posible desde el log (botón "Reconstruir índice").

Tablas proyectadas en Dexie (caché, jamás fuente de verdad):

- `goals(id, title, priority, color, sigil)`
- `modules(id, goal_id, title, status, kind, prereqs[], stability_days, last_reinforced_ts, started_ts)`
- `roadmap_edges(from, to)`
- `stats` (singleton: `total_xp, grade, current_streak, longest_streak, shields, last_qualified_day`) — `current_streak` es el valor **al cierre del último día calificado** (atemporal); si esa racha sigue viva HOY lo decide la capa de presentación (§6.5).
- `review_queue(module_id, due_ts)` — SOLO `due_ts` (clock-free) se proyecta. `retrievability = r(now)` y la partición "vencido" (`due_ts ≤ now`) NO se foldean: se computan en presentación (§6.5).

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
| `firetest.attempted` | `reached/ceiling*300` **sin redondear** (clamp ceiling>0; reached≤ceiling) |
| `note.created` con `payload.length ≥ 140` | +5 |
| `error.logged` | +0 |

El `xp_base` se mantiene SIN redondear (incl. firetest); el `round` ocurre **una sola vez al final**, tras aplicar el multiplicador, para evitar doble-redondeo y artefactos de float.

**Multiplicador de racha — proyección bifásica (day-bucketed).** La consistencia compone, pero "racha al cierre del día del evento" NO es computable en un solo forward-pass: si un `error.resolved` a las 09:00 es el primer evento calificador del día D, en ese instante el proyector aún no sabe que D califica (la calificación es propiedad de TODO el día). Por eso el XP se computa en **dos fases puras**:

1. **Fase 1 — racha por día.** Foldea los eventos en el conjunto de días calificados y computa la racha **cerrada** de cada día civil (incluye al propio día D: el evento calificador es lo que la gana). Reusa el motor de racha (§6.3).
2. **Fase 2 — XP.** A cada evento que paga XP se le asigna `streak = racha_cerrada(día_del_evento)` y se computa:
   `xp_efectivo = round(xp_base * (1 + min(streak, 30) * 0.02))` → hasta +60% a los 30 días.

Consecuencia testeable: **dos eventos del mismo día reciben multiplicador idéntico** (independiente de su posición intra-día). Sin la bifase, dos `error.resolved` el mismo día darían XP distinto según la hora — bug.

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

**Día calificado** = día (en TZ de config) con `≥1 error.resolved` **O** `≥1 session.ended` con `duration_ms ≥ 25min` (cualquier `kind`) **O** `≥1 checkpoint.passed`. Abrir la app NO cuenta.

**Algoritmo (determinístico, pura sobre el log).** El proyector toma el conjunto ordenado de días calificados `D₁ < D₂ < … < Dₙ` y mantiene `current_streak`, `shields`, `longest_streak`, `last_qualified_day`, y un contador interno `qd_count` (días calificados de la racha viva). Inicial: todo 0. Para cada `Dᵢ`:

1. **Gap previo.** `gap = (días civiles estrictamente entre Dᵢ₋₁ y Dᵢ)` (0 si consecutivos; para `D₁`, `gap=0`). Cada día del gap consume **un** escudo:
   - Si `gap ≤ shields`: `shields -= gap`; la racha **sobrevive** (los días-gap NO incrementan la racha, solo no la rompen).
   - Si `gap > shields`: la racha se **rompe** → `current_streak = 0`, `shields = 0`, `qd_count = 0` (los escudos restantes se pierden al romper).
2. **Día calificado.** `current_streak += 1`; `qd_count += 1`; `last_qualified_day = Dᵢ`.
3. **Ganar escudo.** Cada vez que `qd_count` cruza un múltiplo de 7 (7, 14, 21…): si `shields < 2` → `shields += 1`; si ya está en 2 → el grant **se descarta** (no se banca). `qd_count` NO se reindexa: es acumulado de la racha viva y se reinicia solo al romper (paso 1).
4. `longest_streak = max(longest_streak, current_streak)` siempre.

**Casos pin-down:** 2+ días perdidos consecutivos consumen un escudo **por día**; con `shields=1` y `gap=3`, la racha se rompe (3 > 1). Un día-gap absorbido NO suma a la racha (no inflas racha por faltar). Over-cap (>2) se descarta. El contador de 7 se reinicia al romper, no al ganar escudo.

**Racha viva HOY (presentación, §6.5).** El fold deja `current_streak` al cierre de `Dₙ`. Si esa racha sigue viva *hoy* depende de `now`: si `now`'s day == `Dₙ` o el gap `Dₙ→hoy` es absorbible por los `shields` actuales, está viva; si no, presentación la muestra rota/en riesgo. Este cómputo NO está en el fold.

### 6.4 Mastery con decaimiento (repetición espaciada)

El **fold** produce SOLO estado atemporal por módulo: estabilidad `S` (días), `last_reinforced_ts`, y `due_ts` (clock-free, ver abajo). NO computa `r(now)` (eso es §6.5).

**Eventos reforzantes** del módulo: `checkpoint.passed` (incl. `kind:'project'`) y `error.resolved` de ese módulo. `module.completed` por sí solo **NO** refuerza (un módulo cerrado sin reforzar queda con `S` baja → entra pronto a la cola de repaso, que es lo correcto pedagógicamente). En cada reforzante:

```
S_new = S_old * (1 + bonus)
last_reinforced = ts del evento
due_ts = last_reinforced_dias + (-S_new * ln(reviewThreshold))   // clock-free
```

Defaults en `config` (re-tuneables):
- `S0 = 1.0` día (estabilidad inicial al `module.started`; `last_reinforced = started_ts`).
- `reviewThreshold = 0.8` (umbral de retrievabilidad para repaso).
- `bonus = 0.5 + 0.5 * quality`, con `quality ∈ [0,1]`:
  - `checkpoint.passed` `kind` ausente/`'checkpoint'` → `quality = payload.score`
  - `checkpoint.passed` `kind:'project'` → `quality = payload.quality ?? 0.7`
  - `error.resolved` → `quality = 0.7` (default)

**`due_ts`** = momento en que `r` cruzará `reviewThreshold`: `0.8 = exp(-(t-last)/S)` → `t = last + (-S·ln 0.8)` días. **Depende solo de datos del evento** (`S`, `last_reinforced`) → es atemporal y SÍ se proyecta al read-model. Numéricamente `-ln 0.8 = 0.22314`: con `S0=1.0`, `due ≈ 0.223 d` (5.4 h); tras un `error.resolved` (`bonus=0.85 → S=1.85`), `due ≈ 0.413 d`.

### 6.5 Capa de presentación (lo dependiente de `now`)

Función **pura** `present(readModel, now) -> ViewModel`. Recibe `now` EXPLÍCITO (nunca `Date.now()` interno). Computa lo que el fold deliberadamente NO computa:
- **`r(now) = exp(-(now - last_reinforced)/S)`** por módulo → carga del sigilo (módulos activos y completados).
- **`review_queue` efectiva**: módulos `status=completed` con `due_ts ≤ now` (vencidos) ordenados por `due_ts`; los `due_ts > now` aún no entran.
- **Racha viva hoy**: si la racha del fold (§6.3) sigue activa dado `now` (mismo día que `Dₙ`, o gap absorbible por `shields`), si no, "rota/en riesgo".
- **Rito del día**: si HOY ya es día calificado o falta el acto.

Por ser pura con `now` inyectado, es testeable con relojes fijos y NO rompe el determinismo del fold. (Sigilo de módulo activo: arranca en `r=1.0` al `module.started` y decae hasta reforzar — señal honesta "úsalo o se enfría".)

---

## 7. Supabase: espejo + sync

### 7.1 Esquema (`supabase/migrations/0001_events.sql`)

```sql
create extension if not exists pgcrypto;

create table if not exists public.events (
  id          uuid        primary key,
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  seq         bigint      generated always as identity,   -- orden monotónico del SERVIDOR (cursor de pull)
  type        text        not null,
  ts          bigint      not null,                        -- epoch ms cliente (orden del FOLD, no del pull)
  device_id   text        not null,
  goal_id     uuid,
  module_id   uuid,
  payload     jsonb       not null default '{}'::jsonb,
  v           integer     not null default 1,
  created_at  timestamptz not null default now()
);

create index if not exists events_user_seq_idx on public.events (user_id, seq);

alter table public.events enable row level security;

create policy events_select_own on public.events
  for select using (auth.uid() = user_id);
create policy events_insert_own on public.events
  for insert with check (auth.uid() = user_id);
-- Sin policy de update/delete → append-only forzado en la DB.
```

`user_id` y `seq` son metadata del SERVIDOR, NO parte del envelope inmutable. `seq` (identity monotónico, asignado al insertar) es el cursor de pull — **no** `ts` (que es del cliente y bajo clock-skew puede llegar fuera de orden y hacer que un cursor sobre `ts` salte eventos para siempre). `ts` se usa SOLO para el orden del fold `(ts, id)`. UUIDv7 es un uuid válido → la columna `uuid` lo acepta. `goal_id`/`module_id` son uuid sin FK (goals/modules viven en el log, no en tablas espejo).

**Contrato de filas (crítico):** al **push**, el objeto de fila debe **omitir la llave `user_id`** por completo (no mandar `null` ni `undefined` — Postgres solo aplica el `default auth.uid()` si la columna NO está en el INSERT; un `null` explícito viola `not null`). Al **pull**, proyectar la fila al envelope: **descartar `user_id`, `seq`, `created_at`** antes del `put` local (mantiene local y remoto con la misma forma de envelope y evita re-pushear un `user_id` ajeno).

### 7.2 Auth single-user

Supabase Auth email+password. La app es 100% usable offline y sin sesión (todo local). El **sync requiere sesión firmada** → RLS real (`auth.uid()`), no un anon free-for-all. Un solo usuario (el dueño).

### 7.3 Sync (unión de log, sin merge de estado)

Metadata local en Dexie (no en el envelope): cada evento local lleva `synced: 0|1`; un singleton `sync_meta { pull_cursor: number }` donde `pull_cursor` es el último `seq` del servidor visto.

- **Push:** seleccionar eventos locales con `synced=0`; mapear al **contrato de fila** (envelope SIN `user_id`); `supabase.from('events').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })`; al éxito marcar `synced=1`. Idempotente (PK por `id`).
- **Pull:** `select * where seq > pull_cursor order by seq` (cursor sobre `seq` del servidor, monotónico → cero eventos saltados aunque el `ts` de cliente esté sesgado); proyectar cada fila al envelope (descartar `user_id`/`seq`/`created_at`); `db.events.put` (idempotente por `id`, marcar `synced=1`); avanzar `pull_cursor = max(seq)` recibido.
- **Cola offline:** la propia tabla local de eventos ES la cola (fuente de verdad). El sync solo reconcilia.
- **Backoff:** reintentos con backoff exponencial + jitter; cap. Estado de sync visible en UI (para que el usuario sepa que su log está respaldado — mitiga el miedo al desalojo de IndexedDB).
- Tras push/pull, re-foldear (incremental; si llegó un evento con `(ts,id)` < cursor del proyector → rebuild, §5).

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

El mapa `grado → aura` vive en `config` + `tokens.css` (re-tuneable como los umbrales de grado, §2 pp.5): subir de grado solo intercambia el set de CSS vars `--rank-*`; cero lógica tocada.

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

Meta "ITC" (priority alta, color cian, sigilo) → módulo "Estructuras de datos: fundamentos" (`kind`, prereqs) → su **prueba de fuego** (reto en blanco + scoring manual). Sembrado como **eventos** (no estado). Los eventos de seed usan **UUIDs fijos hardcodeados** (uuid válidos, exentos de la generación UUIDv7) → idempotencia: el append de seed hace `put` por `id`, así que re-correr el seed no duplica. NUNCA generes UUIDv7 fresco para el seed (rompería la idempotencia).

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
      streak.ts         días calificados, escudos, longest (atemporal)
      mastery.ts        S/decay, due_ts (atemporal, clock-free)
      present.ts        presentación: r(now), vencidos, racha viva (now EXPLÍCITO)
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

- **R1 — Secrets en el chat.** Las llaves `service_role`/`sb_secret` se pegaron en el transcript. Mitigación inmediata: solo en `.env.local` (gitignored), `service_role` jamás en cliente. Mitigación real: **rotar** las llaves en el dashboard de Supabase (borrar el mensaje ≠ des-exponer). **Gate de salida de Fase 0** (no "post"): la rotación es parte del cierre, dado que las llaves ya están expuestas. Recordatorio explícito al final del build.
- **R2 — Aplicar la migración.** PostgREST no corre DDL con los JWT dados. Mitigación: pegar `0001_events.sql` en el SQL Editor (camino default), o entregar DB password / PAT `sbp_` para aplicarla + verificarla automáticamente. El resto del sync se prueba contra la tabla ya creada.
- **R3 — Desalojo de IndexedDB en iOS.** Mitigado por el espejo Supabase (rehidrata) + `navigator.storage.persist()` + estado de sync visible.
- **R4 — Free tier Supabase.** Suficiente para un usuario; sin riesgo en Fase 0.
- **R5 — Determinismo cross-device.** Garantizado por orden `(ts, id)` con UUIDv7 + folds puros. Test de blindaje: misma multiset de eventos en cualquier orden de llegada → read-model idéntico.

---

## 15. Estrategia de testing (vitest, cero placebos)

- **Core puro** (sin mocks):
  - XP por tipo; firetest sin doble-redondeo; **multiplicador bifásico — dos eventos del MISMO día reciben multiplicador idéntico** (§6.1); ceiling +60% a 30 días.
  - Grado por umbrales (fronteras exactas: 499→Neophyte, 500→Zelator, etc.).
  - Racha + escudos (§6.3): gap absorbido no infla racha; 2+ días perdidos consumen escudo por día; `gap>shields` rompe (racha=0, escudos=0); contador de 7 reinicia al romper, no al ganar; over-cap descartado; longest preservado.
  - Mastery (§6.4): `S_new`, `due_ts` clock-free correcto (`-S·ln 0.8`); `kind:'project'` usa `quality`; `module.completed` no refuerza.
  - **Presentación (§6.5): pura con `now` inyectado** — `r(now)`, partición vencidos (`due_ts ≤ now`), racha viva hoy. Con relojes fijos distintos → mismo read-model del fold, distinta vista (prueba la separación).
  - Time: epoch→día en TZ, cambios de día, DST-safe Monterrey.
- **Proyector**: determinismo (permutaciones del log → mismo read-model, R5); incremental == rebuild; idempotencia de re-aplicar; **insert fuera de orden (`(ts,id)` < cursor) dispara rebuild y converge al mismo estado** (§5).
- **Sync**: doble push/pull = sin duplicados (idempotente por id); push omite `user_id`; pull proyecta al envelope (sin `seq`/`user_id`/`created_at`); **cursor sobre `seq` no salta eventos con `ts` de cliente sesgado** (§7.3); cola offline reconcilia.
- **Integración Supabase** (live, con sesión de prueba): round-trip push→pull contra la tabla real; RLS positivo (ve lo propio) y negativo (no ve lo ajeno); intento de `update`/`delete` rechazado (append-only); cleanup sin residuo.

---

## 16. Secuencia de build (con check-in en cada frontera)

1. **Scaffold** — Next 14 App Router, TS strict, Tailwind, deps (Dexie, Serwist, supabase-js, Zustand, motion, uuidv7, vitest). `next.config` sin `standalone`. Build + dev verde.
2. **Vertical slice** — event core → Dexie append → proyector → Zustand → home renderizando XP/grado/racha **derivados de verdad** de un seed hardcodeado. Prueba la espina end-to-end.
3. **Profundidad de derivación** — tabla XP completa, escudos, mastery decay, review_queue + tests del core.
4. **PWA shell + UI arcana + loop de dopamina** — manifest, Serwist, tokens 3-capas, burst/sigilo/llama, home final, prueba de fuego (scoring manual), reto-en-blanco del módulo.
5. **Supabase live + sync** — aplicar `0001_events.sql`, auth single-user, push/pull idempotente, test de integración contra el proyecto real.
6. **Polish + test pass completo + verify** — `pnpm test` verde, `pnpm build` verde, PWA instalable; commits limpios. Recordatorio de rotación de secrets (R1).

Una milla está cerrada cuando build + tests pasan y la home renderiza datos derivados reales — no cuando "compila".
