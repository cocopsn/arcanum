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

Each exercise is a `## <title>` block with a `type:` line and typed `### sub-sections`:

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

---

See also: [ARCHITECTURE.md](ARCHITECTURE.md) · [README.md](README.md) · [SECURITY.md](SECURITY.md).
