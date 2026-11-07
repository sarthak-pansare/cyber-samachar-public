-- Historical duplicate cleanup is non-destructive by design.
-- This archives duplicate metadata for review and leaves row deletion/merging as
-- an explicit operator action after content owners approve the canonical rows.

create table if not exists public.published_data_duplicate_archive (
  id bigserial primary key,
  duplicate_key text not null,
  duplicate_type text not null,
  canonical_id uuid,
  duplicate_ids uuid[] not null,
  archived_at timestamptz not null default now()
);

insert into public.published_data_duplicate_archive (
  duplicate_key,
  duplicate_type,
  canonical_id,
  duplicate_ids
)
select
  original_url as duplicate_key,
  'original_url' as duplicate_type,
  (array_agg(id order by published_at desc nulls last, updated_at desc nulls last))[1] as canonical_id,
  array_remove(array_agg(id order by published_at desc nulls last, updated_at desc nulls last), (array_agg(id order by published_at desc nulls last, updated_at desc nulls last))[1]) as duplicate_ids
from public.published_data
where original_url is not null
group by original_url
having count(*) > 1
on conflict do nothing;

insert into public.published_data_duplicate_archive (
  duplicate_key,
  duplicate_type,
  canonical_id,
  duplicate_ids
)
select
  processed_id::text as duplicate_key,
  'processed_id' as duplicate_type,
  (array_agg(id order by published_at desc nulls last, updated_at desc nulls last))[1] as canonical_id,
  array_remove(array_agg(id order by published_at desc nulls last, updated_at desc nulls last), (array_agg(id order by published_at desc nulls last, updated_at desc nulls last))[1]) as duplicate_ids
from public.published_data
where processed_id is not null
group by processed_id
having count(*) > 1
on conflict do nothing;

alter table public.published_data_duplicate_archive enable row level security;
grant select on public.published_data_duplicate_archive to service_role;

-- Add these only after duplicate rows are merged, hidden, or deleted by an
-- approved data-maintenance run:
-- create unique index concurrently if not exists prime_raw_data_url_uidx
--   on public.prime_raw_data (url)
--   where url is not null;
-- create unique index concurrently if not exists processed_pending_prime_raw_data_id_uidx
--   on public.processed_pending (prime_raw_data_id)
--   where prime_raw_data_id is not null;
-- create unique index concurrently if not exists published_data_processed_id_uidx
--   on public.published_data (processed_id)
--   where processed_id is not null;
-- create unique index concurrently if not exists published_data_original_url_uidx
--   on public.published_data (original_url)
--   where original_url is not null;
