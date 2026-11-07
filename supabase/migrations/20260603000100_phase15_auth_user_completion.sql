-- Cyber Samachar Phase 1.5 auth/user completion.
-- Additive only: expands user-db profile, activity, auth logs, and private avatar storage.

create extension if not exists citext with schema extensions;

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

do $$
begin
  alter table public.profiles
    add constraint profiles_role_check
    check (role in ('reader', 'contributor', 'moderator', 'admin'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_subscription_status_check
    check (subscription_status in ('free', 'trial', 'pro', 'sponsor', 'cancelled'));
exception
  when duplicate_object then null;
end $$;

create unique index if not exists profiles_username_unique
  on public.profiles (username)
  where username is not null;
create unique index if not exists profiles_email_unique
  on public.profiles (email)
  where email is not null;
create index if not exists profiles_setup_status_idx
  on public.profiles (account_setup_completed, account_status, updated_at desc);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id or (select auth.uid()) = user_id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
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
  severity text not null default 'info' check (severity in ('info', 'warn', 'critical')),
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

create index if not exists user_sessions_user_idx
  on public.user_sessions (user_id, last_seen_at desc);
create index if not exists login_history_user_idx
  on public.login_history (user_id, created_at desc);
create index if not exists login_history_email_idx
  on public.login_history (email, created_at desc);
create index if not exists security_events_user_idx
  on public.security_events (user_id, created_at desc);
create index if not exists security_events_type_idx
  on public.security_events (event_type, created_at desc);
create index if not exists saved_articles_article_idx
  on public.saved_articles (article_id, saved_at desc);
create index if not exists liked_articles_article_idx
  on public.liked_articles (article_id, liked_at desc);
create index if not exists reading_history_user_idx
  on public.reading_history (user_id, last_read_at desc);

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
  on public.user_sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own login history" on public.login_history;
create policy "Users can read own login history"
  on public.login_history for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own saved articles" on public.saved_articles;
create policy "Users can manage own saved articles"
  on public.saved_articles for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own liked articles" on public.liked_articles;
create policy "Users can manage own liked articles"
  on public.liked_articles for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own reading history" on public.reading_history;
create policy "Users can manage own reading history"
  on public.reading_history for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own preferences" on public.user_preferences;
create policy "Users can manage own preferences"
  on public.user_preferences for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Service role can manage user sessions" on public.user_sessions;
create policy "Service role can manage user sessions"
  on public.user_sessions for all to service_role using (true) with check (true);
drop policy if exists "Service role can manage login history" on public.login_history;
create policy "Service role can manage login history"
  on public.login_history for all to service_role using (true) with check (true);
drop policy if exists "Service role can manage security events" on public.security_events;
create policy "Service role can manage security events"
  on public.security_events for all to service_role using (true) with check (true);
drop policy if exists "Service role can manage auth email templates" on public.auth_email_templates;
create policy "Service role can manage auth email templates"
  on public.auth_email_templates for all to service_role using (true) with check (true);
drop policy if exists "Service role can manage outbound email queue" on public.outbound_email_queue;
create policy "Service role can manage outbound email queue"
  on public.outbound_email_queue for all to service_role using (true) with check (true);

grant select on public.user_sessions, public.login_history to authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.saved_articles, public.liked_articles, public.reading_history, public.user_preferences to authenticated;
revoke all on public.security_events from anon, authenticated;
revoke all on public.auth_email_templates from anon, authenticated;
revoke all on public.outbound_email_queue from anon, authenticated;

grant all on public.profiles to service_role;
grant all on public.user_sessions to service_role;
grant all on public.login_history to service_role;
grant all on public.security_events to service_role;
grant all on public.saved_articles to service_role;
grant all on public.liked_articles to service_role;
grant all on public.reading_history to service_role;
grant all on public.user_preferences to service_role;
grant all on public.auth_email_templates to service_role;
grant all on public.outbound_email_queue to service_role;
grant usage, select on all sequences in schema public to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own profile photos" on storage.objects;
create policy "Users can read own profile photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can upload own profile photos" on storage.objects;
create policy "Users can upload own profile photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can update own profile photos" on storage.objects;
create policy "Users can update own profile photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete own profile photos" on storage.objects;
create policy "Users can delete own profile photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

insert into public.auth_email_templates(id, template_type, subject, body_html, body_text)
values
  (
    'signup-verification',
    'supabase-auth',
    'Verify your Cyber Samachar account',
    '<h1>Cyber Samachar</h1><p>Confirm your email to activate your account.</p><p><a href="{{ .ConfirmationURL }}">Verify account</a></p>',
    'Cyber Samachar: confirm your email to activate your account: {{ .ConfirmationURL }}'
  ),
  (
    'password-reset',
    'supabase-auth',
    'Reset your Cyber Samachar password',
    '<h1>Cyber Samachar</h1><p>Use this secure link to reset your password.</p><p><a href="{{ .ConfirmationURL }}">Reset password</a></p>',
    'Cyber Samachar: reset your password using this secure link: {{ .ConfirmationURL }}'
  ),
  (
    'welcome',
    'transactional-deferred',
    'Welcome to Cyber Samachar',
    '<h1>Welcome to Cyber Samachar</h1><p>Your cyber awareness dashboard is ready.</p>',
    'Welcome to Cyber Samachar. Your cyber awareness dashboard is ready.'
  ),
  (
    'security-alert',
    'transactional-deferred',
    'Cyber Samachar security alert',
    '<h1>Security alert</h1><p>We noticed a security-sensitive event on your account.</p>',
    'Cyber Samachar security alert: we noticed a security-sensitive event on your account.'
  ),
  (
    'account-change',
    'transactional-deferred',
    'Cyber Samachar account changed',
    '<h1>Account changed</h1><p>Your Cyber Samachar account settings were updated.</p>',
    'Your Cyber Samachar account settings were updated.'
  )
on conflict (id) do update
set subject = excluded.subject,
    body_html = excluded.body_html,
    body_text = excluded.body_text,
    updated_at = now();
