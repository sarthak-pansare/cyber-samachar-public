import { handleSession } from '@/lib/auth-handlers';

export async function GET(request) {
  return handleSession(request);
}

export async function POST(request) {
  return handleSession(request);
}
