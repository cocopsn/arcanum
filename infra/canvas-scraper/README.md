# ARCANUM · Canvas scraper (capa de obligaciones — Fase 4)

Trae tus entregas de Canvas a ARCANUM **sin contaminar el grafo de maestría**.
n8n raspa Canvas con tu cookie de sesión y escribe **un evento `canvas.synced`** en
la tabla `events` de Supabase. La app lo baja por el sync normal y deriva la
**Agenda**. Todo es reconstruible desde el log (event-sourced, local-first).

> **El fallo es estado normal.** Si la cookie expira, el scraper igual escribe un
> `canvas.synced` con `ok:false`: la app conserva los últimos datos buenos y marca
> "datos de hace X" + "sesión expirada". Nunca un error rojo. El resto de ARCANUM
> funciona 100% sin Canvas.

## Arquitectura

```
n8n (droplet)  ──cookie──▶  Canvas JSON API  ──parse──▶  canvas.synced
      │                     (/api/v1/courses, /planner/items)      │
      └──────────── service-role insert ───────────────▶  Supabase events
                                                                   │
ARCANUM (cliente) ◀──── pull por seq (sync existente) ────────────┘
                  proyector puro → obligations → Agenda
```

**Por qué el JSON API y no scrapear HTML:** el dashboard de Canvas es una SPA; sus
datos *son* ese JSON (mismo cookie), mucho más estable que parsear HTML renderizado.
El parser (`src/lib/canvas-parse.ts`, con tests + fixtures) degrada campo por campo:
si falta un dato, ese campo cae con honestidad; nunca crashea. El Code node de n8n y
`scrape.mjs` son **espejos** de ese parser — los tres se mantienen en sync.

## Provisión (paso a paso — el droplet lo levantas tú)

1. **Droplet** (DigitalOcean/Hetzner, 1 vCPU/1GB basta). Instala Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
2. **Copia esta carpeta** al droplet (`scp -r infra/canvas-scraper root@<droplet>:~`).
3. **Secretos**: `cp .env.example .env` y llena `.env` (ver abajo cómo obtener cada uno).
   ```bash
   openssl rand -hex 24   # → N8N_ENCRYPTION_KEY
   ```
4. **Levanta n8n**:
   ```bash
   docker compose --env-file .env up -d
   ```
   n8n queda en `127.0.0.1:5678`. Accede por túnel SSH (no lo expongas directo):
   ```bash
   ssh -L 5678:127.0.0.1:5678 root@<droplet>   # abre http://localhost:5678
   ```
   Crea la cuenta de owner de n8n al primer acceso.
5. **Importa el workflow**: en n8n → *Workflows → Import from File* → `n8n-workflow.json`.
6. **Activa** el workflow (toggle *Active*). Corre solo cada 2 h. Para probar ya:
   *Execute Workflow*. Revisa que `Supabase Insert` devuelva 201.

### Cómo obtener cada secreto

- **`CANVAS_COOKIE`**: en el navegador, ya logueado en Canvas → DevTools → Network →
  cualquier request a `/api/v1/...` → Request Headers → copia el valor completo de
  `Cookie`. (Es la sesión; caduca — al expirar verás `ok:false` y renuevas aquí.)
- **`CANVAS_BASE_URL`**: el origen de tu Canvas, sin slash (Tec: `https://experiencia21.tec.mx`).
- **`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE`**: Supabase → Project Settings → API.
  La **service_role** key bypassa RLS — vive SOLO en el droplet, jamás en el cliente.
- **`ARCANUM_USER_ID`**: el `id` de tu fila en `auth.users` (Supabase → Authentication →
  Users → tu usuario). Es el dueño de los eventos `canvas.synced`.

## Fallback sin n8n (cron)

`scrape.mjs` es la misma lógica en Node puro — útil para depurar o si no quieres n8n:
```bash
set -a; source .env; set +a       # carga el .env al entorno
node scrape.mjs                   # un run; imprime "canvas.synced escrito · ok=… · N obligaciones"
# cron cada 2h:
echo "0 */2 * * * cd /root/canvas-scraper && set -a && . ./.env && set +a && node scrape.mjs >> scrape.log 2>&1" | crontab -
```
Requiere Node 18+ (usa `fetch` nativo).

## Seguridad

- Secretos SOLO en `.env` del droplet (gitignored). El repo no contiene ninguno.
- La `service_role` nunca toca el cliente: solo el droplet escribe eventos.
- n8n bound a `127.0.0.1` + túnel/reverse-proxy con TLS. No lo dejes público.
- Rota la cookie de Canvas cuando expire; rota la service_role si se filtra.

## Verificar de punta a punta

Tras un run con `ok:true`, abre ARCANUM → footer **Agenda**: deberías ver tus
entregas agrupadas por fecha con el badge "Datos de Canvas · hace un momento". El
botón **Ascender a módulo** crea un módulo de maestría real ligado a esa obligación.
