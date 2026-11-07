-- Cyber Samachar full backend schema, access model, and RLS policies.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;

create table if not exists public.categories (
  id text primary key,
  label_en text not null,
  label_hi text,
  description text,
  icon_key text,
  display_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.article_tags (
  article_id uuid not null references public.published_data(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (article_id, tag)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  audience text not null default 'general' check (audience in ('general', 'professional')),
  language text not null default 'en',
  preferred_categories text[] not null default '{}',
  notification_channels jsonb not null default '{"email": false, "push": false, "whatsapp": false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.published_data(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title_en text not null,
  title_hi text,
  body_en text,
  body_hi text,
  target_type text,
  target_id uuid,
  severity text not null default 'info',
  is_public boolean not null default true,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists public.law_acts (
  id text primary key,
  name_en text not null,
  name_hi text,
  short_name text,
  description_en text,
  description_hi text,
  display_order integer not null default 100,
  is_active boolean not null default true,
  effective_from date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.law_sections (
  id uuid primary key default gen_random_uuid(),
  act_id text not null references public.law_acts(id) on delete cascade,
  section_number text not null,
  title_en text not null,
  title_hi text,
  description_en text,
  description_hi text,
  penalty_en text,
  severity text not null default 'info',
  triable_by text,
  bailable text,
  court text,
  practitioner_note text,
  related_sections text[] not null default '{}',
  effective_from date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (act_id, section_number)
);

create table if not exists public.article_law_links (
  article_id uuid not null references public.published_data(id) on delete cascade,
  law_section_id uuid not null references public.law_sections(id) on delete cascade,
  relevance text,
  created_at timestamptz not null default now(),
  primary key (article_id, law_section_id)
);

create table if not exists public.cyber_cells (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'cyber_cell',
  state text not null,
  city text,
  address text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  phone text,
  email text,
  portal_url text,
  officer_contact text,
  is_active boolean not null default true,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scam_spotlights (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  issue_number integer,
  title_en text not null,
  title_hi text,
  hook_en text,
  hook_hi text,
  body_en text,
  body_hi text,
  loss_figure text,
  share_metadata jsonb not null default '{}'::jsonb,
  is_current boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  crime_type text not null,
  city text,
  incident_at timestamptz,
  loss_amount numeric(14, 2),
  channel text,
  mapped_sections uuid[] not null default '{}',
  status text not null default 'submitted' check (status in ('submitted', 'triaged', 'referred', 'closed')),
  consent_version text not null,
  sensitive_data_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create table if not exists public.article_reactions (
  article_id uuid not null references public.published_data(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  anon_id_hash text,
  reaction_type text not null default 'like',
  created_at timestamptz not null default now(),
  check (user_id is not null or anon_id_hash is not null)
);

create table if not exists public.article_view_events (
  id bigserial primary key,
  article_id uuid not null references public.published_data(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  anon_id_hash text,
  viewed_at timestamptz not null default now()
);

create unique index if not exists article_reactions_user_like_uidx
  on public.article_reactions (article_id, user_id, reaction_type)
  where user_id is not null;

create unique index if not exists article_reactions_anon_like_uidx
  on public.article_reactions (article_id, anon_id_hash, reaction_type)
  where anon_id_hash is not null;

create index if not exists published_data_status_published_at_idx
  on public.published_data (status, published_at desc);
create index if not exists published_data_categories_gin_idx
  on public.published_data using gin (categories);
create index if not exists law_sections_act_idx
  on public.law_sections (act_id, section_number);
create index if not exists cyber_cells_lookup_idx
  on public.cyber_cells (state, city, type);

alter table public.categories enable row level security;
alter table public.article_tags enable row level security;
alter table public.profiles enable row level security;
alter table public.bookmarks enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.law_acts enable row level security;
alter table public.law_sections enable row level security;
alter table public.article_law_links enable row level security;
alter table public.cyber_cells enable row level security;
alter table public.scam_spotlights enable row level security;
alter table public.reports enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.audit_logs enable row level security;
alter table public.article_reactions enable row level security;
alter table public.article_view_events enable row level security;
alter table public.published_data enable row level security;

drop policy if exists "Public can read published articles" on public.published_data;
create policy "Public can read published articles"
  on public.published_data for select
  to anon, authenticated
  using (status = 'published' and generated_headline is not null and generated_article is not null);

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories"
  on public.categories for select
  to anon, authenticated
  using (is_active);

drop policy if exists "Public can read article tags for published articles" on public.article_tags;
create policy "Public can read article tags for published articles"
  on public.article_tags for select
  to anon, authenticated
  using (exists (
    select 1 from public.published_data p
    where p.id = article_id and p.status = 'published'
  ));

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

drop policy if exists "Public can read public notifications" on public.notifications;
create policy "Public can read public notifications"
  on public.notifications for select
  to anon, authenticated
  using (is_public and (expires_at is null or expires_at > now()));

drop policy if exists "Users can manage own notification reads" on public.notification_reads;
create policy "Users can manage own notification reads"
  on public.notification_reads for all
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Public can read active law acts" on public.law_acts;
create policy "Public can read active law acts"
  on public.law_acts for select
  to anon, authenticated
  using (is_active);

drop policy if exists "Public can read active law sections" on public.law_sections;
create policy "Public can read active law sections"
  on public.law_sections for select
  to anon, authenticated
  using (is_active);

drop policy if exists "Public can read article law links" on public.article_law_links;
create policy "Public can read article law links"
  on public.article_law_links for select
  to anon, authenticated
  using (exists (
    select 1 from public.published_data p
    where p.id = article_id and p.status = 'published'
  ));

drop policy if exists "Public can read active cyber cells" on public.cyber_cells;
create policy "Public can read active cyber cells"
  on public.cyber_cells for select
  to anon, authenticated
  using (is_active);

drop policy if exists "Public can read current scam spotlights" on public.scam_spotlights;
create policy "Public can read current scam spotlights"
  on public.scam_spotlights for select
  to anon, authenticated
  using (published_at <= now());

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

drop policy if exists "Users can update own report status fields" on public.reports;
create policy "Users can update own report status fields"
  on public.reports for update
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

drop policy if exists "Users can manage own reactions" on public.article_reactions;
create policy "Users can manage own reactions"
  on public.article_reactions for all
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Public can manage anonymous reactions" on public.article_reactions;
create policy "Public can manage anonymous reactions"
  on public.article_reactions for all
  to anon, authenticated
  using (user_id is null and anon_id_hash is not null)
  with check (user_id is null and anon_id_hash is not null);

drop policy if exists "Public can write anonymous view events" on public.article_view_events;
create policy "Public can write anonymous view events"
  on public.article_view_events for insert
  to anon, authenticated
  with check (article_id is not null);

drop policy if exists "Public can update article counters" on public.published_data;
create policy "Public can update article counters"
  on public.published_data for update
  to anon, authenticated
  using (status = 'published')
  with check (status = 'published');

drop policy if exists "Service role can read audit logs" on public.audit_logs;
create policy "Service role can read audit logs"
  on public.audit_logs for select
  to service_role
  using (true);

drop policy if exists "Authenticated can write own audit events" on public.audit_logs;
create policy "Authenticated can write own audit events"
  on public.audit_logs for insert
  to authenticated
  with check ((select auth.uid()) is not null and actor_id = (select auth.uid()));

grant select on public.published_data to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.article_tags to anon, authenticated;
grant select on public.notifications to anon, authenticated;
grant select on public.law_acts to anon, authenticated;
grant select on public.law_sections to anon, authenticated;
grant select on public.article_law_links to anon, authenticated;
grant select on public.cyber_cells to anon, authenticated;
grant select on public.scam_spotlights to anon, authenticated;

revoke all on public.reports from anon, authenticated;
revoke update on public.published_data from anon, authenticated;
revoke all on public.article_reactions from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant insert, update, delete on public.bookmarks to authenticated;
grant select, insert, update, delete on public.bookmarks to authenticated;
grant select, insert, update, delete on public.notification_reads to authenticated;
revoke all on public.reports from anon, authenticated;
grant insert on public.newsletter_subscribers to anon, authenticated;
grant insert on public.waitlist_entries to anon, authenticated;
grant insert on public.article_view_events to anon, authenticated;
revoke update on public.published_data from anon, authenticated;
revoke all on public.article_reactions from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

grant all on public.categories to service_role;
grant all on public.article_tags to service_role;
grant all on public.profiles to service_role;
grant all on public.bookmarks to service_role;
grant all on public.notifications to service_role;
grant all on public.notification_reads to service_role;
grant all on public.law_acts to service_role;
grant all on public.law_sections to service_role;
grant all on public.article_law_links to service_role;
grant all on public.cyber_cells to service_role;
grant all on public.scam_spotlights to service_role;
grant all on public.reports to service_role;
grant all on public.newsletter_subscribers to service_role;
grant all on public.waitlist_entries to service_role;
grant all on public.audit_logs to service_role;
grant all on public.article_reactions to service_role;
grant all on public.article_view_events to service_role;
