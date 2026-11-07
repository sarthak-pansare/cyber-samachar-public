import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getBearerToken, requireSetupUser } from '@/lib/server-auth';
import { getUserSessionClient } from '@/lib/supabase';
import { validateTurnstile } from '@/lib/turnstile';

const ALLOWED_FIELDS = [
  'crime_type',
  'city',
  'incident_at',
  'loss_amount',
  'channel',
  'mapped_sections',
  'consent_version',
  'sensitive_data_ciphertext',
];

function pickReportPayload(body) {
  return Object.fromEntries(
    ALLOWED_FIELDS
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [field, body[field]]),
  );
}

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('cf-connecting-ip') || 'unknown';
  const limited = rateLimit(`report:${ip}`, { limit: 3, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: 'Too many report submissions.' }, { status: 429 });

  if (process.env.REPORTS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Secure report submission is not enabled yet.' }, { status: 503 });
  }

  const auth = await requireSetupUser(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const turnstile = await validateTurnstile(body.turnstileToken, ip);
  if (!turnstile.ok) return NextResponse.json({ error: 'Verification failed.' }, { status: 403 });

  const payload = pickReportPayload(body);
  if (!payload.crime_type || !payload.consent_version || !payload.sensitive_data_ciphertext) {
    return NextResponse.json({ error: 'Encrypted report payload and consent are required.' }, { status: 400 });
  }

  const client = getUserSessionClient(getBearerToken(request));
  if (!client) return NextResponse.json({ error: 'User database is not configured.' }, { status: 503 });

  const { data, error } = await client.rpc('submit_report', { payload });
  if (error) return NextResponse.json({ error: 'Could not submit report.' }, { status: 500 });

  return NextResponse.json({ ok: true, reportId: data });
}
