import { NextResponse } from 'next/server';
import { recordView } from '@/lib/content';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request, { params }) {
  const { id } = await params;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('cf-connecting-ip') || 'unknown';
  const limited = rateLimit(`article-view:${ip}:${id}`, { limit: 12, windowMs: 60_000 });

  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many view events.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const result = await recordView(id, body.anonId || ip);
  return NextResponse.json({ ok: true, recorded: result.ok, reason: result.reason || null });
}
