-- ARCANUM — event log mirror. Append-only, RLS-scoped to the owner.
-- Apply once in the Supabase SQL Editor (or via CLI with the DB password / a
-- personal access token). Spec §7.1.

create extension if not exists pgcrypto;

create table if not exists public.events (
  id          uuid        primary key,
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  seq         bigint      generated always as identity,  -- server monotonic cursor for pull
  type        text        not null,
  ts          bigint      not null,                       -- client epoch ms; FOLD order only
  device_id   text        not null,
  goal_id     uuid,
  module_id   uuid,
  payload     jsonb       not null default '{}'::jsonb,
  v           integer     not null default 1,
  created_at  timestamptz not null default now()
);

create index if not exists events_user_seq_idx on public.events (user_id, seq);

alter table public.events enable row level security;

-- Owner-only read/insert. No update/delete policy → append-only at the DB.
drop policy if exists events_select_own on public.events;
create policy events_select_own on public.events
  for select using (auth.uid() = user_id);

drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
  for insert with check (auth.uid() = user_id);
