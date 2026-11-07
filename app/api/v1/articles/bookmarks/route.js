import { handleBookmarks } from '@/lib/auth-handlers';

export async function GET(request) {
  return handleBookmarks(request);
}

export async function POST(request) {
  return handleBookmarks(request);
}
