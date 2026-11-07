-- Cyber Samachar Phase 1.5 content-db schema.
-- Target project: content-db cawwrszyytuerotvykpw.
-- This file is additive and must not drop existing CYBERINTEL pipeline tables.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.prime_raw_data (
  id uuid primary key default gen_random_uuid(),
  url text,
  title text,
  description text,
  full_content text,
  source_name text,
  source_domain text,
  published_at timestamptz,
  status text default 'pending',
  track text,
  is_general boolean default true,
  is_technical boolean default false,
  tags text[] default '{}',
  severity text default 'info',
  india_relevant boolean default false,
  is_breaking boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processed_pending (
  id uuid primary key default gen_random_uuid(),
  prime_raw_data_id uuid,
  research_data jsonb default '{}'::jsonb,
  generated_article text,
  generated_headline text,
  image_prompt text,
  card_image_url text,
  metadata jsonb default '{}'::jsonb,
  plagiarism_checked boolean default false,
  plagiarism_score numeric,
  source_verified boolean default false,
  categories text[] default '{}',
  sub_categories text[] default '{}',
  social_copy text,
  track text,
  is_general boolean default true,
  is_technical boolean default false,
  tags text[] default '{}',
  severity text default 'info',
  india_relevant boolean default false,
  is_breaking boolean default false,
  status text default 'pending',
  processed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.published_data (
  id uuid primary key default gen_random_uuid(),
  processed_id uuid,
  generated_headline text,
  generated_article text,
  card_image_url text,
  social_copy text,
  metadata jsonb default '{}'::jsonb,
  categories text[] default '{}',
  sub_categories text[] default '{}',
  tags text[] default '{}',
  severity text default 'info',
  track text,
  is_general boolean default true,
  is_technical boolean default false,
  india_relevant boolean default false,
  is_breaking boolean default false,
  source_name text,
  source_domain text,
  original_url text,
  original_published_at timestamptz,
  published_at timestamptz not null default now(),
  status text default 'draft',
  view_count bigint not null default 0,
  share_count bigint not null default 0,
  like_count bigint not null default 0,
  save_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

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

create table if not exists public.article_reactions (
  article_id uuid not null references public.published_data(id) on delete cascade,
  user_id uuid,
  anon_id_hash text,
  reaction_type text not null default 'like',
  created_at timestamptz not null default now(),
  check (user_id is not null or anon_id_hash is not null)
);

create table if not exists public.article_view_events (
  id bigserial primary key,
  article_id uuid not null references public.published_data(id) on delete cascade,
  user_id uuid,
  anon_id_hash text,
  viewed_at timestamptz not null default now()
);

create table if not exists public.published_data_duplicate_archive (
  id bigserial primary key,
  duplicate_key text not null,
  duplicate_type text not null,
  canonical_id uuid,
  duplicate_ids uuid[] not null,
  archived_at timestamptz not null default now()
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

alter table public.prime_raw_data enable row level security;
alter table public.processed_pending enable row level security;
alter table public.published_data enable row level security;
alter table public.categories enable row level security;
alter table public.article_tags enable row level security;
alter table public.notifications enable row level security;
alter table public.law_acts enable row level security;
alter table public.law_sections enable row level security;
alter table public.article_law_links enable row level security;
alter table public.cyber_cells enable row level security;
alter table public.scam_spotlights enable row level security;
alter table public.article_reactions enable row level security;
alter table public.article_view_events enable row level security;
alter table public.published_data_duplicate_archive enable row level security;

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

drop policy if exists "Public can read public notifications" on public.notifications;
create policy "Public can read public notifications"
  on public.notifications for select
  to anon, authenticated
  using (is_public and (expires_at is null or expires_at > now()));

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

grant select on public.published_data to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.article_tags to anon, authenticated;
grant select on public.notifications to anon, authenticated;
grant select on public.law_acts to anon, authenticated;
grant select on public.law_sections to anon, authenticated;
grant select on public.article_law_links to anon, authenticated;
grant select on public.cyber_cells to anon, authenticated;
grant select on public.scam_spotlights to anon, authenticated;

revoke all on public.prime_raw_data from anon, authenticated;
revoke all on public.processed_pending from anon, authenticated;
revoke insert, update, delete on public.published_data from anon, authenticated;
revoke all on public.article_reactions from anon, authenticated;
revoke all on public.article_view_events from anon, authenticated;
revoke all on public.published_data_duplicate_archive from anon, authenticated;

grant all on public.prime_raw_data to service_role;
grant all on public.processed_pending to service_role;
grant all on public.published_data to service_role;
grant all on public.categories to service_role;
grant all on public.article_tags to service_role;
grant all on public.notifications to service_role;
grant all on public.law_acts to service_role;
grant all on public.law_sections to service_role;
grant all on public.article_law_links to service_role;
grant all on public.cyber_cells to service_role;
grant all on public.scam_spotlights to service_role;
grant all on public.article_reactions to service_role;
grant all on public.article_view_events to service_role;
grant all on public.published_data_duplicate_archive to service_role;

create schema if not exists private;
revoke all on schema private from public;

create or replace function public.get_feed(
  cat text default null,
  audience text default 'all',
  q text default null,
  page integer default 1,
  page_size integer default 20
)
returns setof public.published_data
language sql
stable
as $$
  select p.*
  from public.published_data p
  where p.status = 'published'
    and p.generated_headline is not null
    and p.generated_article is not null
    and (cat is null or cat = '' or cat = 'all' or p.categories::text ilike '%' || cat || '%')
    and (
      audience is null
      or audience = ''
      or audience = 'all'
      or (audience = 'general' and coalesce(p.is_general, false))
      or (audience = 'professional' and coalesce(p.is_technical, false))
    )
    and (
      q is null
      or q = ''
      or p.generated_headline ilike '%' || q || '%'
      or p.generated_article ilike '%' || q || '%'
      or p.tags::text ilike '%' || q || '%'
    )
  order by p.published_at desc
  limit least(greatest(coalesce(page_size, 20), 1), 50)
  offset greatest(coalesce(page, 1) - 1, 0) * least(greatest(coalesce(page_size, 20), 1), 50);
$$;

create or replace function public.get_article(article_id uuid)
returns table (
  article jsonb,
  related_laws jsonb,
  related_articles jsonb
)
language sql
stable
as $$
  with current_article as (
    select *
    from public.published_data
    where id = article_id and status = 'published'
    limit 1
  )
  select
    to_jsonb(ca.*) as article,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ls.id,
        'act_id', ls.act_id,
        'section_number', ls.section_number,
        'title_en', ls.title_en,
        'title_hi', ls.title_hi,
        'severity', ls.severity,
        'relevance', allinks.relevance
      ) order by ls.act_id, ls.section_number)
      from public.article_law_links allinks
      join public.law_sections ls on ls.id = allinks.law_section_id
      where allinks.article_id = ca.id and ls.is_active
    ), '[]'::jsonb) as related_laws,
    coalesce((
      select jsonb_agg(to_jsonb(p.*) order by p.published_at desc)
      from (
        select p.*
        from public.published_data p
        where p.id <> ca.id
          and p.status = 'published'
          and (p.categories && ca.categories or p.tags && ca.tags)
        order by p.published_at desc
        limit 4
      ) p
    ), '[]'::jsonb) as related_articles
  from current_article ca;
$$;

create or replace function public.get_archive(
  year integer default extract(year from now())::integer,
  audience text default 'all'
)
returns table (
  archive_year integer,
  archive_month integer,
  total_count bigint,
  critical_count bigint,
  breach_count bigint,
  articles jsonb
)
language sql
stable
as $$
  select
    extract(year from p.published_at)::integer as archive_year,
    extract(month from p.published_at)::integer as archive_month,
    count(*) as total_count,
    count(*) filter (where p.severity in ('critical', 'high')) as critical_count,
    count(*) filter (where p.categories::text ilike '%breach%') as breach_count,
    jsonb_agg(to_jsonb(p.*) order by p.published_at desc) as articles
  from public.published_data p
  where p.status = 'published'
    and extract(year from p.published_at)::integer = year
    and (
      audience is null
      or audience = ''
      or audience = 'all'
      or (audience = 'general' and coalesce(p.is_general, false))
      or (audience = 'professional' and coalesce(p.is_technical, false))
    )
  group by 1, 2
  order by 1 desc, 2 desc;
$$;

create or replace function private.record_article_view(
  article_id uuid,
  anon_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor uuid := auth.uid();
  anon_hash text := case when anon_id is null or anon_id = '' then null else encode(digest(anon_id, 'sha256'), 'hex') end;
  new_count bigint;
begin
  insert into public.article_view_events(article_id, user_id, anon_id_hash)
  values (article_id, actor, anon_hash);

  update public.published_data
  set view_count = coalesce(view_count, 0) + 1,
      updated_at = now()
  where id = article_id and status = 'published'
  returning view_count into new_count;

  return jsonb_build_object('article_id', article_id, 'view_count', coalesce(new_count, 0));
end;
$$;

create or replace function private.toggle_article_like(
  article_id uuid,
  anon_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor uuid := auth.uid();
  anon_hash text := case when anon_id is null or anon_id = '' then null else encode(digest(anon_id, 'sha256'), 'hex') end;
  removed_count integer;
  liked boolean;
  new_count bigint;
begin
  if actor is null and anon_hash is null then
    raise exception 'anon_id is required when the user is not authenticated';
  end if;

  if actor is not null then
    delete from public.article_reactions
    where article_reactions.article_id = toggle_article_like.article_id
      and user_id = actor
      and reaction_type = 'like';
  else
    delete from public.article_reactions
    where article_reactions.article_id = toggle_article_like.article_id
      and anon_id_hash = anon_hash
      and reaction_type = 'like';
  end if;

  get diagnostics removed_count = row_count;
  liked := removed_count = 0;

  if liked then
    insert into public.article_reactions(article_id, user_id, anon_id_hash, reaction_type)
    values (article_id, actor, anon_hash, 'like');
  end if;

  update public.published_data p
  set like_count = (
        select count(*)
        from public.article_reactions r
        where r.article_id = p.id and r.reaction_type = 'like'
      ),
      updated_at = now()
  where p.id = article_id
  returning p.like_count into new_count;

  return jsonb_build_object('article_id', article_id, 'liked', liked, 'like_count', coalesce(new_count, 0));
end;
$$;

create or replace function public.record_article_view(article_id uuid, anon_id text default null)
returns jsonb
language sql
as $$
  select private.record_article_view(article_id, anon_id);
$$;

create or replace function public.toggle_article_like(article_id uuid, anon_id text default null)
returns jsonb
language sql
as $$
  select private.toggle_article_like(article_id, anon_id);
$$;

create or replace function public.pipeline_upsert_processed_pending(row_data jsonb)
returns uuid
language plpgsql
set search_path = public, extensions
as $$
declare
  row_id uuid := coalesce(nullif(row_data->>'id', '')::uuid, nullif(row_data->>'prime_raw_data_id', '')::uuid, gen_random_uuid());
begin
  insert into public.processed_pending(
    id, prime_raw_data_id, research_data, generated_article, generated_headline,
    image_prompt, card_image_url, metadata, categories, sub_categories, social_copy,
    track, is_general, is_technical, tags, severity, india_relevant, is_breaking, status
  )
  values (
    row_id,
    nullif(row_data->>'prime_raw_data_id', '')::uuid,
    coalesce(row_data->'research_data', '{}'::jsonb),
    row_data->>'generated_article',
    row_data->>'generated_headline',
    row_data->>'image_prompt',
    row_data->>'card_image_url',
    coalesce(row_data->'metadata', '{}'::jsonb),
    coalesce(array(select jsonb_array_elements_text(coalesce(row_data->'categories', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(row_data->'sub_categories', '[]'::jsonb))), '{}'),
    row_data->>'social_copy',
    row_data->>'track',
    coalesce((row_data->>'is_general')::boolean, true),
    coalesce((row_data->>'is_technical')::boolean, false),
    coalesce(array(select jsonb_array_elements_text(coalesce(row_data->'tags', '[]'::jsonb))), '{}'),
    coalesce(row_data->>'severity', 'info'),
    coalesce((row_data->>'india_relevant')::boolean, false),
    coalesce((row_data->>'is_breaking')::boolean, false),
    coalesce(row_data->>'status', 'pending')
  )
  on conflict (id) do update
  set research_data = excluded.research_data,
      generated_article = excluded.generated_article,
      generated_headline = excluded.generated_headline,
      image_prompt = excluded.image_prompt,
      card_image_url = excluded.card_image_url,
      metadata = excluded.metadata,
      categories = excluded.categories,
      sub_categories = excluded.sub_categories,
      social_copy = excluded.social_copy,
      track = excluded.track,
      is_general = excluded.is_general,
      is_technical = excluded.is_technical,
      tags = excluded.tags,
      severity = excluded.severity,
      india_relevant = excluded.india_relevant,
      is_breaking = excluded.is_breaking,
      status = excluded.status,
      updated_at = now();

  return row_id;
end;
$$;

create or replace function public.pipeline_upsert_published_data(row_data jsonb)
returns uuid
language plpgsql
set search_path = public, extensions
as $$
declare
  row_id uuid := coalesce(nullif(row_data->>'id', '')::uuid, nullif(row_data->>'processed_id', '')::uuid, gen_random_uuid());
begin
  insert into public.published_data(
    id, processed_id, generated_headline, generated_article, card_image_url,
    social_copy, metadata, categories, sub_categories, tags, severity, track,
    is_general, is_technical, india_relevant, is_breaking, source_name,
    source_domain, original_url, original_published_at, status
  )
  values (
    row_id,
    nullif(row_data->>'processed_id', '')::uuid,
    row_data->>'generated_headline',
    row_data->>'generated_article',
    row_data->>'card_image_url',
    row_data->>'social_copy',
    coalesce(row_data->'metadata', '{}'::jsonb),
    coalesce(array(select jsonb_array_elements_text(coalesce(row_data->'categories', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(row_data->'sub_categories', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(row_data->'tags', '[]'::jsonb))), '{}'),
    coalesce(row_data->>'severity', 'info'),
    row_data->>'track',
    coalesce((row_data->>'is_general')::boolean, true),
    coalesce((row_data->>'is_technical')::boolean, false),
    coalesce((row_data->>'india_relevant')::boolean, false),
    coalesce((row_data->>'is_breaking')::boolean, false),
    row_data->>'source_name',
    row_data->>'source_domain',
    row_data->>'original_url',
    nullif(row_data->>'original_published_at', '')::timestamptz,
    coalesce(row_data->>'status', 'published')
  )
  on conflict (id) do update
  set processed_id = excluded.processed_id,
      generated_headline = excluded.generated_headline,
      generated_article = excluded.generated_article,
      card_image_url = excluded.card_image_url,
      social_copy = excluded.social_copy,
      metadata = excluded.metadata,
      categories = excluded.categories,
      sub_categories = excluded.sub_categories,
      tags = excluded.tags,
      severity = excluded.severity,
      track = excluded.track,
      is_general = excluded.is_general,
      is_technical = excluded.is_technical,
      india_relevant = excluded.india_relevant,
      is_breaking = excluded.is_breaking,
      source_name = excluded.source_name,
      source_domain = excluded.source_domain,
      original_url = excluded.original_url,
      original_published_at = excluded.original_published_at,
      status = excluded.status,
      updated_at = now();

  return row_id;
end;
$$;

grant execute on function public.get_feed(text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_article(uuid) to anon, authenticated;
grant execute on function public.get_archive(integer, text) to anon, authenticated;
grant execute on function public.record_article_view(uuid, text) to anon, authenticated;
grant execute on function public.toggle_article_like(uuid, text) to anon, authenticated;
grant execute on function public.pipeline_upsert_processed_pending(jsonb) to service_role;
grant execute on function public.pipeline_upsert_published_data(jsonb) to service_role;
grant usage on schema private to anon, authenticated;
grant execute on function private.record_article_view(uuid, text) to anon, authenticated;
grant execute on function private.toggle_article_like(uuid, text) to anon, authenticated;

insert into public.published_data_duplicate_archive (duplicate_key, duplicate_type, canonical_id, duplicate_ids)
select
  original_url,
  'original_url',
  (array_agg(id order by published_at desc nulls last, updated_at desc nulls last))[1],
  array_remove(array_agg(id order by published_at desc nulls last, updated_at desc nulls last), (array_agg(id order by published_at desc nulls last, updated_at desc nulls last))[1])
from public.published_data
where original_url is not null
group by original_url
having count(*) > 1
on conflict do nothing;

insert into public.published_data_duplicate_archive (duplicate_key, duplicate_type, canonical_id, duplicate_ids)
select
  processed_id::text,
  'processed_id',
  (array_agg(id order by published_at desc nulls last, updated_at desc nulls last))[1],
  array_remove(array_agg(id order by published_at desc nulls last, updated_at desc nulls last), (array_agg(id order by published_at desc nulls last, updated_at desc nulls last))[1])
from public.published_data
where processed_id is not null
group by processed_id
having count(*) > 1
on conflict do nothing;

insert into public.categories (id, label_en, icon_key, display_order)
values
  ('malware', 'Malware', 'bug', 10),
  ('breach', 'Data Breach', 'database', 20),
  ('scam', 'Scam/Fraud', 'shield-alert', 30),
  ('regulation', 'Regulation', 'scale', 40),
  ('apt', 'APT Activity', 'radar', 50),
  ('vulnerability', 'Vulnerability', 'scan', 60)
on conflict (id) do update
set label_en = excluded.label_en,
    icon_key = excluded.icon_key,
    display_order = excluded.display_order,
    is_active = true,
    updated_at = now();

insert into public.law_acts (id, name_en, short_name, display_order, is_active)
values
  ('it-act-2000', 'Information Technology Act, 2000', 'IT Act', 10, true),
  ('bns-2023', 'Bharatiya Nyaya Sanhita, 2023', 'BNS', 20, true),
  ('dpdp-2023', 'Digital Personal Data Protection Act, 2023', 'DPDP', 30, true)
on conflict (id) do update
set name_en = excluded.name_en,
    short_name = excluded.short_name,
    display_order = excluded.display_order,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.law_sections (act_id, section_number, title_en, description_en, severity)
values
  ('it-act-2000', '43', 'Penalty and compensation for damage to computer systems', 'Civil liability for unauthorized access, downloads, disruption, or damage to computer systems.', 'moderate'),
  ('it-act-2000', '66', 'Computer-related offences', 'Criminal liability for dishonest or fraudulent computer-related acts.', 'high'),
  ('it-act-2000', '66C', 'Identity theft', 'Covers fraudulent or dishonest use of electronic signatures, passwords, or unique identification features.', 'high'),
  ('it-act-2000', '66D', 'Cheating by personation using computer resource', 'Covers phishing, impersonation, and online cheating using digital systems.', 'high'),
  ('dpdp-2023', '8', 'Obligations of Data Fiduciary', 'Requires lawful processing, security safeguards, breach notices, and deletion when purpose is complete.', 'high')
on conflict (act_id, section_number) do update
set title_en = excluded.title_en,
    description_en = excluded.description_en,
    severity = excluded.severity,
    is_active = true,
    updated_at = now();

insert into public.scam_spotlights (week_start, issue_number, title_en, hook_en, body_en, loss_figure, is_current)
values (
  date_trunc('week', now())::date,
  1,
  'OTP Relay Scams',
  'Fraudsters pressure victims to reveal OTPs during fake support calls.',
  'Never share OTPs, UPI PINs, or screen-share access with callers claiming to be from banks, delivery companies, or support desks.',
  'Varies by victim',
  true
)
on conflict do nothing;

-- Add these only after duplicate rows are merged, hidden, or deleted by an approved data-maintenance run:
-- create unique index concurrently if not exists prime_raw_data_url_uidx on public.prime_raw_data (url) where url is not null;
-- create unique index concurrently if not exists processed_pending_prime_raw_data_id_uidx on public.processed_pending (prime_raw_data_id) where prime_raw_data_id is not null;
-- create unique index concurrently if not exists published_data_processed_id_uidx on public.published_data (processed_id) where processed_id is not null;
-- create unique index concurrently if not exists published_data_original_url_uidx on public.published_data (original_url) where original_url is not null;
