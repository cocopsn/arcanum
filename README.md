<div align="center">

# ✶ ARCANUM

### *Ex scintilla* — un régimen de aprendizaje personal, event-sourced y local-first.

*Una chispa. Es todo lo que el fuego necesitó para empezar.*

<br/>

![architecture](https://img.shields.io/badge/architecture-event--sourced-3f74e8?style=for-the-badge)
![local-first](https://img.shields.io/badge/local--first-offline-4f9d7a?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?style=for-the-badge)

![Next.js](https://img.shields.io/badge/Next.js-14-000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![Dexie](https://img.shields.io/badge/Dexie-IndexedDB-EE5A24?style=flat-square)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/tests-vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![Personal](https://img.shields.io/badge/scope-one%20learner-9A93C8?style=flat-square)

</div>

---

> **Honest scope.** Arcanum is a **personal, single-user system** — one learner, one identity, no
> sign-up. It is public so it can be read and learned from, not run as a service. There is no
> multi-tenant mode and none is planned.

## What it is

Arcanum treats learning like a régime. The map is a **DAG of cells** under fog-of-war; a cell opens only
when you've *earned* the one before it. Each cell is a **WHITE ROOM** with three gates — an entry
challenge, a body anchored to a **real** source (no invented academic content), and an adversarial
**exit gate** that interrogates your understanding at a 0.1%, defend-from-first-principles standard. The
gate has real power: passing it is the *only* way a cell counts as mastered.

Everything you do is an **append-only event**. All state — your grade, streak, mastery, the whole map —
is a **pure projection** of that log. Nothing is stored that can't be re-derived; nothing you did can be
silently corrupted. It works **offline** (walking, gym, eyes closed) and syncs conflict-free across
devices when there's a network.

<div align="center">

**✶ ITC** · la sala del trono &nbsp;&nbsp; **⎓ FrED Factory** · la forja &nbsp;&nbsp; **✺ Competitiva** · la arena &nbsp;&nbsp; **ᚦ Alemán** · el claustro

</div>

## The régime

| | |
|---|---|
| **The log is truth** | Append-only events; every state is a pure fold (`project`). Re-folding is idempotent. |
| **Fog-of-war** | A cell is sealed until every live prerequisite is *mastered*. Fail-closed. |
| **The exit gate** | An adversarial, rubric-anchored interrogation (an "Asuka" persona). No AI verdict → it **waits** (offline work is queued, never faked). |
| **Nature decides the gate** | `a_mano` = defend the design from scratch · `delegable` = direct & audit an assistant · `mixto` = both. |
| **The grade ladder** | Cumulative XP from *Scintilla* (the spark) → *Faber* (the forge) → … *ex scintilla, per ictus.* |
| **Three content layers** | Heavy (curated mission) · Light (infinite on-demand lessons) · Review (spaced decay queue). |
| **Read ≠ master** | Reading a book or hearing the audiobook is *input*. Only the gate grants mastery. |

## Quickstart

```bash
git clone https://github.com/cocopsn/arcanum.git
cd arcanum
pnpm install
pnpm dev          # http://localhost:3000
```

The app runs **fully local without any environment variables** — the log lives in IndexedDB, and sync/AI
just stay off (honest degradation). To enable cloud backup + the AI evaluator, set these (names only —
never commit values; see [`.env.example`](.env.example)):

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase **anon** key (RLS-scoped) |
| `ARCANUM_ACCESS_PASSWORD` | server | the single-user gate password |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | server-side session mint (never `NEXT_PUBLIC_`) |
| `OPENAI_API_KEY` · `ANTHROPIC_API_KEY` · `KEE_ENDPOINT` | **Edge Function secrets** | the AI evaluator (see [OPERATIONS.md](OPERATIONS.md)) |

```bash
pnpm build        # production build
pnpm typecheck    # tsc --noEmit (strict)
pnpm lint         # next lint
pnpm test         # vitest (unit + integration)
pnpm loc          # lines-of-code report (see below)
```

## Project map

```
src/core/     event-sourced core (events · projector · read-model · roadmap · grade)
src/db/       Dexie schema + repo (the event log)
src/sync/     Supabase push/pull · auth · AI Edge-Function client
src/lib/      domain (books · exercises + sandbox · offline · audio · speech · gates · spines)
src/ui/       React surfaces (subject map · book reader · exercises · notes · audio · offline)
src/app/      Next App Router · providers · service worker · API routes
supabase/     migrations (public.events + RLS) · functions/ai-router (the evaluator)
content/      books/ · exercises/   ← the learning content (.md, ingested)
infra/        canvas-scraper (n8n)  ← optional Fase-4 obligations scraper
scripts/      tooling (loc.mjs · generate-icons.mjs)
```

## Contributing content

Content is **generated externally** (e.g. with a Sonnet model) as `.md`, dropped into `content/`, and
**ingested** — Arcanum consumes books/banks, it never invents them. A book *resolves* to a roadmap cell
by its slug (`itc-c1`, `fred-op-3`), or stays a loose readable. Every code exercise's reference solution
is **executed against its own test cases** before a bank is accepted. The full frontmatter contract, the
valid cell slugs per spine, and the match-or-loose rule are in **[CONTENT.md](CONTENT.md)**.

## Documentation

| Doc | What's in it |
|---|---|
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | The full architecture — event model, projections, layers, invariants, diagrams, ADRs. |
| **[CONTENT.md](CONTENT.md)** | The book + exercise frontmatter contract, cell slugs, ingestion flow, adding a spine/path. |
| **[SECURITY.md](SECURITY.md)** | Sandbox threat model, secrets, RLS, CSP, and declared debt. |
| **[OPERATIONS.md](OPERATIONS.md)** | Deploy (Vercel + Edge Functions), env vars, tests, troubleshooting. |
| **[DEPLOY.md](DEPLOY.md)** · **[AGENT.md](AGENT.md)** | Deploy notes · the AI-router contract. |

## Repo at a glance

Run `pnpm loc` for the live count. Snapshot at time of writing:

```
BY CATEGORY        loc     files
  code          17,996      147
  content        8,680       33
  config         8,367       10   (pnpm-lock.yaml dominates)
  tests          5,280       71
  docs           2,041       10
  TOTAL         42,451      274
```

<div align="center">
<br/>

*Régimen personal. No es un producto — es un régimen.*

**✶**

</div>
