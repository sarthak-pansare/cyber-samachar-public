import { handleLikedArticles } from '@/lib/auth-handlers';

export async function GET(request) {
  return handleLikedArticles(request);
}

export async function POST(request) {
  return handleLikedArticles(request);
}
