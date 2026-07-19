# ARCANUM — Operations

Running, testing, deploying, and un-sticking Arcanum. The package manager is **pnpm**
(`pnpm-lock.yaml`). For deploy specifics also see [DEPLOY.md](DEPLOY.md); for the AI-router contract,
[AGENT.md](AGENT.md).

---

## 1. Local development

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

**No env vars are required to run** — the event log lives in IndexedDB; with no Supabase config,
`getSupabase()` is `null` and sync + AI simply stay off (honest degradation). The app is fully usable from
the local log.

## 2. Environment variables (names only — never commit values)

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Supabase **anon** key (RLS-scoped, safe to expose) |
| `ARCANUM_ACCESS_PASSWORD` | server (Vercel) | the single-user gate password |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** (Vercel) | server-side Supabase session mint — never `NEXT_PUBLIC_` |
| `OPENAI_API_KEY` | **Edge Function secret** | evaluator provider (primary) |
| `ANTHROPIC_API_KEY` | **Edge Function secret** | evaluator provider (implemented, off the default chain) |
| `KEE_ENDPOINT` / `KEE_API_KEY` | **Edge Function secret** | evaluator fallback (the learner's RAG agent; inert until set) |

Copy `.env.example` → `.env.local` for local server env (it's gitignored). Edge-Function secrets are set
on Supabase, not in `.env.local`.

## 3. Quality gate (run before any deploy)

```bash
pnpm typecheck      # tsc --noEmit (strict)
pnpm lint           # next lint (0 warnings/errors expected)
pnpm test           # vitest — unit + integration
pnpm build          # next build (must be 0)
pnpm loc            # lines-of-code report (see §6)
```

All four must be green. `pnpm test` runs entirely offline (happy-dom + fake-indexeddb); no network, no
speakers needed — audio/speech are verified *structurally* (correct utterances, no fetch), not by ear.

## 4. Deploy

- **App → Vercel.** Production auto-deploys from `main` (Vercel GitHub integration). Confirm a deploy is
  live by grepping the served chunk for a marker unique to the change (see §5). Set the server env vars
  (`ARCANUM_ACCESS_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, the `NEXT_PUBLIC_*`) in the Vercel project.
- **Edge Function → Supabase.** The evaluator is `supabase/functions/ai-router`:
  ```bash
  supabase functions deploy ai-router
  supabase secrets set OPENAI_API_KEY=…            # (and ANTHROPIC_API_KEY, KEE_ENDPOINT if used)
  ```
  It is deployed independently of the Vercel app — a code change to the function does **not** ride the
  Vercel deploy.
- **DB migration → Supabase.** `supabase/migrations/*.sql` (the `public.events` mirror + RLS). Apply via
  the Supabase CLI / dashboard. The mirror is additive; the log is the source of truth regardless.

## 5. Verifying a deploy is actually live

Vercel serves the old build until the new one swaps in, so a `200` alone doesn't prove the new code.
Grep the **served** JS chunk for a string unique to your change:

```bash
html=$(curl -s https://<app>.vercel.app/)
for js in $(echo "$html" | grep -oE '/_next/static/chunks/[a-zA-Z0-9_./-]+\.js' | sort -u); do
  curl -s "https://<app>.vercel.app$js" | grep -q "MARKER_STRING_FROM_YOUR_CHANGE" && echo "live in $js"
done
```

This is more reliable than the deploy API's state (which can read stale for a few seconds).

## 6. Lines-of-code report

```bash
pnpm loc            # human table:  code / tests / docs / content / config, by dir, total
pnpm loc -- --json  # machine-readable (or: node scripts/loc.mjs --json)
```

`scripts/loc.mjs` counts every **tracked** text file via `git ls-files` (so `node_modules` / `.next` /
build artifacts are excluded by `.gitignore` automatically) and buckets each file. Binaries (images,
fonts) are skipped and tallied. Zero dependencies.

## 7. Troubleshooting (things that have actually bitten this project)

- **"Application error" / corrupted chunks after running dev + prod together.** Running `next dev` over the
  same `.next` that `next start` is serving **corrupts the build** (400 chunks, React #423) — it looks like
  a code bug but is `.next` contamination. Fix: `taskkill` the node processes, `rm -rf .next`, and do a
  **clean `pnpm build`** on an isolated port. Never run two builds over the same `.next`.
- **Stale service worker serves the old app in preview.** A previously-registered SW can keep serving old
  chunks. Grep the served chunk (§5) to confirm what's actually running; hard-reload / clear the SW; in a
  throwaway preview, navigate to `about:blank` first to reset IndexedDB, then load.
- **Headless preview: `computer{screenshot}` hangs, and trusted coordinate-clicks aren't available.** The
  page *is* live and `javascript_tool` eval works — verify structurally via JS (read DOM, call handlers,
  spy on globals) rather than screenshots. This is a headless quirk, not an app fault.
- **Preview viewport is `0×0` on first load** (esp. with React Flow). Resize the window to a preset
  (desktop/mobile) and re-navigate before reading the page.
- **A code change to the Edge Function didn't take effect after a Vercel deploy.** It wouldn't — the
  function deploys to Supabase separately (`supabase functions deploy ai-router`), not with Vercel.
- **Voices differ from your device.** The audiobook uses the browser's *installed* voices. A headless/CI
  environment reports **0 voices**; your phone/desktop has the system es-MX/es-ES voices (they load
  asynchronously via `voiceschanged`, sometimes only after the first tap on iOS).

---

See also: [ARCHITECTURE.md](ARCHITECTURE.md) · [SECURITY.md](SECURITY.md) · [CONTENT.md](CONTENT.md) ·
[DEPLOY.md](DEPLOY.md) · [AGENT.md](AGENT.md).
