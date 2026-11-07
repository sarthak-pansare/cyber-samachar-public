-- Public RPCs used by Cyber Samachar frontend plus constrained pipeline upserts.
-- Functions are SECURITY INVOKER unless noted by Supabase internals; service-role
-- grants, not frontend keys, gate pipeline-only writes.

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
    and (
      cat is null
      or cat = ''
      or cat = 'all'
      or p.categories::text ilike '%' || cat || '%'
    )
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
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', ls.id,
            'act_id', ls.act_id,
            'section_number', ls.section_number,
            'title_en', ls.title_en,
            'title_hi', ls.title_hi,
            'severity', ls.severity,
            'relevance', allinks.relevance
          )
          order by ls.act_id, ls.section_number
        )
        from public.article_law_links allinks
        join public.law_sections ls on ls.id = allinks.law_section_id
        where allinks.article_id = ca.id and ls.is_active
      ),
      '[]'::jsonb
    ) as related_laws,
    coalesce(
      (
        select jsonb_agg(to_jsonb(p.*) order by p.published_at desc)
        from (
          select p.*
          from public.published_data p
          where p.id <> ca.id
            and p.status = 'published'
            and (
              p.categories && ca.categories
              or p.tags && ca.tags
            )
          order by p.published_at desc
          limit 4
        ) p
      ),
      '[]'::jsonb
    ) as related_articles
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
    coalesce(
      array(select jsonb_array_elements_text(coalesce(payload->'mapped_sections', '[]'::jsonb))::uuid),
      '{}'
    ),
    coalesce(nullif(payload->>'consent_version', ''), 'v1'),
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
  mapped_sections uuid[],
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

create or replace function public.record_article_view(
  article_id uuid,
  anon_id text default null
)
returns jsonb
language sql
as $$
  select private.record_article_view(article_id, anon_id);
$$;

create or replace function public.toggle_article_like(
  article_id uuid,
  anon_id text default null
)
returns jsonb
language sql
as $$
  select private.toggle_article_like(article_id, anon_id);
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
  mapped_sections uuid[],
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
as $$
  select * from private.get_report_status(report_id);
$$;

create or replace function public.pipeline_upsert_processed_pending(row_data jsonb)
returns uuid
language plpgsql
as $$
declare
  row_id uuid := coalesce(nullif(row_data->>'id', '')::uuid, nullif(row_data->>'prime_raw_data_id', '')::uuid, gen_random_uuid());
begin
  insert into public.processed_pending(
    id,
    prime_raw_data_id,
    research_data,
    generated_article,
    generated_headline,
    image_prompt,
    card_image_url,
    metadata,
    categories,
    sub_categories,
    social_copy,
    track,
    is_general,
    is_technical,
    tags,
    severity,
    india_relevant,
    is_breaking,
    status
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
as $$
declare
  row_id uuid := coalesce(nullif(row_data->>'id', '')::uuid, nullif(row_data->>'processed_id', '')::uuid, gen_random_uuid());
begin
  insert into public.published_data(
    id,
    processed_id,
    generated_headline,
    generated_article,
    card_image_url,
    social_copy,
    metadata,
    categories,
    sub_categories,
    tags,
    severity,
    track,
    is_general,
    is_technical,
    india_relevant,
    is_breaking,
    source_name,
    source_domain,
    original_url,
    original_published_at,
    status
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
grant execute on function public.submit_report(jsonb) to authenticated;
grant execute on function public.get_report_status(uuid) to authenticated;
grant execute on function public.pipeline_upsert_processed_pending(jsonb) to service_role;
grant execute on function public.pipeline_upsert_published_data(jsonb) to service_role;
grant usage on schema private to anon, authenticated;
grant execute on function private.record_article_view(uuid, text) to anon, authenticated;
grant execute on function private.toggle_article_like(uuid, text) to anon, authenticated;
grant execute on function private.submit_report(jsonb) to authenticated;
grant execute on function private.get_report_status(uuid) to authenticated;
