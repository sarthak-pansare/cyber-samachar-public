import { rateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/auth-session';
import { handleBookmarks } from '@/lib/auth-handlers';

export async function GET(request) {
  return handleBookmarks(request);
}

export async function POST(request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`bookmark:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!limited.ok) return Response.json({ error: 'Too many bookmark updates.' }, { status: 429 });
  return handleBookmarks(request);
}
