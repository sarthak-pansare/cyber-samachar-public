import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getContentClient } from '@/lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request, { params }) {
  const { id } = await params;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('cf-connecting-ip') || 'unknown';
  const limited = rateLimit(`article-like:${ip}:${id}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: 'Too many reactions.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  if (!UUID_RE.test(String(id))) return NextResponse.json({ ok: true, mode: 'local-preview' });

  const client = getContentClient();
  if (!client) return NextResponse.json({ ok: true, mode: 'local-preview' });

  const { data, error } = await client.rpc('toggle_article_like', {
    article_id: id,
    anon_id: body.anonId || ip,
  });

  if (error) return NextResponse.json({ error: 'Could not update reaction.' }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
