# ARCANUM — Security model

Verified against source (`file:line`). Arcanum is a **personal, single-user** app on a **public** repo.
The threat model reflects that: the client is trusted (it's the owner's own device), and the main risks
are (a) untrusted *content* the owner ingests, (b) leaking a secret into the public repo, and (c) the AI
evaluator's privacy posture. Where the code falls short of an ideal, it's listed under **Declared debt**.

---

## 1. The code sandbox (learner-run exercise code)

Exercise code the owner writes — or reference solutions inside an *imported* bank — runs locally. It must
not be able to read or wipe the event log, or exfiltrate.

### JavaScript — hard isolation ✅
- Runs in a **fresh blob Web Worker**, terminated after each run (`src/lib/js-runner.ts:93-114`).
- **`WORKER_SHIELD`** (`js-runner.ts:56-57`) severs, *before any user code runs* (it's interpolated at the
  top of the worker source, `:60-61`): `indexedDB, caches, fetch, XMLHttpRequest, WebSocket, importScripts,
  navigator, Notification, openDatabase, localStorage, sessionStorage`. The worker also has no DOM / window
  / Zustand store.
- A **main-thread timeout** (3 s default) races the worker and terminates infinite loops — it works
  because the timer runs on the main thread while the loop only blocks the worker thread
  (`js-runner.ts:97-114`). Tested: `js-runner.test.ts:47-66` asserts 8 globals become `undefined`.
- **Verdict:** JS learner code cannot reach storage or the network. Airtight.

### Python — isolated from storage, but ⚠️ keeps network
- Runs via **Pyodide** (CPython/WASM), `CacheFirst`-cached under `arcanum-pyodide` for offline
  (`py-runner.ts`, `sw.ts:41-42`).
- The **storage bridge is severed** inside `boot()`: `indexedDB, caches, openDatabase, localStorage,
  sessionStorage` are nulled (`py-runner.ts:42-47`) — so `import js; js.indexedDB.deleteDatabase('arcanum')`
  can't reach the log.
- **⚠️ Asymmetry (declared debt #1):** the Python shield **deliberately keeps `fetch` and `importScripts`
  alive** (needed for Pyodide package loads, `py-runner.ts:44-46`). So Python learner code retains network
  egress. The "can't exfiltrate" guarantee is airtight for JS but for Python rests on "nothing sensitive is
  reachable," not on cutting the network.
- **⚠️ (declared debt #2):** the Python worker is a **singleton reused across runs** — only the namespace
  dict is fresh, so globals/monkeypatches can leak between consecutive learner runs. JS spins a fresh
  worker each time. (Personal app, low risk; noted for honesty.)

### Content validation (untrusted imported banks)
Importing an exercise bank **executes every code exercise's reference solution against its own test
cases** before accepting it (`exercises-validate.ts:44-73`), rejecting a broken bank with the exact
failing case. Imported JS validates in the **shielded worker**; the bundled seed uses the plain
main-thread `execCode` (trusted content) and trusts Python (build-time round-trip). *(Declared debt #3:
the validator's default JS runner is main-thread + unshielded; only the import path passes the shielded
`runJs`.)*

---

## 2. Secrets

- **Nothing sensitive is in the repo.** `.env.local` is **gitignored and untracked** (`.gitignore` — the
  Edge-Function agent verified `git check-ignore` matches and `git ls-files` does not list it).
  `.env.example` holds only placeholder names. A repo-wide scan for `sk-…` / bearer patterns found only
  false positives in the lockfile/package.json.
- **Where secrets live:**
  | Secret | Home |
  |---|---|
  | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `KEE_ENDPOINT`, `KEE_API_KEY` | **Edge Function secrets** (Supabase), read via `Deno.env.get` |
  | `SUPABASE_SERVICE_ROLE_KEY`, `ARCANUM_ACCESS_PASSWORD` | **server** env (Vercel), used only in route handlers |
  | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client (public by design — the anon key is RLS-scoped) |
- **`service_role` never touches the browser.** It appears only in server code (`src/lib/supabase-admin.ts`
  — "SERVER-ONLY, import ONLY from route handlers"), `mc-status.ts` (imported solely by `/api/mc/*`), and
  `/api/*` routes. The browser sync path uses the anon key only (`src/sync/client.ts:8-28`).

---

## 3. Auth — one user, no sign-up

- **Single owner, no self-registration** (`src/sync/auth.ts:5-8` — "There is no signUp"). The Supabase
  password is a **server-managed secret** `sha256("arcanum:sbpw:v1:" + service_role)` the client never sees
  (`supabase-admin.ts:10-12,29-40`).
- **Env-var gate:** the app is behind `ARCANUM_ACCESS_PASSWORD` (server-validated). The stored token is the
  sha256, in an httpOnly cookie — the password itself is never in a cookie.
- **Passwordless self-heal:** past the gate, the client mints a Supabase session server-side from the gate
  cookie (`/api/session` + `/api/session/refresh`) and adopts it — no second password
  (`providers.tsx:80-98`). With no `service_role`, sync/AI just stay off (honest degradation).

## 4. Supabase RLS

- Mirror table `public.events` (`supabase/migrations/0001_events.sql`): **RLS enabled**, owner-only
  policies `events_select_own` / `events_insert_own` on `auth.uid() = user_id`; `user_id` defaults to
  `auth.uid()`. **No update/delete policy → append-only at the database.** Push upserts with
  `ignoreDuplicates:true` (a pure append — server rows are immutable to the client).

## 5. The AI evaluator — JWT-gated, with two known gaps

The evaluator is one Deno Edge Function (`supabase/functions/ai-router/index.ts`). It **passes through the
caller's JWT and calls `getUser()`; unauthenticated → 401** (`:601-609`). Best-effort per-user rate limit
12/60 s (`:44-57`, in-memory). The **exit-gate invariant holds**: a verdict is set only from a real
evaluator call, and with no provider the gate **enqueues and waits** — it never auto-passes (there is *no*
heuristic for the exit gate; `use-actions.ts:75-86`, `projector.ts:389-408`, tested `ai-queue.test.ts`).

**⚠️ Declared debt #4 — no ZDR / `store:false`.** The Edge Function sends only `{model, max_tokens,
messages}` to OpenAI; **no `store:false` / data-retention control is transmitted** (verified — grep found
none). OpenAI's default retention applies. For a personal app this is a minor privacy note, not a legal
issue, but it *contradicts a "privacy-hardened" mental model* — fix by adding `store:false` to the OpenAI
request bodies.

**⚠️ Declared debt #5 — provider override not allowlisted.** The request body's `providers` array
overrides the default `["openai","kee"]` chain with **no server-side allowlist** (`:613`). Any
authenticated caller (i.e. the owner) can force `["anthropic"]` and spend `ANTHROPIC_API_KEY`, or reorder
priority. Low risk for a single trusted user; worth an allowlist if the surface ever widens.

## 6. Public-repo hygiene · CSP

- The app ships a Content-Security-Policy (`next.config.mjs`) and the reader renders markdown **without**
  `rehype-raw` / `dangerouslySetInnerHTML` (raw HTML in a book is treated as text; `javascript:` hrefs are
  sanitized by react-markdown's default url-transform).
- Service worker: `/api/*` is `NetworkOnly` (auth verdicts never cached).

---

## Declared debt (summary)

| # | Item | Severity (personal app) |
|---|---|---|
| 1 | Python sandbox keeps `fetch` (network egress) | low |
| 2 | Python worker singleton — state leaks between runs | low |
| 3 | Validator's default JS runner is main-thread/unshielded (import path is shielded) | low |
| 4 | Edge Function sends no `store:false`/ZDR to OpenAI | low-med (privacy) |
| 5 | Provider-override field has no server allowlist | low |
| 6 | **Pending secret rotation** — the Supabase `service_role` + `anon` were used during setup with a disposable PAT; a rotation was noted as a standing owner action | medium — do it |

See also: [ARCHITECTURE.md](ARCHITECTURE.md) · [OPERATIONS.md](OPERATIONS.md).
