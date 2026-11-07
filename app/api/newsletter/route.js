import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getUserAdminClient } from '@/lib/supabase';
import { validateTurnstile } from '@/lib/turnstile';
import { environmentSourceName } from '@/lib/environment-policy';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('cf-connecting-ip') || 'unknown';
  const limited = rateLimit(`newsletter:${ip}`, { limit: 4, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: 'Too many submissions. Try again shortly.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });

  const turnstile = await validateTurnstile(body.turnstileToken, ip);
  if (!turnstile.ok) return NextResponse.json({ error: 'Verification failed.' }, { status: 403 });

  const client = getUserAdminClient();
  if (!client) return NextResponse.json({ ok: true, mode: 'local-preview' });

  const { error } = await client
    .from('newsletter_subscribers')
    .upsert({
      email,
      name: body.name || null,
      source: environmentSourceName(body.source || 'website'),
      status: 'active',
      consent_version: body.consentVersion || 'v1-content-mvp',
    }, { onConflict: 'email' });

  if (error) return NextResponse.json({ error: 'Could not save subscription.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
