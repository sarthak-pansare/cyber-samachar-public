import { handleBrowserCallback, handleCallback } from '@/lib/auth-handlers';

export async function GET(request) {
  return handleCallback(request);
}

export async function POST(request) {
  return handleBrowserCallback(request);
}
