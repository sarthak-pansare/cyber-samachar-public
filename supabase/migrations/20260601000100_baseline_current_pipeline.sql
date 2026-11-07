-- Baseline for the existing CYBERINTEL pipeline tables.
-- These definitions are intentionally additive. On the live project, the tables
-- already exist; this file lets local Supabase resets and static review tools
-- understand the columns used by Cyber Samachar backend migrations.

create extension if not exists pgcrypto with schema extensions;

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

alter table public.prime_raw_data enable row level security;
alter table public.processed_pending enable row level security;
alter table public.published_data enable row level security;

grant select on public.published_data to anon, authenticated;
grant all on public.prime_raw_data to service_role;
grant all on public.processed_pending to service_role;
grant all on public.published_data to service_role;
