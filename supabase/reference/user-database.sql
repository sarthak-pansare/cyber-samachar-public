-- Cyber Samachar Phase 1.5 user-db schema.
-- Target project: user-db icgopcyfqbljjgppjblw.
-- This file contains no cross-database foreign keys to content-db objects.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  audience text not null default 'general' check (audience in ('general', 'professional')),
  language text not null default 'en',
  preferred_categories text[] not null default '{}',
  notification_channels jsonb not null default '{"email": false, "push": false, "whatsapp": false}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table if not exists public.notification_reads (
  notification_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text,
  status text not null default 'pending' check (status in ('pending', 'active', 'unsubscribed')),
  source text not null default 'website',
  consent_version text not null default 'v1-content-mvp',
  confirm_token_hash text,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  feature text not null,
  name text,
  source text not null default 'website',
  consent_version text not null default 'v1-content-mvp',
  created_at timestamptz not null default now(),
  unique (email, feature)
);

alter table public.newsletter_subscribers
  add column if not exists source text not null default 'website',
  alter column consent_version set default 'v1-content-mvp';

alter table public.waitlist_entries
  add column if not exists source text not null default 'website',
  alter column consent_version set default 'v1-content-mvp';

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  crime_type text not null,
  city text,
  incident_at timestamptz,
  loss_amount numeric(14, 2),
  channel text,
  mapped_sections text[] not null default '{}',
  status text not null default 'submitted' check (status in ('submitted', 'triaged', 'referred', 'closed')),
  consent_version text not null,
  sensitive_data_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid,
  actor_role text,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

create table if not exists public.email_signups (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text,
  feature text,
  source text not null default 'website',
  status text not null default 'active',
  consent_version text not null default 'v1-content-mvp',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gemini_key_tracker (
  id uuid primary key default gen_random_uuid(),
  key_name text not null unique,
  api_key text,
  api_key_ciphertext text,
  is_active boolean not null default true,
  is_exhausted boolean not null default false,
  priority integer not null default 100,
  usage_count integer not null default 0,
  daily_limit integer not null default 1500,
  last_used_at timestamptz,
  exhausted_at timestamptz,
  reset_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (api_key is not null or api_key_ciphertext is not null)
);

create index if not exists bookmarks_article_idx
  on public.bookmarks (article_id, created_at desc);
create index if not exists reports_user_status_idx
  on public.reports (user_id, status, created_at desc);
create index if not exists article_comments_article_status_idx
  on public.article_comments (article_id, status, created_at desc);
create index if not exists article_comments_user_idx
  on public.article_comments (user_id, created_at desc);
create index if not exists admin_audit_logs_actor_idx
  on public.admin_audit_logs (actor_id, created_at desc);
create index if not exists gemini_key_tracker_rotation_idx
  on public.gemini_key_tracker (is_active, is_exhausted, priority, last_used_at);

alter table public.profiles enable row level security;
alter table public.bookmarks enable row level security;
alter table public.notification_reads enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.article_comments enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.email_signups enable row level security;
alter table public.gemini_key_tracker enable row level security;

drop policy if exists "Users can manage own profile" on public.profiles;
create policy "Users can manage own profile"
  on public.profiles for all
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can manage own bookmarks" on public.bookmarks;
create policy "Users can manage own bookmarks"
  on public.bookmarks for all
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can manage own notification reads" on public.notification_reads;
create policy "Users can manage own notification reads"
  on public.notification_reads for all
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Public can join newsletter" on public.newsletter_subscribers;
create policy "Public can join newsletter"
  on public.newsletter_subscribers for insert
  to anon, authenticated
  with check (email is not null and consent_version is not null);

drop policy if exists "Public can join waitlist" on public.waitlist_entries;
create policy "Public can join waitlist"
  on public.waitlist_entries for insert
  to anon, authenticated
  with check (email is not null and feature is not null and consent_version is not null);

drop policy if exists "Users can submit reports" on public.reports;
create policy "Users can submit reports"
  on public.reports for insert
  to authenticated
  with check ((select auth.uid()) is not null and ((select auth.uid()) = user_id or user_id is null));

drop policy if exists "Users can read own report status" on public.reports;
create policy "Users can read own report status"
  on public.reports for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

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

drop policy if exists "Service role can manage email signups" on public.email_signups;
create policy "Service role can manage email signups"
  on public.email_signups for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage gemini keys" on public.gemini_key_tracker;
create policy "Service role can manage gemini keys"
  on public.gemini_key_tracker for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.bookmarks to authenticated;
grant select, insert, update, delete on public.notification_reads to authenticated;
grant insert on public.newsletter_subscribers to anon, authenticated;
grant insert on public.waitlist_entries to anon, authenticated;

revoke all on public.reports from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;
revoke all on public.article_comments from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;
revoke all on public.email_signups from anon, authenticated;
revoke all on public.gemini_key_tracker from anon, authenticated;

grant all on public.profiles to service_role;
grant all on public.bookmarks to service_role;
grant all on public.notification_reads to service_role;
grant all on public.newsletter_subscribers to service_role;
grant all on public.waitlist_entries to service_role;
grant all on public.reports to service_role;
grant all on public.audit_logs to service_role;
grant all on public.article_comments to service_role;
grant all on public.admin_audit_logs to service_role;
grant all on public.email_signups to service_role;
grant all on public.gemini_key_tracker to service_role;

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

create or replace function private.submit_report(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into public.reports(
    user_id,
    crime_type,
    city,
    incident_at,
    loss_amount,
    channel,
    mapped_sections,
    consent_version,
    sensitive_data_ciphertext
  )
  values (
    auth.uid(),
    nullif(payload->>'crime_type', ''),
    nullif(payload->>'city', ''),
    nullif(payload->>'incident_at', '')::timestamptz,
    nullif(payload->>'loss_amount', '')::numeric,
    nullif(payload->>'channel', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'mapped_sections', '[]'::jsonb))), '{}'),
    coalesce(nullif(payload->>'consent_version', ''), 'v1-content-mvp'),
    nullif(payload->>'sensitive_data_ciphertext', '')
  )
  returning id into new_id;

  insert into public.audit_logs(actor_id, actor_role, action, target_table, target_id, metadata)
  values (auth.uid(), 'authenticated', 'report.submit', 'reports', new_id, jsonb_build_object('source', 'submit_report'));

  return new_id;
end;
$$;

create or replace function private.get_report_status(report_id uuid)
returns table (
  id uuid,
  crime_type text,
  city text,
  incident_at timestamptz,
  loss_amount numeric,
  channel text,
  mapped_sections text[],
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into public.audit_logs(actor_id, actor_role, action, target_table, target_id, metadata)
  values (auth.uid(), 'authenticated', 'report.read', 'reports', report_id, jsonb_build_object('source', 'get_report_status'));

  return query
  select
    r.id,
    r.crime_type,
    r.city,
    r.incident_at,
    r.loss_amount,
    r.channel,
    r.mapped_sections,
    r.status,
    r.created_at,
    r.updated_at
  from public.reports r
  where r.id = report_id
    and r.user_id = auth.uid();
end;
$$;

create or replace function public.submit_report(payload jsonb)
returns uuid
language sql
as $$
  select private.submit_report(payload);
$$;

create or replace function public.get_report_status(report_id uuid)
returns table (
  id uuid,
  crime_type text,
  city text,
  incident_at timestamptz,
  loss_amount numeric,
  channel text,
  mapped_sections text[],
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
as $$
  select * from private.get_report_status(report_id);
$$;

create or replace function public.get_active_gemini_key()
returns table (
  id uuid,
  key_name text,
  api_key text,
  usage_count integer,
  daily_limit integer
)
language sql
security definer
set search_path = public
as $$
  select
    g.id,
    g.key_name,
    coalesce(g.api_key, g.api_key_ciphertext) as api_key,
    g.usage_count,
    g.daily_limit
  from public.gemini_key_tracker g
  where g.is_active
    and not g.is_exhausted
    and g.usage_count < g.daily_limit
  order by g.priority asc, g.last_used_at asc nulls first, g.created_at asc
  limit 1;
$$;

create or replace function public.increment_gemini_count(key_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data public.gemini_key_tracker%rowtype;
begin
  update public.gemini_key_tracker
  set usage_count = usage_count + 1,
      last_used_at = now(),
      is_exhausted = usage_count + 1 >= daily_limit,
      exhausted_at = case when usage_count + 1 >= daily_limit then coalesce(exhausted_at, now()) else exhausted_at end,
      updated_at = now()
  where id::text = key_identifier or key_name = key_identifier
  returning * into row_data;

  if not found then
    raise exception 'gemini key not found';
  end if;

  return jsonb_build_object(
    'id', row_data.id,
    'key_name', row_data.key_name,
    'usage_count', row_data.usage_count,
    'daily_limit', row_data.daily_limit,
    'is_exhausted', row_data.is_exhausted
  );
end;
$$;

create or replace function public.exhaust_gemini_key(key_identifier text, reason text default 'quota')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data public.gemini_key_tracker%rowtype;
begin
  update public.gemini_key_tracker
  set is_exhausted = true,
      exhausted_at = now(),
      metadata = metadata || jsonb_build_object('exhaust_reason', reason),
      updated_at = now()
  where id::text = key_identifier or key_name = key_identifier
  returning * into row_data;

  if not found then
    raise exception 'gemini key not found';
  end if;

  return jsonb_build_object('id', row_data.id, 'key_name', row_data.key_name, 'is_exhausted', row_data.is_exhausted);
end;
$$;

create or replace function public.rotate_gemini_keys()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reset_count integer;
begin
  update public.gemini_key_tracker
  set usage_count = 0,
      is_exhausted = false,
      exhausted_at = null,
      reset_at = now(),
      updated_at = now()
  where is_active;

  get diagnostics reset_count = row_count;
  return reset_count;
end;
$$;

grant usage on schema private to authenticated;
grant execute on function public.submit_report(jsonb) to authenticated;
grant execute on function public.get_report_status(uuid) to authenticated;
grant execute on function private.submit_report(jsonb) to authenticated;
grant execute on function private.get_report_status(uuid) to authenticated;
grant execute on function public.get_active_gemini_key() to service_role;
grant execute on function public.increment_gemini_count(text) to service_role;
grant execute on function public.exhaust_gemini_key(text, text) to service_role;
grant execute on function public.rotate_gemini_keys() to service_role;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule('rotate-keys-00') where exists (select 1 from cron.job where jobname = 'rotate-keys-00');
    perform cron.unschedule('rotate-keys-13') where exists (select 1 from cron.job where jobname = 'rotate-keys-13');
    perform cron.schedule('rotate-keys-00', '0 0 * * *', 'select public.rotate_gemini_keys();');
    perform cron.schedule('rotate-keys-13', '0 13 * * *', 'select public.rotate_gemini_keys();');
  end if;
end $$;

-- Phase 1.5 auth/user completion extension.
-- Additive only; mirrors supabase/migrations/20260603000100_phase15_auth_user_completion.sql.
alter table public.profiles
  add column if not exists user_id uuid,
  add column if not exists full_name text,
  add column if not exists username citext,
  add column if not exists email citext,
  add column if not exists profession text,
  add column if not exists organization_company text,
  add column if not exists job_title text,
  add column if not exists country text,
  add column if not exists state text,
  add column if not exists city text,
  add column if not exists profile_photo_path text,
  add column if not exists bio text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists preferred_categories text[] not null default '{}',
  add column if not exists preferences jsonb not null default '{}'::jsonb,
  add column if not exists notification_channels jsonb not null default '{}'::jsonb,
  add column if not exists account_status text not null default 'pending_setup',
  add column if not exists role text not null default 'reader',
  add column if not exists subscription_status text not null default 'free',
  add column if not exists account_setup_completed boolean not null default false,
  add column if not exists account_setup_completed_at timestamptz,
  add column if not exists last_active_at timestamptz;

update public.profiles
set user_id = id
where user_id is null;

alter table public.profiles
  alter column user_id set not null;

do $$
begin
  alter table public.profiles
    add constraint profiles_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_user_id_key unique (user_id);
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_profile_user_id()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    new.user_id := new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_profile_user_id_before_write on public.profiles;
create trigger set_profile_user_id_before_write
  before insert or update on public.profiles
  for each row execute function public.set_profile_user_id();

do $$
begin
  alter table public.profiles
    drop constraint if exists profiles_account_status_check;
  alter table public.profiles
    add constraint profiles_account_status_check
    check (account_status in ('pending_verification', 'pending_setup', 'pending', 'active', 'suspended', 'banned', 'deleted'));
exception
  when duplicate_object then null;
end $$;

create unique index if not exists profiles_username_unique
  on public.profiles (username)
  where username is not null;
create unique index if not exists profiles_email_unique
  on public.profiles (email)
  where email is not null;

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select auth.uid()) = user_id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id or (select auth.uid()) = user_id)
  with check ((select auth.uid()) = id and (select auth.uid()) = user_id);

drop policy if exists "Service role can manage profiles" on public.profiles;
create policy "Service role can manage profiles"
  on public.profiles for all to service_role using (true) with check (true);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_token_hash text not null unique,
  device_info jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  remembered boolean not null default false,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.login_history (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  email citext,
  event_type text not null check (event_type in ('login.success', 'login.failed', 'logout', 'session.refresh')),
  ip_address text,
  user_agent text,
  device_info jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  email citext,
  event text,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warn', 'warning', 'critical')),
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.security_events
  add column if not exists email citext,
  add column if not exists event text,
  add column if not exists event_type text,
  add column if not exists user_agent text;

update public.security_events
set event_type = event
where event_type is null;

update public.security_events
set event = event_type
where event is null;

alter table public.security_events
  alter column event_type set not null,
  alter column event set not null;

do $$
begin
  alter table public.security_events
    drop constraint if exists security_events_severity_check;
  alter table public.security_events
    add constraint security_events_severity_check
    check (severity in ('info', 'warn', 'warning', 'critical'));
exception
  when duplicate_object then null;
end $$;

create table if not exists public.saved_articles (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null,
  source text not null default 'content-db',
  saved_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table if not exists public.liked_articles (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null,
  source text not null default 'content-db',
  liked_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table if not exists public.reading_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id text not null,
  source text not null default 'content-db',
  first_read_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  read_count integer not null default 1 check (read_count > 0),
  primary key (user_id, article_id)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  audience text not null default 'general' check (audience in ('general', 'professional')),
  language text not null default 'en',
  interests text[] not null default '{}',
  notification_channels jsonb not null default '{}'::jsonb,
  feed_preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_email_templates (
  id text primary key,
  template_type text not null,
  subject text not null,
  body_html text not null,
  body_text text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.outbound_email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email citext not null,
  template_id text references public.auth_email_templates(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.user_sessions enable row level security;
alter table public.login_history enable row level security;
alter table public.security_events enable row level security;
alter table public.saved_articles enable row level security;
alter table public.liked_articles enable row level security;
alter table public.reading_history enable row level security;
alter table public.user_preferences enable row level security;
alter table public.auth_email_templates enable row level security;
alter table public.outbound_email_queue enable row level security;

drop policy if exists "Users can read own sessions" on public.user_sessions;
create policy "Users can read own sessions"
  on public.user_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own login history" on public.login_history;
create policy "Users can read own login history"
  on public.login_history for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own saved articles" on public.saved_articles;
create policy "Users can manage own saved articles"
  on public.saved_articles for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own liked articles" on public.liked_articles;
create policy "Users can manage own liked articles"
  on public.liked_articles for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own reading history" on public.reading_history;
create policy "Users can manage own reading history"
  on public.reading_history for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own preferences" on public.user_preferences;
create policy "Users can manage own preferences"
  on public.user_preferences for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select on public.user_sessions, public.login_history to authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.saved_articles, public.liked_articles, public.reading_history, public.user_preferences to authenticated;
revoke all on public.security_events from anon, authenticated;
revoke all on public.auth_email_templates from anon, authenticated;
revoke all on public.outbound_email_queue from anon, authenticated;
grant all on public.user_sessions, public.login_history, public.security_events, public.saved_articles, public.liked_articles, public.reading_history, public.user_preferences, public.auth_email_templates, public.outbound_email_queue to service_role;
grant all on public.profiles to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into public.auth_email_templates(id, template_type, subject, body_html, body_text)
values
  ('signup-verification', 'supabase-auth', 'Verify your Cyber Samachar account', '<h1>Cyber Samachar</h1><p>Confirm your email to activate your account.</p><p><a href="{{ .ConfirmationURL }}">Verify account</a></p>', 'Cyber Samachar: confirm your email to activate your account: {{ .ConfirmationURL }}'),
  ('password-reset', 'supabase-auth', 'Reset your Cyber Samachar password', '<h1>Cyber Samachar</h1><p>Use this secure link to reset your password.</p><p><a href="{{ .ConfirmationURL }}">Reset password</a></p>', 'Cyber Samachar: reset your password using this secure link: {{ .ConfirmationURL }}'),
  ('welcome', 'transactional-deferred', 'Welcome to Cyber Samachar', '<h1>Welcome to Cyber Samachar</h1><p>Your cyber awareness dashboard is ready.</p>', 'Welcome to Cyber Samachar. Your cyber awareness dashboard is ready.'),
  ('security-alert', 'transactional-deferred', 'Cyber Samachar security alert', '<h1>Security alert</h1><p>We noticed a security-sensitive event on your account.</p>', 'Cyber Samachar security alert: we noticed a security-sensitive event on your account.'),
  ('account-change', 'transactional-deferred', 'Cyber Samachar account changed', '<h1>Account changed</h1><p>Your Cyber Samachar account settings were updated.</p>', 'Your Cyber Samachar account settings were updated.')
on conflict (id) do update
set subject = excluded.subject,
    body_html = excluded.body_html,
    body_text = excluded.body_text,
    updated_at = now();
