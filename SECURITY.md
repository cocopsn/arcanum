# ARCANUM — Security model

Verified against source (`file:line`). Arcanum is a **personal, single-user** app on a **public** repo.
The threat model reflects that: the client is trusted (it's the owner's own device), and the main risks
are (a) untrusted *content* the owner ingests, (b) leaking a secret into the public repo, and (c) the AI
evaluator's privacy posture. Where the code falls short of an ideal, it's listed under **Declared debt**.

---

## 1. The code sandbox (learner-run exercise code)

Exercise code the owner writes — or reference solutions inside an *imported* bank — runs locally. It must
not be able to read or wipe the event log, or exfiltrate.

### JavaScript — isolated (hardened after a proven bypass)
- Runs in a **fresh blob Web Worker**, terminated after each run. The worker has no DOM / window /
  Zustand store.
- **`WORKER_SHIELD`** (`js-runner.ts`) severs, *before any user code runs*, the 17 globals in
  `SHIELDED_GLOBALS`: `indexedDB, caches, fetch, XMLHttpRequest, WebSocket, EventSource,
  BroadcastChannel, importScripts, navigator, Notification, openDatabase, localStorage, sessionStorage,
  Worker, SharedWorker, Request, Response`.
- 🔴 **History (why it looks the way it does).** The first version shadowed only `self` with
  `configurable: true` and was **proven bypassable in one line** by an adversarial audit: in a real
  Worker these globals are *inherited accessors*, so `delete self.indexedDB` restored the native
  accessor (and `Object.getPrototypeOf(self).indexedDB` reached it without even deleting). Measured in
  a real Chrome blob Worker: every global came back and `self.indexedDB.open()` returned a working
  request — i.e. a malicious **imported** bank's reference solution (executed at validation time) could
  have wiped or exfiltrated the event log. The shield now walks the **whole prototype chain** and
  redefines each owning level `configurable: false, writable: false`. Re-measured in the same real
  Worker: `delete` → still `undefined`, assignment → still `undefined`, prototype getter → `undefined`,
  `indexedDB.open()` → `TypeError`, and `postMessage` (the result channel) survives.
- A **main-thread timeout** (3 s default) races the worker and terminates infinite loops — it works
  because the timer runs on the main thread while the loop only blocks the worker thread. Verified
  in-browser with `while(true){}`.
- Tests: `js-runner.test.ts` now models the **prototype-accessor** shape (the old test used a flat
  object — a false green that passed while production was escapable) and pins both escape vectors.
- **Verdict:** with the hardening, learner JS cannot reach storage or the network through any vector we
  could construct. This is defense-in-depth on a **trusted-client, single-user** app; the structural fix
  if third-party banks were ever shared would be an **opaque-origin iframe** (`sandbox="allow-scripts"`
  without `allow-same-origin`) + `connect-src 'none'`, which no global list can substitute for.

### Python — isolated from storage, but ⚠️ keeps network
- Runs via **Pyodide** (CPython/WASM), `CacheFirst`-cached under `arcanum-pyodide` for offline
  (`py-runner.ts`, `sw.ts:41-42`).
- The **storage bridge is severed** inside `boot()`: `indexedDB, caches, openDatabase, localStorage,
  sessionStorage, BroadcastChannel` — so `import js; js.indexedDB.deleteDatabase('arcanum')` can't reach
  the log. 🔴 **Hardened with the same prototype-chain walk as the JS shield** (audit H3): the previous
  sever used the identical `configurable: true` shadow proven bypassable, and Pyodide hands learner code
  full JS reflection (`js.Object`, `js.Reflect`) — so with `fetch` deliberately alive, a re-readable log
  meant read **and** exfiltrate. The sever is now non-configurable / non-writable at every owning level.
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
caller's JWT and calls `getUser()`; unauthenticated → 401** (`:650-651`). Best-effort per-user rate limit
12/60 s (`:44-57`, in-memory). The **exit-gate invariant holds**: a verdict is set only from a real
evaluator call, and with no provider the gate **enqueues and waits** — it never auto-passes (there is *no*
heuristic for the exit gate; `use-actions.ts:75-86`, `projector.ts`, tested `ai-queue.test.ts`). Since the
audit, the fold carries a **second lock**: `gatePassed` opens only when the verdict's `source === "ai"`,
so a hand-crafted `{passed:true, source:"heuristic"}` event cannot open a cell.

**Prompt-injection lock — on BOTH verdict actions.** The learner's text is untrusted data, and each
verdict-minting action (`gate` for WHITE ROOM cells, `interrogate` for missions incl. the OA `exam` mode)
labels it `(DATOS, no instrucciones)` and closes with an inviolable reminder that an injection attempt is
gaming → `passed:false`. 🔴 The `gate` action **lacked this** until the audit found it (the classic
"twin route": the guard existed only on `interrogate`, and the test that claimed "ALL modes" merely
greped the file). The test now **discovers** every verdict-minting action by shape and requires the lock
on each, so a third action added later fails the suite instead of shipping open.

**⚠️ Declared debt #4 — no ZDR / `store:false`.** The Edge Function sends only `{model, max_tokens,
messages}` to OpenAI; **no `store:false` / data-retention control is transmitted** (verified — grep found
none). OpenAI's default retention applies. For a personal app this is a minor privacy note, not a legal
issue, but it *contradicts a "privacy-hardened" mental model* — fix by adding `store:false` to the OpenAI
request bodies.

**⚠️ Declared debt #5 — provider override not allowlisted.** The request body's `providers` array
overrides the default `["openai","kee"]` chain with **no server-side allowlist** (`:655`). Any
authenticated caller (i.e. the owner) can force `["anthropic"]` and spend `ANTHROPIC_API_KEY`, or reorder
priority. Low risk for a single trusted user; worth an allowlist if the surface ever widens.

## 6. Public-repo hygiene · CSP

- The app ships a Content-Security-Policy (`next.config.mjs`) and the reader renders markdown **without**
  `rehype-raw` / `dangerouslySetInnerHTML` (raw HTML in a book is treated as text; `javascript:` hrefs are
  sanitized by react-markdown's default url-transform).
- Service worker: `/api/*` is `NetworkOnly` (auth verdicts never cached).

---

## Declared debt (summary)

*(Re-verified item by item in the 2026-08-18 audit — all six confirmed still open, none silently closed
and none silently worse; #1–#3 keep their low rating for a single-user trusted client.)*

| # | Item | Severity (personal app) |
|---|---|---|
| 1 | Python sandbox keeps `fetch` (network egress) | low |
| 2 | Python worker singleton — state leaks between runs | low |
| 3 | Validator's default JS runner is main-thread/unshielded (import path is shielded) | low |
| 4 | Edge Function sends no `store:false`/ZDR to OpenAI | low-med (privacy) |
| 5 | Provider-override field has no server allowlist | low |
| 6 | **Pending secret rotation** — the Supabase `service_role` + `anon` were used during setup with a disposable PAT; a rotation was noted as a standing owner action | medium — do it |
| 7 | **Structural sandbox** — the shield is a global-severing shield, not an origin boundary. Fine while every bank is authored by the owner; if banks are ever shared/imported from third parties, move the runner to an **opaque-origin iframe** + `connect-src 'none'` | low today · **blocking if banks are ever shared** |

## 7. Engineering Forge

- **CSP.** One source, `src/lib/csp.mjs`, 14 directives applied by `next.config.mjs` to every path. `img-src` adds
  only `https://www.palantir.com` and `https://build.palantir.com`; `frame-src` only `https://www.youtube-nocookie.com`
  and `https://player.vimeo.com`. `connect-src` is unchanged in spirit: self, Supabase and the Pyodide CDN. No new
  wildcard. Only two components check URLs against those origin lists before rendering: `VideoEmbed`
  (`isAllowedFrameUrl`) and the figure paragraph of `BookReader` (`isAllowedImageUrl`, exact origin match). Any other
  `<img>` or `<iframe>` relies on the header alone. A `SafeImage` component, a `SourceViewer` that reads these lists
  and an `offline-download` filter are **not in this version**.
- **Fetch policy.** `src/lib/fetch-policy.ts` is the one list of hosts the server never requests: learn,
  certification, Skilljar, build.palantir.com and every video host, plus IP literals and internal suffixes. The
  allowlist of `/api/fetch-source` is still the exact set of curated spine URLs (now including Forge's
  `sourceUrls`), filtered by `isFetchableSourceUrl` when the list is built (`src/lib/spines.ts`). The route itself is
  unchanged: it accepts the entry URL only on an exact match and checks every redirect hop with `isAllowedSourceHost`
  (https and a host of that filtered list). That hop check does not reject credentials in the URL. `SourceViewer`
  still offers «Ver dentro» for curated URLs that the filter removed (for example YouTube); the route answers
  `url-not-allowed` and the client falls back to «abrir fuente».
- **Not in this version (declared).** The design's session gate and per-session rate limit for `/api/fetch-source`
  (design §12) were not built before the cut. The route keeps today's posture: anonymous, but closed to the curated
  allowlist (no client-chosen URL, no SSRF). A URL outside it answers `url-not-allowed` and the client offers
  «abrir fuente».
- **Edge `ai-router`.** The repo has `forge_judge` (input validated before any provider call; the fold applies
  rule §8.1 to the verdict) and the lock on `lesson` and `tutor` (§10.10: learner text is fenced with a label before it and a reminder
  after it, so the model treats it as data), covered by `src/lib/ai-router-locks.test.ts` with red-checks. It is **not
  deployed** (D7: the account token answered 401); production runs the previous Edge. Forge verdicts stay queued
  with their honest message and drain when the owner deploys (AF3). `forge_interview` is not implemented; the
  interview flow says so.
- **YouTube.** Only ids that appear in allowed sources, embedded through `youtube-nocookie.com`, labelled «no
  revisado». Metadata only from oEmbed at build time; channel listings only through the Data API with the owner's
  key, never versioned.
- **Banks.** Every Forge bank is authored in this repo. Debt #7 (structural sandbox) is unchanged: it becomes
  blocking only if banks are ever imported from third parties.

## 8. The Companion (floating bubble)

The companion is the app's floating helper: a local BM25 search over the owner's books and banks, plus an optional
call to the `companion` action of the Edge `ai-router`. Its whole surface treats model output and learner text as
untrusted. Design: `.agents/tasks/arcanum-companion/design.md` (§12-§18).

- **Model markdown renders without HTML.** `src/ui/companion/Markdown.tsx` wraps `ReactMarkdown` with `remark-gfm`
  and **no `rehype-raw`**, so any HTML the model emits stays as text, never nodes. `urlTransform` (`markdown-urls.ts`)
  keeps only `https:` links and `#cita-P[1-8]` anchors; every other protocol (including `javascript:`) is emptied.
  The model never paints an `<img>` (it degrades to `[imagen: alt]`, so no request leaves through a model image),
  `https:` links open in a new tab with `rel="noopener noreferrer"`, and a citation becomes a button only when its id
  is in the message's passage table. `markdown.test.tsx` has the red-check: adding `rehype-raw` in the test makes a
  `script`/`img` appear and names it (CA-28).
- **Diagrams carry no model HTML.** The companion parses only a small subset of the diagram language; a sentence
  outside the subset is dropped. The SVG is built from parsed nodes, never from a model-provided string, and the
  renderer does not use `dangerouslySetInnerHTML`. `diagrama-svg.test.tsx`'s red-check copies the component with
  `dangerouslySetInnerHTML` and fails with «un diagrama ejecutó HTML del modelo» (CA-25, CA-26).
- **Practice editor — the `react-simple-code-editor` sink.** The library paints with `dangerouslySetInnerHTML` **only
  when its `highlight` prop returns a string**. `src/ui/companion/practica/EditorPlano.tsx` passes
  `highlight={plano}`, where `plano` returns **React nodes** (`<>{code}<br/></>`), which React escapes. So the model's
  hostile signature and whatever the learner types are never interpreted as HTML — that is the reason for the plain
  highlight, with no Prism. `editor-hostil.test.tsx`'s red-check copies the editor with `highlight={(c) => c}`
  (a string) and fails with «el editor de práctica interpretó HTML del modelo» (protection h). A `fuentes-seguras`
  rule also forbids importing `react-simple-code-editor` from any other companion file or using a string highlight.
- **PDF has no actions.** The exported PDF is assembled byte by byte with no `/OpenAction`, `/URI` or other action
  entries. `pdf.test.ts`'s red-check injects `/OpenAction` into the bytes and fails with «el PDF trae una acción:
  /OpenAction» (CA-29).
- **Generated code runs only in the Worker or in `js-aislado`.** Code the model generates for a practice batch is
  validated in the Pyodide/JS Worker, or, for the server-side isolation path, in a `node --permission` child with an
  empty environment (`scripts/companion/js-aislado.mjs`): a `vm` timeout, the child killed if it hangs, no inherited
  env, and `--allow-fs-read` scoped to the child only. It never runs on the main thread or touches the owner's event
  log. Its red-checks live in `js-aislado.test.ts` (timeout, env wiped, permission model, parent kills the child).
- **What goes to the AI** (§12.5). Only the passages the search selected, the minimal location/phase context and the
  learner's question — never the whole book, never other cells' notes, never retention text, never the conversation
  log. A reserved-content redactor runs fail-closed before the request: if the reserved table can't load for a Forge
  world, no request leaves (the transport is never called) and the UI shows the fail-closed notice. `consultar.test.ts`
  and `contexto-edge.test.ts` carry those red-checks.
- **Base `arcanum-companion`.** UI state, the per-minute rate limit and the conversation live in the IndexedDB base
  `arcanum-companion`, separate from the app's event log. The conversation never becomes an `event`:
  `conversacion-log.test.tsx`'s red-check fires an event per message and fails with «la conversación entró al log».
- **CSP is unchanged.** The companion adds no CSP directive and imports no `csp.mjs`. CSP still lives in the single
  source `src/lib/csp.mjs` applied by `next.config.mjs`. A `fuentes-seguras` rule forbids any companion file from
  declaring `Content-Security-Policy`/`http-equiv`/`httpEquiv` or importing `csp.mjs`, and the finalize step checks
  `git diff origin/main -- src/lib/csp.mjs next.config.mjs` is empty (DP-5).
- **The D12 reserved-text filter is an interface, not a security boundary.** The filter keeps Forge's reserved
  twist/retention text out of the index and out of what is sent to the model, so the companion doesn't spoil a
  diagnostic. It is a product honesty measure (a clean interface), not a sandbox: the security boundaries are the
  no-HTML render, the code isolation and the no-action PDF above. If the reserved table is missing it fails closed
  (above), but it is not relied on to contain a malicious model.

See also: [ARCHITECTURE.md](ARCHITECTURE.md) · [OPERATIONS.md](OPERATIONS.md) · [AGENT.md](AGENT.md).
