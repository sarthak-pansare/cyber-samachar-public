-- User-db backend extensions for locked-UI integration.
-- Apply only after Phase 1.5 user-db preflight passes. This migration has no
-- cross-database foreign keys and does not expose comments/admin data directly
-- to the browser.

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 3 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden')),
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists article_comments_article_status_idx
  on public.article_comments (article_id, status, created_at desc);

create index if not exists article_comments_user_idx
  on public.article_comments (user_id, created_at desc);

create index if not exists admin_audit_logs_actor_idx
  on public.admin_audit_logs (actor_id, created_at desc);

alter table public.article_comments enable row level security;
alter table public.admin_audit_logs enable row level security;

revoke all on public.article_comments from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;

grant all on public.article_comments to service_role;
grant all on public.admin_audit_logs to service_role;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.jwt_is_admin()
returns boolean
language sql
stable
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'editor')
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'cs_role', '') in ('admin', 'editor')
    or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ?| array['admin', 'editor'];
$$;

drop policy if exists "Service role can manage article comments" on public.article_comments;
create policy "Service role can manage article comments"
  on public.article_comments for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage admin audit logs" on public.admin_audit_logs;
create policy "Service role can manage admin audit logs"
  on public.admin_audit_logs for all
  to service_role
  using (true)
  with check (true);
