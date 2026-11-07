import { rateLimit } from '@/lib/rate-limit';
import { handlePreferences } from '@/lib/auth-handlers';
import { getClientIp } from '@/lib/auth-session';

export async function POST(request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`profile-preferences:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return Response.json({ error: 'Too many profile updates.' }, { status: 429 });
  return handlePreferences(request);
}
