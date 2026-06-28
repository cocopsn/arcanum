# ARCANUM

PWA local-first de aprendizaje. Núcleo event-sourced: un log append-only de eventos inmutables es la única fuente de verdad; todo estado (XP, grado hermético, racha, mastery) se deriva con un proyector puro. Local-first (Dexie/IndexedDB) con Supabase como espejo sincronizado.

Metodología: aprender por error (el reto va primero, el recurso es on-demand) y aprender por acción (proyectos reales).

## Estado

Fase 0 en construcción. Spec: [`docs/superpowers/specs/2026-06-28-arcanum-phase0-design.md`](docs/superpowers/specs/2026-06-28-arcanum-phase0-design.md).

## Stack

Next.js 14 (App Router) · TypeScript strict · Dexie · Serwist · Supabase (Postgres + Auth) · Zustand · Tailwind · motion.

## Desarrollo

```bash
pnpm install
pnpm dev        # :3000
pnpm test       # vitest
pnpm build
```

Copia `.env.example` a `.env.local` y llena las llaves de Supabase.
