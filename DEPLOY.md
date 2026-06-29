# ARCANUM · Deploy

Estado del despliegue y la lista EXACTA de acciones que te tocan a ti. ARCANUM es
local-first: funciona 100% offline sin nada de esto; lo de abajo habilita **sync
entre dispositivos**, **IA del rito** y la **capa de Canvas**.

## ✅ Verificado localmente (listo para subir)

- `pnpm build` limpio · `pnpm test:run` verde · typecheck/lint en cero.
- **Smoke en modo producción** (`next start`): `/` 200, `/manifest.webmanifest` sirve,
  `/sw.js` 200 (service worker de prod), `/icons/*` 200 → **PWA instalable + offline**.
- **Seguridad del bundle**: el único JWT inlineado en el cliente es la **anon key**
  (`role: anon`, pública por diseño, protegida por RLS). La `service_role` NO aparece
  en `src/` ni en el bundle servido (`.next/static`) — solo vive en el scraper (env del
  droplet). Verificado decodificando el JWT del bundle.
- **Sin migración nueva en Fase 4**: `canvas.synced` y `grade.celebrated` usan la tabla
  `events` existente (migración `0001_events.sql`, ya aplicada en Fase 0). Nada que migrar.

## 1) App → Vercel (free)

> No pude desplegar yo: el repo no tiene remote git y la herramienta de deploy de
> Vercel apunta al cwd equivocado (otro proyecto). Estos son tus comandos exactos.

**a. Sube el repo a GitHub** (privado recomendado):

```bash
cd D:\projects\arcanum
gh repo create arcanum --private --source=. --remote=origin --push
# (o crea el repo en github.com y: git remote add origin … && git push -u origin main)
```

**b. Importa en Vercel**: vercel.com → *Add New… → Project* → importa `arcanum`.
Framework: **Next.js** (autodetectado). Build/Output: por defecto. Deploy.

**c. Variables de entorno en Vercel** (Project → Settings → Environment Variables,
*Production* + *Preview*):

| Variable | Valor | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tssmjabfszndxwlpzngv.supabase.co` | pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(anon key de Supabase → Settings → API)* | pública (RLS protege) |

> NUNCA pongas la `service_role` ni claves de IA en Vercel — el cliente no las usa.
> Re-deploya tras añadir las env (Vercel lo ofrece). Sin estas env la app igual
> carga, pero en modo solo-local (sin sync).

**d. Verifica en la URL de prod** (`https://arcanum-….vercel.app`):
- Instalar PWA (Chrome: icono de instalar / iOS Safari: Compartir → Añadir a inicio).
- Abrir, hacer un acto (sellar un muro), cerrar, **modo avión**, reabrir → sigue ahí.
- En 2 dispositivos con la misma cuenta → un evento en A aparece en B.

## 2) Edge Function (IA del rito + OCR) → Supabase

La función `ai-router` ya existe en Supabase; este deploy actualiza el prompt del
rito (Fase 4) a contexto accionable. Requiere tu PAT — **corre tú este comando**:

```bash
cd D:\projects\arcanum
supabase login                                   # o: export SUPABASE_ACCESS_TOKEN=<tu PAT>
supabase functions deploy ai-router --project-ref tssmjabfszndxwlpzngv
```

Secrets de la función (ya los pusiste en Fase 2; confírmalo):

```bash
supabase secrets list --project-ref tssmjabfszndxwlpzngv      # debe incluir OPENAI_API_KEY
# si falta alguno:
supabase secrets set OPENAI_API_KEY=<...> --project-ref tssmjabfszndxwlpzngv
# (ANTHROPIC_API_KEY es opcional — el router cae a él si está)
```

Las claves de IA viven SOLO en los secrets de la función (`Deno.env.get`), nunca en
el cliente. El cliente invoca `ai-router` autenticado con su JWT de Supabase.

## 3) Canvas (capa de obligaciones) → droplet con n8n

Todo el paso a paso está en [`infra/canvas-scraper/README.md`](infra/canvas-scraper/README.md).
Resumen de lo tuyo: levantar un droplet, `docker compose up -d` con un `.env` (cookie de
Canvas + `service_role` + tu `user_id`), importar `n8n-workflow.json`, activar. Sin esto,
la Agenda muestra "Aún no conectas Canvas" (estado normal, no error).

## Resumen: qué quedó live vs. qué te toca

| Pieza | Estado | Acción tuya |
|---|---|---|
| Build + PWA prod-ready | ✅ verificado local | — |
| App en Vercel | ⏳ listo para subir | §1 (GitHub push + import + env) |
| Edge Function `ai-router` (Fase 4) | ⏳ código listo | §2 (`supabase functions deploy`, tu PAT) |
| Migración DB | ✅ ninguna nueva | — |
| Canvas scraper (n8n) | ⏳ todo generado | §3 (droplet + cookie + activar) |

Nada de lo pendiente bloquea a ARCANUM: instala la PWA y úsala offline hoy mismo; el
sync, la IA y Canvas se encienden cuando completes §1–§3.
