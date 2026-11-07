import {
  fallbackArticles,
  fallbackCategories,
  fallbackCyberCells,
  fallbackLawActs,
  fallbackLawSections,
  fallbackScam,
} from './fallback-data';
import { getContentClient } from './supabase';

const PAGE_SIZE = 12;

function normalizeArticle(row) {
  return {
    ...row,
    title: row.generated_headline || row.title || 'Untitled Cyber Samachar story',
    body: row.generated_article || row.body || row.content || '',
    summary:
      row.social_copy ||
      row.metadata?.meta_description ||
      row.summary ||
      String(row.generated_article || '').slice(0, 180),
    image: row.card_image_url || null,
    categories: Array.isArray(row.categories) ? row.categories : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    published_at: row.published_at || row.original_published_at || null,
  };
}

function filterArticles(rows, { cat = 'all', audience = 'all', q = '' } = {}) {
  const query = q.trim().toLowerCase();
  return rows
    .filter((article) => article.status === 'published')
    .filter((article) => {
      if (cat === 'all' || !cat) return true;
      return article.categories?.includes(cat) || article.tags?.includes(cat) || article.severity === cat;
    })
    .filter((article) => {
      if (!audience || audience === 'all') return true;
      if (audience === 'general') return article.is_general || article.track === 'general' || article.track === 'both';
      if (audience === 'professional') return article.is_technical || article.track === 'professional' || article.track === 'both';
      return true;
    })
    .filter((article) => {
      if (!query) return true;
      const haystack = [
        article.generated_headline,
        article.generated_article,
        article.social_copy,
        article.source_name,
        ...(article.categories || []),
        ...(article.tags || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    })
    .map(normalizeArticle);
}

export async function getFeed(options = {}) {
  const { cat = 'all', audience = 'all', q = '', page = 1, pageSize = PAGE_SIZE } = options;
  const client = getContentClient();

  if (client) {
    const { data, error } = await client.rpc('get_feed', {
      cat,
      audience,
      q,
      page,
      page_size: pageSize,
    });
    if (!error && data) return data.map(normalizeArticle);

    const { data: directData, error: directError } = await client
      .from('published_data')
      .select('*')
      .eq('status', 'published')
      .not('generated_headline', 'is', null)
      .not('generated_article', 'is', null)
      .order('published_at', { ascending: false })
      .range(
        Math.max(0, (Number(page) - 1) * Number(pageSize)),
        Math.max(0, (Number(page) - 1) * Number(pageSize)) + Number(pageSize) - 1,
      );
    if (!directError && directData) return filterArticles(directData.map(normalizeArticle), { cat, audience, q });
  }

  const start = Math.max(0, (Number(page) - 1) * Number(pageSize));
  return filterArticles(fallbackArticles, { cat, audience, q }).slice(start, start + Number(pageSize));
}

export async function getArticle(id) {
  const client = getContentClient();

  if (client) {
    const { data, error } = await client.rpc('get_article', { article_id: id });
    if (!error && data) {
      const result = Array.isArray(data) ? data[0] : data;
      const article = result?.article || result;
      if (article) return normalizeArticle(article);
    }

    const { data: directData, error: directError } = await client
      .from('published_data')
      .select('*')
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle();
    if (!directError && directData) return normalizeArticle(directData);
  }

  return fallbackArticles.map(normalizeArticle).find((article) => article.id === id) || null;
}

export async function getCategories() {
  const client = getContentClient();
  if (client) {
    const { data, error } = await client
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (!error && data) return data;
  }
  return fallbackCategories;
}

export async function getTicker() {
  const rows = await getFeed({ pageSize: 8 });
  return rows.filter((article) => article.is_breaking).concat(rows).slice(0, 8);
}

export async function getArchive(year = new Date().getFullYear()) {
  const client = getContentClient();
  if (client) {
    const { data, error } = await client.rpc('get_archive', { year: Number(year), audience: 'all' });
    if (!error && data) return data;

    const { data: directData, error: directError } = await client
      .from('published_data')
      .select('*')
      .eq('status', 'published')
      .gte('published_at', `${Number(year)}-01-01T00:00:00.000Z`)
      .lt('published_at', `${Number(year) + 1}-01-01T00:00:00.000Z`)
      .order('published_at', { ascending: false });
    if (!directError && directData) return directData.map(normalizeArticle);
  }
  return filterArticles(fallbackArticles)
    .filter((article) => !year || new Date(article.published_at).getFullYear() === Number(year))
    .map(normalizeArticle);
}

export async function getLawData() {
  const client = getContentClient();
  if (client) {
    const [acts, sections] = await Promise.all([
      client.from('law_acts').select('*').eq('is_active', true).order('display_order', { ascending: true }),
      client.from('law_sections').select('*').eq('is_active', true).order('section_number', { ascending: true }),
    ]);
    if (!acts.error && !sections.error) return { acts: acts.data, sections: sections.data };
  }
  return { acts: fallbackLawActs, sections: fallbackLawSections };
}

export async function getLawSection(id) {
  const { sections, acts } = await getLawData();
  const section = sections.find((row) => row.id === id);
  if (!section) return null;
  return { ...section, act: acts.find((act) => act.id === section.act_id) };
}

export async function getCyberCells() {
  const client = getContentClient();
  if (client) {
    const { data, error } = await client
      .from('cyber_cells')
      .select('*')
      .eq('is_active', true)
      .order('state', { ascending: true });
    if (!error && data) return data;
  }
  return fallbackCyberCells;
}

export async function getScamSpotlight() {
  const client = getContentClient();
  if (client) {
    const { data, error } = await client
      .from('scam_spotlights')
      .select('*')
      .eq('is_current', true)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) return data;
  }
  return fallbackScam;
}

export async function recordView(articleId, anonId = 'web') {
  const uuid = String(articleId || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    return { ok: false, reason: 'local_preview_article_id' };
  }
  const client = getContentClient();
  if (!client) return { ok: false, reason: 'supabase_not_configured' };
  const { error } = await client.rpc('record_article_view', { article_id: uuid, anon_id: anonId });
  return { ok: !error, error };
}
