import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getUserAdminClient } from '@/lib/supabase';
import { requireSetupUser } from '@/lib/server-auth';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('cf-connecting-ip') || 'unknown';
  const limited = rateLimit(`comment:${ip}`, { limit: 8, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: 'Too many comments.' }, { status: 429 });

  const auth = await requireSetupUser(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const articleId = String(body.articleId || '').trim();
  const commentBody = String(body.body || '').trim();
  if (!articleId || commentBody.length < 3 || commentBody.length > 2000) {
    return NextResponse.json({ error: 'Comment must be 3-2000 characters.' }, { status: 400 });
  }

  const client = getUserAdminClient();
  if (!client) return NextResponse.json({ error: 'User database is not configured.' }, { status: 503 });

  const { data, error } = await client
    .from('article_comments')
    .insert({ article_id: articleId, user_id: auth.user.id, body: commentBody, status: 'pending' })
    .select('id,status,created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Could not submit comment.' }, { status: 500 });
  return NextResponse.json({ ok: true, comment: data });
}
