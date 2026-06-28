# ARCANUM Fase 0 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. The full design contract is `docs/superpowers/specs/2026-06-28-arcanum-phase0-design.md` — read it; this plan does NOT duplicate its formulas, it operationalizes them. Section refs like "§6.3" point at the spec.

**Goal:** Build Phase 0 of ARCANUM — a local-first, single-user learning PWA whose only source of truth is an append-only event log, with all gamification (XP, hermetic grade, streak+shields, mastery decay) derived by a pure projector, mirrored to Supabase, and rendered on an arcane home screen.

**Architecture:** A framework-free pure core (`src/core/*`) folds the event log into a time-invariant read-model; a pure presentation layer injects `now` for time-dependent views. Dexie holds the log + projection cache; Supabase Postgres is an idempotent mirror synced by event union (server `seq` cursor). React/Next (App Router) + Zustand render the read-model; Serwist makes it an installable offline-first PWA. Color is a 3-layer token system (structural + per-topic + per-rank aura).

**Tech Stack:** Next 14.2 (App Router) · TypeScript 5.x strict · Dexie 4 · Serwist 9 · @supabase/supabase-js 2 · Zustand 4 · Tailwind 3.4 · framer-motion 11 · uuidv7 · Vitest 2 (happy-dom + fake-indexeddb).

**Conventions:**
- TDD throughout: write failing test → run (see it fail) → minimal impl → run (pass) → commit. Cero placebos.
- `src/core/*` imports NOTHING from react/next/dexie/supabase. Enforced by an arch test.
- Pure functions take `now`/inputs explicitly — never `Date.now()` / `Math.random()` inside core or presentation.
- Commit after each green task. Conventional commits.

---

## File structure (locked)

```
src/
  core/                      ← PURE, framework-free. The heart.
    event.ts                 envelope ArcanumEvent, EventType, payload types, Json; uuidv7 gen; compareEvents (ts,id)
    read-model.ts            ReadModel, Goal, Module, Stats, ReviewItem, ViewModel types
    config.ts                ARCANUM_CONFIG: grade thresholds, XP table, mastery (S0,bonus,reviewThreshold), TZ, rank→aura, streak consts
    time.ts                  civilDay(ts,tz) → 'YYYY-MM-DD'; dayKeyToOrdinal; daysBetween; msToDays
    xp.ts                    xpBase(event); streakMultiplier(streak); (consumed by projector two-phase)
    grade.ts                 gradeForXp(totalXp) → grade name + index
    streak.ts                streakTimeline(qualifiedDayOrdinals) → per-day closed streak + final {current,longest,shields,qd_count,lastQualifiedDay}
    mastery.ts               reinforce(state,quality,tsDays) → {S,last,dueDays}; dueDaysFor(S,last,threshold)
    projector.ts             project(events) → ReadModel (incremental + full rebuild); two-phase XP/streak; (ts,id) order; out-of-order → rebuild
    present.ts               present(readModel, nowMs) → ViewModel (r(now), overdue review, streak-alive, rito del día)
  db/
    schema.ts                ArcanumDB (Dexie): events(+synced), goals, modules, roadmap_edges, stats, review_queue, sync_meta
    repo.ts                  appendEvent, getAllEvents, loadReadModel/saveReadModel, projectorCursor
  sync/
    client.ts                browser supabase client (env)
    auth.ts                  signIn/signOut/getSession/onAuthChange
    mapping.ts               toRow(event) (omit user_id); fromRow(row) (strip user_id,seq,created_at)
    sync.ts                  push(), pull(), syncOnce(), backoff
  store/
    arcanum-store.ts         Zustand: {readModel, viewModel, dispatch(event), rebuild(), refreshPresent(now)}
  app/
    layout.tsx               html/head metas (iOS PWA), providers, fonts
    page.tsx                 home screen (server shell → client HomeView)
    globals.css              tailwind base + structural tokens import + iOS scroll rules
    sw.ts                    Serwist service worker source
    manifest.ts              web app manifest (Next metadata route)
    icon assets in public/
  ui/
    HomeView.tsx             client root: reads store, renders the home
    GradeSigil.tsx, XpBurst.tsx, StreakFlame.tsx, ModuleCard.tsx, RitoDelDia.tsx,
    BlankChallenge.tsx, FireTest.tsx, SyncStatus.tsx, InstallCoachMark.tsx, RankAura.tsx
  styles/
    tokens.css               3-layer color tokens (structural constants + topic + rank aura map)
  lib/
    seed.ts                  fixed-UUID seed events (ITC goal + módulo + firetest)
    rank-aura.ts             grade → CSS var set (re-tunable, mirrors config)
supabase/migrations/0001_events.sql
tests/                       co-located under src/**/__tests__ OR tests/; this plan uses src/**/*.test.ts
```

---

## Chunk 1: Scaffold + tooling

Goal: a building, linting, testing Next 14 App Router skeleton with strict TS, Tailwind, Vitest, and the core-purity arch test harness. (Deps already installed.)

### Task 1.1: Base configs

**Files:**
- Create: `tsconfig.json`, `next.config.mjs`, `next-env.d.ts` (auto), `postcss.config.mjs`, `tailwind.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `.eslintrc.json`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: `tsconfig.json`** — Next strict baseline + `"strict": true`, `"noUncheckedIndexedAccess": true`, path alias `"@/*": ["./src/*"]`, `moduleResolution: "bundler"`, `jsx: "preserve"`, include `next-env.d.ts`, `**/*.ts`, `**/*.tsx`.
- [ ] **Step 2: `next.config.mjs`** — `withSerwistInit` from `@serwist/next` (swSrc `src/app/sw.ts`, swDest `public/sw.js`, disable in dev), `reactStrictMode: true`. NEVER `output:'standalone'`.
- [ ] **Step 3: `tailwind.config.ts`** — content globs `./src/**/*.{ts,tsx}`, `darkMode: 'class'` (app is always dark; class anchors it), extend colors to reference CSS vars (`ink: 'var(--ink)'`, `surface`, `line`, `text`, `topic`, `rank`, etc.), fontFamily sans/serif/mono. `postcss.config.mjs` → tailwindcss + autoprefixer.
- [ ] **Step 4: `vitest.config.ts`** — `@vitejs/plugin-react`, `environment: 'happy-dom'`, `setupFiles: ['vitest.setup.ts']`, alias `@`→`./src`, `globals: true`. `vitest.setup.ts` imports `fake-indexeddb/auto` and `@testing-library/jest-dom/vitest`.
- [ ] **Step 5: minimal `src/app/{layout.tsx,page.tsx,globals.css}`** — layout renders `<html lang="es"><body>{children}`, page renders a placeholder `<main>ARCANUM</main>`. globals.css has the three `@tailwind` directives.
- [ ] **Step 6: Verify** — `pnpm build` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS.
- [ ] **Step 7: Commit** — `chore: scaffold Next 14 App Router + strict TS + Tailwind + Vitest`.

### Task 1.2: Core-purity arch test

**Files:** Create `src/core/__arch__/purity.test.ts`

- [ ] **Step 1: Write failing test** — read every file under `src/core/` (via `import.meta.glob` raw or fs in node test), assert none contains an import matching `/(from ['"](react|next|dexie|@supabase|zustand|framer-motion)|app\/|\/db\/|\/sync\/)/`. (At this point `src/core` is empty → make the test create-then-assert tolerant: if no files, it should still pass but the matcher exists. Better: write the matcher now, it passes vacuously, and grows teeth as core files land.)
- [ ] **Step 2: Run** — `pnpm test src/core/__arch__/purity.test.ts` Expected PASS (vacuous).
- [ ] **Step 3: Commit** — `test: core purity guard (no framework imports in src/core)`.

---

## Chunk 2: Core foundations (event, config, time)

### Task 2.1: Event envelope + ordering + UUIDv7

**Files:** Create `src/core/event.ts`, `src/core/event.test.ts`

- [ ] **Step 1: Failing tests** in `event.test.ts`:
  - `newEventId()` returns distinct strings, and two ids minted in sequence sort ascending by string compare (UUIDv7 monotonic-ish) — assert `a < b` for `a=newEventId(); b=newEventId()` (uuidv7 lib is monotonic within ms).
  - `compareEvents(x,y)` orders by `ts` then `id`: `compareEvents({ts:1,id:'b'},{ts:2,id:'a'}) < 0`; equal ts falls to id: `compareEvents({ts:5,id:'b'},{ts:5,id:'a'}) > 0`.
  - `makeEvent('error.resolved', {insight:'x'}, {ts, deviceId, goalId, moduleId})` returns a well-formed `ArcanumEvent` with `v:1`, given fields, generated `id`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `event.ts`:** `EventType` union (14 types per §4.4); `Json`; per-type payload interfaces; `ArcanumEvent`; `EVENT_TYPES` const array; `newEventId()` wrapping `uuidv7()`; `compareEvents(a,b)`; `makeEvent(...)`. Export everything.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `feat(core): event envelope, EventType taxonomy, UUIDv7, (ts,id) ordering`.

### Task 2.2: Config

**Files:** Create `src/core/config.ts`, `src/core/config.test.ts`

- [ ] **Step 1: Failing tests:** `ARCANUM_CONFIG.gradeThresholds` has 11 entries Neophyte..Ipsissimus with exact XP per §6.2; thresholds strictly ascending; `xp` table constants match §6.1 (`errorResolved:25`, `sessionMin:10`, `checkpoint:50`, `moduleCompleted:150`, `firetestMax:300`, `note:5`, `noteMinLen:140`, `sessionMinMs:1_500_000`, `streakMultPerDay:0.02`, `streakMultCap:30`); mastery `{S0:1, reviewThreshold:0.8, bonusBase:0.5, bonusQualityWeight:0.5, defaultQuality:0.7}`; streak `{shieldEvery:7, shieldMax:2}`; `tz:'America/Monterrey'`; `rankAura` maps each grade → hex per §9.3.
- [ ] **Step 2-4:** Run FAIL → implement `config.ts` (a single frozen object, typed) → Run PASS.
- [ ] **Step 5: Commit** — `feat(core): ARCANUM_CONFIG (grades, xp, mastery, streak, tz, rank aura)`.

### Task 2.3: Time (civil day in TZ)

**Files:** Create `src/core/time.ts`, `src/core/time.test.ts`

- [ ] **Step 1: Failing tests:**
  - `civilDay(ts, 'America/Monterrey')` returns `'YYYY-MM-DD'`. Pick an epoch ms that is e.g. `2026-06-28T04:00:00Z` → in Monterrey (UTC-6) that's `2026-06-27 22:00` → `'2026-06-27'` (asserts TZ offset applied, not UTC).
  - Day boundary: `2026-06-28T05:59:00Z` → Monterrey `2026-06-27 23:59` → `'2026-06-27'`; `2026-06-28T06:00:00Z` → `'2026-06-28'`.
  - `dayOrdinal('2026-06-28')` is an integer; `dayOrdinal(b) - dayOrdinal(a) === 1` for consecutive civil days; `daysBetween` exclusive count for gap logic.
  - `msToDays(86_400_000) === 1`.
- [ ] **Step 2-4:** Run FAIL → implement using `Intl.DateTimeFormat(tz, {year,month,day})` formatToParts (no heavy dep); `dayOrdinal` via `Date.UTC(y,m-1,d)/86400000` on the civil parts → integer day number → Run PASS.
- [ ] **Step 5: Commit** — `feat(core): TZ-aware civil-day + day arithmetic`.

---

## Chunk 3: Derivation engines (xp, grade, streak, mastery)

### Task 3.1: Grade

**Files:** `src/core/grade.ts`, `src/core/grade.test.ts`

- [ ] **Step 1: Failing tests (boundaries exact):** `gradeForXp(0).name==='Neophyte'`; `gradeForXp(499).name==='Neophyte'`; `gradeForXp(500).name==='Zelator'`; `gradeForXp(159_999).name==='Magus'`; `gradeForXp(160_000).name==='Ipsissimus'`; returns `{name, index, floorXp, nextXp|null}` (Ipsissimus nextXp null).
- [ ] **Step 2-4:** FAIL → implement (scan thresholds descending) → PASS.
- [ ] **Step 5: Commit** — `feat(core): hermetic grade from accumulated XP`.

### Task 3.2: XP base + streak multiplier

**Files:** `src/core/xp.ts`, `src/core/xp.test.ts`

- [ ] **Step 1: Failing tests:**
  - `xpBase(event)` per §6.1 for every type: error.resolved→25; checkpoint.passed→50 (both kinds); module.completed→150; session.ended dur=1_500_000 kind!=review→10; same dur kind='review'→0; dur<25min→0; firetest reached=6 ceiling=10 → 180 (unrounded `6/10*300`); note length 140→5, length 139→0; error.logged→0; others→0.
  - `streakMultiplier(0)===1`; `streakMultiplier(30)===1.6`; `streakMultiplier(45)===1.6` (capped at 30); `streakMultiplier(10)` ≈ 1.2.
- [ ] **Step 2-4:** FAIL → implement (`xpBase` returns raw number, NO rounding; `streakMultiplier` clamps to cap) → PASS.
- [ ] **Step 5: Commit** — `feat(core): XP base table + streak multiplier (unrounded base)`.

### Task 3.3: Streak + shields timeline

**Files:** `src/core/streak.ts`, `src/core/streak.test.ts`

This is the §6.3 algorithm. Input: sorted unique array of qualified-day ordinals. Output: a `Map<ordinal, closedStreak>` (for XP phase 2) plus final state `{current, longest, shields, qdCount, lastQualifiedDay}`.

- [ ] **Step 1: Failing tests (walk concrete sequences):**
  - Consecutive `[0,1,2]` → closedStreak {0:1,1:2,2:3}; final current 3, shields 0, longest 3.
  - Earn shield at 7: `[0..6]` (7 days) → after day index 6, qdCount 7 → shields 1; current 7.
  - Gap absorbed: `[0..6, 8]` (gap of 1 day at ord 7, shields=1) → shields 1→0, current 8 (day 8 increments), gap day NOT counted; longest 8.
  - Break: `[0..6, 10]` (gap of 3 (ords 7,8,9), shields=1) → 3>1 → break: current resets, day 10 → current 1, shields 0, qdCount 1, longest 7 preserved.
  - Over-cap: build qdCount to 21 with shields already 2 → grant dropped, shields stays 2.
  - 7-counter resets on break: after a break, next shield needs 7 fresh qualified days.
- [ ] **Step 2-4:** FAIL → implement the exact §6.3 loop → PASS.
- [ ] **Step 5: Commit** — `feat(core): streak + shields timeline (per-day, deterministic)`.

### Task 3.4: Mastery

**Files:** `src/core/mastery.ts`, `src/core/mastery.test.ts`

- [ ] **Step 1: Failing tests:**
  - `dueDaysFor(S, lastDays, 0.8) === lastDays + (-S*Math.log(0.8))`. Numeric: `dueDaysFor(1, 0, 0.8)` ≈ 0.22314.
  - `reinforce({S:1, last:0}, quality=0.7, tsDays=2)` → `bonus=0.85`, `S=1.85`, `last=2`, `due=2 + (-1.85*ln0.8)` ≈ 2.4128.
  - `reinforce` with quality=1 → bonus 1.0 → S doubles.
  - `retrievability(S, lastDays, nowDays)` = `exp(-(now-last)/S)`; `retrievability(1,0,0)===1`.
- [ ] **Step 2-4:** FAIL → implement pure functions (no clock) → PASS.
- [ ] **Step 5: Commit** — `feat(core): mastery decay (S update, clock-free due, retrievability)`.

---

## Chunk 4: Projector + presentation

### Task 4.1: Projector — read-model types + fold

**Files:** `src/core/read-model.ts`, `src/core/projector.ts`, `src/core/projector.test.ts`

The projector folds events (sorted `(ts,id)`) into a `ReadModel`. It runs the two-phase XP/streak: Phase 1 derives qualified-day ordinals + closed-streak map (via `streak.ts`); Phase 2 sums XP using each XP event's day's closed streak. Mastery state per module updated on reinforcing events. Goals/modules/edges upserted. Output `ReadModel`: `{goals[], modules[], edges[], stats:{totalXp,grade,currentStreak,longestStreak,shields,lastQualifiedDay}, reviewDue:[{moduleId,dueDays}], cursor:{ts,id}|null}`. `dueDays` stored (clock-free); NO `r(now)`.

- [ ] **Step 1: Failing tests:**
  - Empty log → zeroed ReadModel, grade Neophyte.
  - Seed a goal.upserted + module.upserted → goals/modules populated; module status from started/completed.
  - One error.resolved on a qualified day → totalXp 25*mult(streak=1)=25*1.02=25.5→round 26 (assert rounding once). Provide explicit event with known ts/day.
  - Two error.resolved SAME civil day → both use identical multiplier (the §6.1 invariant). Assert combined XP == 2 * round(25 * mult(sameStreak)). Actually assert each contributes the same multiplier by constructing and checking total.
  - Determinism: shuffle the input event array → `project(shuffled)` deep-equals `project(sorted)` (R5).
  - Mastery: module.started then checkpoint.passed score 0.8 → module's S and dueDays match `reinforce`.
  - `project` is pure: calling twice returns equal, input not mutated.
- [ ] **Step 2-4:** FAIL → implement `project(events)`: sort copy by compareEvents; bucket by civil day; build qualified-day ordinals; `streakTimeline`; fold once accumulating goals/modules/edges/mastery/xp(with day multiplier); compute grade; assemble. → PASS.
- [ ] **Step 5: Commit** — `feat(core): pure projector (two-phase XP/streak, mastery, deterministic)`.

### Task 4.2: Incremental projection + rebuild + out-of-order

**Files:** modify `src/core/projector.ts`, add tests

- [ ] **Step 1: Failing tests:**
  - `projectIncremental(prevReadModel, prevCursor, newEvents)` applied event-by-event in order equals `project(allEvents)` (incremental == rebuild) when newEvents all sort after cursor.
  - Out-of-order: if a newEvent sorts `< cursor`, `projectIncremental` returns a sentinel/throws `NEEDS_REBUILD` (or the wrapper detects and calls full `project`). Test the wrapper `applyEvents(model, cursor, events)` → when out-of-order present, result deep-equals `project(union)`.
- [ ] **Step 2-4:** FAIL → implement. Because XP/streak are two-phase (day-bucketed), true incremental XP is only valid when the new event's day ≥ last day; simplest correct approach for Phase 0: `applyEvents` appends to an in-memory event array and re-runs `project` when ANY new event is out-of-order OR affects an already-closed day; otherwise fast-path. Spec only requires `incremental == rebuild` to hold — implement `applyEvents` to **guarantee** equality (re-fold when in doubt). Document this. → PASS.
- [ ] **Step 5: Commit** — `feat(core): incremental projection with out-of-order rebuild guarantee`.

### Task 4.3: Presentation layer (now-injected)

**Files:** `src/core/present.ts`, `src/core/present.test.ts`

- [ ] **Step 1: Failing tests:**
  - `present(readModel, nowMs)` returns `ViewModel` with per-module `retrievability=r(now)`; for a module reinforced at day D with S, assert value equals `exp(-(nowDays-D)/S)`.
  - `reviewQueue`: only modules with status completed and `dueDays <= nowDays`, sorted ascending by dueDays.
  - Streak alive: readModel.lastQualifiedDay == today(now) → `streakAlive:true`; gap within shields → alive; gap beyond shields → false.
  - Rito del día: `ritoPending` true unless today already qualified (needs the qualified-day set — pass it through ReadModel or recompute from events? Decision: ReadModel carries `qualifiedDays` ordinals so present can check today). Add `qualifiedDays` to ReadModel.
  - Purity: same readModel + two different `now` → different ViewModel but readModel untouched.
- [ ] **Step 2-4:** FAIL → implement; add `qualifiedDays:number[]` to ReadModel (update projector + its tests) → PASS.
- [ ] **Step 5: Commit** — `feat(core): present(readModel, now) — r(now), review-due, streak-alive, rito`.

---

## Chunk 5: Dexie persistence

### Task 5.1: Schema + repo

**Files:** `src/db/schema.ts`, `src/db/repo.ts`, `src/db/repo.test.ts`

- [ ] **Step 1: Failing tests (fake-indexeddb):**
  - `appendEvent(db, event)` stores it with `synced:0`; `getAllEvents(db)` returns it; re-`appendEvent` same id (put) does not duplicate (idempotent by id).
  - `saveReadModel(db, rm)` then `loadReadModel(db)` round-trips deep-equal.
  - `markSynced(db, ids)` flips `synced:1`; `getUnsynced(db)` excludes them.
  - `setPullCursor/getPullCursor` round-trip.
- [ ] **Step 2-4:** FAIL → implement Dexie subclass with tables `events: 'id, synced, ts'`, `projection: 'key'` (single-row read-model under key 'current'), `sync_meta: 'key'`. repo functions. → PASS.
- [ ] **Step 5: Commit** — `feat(db): Dexie schema + repo (append, projection cache, sync meta)`.

---

## Chunk 6: Supabase sync

### Task 6.1: Migration SQL

**Files:** `supabase/migrations/0001_events.sql`

- [ ] **Step 1:** Write the exact SQL from spec §7.1 (events table with `seq` identity, RLS select/insert own, no update/delete, index `(user_id, seq)`).
- [ ] **Step 2: Commit** — `feat(db): Supabase events table migration (RLS append-only, seq cursor)`.
- [ ] **Step 3 (human/agent gate):** apply it — paste into Supabase SQL Editor, OR if a DB password / `sbp_` token is provided, apply via CLI and verify table exists. (Tracked in spec R2.)

### Task 6.2: Client, auth, mapping

**Files:** `src/sync/client.ts`, `src/sync/auth.ts`, `src/sync/mapping.ts`, `src/sync/mapping.test.ts`

- [ ] **Step 1: Failing tests (mapping — pure, unit-testable):**
  - `toRow(event)` returns object WITHOUT a `user_id` key (assert `!('user_id' in row)`); keeps id,type,ts,device_id,goal_id,module_id,payload,v.
  - `fromRow({...envelope, user_id, seq, created_at})` returns a clean envelope (no user_id/seq/created_at).
  - round-trip `fromRow(serverShape(toRow(event)))` deep-equals event.
- [ ] **Step 2-4:** FAIL → implement mapping (pure); client.ts creates `createClient(url, anonKey)` from env with `auth: { persistSession:true }`; auth.ts wraps signInWithPassword/signOut/getUser/onAuthStateChange. → PASS (mapping tests; client/auth are thin, no unit test).
- [ ] **Step 5: Commit** — `feat(sync): supabase client + auth + envelope/row mapping`.

### Task 6.3: Push/pull/backoff

**Files:** `src/sync/sync.ts`, `src/sync/sync.test.ts`

- [ ] **Step 1: Failing tests (with a mocked supabase client object — inject the client):**
  - `push(db, client)`: selects unsynced, calls `upsert(rows,{onConflict:'id',ignoreDuplicates:true})` with rows from `toRow` (assert no user_id), marks synced.
  - `pull(db, client)`: queries `seq > cursor order by seq`, `put`s `fromRow` results, advances cursor to max seq, marks synced.
  - Double push/pull idempotent: running twice stores no duplicates.
  - Backoff: `syncWithRetry` retries on thrown error with increasing delay (inject a fake timer/now and a counter).
- [ ] **Step 2-4:** FAIL → implement with dependency-injected client (so tests use a fake). → PASS.
- [ ] **Step 5: Commit** — `feat(sync): idempotent push/pull on seq cursor + backoff`.

### Task 6.4: Live integration test (gated on applied migration + creds)

**Files:** `src/sync/sync.integration.test.ts` (skipped unless `RUN_SUPABASE_IT=1`)

- [ ] **Step 1:** Write an integration test: sign in a test session, push N seed events, pull them back, assert round-trip; assert a raw `update`/`delete` is rejected (append-only RLS); cleanup. Guard with `describe.skipIf(!process.env.RUN_SUPABASE_IT)`.
- [ ] **Step 2:** Run live once (after migration applied) → PASS; then leave gated so CI/`pnpm test` stays offline-green.
- [ ] **Step 3: Commit** — `test(sync): gated live Supabase round-trip + append-only assertion`.

---

## Chunk 7: Store + wiring

### Task 7.1: Zustand store

**Files:** `src/store/arcanum-store.ts`, `src/store/arcanum-store.test.ts`

- [ ] **Step 1: Failing tests:**
  - `dispatch(event)`: appends to db, updates `readModel` (via applyEvents), and `viewModel` (via present(now)); store state reflects new XP.
  - `rebuild()`: reloads all events, re-folds, equals project(all).
  - `refreshPresent(now)`: recomputes viewModel without new events.
  - `hydrate()`: loads persisted read-model + events on init.
- [ ] **Step 2-4:** FAIL → implement Zustand store holding `{readModel, viewModel, syncState}` with actions; `now` injected (default `Date.now` at the boundary, but actions accept an optional `now` for tests). → PASS.
- [ ] **Step 5: Commit** — `feat(store): Zustand read-model store (dispatch, rebuild, present)`.

### Task 7.2: Seed

**Files:** `src/lib/seed.ts`, `src/lib/seed.test.ts`

- [ ] **Step 1: Failing tests:** `SEED_EVENTS` is an array with FIXED uuids (constant, not generated); contains goal.upserted ITC (color cian, priority high), module.upserted "Estructuras de datos: fundamentos", module.started, and a firetest.attempted; applying seed twice (put by id) yields same event count (idempotent). `project(SEED_EVENTS)` has 1 goal + 1 module.
- [ ] **Step 2-4:** FAIL → implement with hardcoded UUIDs → PASS.
- [ ] **Step 5: Commit** — `feat(seed): ITC goal + módulo + fire test (fixed UUIDs, idempotent)`.

---

## Chunk 8: PWA shell + tokens + styles

### Task 8.1: Color tokens (3 layers)

**Files:** `src/styles/tokens.css`, `src/lib/rank-aura.ts`, `src/lib/rank-aura.test.ts`

- [ ] **Step 1: Failing test:** `rankAuraVars('Adeptus Minor')` returns `{'--rank': '#5A4FE0', ...}` matching config §9.3; `rankAuraVars(grade)` defined for all 11 grades.
- [ ] **Step 2-4:** FAIL → `tokens.css` defines structural constants (`--ink`…`--text-muted` per §9.1) on `:root`, topic defaults, and a neutral default rank set; `rank-aura.ts` maps grade→`--rank*` vars (consumed by setting style on a wrapper). → PASS.
- [ ] **Step 5: Commit** — `feat(styles): 3-layer color tokens + grade→aura mapping`.

### Task 8.2: PWA manifest + iOS metas + Serwist SW

**Files:** `src/app/manifest.ts`, `src/app/sw.ts`, `src/app/layout.tsx` (metas), `public/icons/*`

- [ ] **Step 1:** `manifest.ts` (Next metadata route) → name, short_name "Arcanum", `display:'standalone'`, `theme_color:'#0C0B12'`, `background_color:'#0C0B12'`, icons incl maskable 512 + apple-touch. Generate placeholder PNG icons (a simple arcane sigil) into `public/icons` (script or static). `sw.ts` = Serwist default precache + offline fallback. `layout.tsx` adds viewport `viewport-fit=cover`, `apple-mobile-web-app-capable`, status-bar-style, theme-color; body gets `overscroll-behavior:none` + tap-highlight rules in globals.css; fonts via `next/font` (Inter + a serif display + JetBrains Mono).
- [ ] **Step 2: Verify** — `pnpm build` PASS; sw.js emitted; manifest served. Smoke the dev server: home loads, manifest 200.
- [ ] **Step 3: Commit** — `feat(pwa): manifest + iOS metas + Serwist offline SW + fonts`.

### Task 8.3: storage.persist + install coach-mark + sync status

**Files:** `src/ui/InstallCoachMark.tsx`, `src/ui/SyncStatus.tsx`, a `persist` call in a client init hook

- [ ] **Step 1:** Client init effect calls `navigator.storage?.persist?.()`. `InstallCoachMark` detects iOS Safari non-standalone (`navigator.standalone===false` + iOS UA) and shows the "Compartir → Agregar a inicio" hint. `SyncStatus` shows signed-in/out + last sync + pending count from the store.
- [ ] **Step 2: Commit** — `feat(pwa): storage.persist, iOS install coach-mark, sync status`.

---

## Chunk 9: Arcane UI + home screen

All components are presentational, driven by the store's `viewModel`/`readModel`. Animations transform/opacity only; respect `prefers-reduced-motion`. Tests use happy-dom + @testing-library; assert rendered text/structure from a fixture view-model (not pixels).

### Task 9.1: Atom components

**Files:** `src/ui/{GradeSigil,XpBurst,StreakFlame,RankAura}.tsx` + `.test.tsx` each

- [ ] **Step 1: Failing tests:** `GradeSigil` renders grade name + sigil, colored by `--rank`; `StreakFlame` renders streak number + N shield marks; `XpBurst` renders given xp delta (animation gated behind reduced-motion check, but the number renders). `RankAura` sets the `--rank*` CSS vars on a wrapper from current grade.
- [ ] **Step 2-4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** — `feat(ui): grade sigil, streak flame, xp burst, rank aura wrapper`.

### Task 9.2: Module card + blank challenge + fire test + rito

**Files:** `src/ui/{ModuleCard,BlankChallenge,FireTest,RitoDelDia}.tsx` + tests

- [ ] **Step 1: Failing tests:**
  - `ModuleCard` renders module title in topic color, mastery sigil charge = `retrievability` (width %), and opens to a `BlankChallenge` FIRST (resources collapsed) per §10.1. Assert resources are in a collapsed/secondary region.
  - `BlankChallenge` has a "Registrar muro superado" action that dispatches `error.resolved` (assert callback called with an event of that type).
  - `FireTest` renders two sliders (reached/ceiling) + submit dispatching `firetest.attempted` with the slider values (§10.3, manual scoring).
  - `RitoDelDia` shows pending vs done from `viewModel.ritoPending`.
- [ ] **Step 2-4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** — `feat(ui): module card (challenge-first), fire test, rito del día`.

### Task 9.3: HomeView + page wiring

**Files:** `src/ui/HomeView.tsx`, `src/app/page.tsx`, `src/app/providers.tsx`, `src/ui/HomeView.test.tsx`

- [ ] **Step 1: Failing test:** Given a store seeded with `SEED_EVENTS` + a few XP events, `HomeView` renders: ITC goal, the módulo, rito del día, streak flame with derived number, grade sigil with derived grade. Assert the numbers equal the projector's derived values (not hardcoded) — i.e., wire store→present→render.
- [ ] **Step 2-4:** FAIL → implement: `providers.tsx` is a client component that hydrates the store (load events or seed if empty, apply persist, kick a sync if signed in); `page.tsx` renders `<Providers><HomeView/></Providers>`; `HomeView` subscribes to store and composes the atoms wrapped in `RankAura`. → PASS.
- [ ] **Step 5: Commit** — `feat(ui): home screen wired to derived read-model (vertical slice complete)`.

---

## Chunk 10: Integration, verify, close

### Task 10.1: Reconstruir índice (rebuild button)

**Files:** modify `HomeView`/a settings affordance + test

- [ ] **Step 1: Failing test:** a "Reconstruir índice" action calls `store.rebuild()` and the resulting read-model deep-equals `project(allEvents)`.
- [ ] **Step 2-4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** — `feat: rebuild-from-log affordance`.

### Task 10.2: Full verification

- [ ] `pnpm test` → ALL green (unit + projector determinism + sync idempotency + presentation).
- [ ] `pnpm typecheck` → clean. `pnpm lint` → clean. `pnpm build` → success (no standalone, sw emitted).
- [ ] Dev-server smoke: home renders derived data; reload offline still renders (SW); manifest + sw 200; install coach-mark appears in simulated iOS UA.
- [ ] If creds/migration ready: apply `0001_events.sql`, run gated live integration (`RUN_SUPABASE_IT=1`) → round-trip green; sign-in → push/pull works; verify in Supabase the events row count.
- [ ] **Commit** — `chore: Phase 0 verification pass (tests+build+smoke green)`.

### Task 10.3: Exit gate — secret rotation reminder (R1)

- [ ] Surface to the user: rotate the Supabase `service_role` / `sb_secret` keys (exposed in chat) in the dashboard; update `.env.local`. The milestone is NOT closed until rotated. (This is a human action; the plan flags it explicitly.)

---

## Done = closed (not "compiles")

Phase 0 is closed when: `pnpm test` + `pnpm build` green; the home screen renders XP/grade/streak/mastery **derived from the real log** (change an event → numbers change); the app installs + works offline; live Supabase round-trip is verified (or explicitly deferred with migration-apply as the only open step); and secret rotation is done. Per spec §16.
