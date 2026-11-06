# ARCANUM — Content

How learning content is authored, ingested, and anchored. **Arcanum consumes content, it never
invents it** — books and exercise banks are generated *externally* as `.md`, dropped into `content/`,
and ingested. Verified against `src/lib/book.ts`, `cell-slugs.ts`, `exercises-md.ts`, `seed-*.ts`.

---

## The two content types

| Type | Folder | Anchors by | Contract file |
|---|---|---|---|
| **Mini-book** (deep reading) | `content/books/*.md` | slug/UUID → cell (or loose) | `src/lib/book.ts` |
| **Exercise bank** (Fase-2) | `content/exercises/*.md` | cell UUID (`module_id`) | `src/lib/exercises-md.ts` |

---

## 1. Mini-book frontmatter

`src/lib/book.ts` → `parseBook` / `BookMeta`. A `.md` without frontmatter or without a `title` parses to
`null` (rejected honestly — never a faked book).

```yaml
---
module_id: fred-op-3-serial          # the ANCHOR HANDLE (see §3). Slug or cell UUID. Omit → loose book.
spine: FrED                          # ITC | FrED | Competitiva | Alemán — drives the world tint + section
title: "Serial y tu primer Handler real"
subtitle: "Del bit en el cable al sensor que ORION puede comandar"
source_canonical: "pyserial; Arduino/DHT11 datasheet; orion-bridge-v2 handler pattern"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 45
---

> La pregunta raíz del libro (un blockquote — se destaca arriba).

## Prólogo
Prosa. Markdown normal. Bloques de código con ```lang para resaltado offline.

## Núcleo
…
```

Only `title` is required. The body is free markdown; section headings (`##`) become the TOC and the
audiobook's section boundaries. **The audiobook never reads code literally** (see
[ARCHITECTURE.md](ARCHITECTURE.md) §4.9).

## 2. Exercise-bank frontmatter

`src/lib/exercises-md.ts` → `parseExercisesMd`. **All-or-nothing**: one malformed exercise rejects the
whole bank. The `module_id` here is the **cell UUID** (not a slug — banks anchor directly).

```yaml
---
module_id: cb000000-0000-4000-8000-00000000000c   # the CELL UUID (see §3 for slug → UUID)
spine: FrED
title: Ejercicios — Serial y tu primer Handler real
kind: exercises                                    # MUST be exactly "exercises"
languages: [javascript, python]
generated_by: Claude
version: 1
---
```

Each exercise is a `## <title>` block with a `type:` line and typed `### sub-sections`. An optional
`tiempo: N` preamble line (minutes; `tiempo: 25 min` also accepted) declares a TIMED-DRILL target —
the runner then shows a real stopwatch and an honest within/over verdict at the closing gesture
(`lib/drill-clock.ts`). A declared-but-malformed `tiempo` rejects the whole bank (all-or-nothing).
OA Amazon banks carry `tiempo:` on every exercise (the exam is clocked); other banks may omit it —
without the line, nothing renders and the bank behaves exactly as before:

**Choice family** — `multiple_choice` · `complexity` · `trace` (asserted, never executed):
```markdown
## Por qué un start bit
type: multiple_choice

<enunciado…>

### Opciones
- opción incorrecta
- [x] la correcta                # exactly ONE [x]; no empty option
- otra incorrecta

### Justificación
<por qué la correcta y por qué fallan las otras>   # required, non-empty
```

**Code** — `type: code` (EXECUTED + validated against its own cases before the bank is accepted):
```markdown
## Checksum del DHT11
type: code

<enunciado…>

### Especificación
<pseudocódigo / la regla exacta>

### Firma
```javascript
function dht11Checksum(a, b, c, d) { }
```
```python
def dht11_checksum(a, b, c, d): ...
```

### Casos
```json
[ { "input": [1,2,3,4], "expected": 10 }, { "input": [255,255,255,255], "expected": 252 } ]
```

### Solución
```javascript
function dht11Checksum(a,b,c,d){ return (a+b+c+d) & 0xFF; }
```
```python
def dht11_checksum(a,b,c,d): return (a+b+c+d) & 0xFF
```

### Pistas
- una pista útil
```

**Calling convention:** the runner calls `fn(...input)` and **deep-compares** the return to `expected`
(`exercise.ts:66-78`). Keep returns to numbers / strings / booleans / arrays so JS and Python agree
exactly. **Every `code` exercise's reference solution is run against its own cases at ingest** — a wrong
solution rejects the bank (`exercises-validate.ts:44-73`). For the bundled seed, JS is executed and Python
is trusted (build-time round-trip); an *imported* bank validates both in the sandboxed runners.

## 3. Anchoring — the match-or-loose rule

`src/lib/cell-slugs.ts` → `resolveCellId(handle)`. A book's `module_id` handle resolves to a cell when it:
1. **is a known cell UUID**, or
2. **equals a cell slug** (`itc-c1`), or
3. **starts with `slug-`** (boundary prefix: `itc-c1-asintotico` → `itc-c1` → ITC C1).

No match → the book stays **loose**: still readable, listed under its `spine` in the library, but not
anchored to any cell. **Books never create cells** — a cell must already exist (seeded) for a book to
light up "Leer" on it. Exercise banks anchor by the cell UUID directly.

### Valid cell slugs (from the real registry, `cell-slugs.ts`)

| Spine | Slugs |
|---|---|
| **ITC** | `itc-0` · `itc-c1` … `itc-c8` · `itc-iot` |
| **FrED · Fundamentos** | `fred-s1` … `fred-s4` · `fred-h1` … `fred-h4` |
| **FrED · Operativo** | `fred-op-0` … `fred-op-8` (the ORION Bridge track) |
| **Competitiva · ICPC** | `cp1` … `cp8` (1:1 with the contest-pattern cells) |
| **Alemán** | `de-a1` → A1.1 entry cell · `de-a2` → A2.1 entry cell |
| **OA Amazon** | `oa-0` … `oa-13` (books named `oa-N-<anything>` anchor by the boundary-prefix rule; digit boundaries are safe: `oa-1-…` ≠ `oa-10-…`) |

*Alemán note:* the spine is fine-grained (A1.1–A1.5, A2.1–A2.3, B1/B2), so a **whole-level** book anchors at
its level's **entry cell** — `de-a1-fundamentos` → A1.1, `de-a2-conversacion` → A2.1. When two books resolve
to the same cell (e.g. a `depth: deep` rewrite next to its `depth: standard` original), the **deeper one
anchors and the shallower stays loose** (`seed-books.ts`, derived purely from the `depth` metadata). The
rule everywhere: name a book `<slug>-<anything>` and it anchors to that cell; add new cells' slugs here.

## 4. Ingestion flow

```
generate .md (external, e.g. Sonnet)  →  drop in content/{books,exercises}/  →  ingested on load
```

- **Books** are bundled at build via `require.context` (`src/lib/all-books.ts`) and seeded into the
  `arcanum-books` Dexie on mount (`seed-books.ts`, idempotent — never clobbers a user import). On seed each
  book's handle resolves (§3): linked → keyed by the cell UUID (shows "Leer"); loose → keyed by its own
  handle, listed by spine. A book that *used to be* loose but now resolves (its cell was just seeded) drops
  its stale loose row so it isn't duplicated.
- **Exercise banks** are `import`ed explicitly in `seed-exercises.ts` and seeded into `arcanum-exercises`,
  each **validated** (JS executed, §2) before it lands. A broken bank never ingests.

To add content: write the `.md`, drop it in the right folder, (for a bank) add its `import` to
`seed-exercises.ts`. That's it — no code change for a book.

## 5. Adding a spine or a path

- **A new spine (world):** add a `Spine` to `SPINES` in `src/lib/spines.ts` — `{ goalId, goalTitle,
  sigil, color, paths[], cells[] }`. The seed (`src/lib/seed.ts`) turns it into `goal.upserted` +
  `module.upserted` + linear-chain `roadmap.edge.upserted` events. Add its cell slugs to `cell-slugs.ts`.
  Give it a world theme in `subject-themes.ts` (matched by goal title) or it falls back to a neutral theme.
- **A new path** (a parallel route inside a goal): add a `SpinePath` to that spine's `paths[]`. Cells
  reference it by `pathSlug`. Progress is 100% independent per path (fog-of-war never crosses).
- **Inserting cells into an already-shipped chain** (like FrED Operativo op-1..op-8): seed them in a
  **separate appended block** with fresh event ids (the `b4000000-` prefix) — never renumber or repurpose
  a shipped event id, so a live device and a fresh install converge to the identical DAG. See
  `buildOperativoSeed` / `buildOperativoExtension` in `seed.ts` for the pattern.

## 6. Engineering Forge — content contracts (frozen in Phase 0)

Source of truth: `.agents/tasks/arcanum-forge/design.md` §6.2, §9.2, §9.3, §13.1, §18.2 (plus obligation M1 of the
orchestrator's D6). Code: `src/lib/exercises-md.ts`, `src/forge/bank/**`, `src/lib/exercises-validate.ts`,
`src/forge/content/book-rules.ts`. Tests: `exercises-md-compat`, `exercises-md-forge`, `bank-pending`,
`bank-seed-trust`, `src/forge/__tests__/{books,banks,phase0-contracts}.test.*`.

### 6.1 Banks: `content/forge/exercises/<código>.md`

Same frontmatter as §2 (`kind: exercises`, `module_id` = the cell UUID). Each `## <title>` block has a preamble and
`###` subsections. Recognized preamble lines (all removed from the statement): `type:`, `tiempo:`, `id:`, `rol:` and the
type's own lines. Common rules:

- `id:` is **mandatory** in the 16 Forge types (optional in `code`, `choice`, `production`): `^[a-z0-9][a-z0-9-]{1,63}$`,
  unique in the bank. The exercise id becomes `${module_id}:${id}` (`:${lang}` appended for `code`) and `id` is the
  evidence `itemId`. Without `id:` the old positional id stays (the 39 existing banks parse identically).
- `rol:` = `practica` (default) · `recuperacion` · `prediccion` · `transferencia`.
- All-or-nothing: one malformed block rejects the bank; the reason names the exercise and the field
  (`explainExercisesMd`). JSON goes in ` ```json ` fences, code in fences with its language (`javascript`, `python`,
  `sql`, `text`). `####` exists only inside `### Mutantes`. A repeated section or preamble line rejects.

| `type:` | Own lines | Mandatory `###` sections (optional in parentheses) |
|---|---|---|
| `prediccion` | (`escala:` 2-5 increasing ints in [50,100], default `50 70 90`) | Opciones (≥ 2, exactly one `[x]`), Justificación |
| `desvanecido` | `lang:` when there is a template | Pasos (numbered), Plantilla (regions `# <paso N>`…`# </paso N>` / `// <paso N>`…), Casos, Niveles (`- N: a, b`), Rúbrica (if any step is prose) |
| `historial` | `modo: traza\|fallas`; traza: `objetivo: violar\|proteger`, (`chequeo: final\|cada-paso`) | traza: Estado, Actores (≤ 3 actors, ≤ 14 steps), Invariante (`text`), Referencia, Protocolos (only and always with `proteger`, ≥ 2). fallas: Firma, Arnés (`arnes(calendario)`), Calendarios, Solución, Ingenua |
| `mutantes` | `minimo:` | Firma, Referencia, Mutantes (`#### <id>` or `#### <id> · crítico`, one js fence each), Casos dorados, Formato de casos |
| `contraejemplo` | — | Firma, Precondición (`function pre`), Casi correcta, Referencia, Testigo, (Comparador `function same`), (Invariante `function prop`) |
| `senal` | `semilla:` | Patrones (≥ 3), Ítems (JSON ≥ 3 `{ enunciado, patron, senal }`) |
| `entrevista` | `fases: preguntas N, estructuracion N, defensa N` | Personas, Hechos (≤ 30, texto ≤ 400, `revela_si` when `oculto`), Entregable, Rúbrica. **No `### Variación`**: the variation is the bank's `giro` |
| `expediente` | — | Pasada 2, Pasada 3, Rúbrica |
| `retencion` | `dias:` 1-120, `variante_de:` (item id or `mision`), `forma: defensa\|codigo` | defensa: Rúbrica. codigo: Firma, Casos, Solución |
| `giro` | — | Rúbrica (the statement is the twist) |
| `sql` | `orden: si\|no` | Esquema, Datos, Fixtures (each fence starts `-- fixture: <nombre>`, unique), Solución, Ingenua |
| `ontologia` | — | Decisiones (≥ 2), Referencia (an `OntologyModel`, `src/forge/bank/types/ontologia.ts`), Rúbrica, (Fuentes), (Exigencias) |
| `forense` | `corte:` (fixed ISO instant) | Esquema, Datos, Pipeline (`-- paso: <id>`), Invariantes, Mentiras, Corrección, Control de referencia, (Datos limpios) |
| `permisos` | — | Modelo (usuarios, grupos, roles, markings, recursos), Preguntas (≥ 6), Solución |
| `recuperacion` | `corte:` | Corpus (≤ 40, texto ≤ 4,000), Preguntas, Clave, Contradicciones, Inyección |
| `gameday` | — | Línea de tiempo (≤ 200), Causas, Acciones, Clave, Rúbrica |

**`code` extension (RF-E1, optional):** `### Generador` (fences per language with `generate(seed)` returning the
arguments) together with `### Casos generados` (JSON `[{ "semilla", "esperado" }]`), and `### Comprobador` (fences per
language with `check(args, salida, esperado)`). A language without a generator fence has no generated cases. The parser
only reads them; in the seed they are trusted (bank-check ran them) and at import a bank with generated cases is
rejected until the worker harness `__run_generated(seed)` exists.

**Route banks** (F0-F2, S1-S2, P1-P5, SW1-SW4, A1-A2; content rule CA-77, `banks.test.ts`): ≥ 6 items, ≥ 1 with
`rol: prediccion` or `recuperacion`, exactly 1 `giro` with an explicit `rol: transferencia`, `id:` in all, ≤ 48 KiB.

### 6.2 Ingestion checks (`src/lib/exercises-validate.ts`)

```ts
interface BankCheckContext { source: "seed" | "import"; jsRun: ExecRunner; pyRun?: ExecRunner }
type BankCheck   = (item, ctx) => Promise<{ ok: true } | { ok: false; errors: string[] } | { disponible: false }>;
type BankCheckJs = (item, ctx) => Promise<{ ok: true } | { ok: false; errors: string[] }>;
type BankCheckPy = (item, ctx & { pyRun }) => Promise<{ ok: true } | { ok: false; errors: string[] }>;
interface BankCheckModule {
  check: BankCheck;                                    // data only; NEVER executes (its ctx.jsRun refuses: M1)
  js?: { needs(item): boolean; check: BankCheckJs };   // author JS (reference, mutants, naive): import only, Worker
  py?: { needs(item): boolean; check: BankCheckPy };   // Python and SQL: import only, Pyodide
}
```

- `src/forge/bank/check/registry.ts` maps each of the 16 types to `() => import("./<tipo>")` — never a static import.
  `validateBank` loads only the types a bank brings. A check chunk that does not load → the bank is not saved
  (`missingCheck`, «no descargado · requiere conexión una vez»).
- **Seed trust + M1 (one rule, in `validateBank` only).** In the seed (`saveExerciseBank(md, { source: "seed" })`) no
  author code of the 16 types runs: not `js`, not `py`, and `check` cannot execute. Those steps are verified by
  `scripts/forge/bank-check.mjs` into `content/forge/verification/<código>.json` (`sha10` of the `.md`; items with
  `resultado`), and only a run whose `sha10` matches makes a bank «Verificado». At import, `js` and `py` run only with
  the caller's runners (`runJs` Worker, `runPy`); without them the bank is rejected, never run on the main thread.
- **Pending rule.** A check answering `{ disponible: false }` (a Phase-0 stub) leaves its item **pending**: accepted
  without validation, stored in `ExerciseBankRow.pendientes`, never returned by `loadBankForModule`. A real check that
  fails still rejects the whole bank. Real checks shipped in Phase 0: `giro`, `expediente`, `entrevista`, `gameday`,
  `recuperacion`, `senal`, `prediccion`; the other 9 are stubs that their owner branch replaces file by file.
- `banks.test.ts` fails on a current verification that records `resultado: "fallo"`; with `FORGE_BANKS_STRICT=1` it
  also fails when a bank with executable author steps has no current run.

### 6.3 Books: `content/forge/books/<código>.md`

`parseBook` contract plus `estado` in the frontmatter (never `verificado` by hand) and `module_id: forge-<código>`. `##`
sections «Ejemplo trabajado», «Contraejemplo», «Diagrama» (with a ` ```text ` fence), a connections, a questions and a
sources section, and ≥ 1 explanation section; every explanation section, and every section naming a product
(`PRODUCT_NAMES`), has ≥ 1 link of the allowed list. **Video:** a paragraph with only
`[label](https://www.youtube.com/watch?v=<11 chars> "video")` or `(https://youtu.be/<id> "video")`, id in `videos.json`.
**Figure:** a paragraph with only `![alt ≤ 30 words](<image of that docs page> "figura <https://www.palantir.com/docs/…>")`.
**Other book:** `[text](#libro:<handle>)`, resolving to an existing book. No BOM. The F1-03 book never contains the text
of a hidden fact of its interview. `books.test.ts` applies these rules; zero books is green, and a rule whose data source
is not merged yet (maestro, catalog, Atlas, videos) is reported as pending, not failed.

### 6.4 Authoring state and publication

- `estado` in a book's frontmatter is `autorado` at most; nobody writes `verificado` by hand. The app derives the
  state per cell (`src/forge/model/authoring.ts`): «Especificado» with a complete ficha; «Autorado» with a valid
  book and bank (SD: book + expediente; X and D: statement + deliverable); «Verificado» only when every executable
  item has a passing bank-check run with the current `sha10` **and** the bank has no pending items.
- `books-publish` (`pnpm forge:publish`) copies books and banks and writes `book-index.json` and `bank-index.json`;
  it runs before `dev`, `build`, `test` and `typecheck`.
- Links in books use only allowed hosts (docs, build, the master's URLs); learn and certification appear only as
  outgoing «requiere cuenta» links. Videos are youtube-nocookie embeds labelled «no revisado»; figures come from
  the cited page's images in the Atlas. `#libro:` links point to another world's book by anchor.

### 6.5 State at integration (2026-11-06)

- **128 books and 128 banks** across F0-F2, P1-P4, S1-S2, SW1-SW4, A1-A2 and SD-01 to SD-12, with their
  verification files. `bank-check --all`: 0 failures; 21 banks keep items «sin verificar» for types without a
  harness. The strict gate passes.
- **Without book or bank («Libro pendiente», state «Especificado»):** P5-01 to P5-08. D1-D8 and X01-X24 are
  statement + deliverable cells and have no book by design.
- **Types with their stub** («aún no está disponible en esta versión», never offered): runners `contraejemplo`,
  `desvanecido`, `forense`, `gameday`, `mutantes`, `retencion`; flows `diagnostico`, `entrevista`, `expediente`,
  `gameday`, `proyecto`. Ingestion checks still on the shared stub: `contraejemplo`, `desvanecido`, `forense`,
  `mutantes`, `retencion`; banks that use them are accepted with those items pending and stay «Autorado» at most.
- **Interactive types:** `ontologia` (Ontology Forge), `sql`, `historial` (mode `traza`; mode `fallas` keeps the
  pending text), `permisos`, `recuperacion`,
  `prediccion`, `senal`, plus the mission flow (`ForgeMission`), whose verdicts queue until the Edge is deployed.

---

See also: [ARCHITECTURE.md](ARCHITECTURE.md) · [README.md](README.md) · [SECURITY.md](SECURITY.md).
