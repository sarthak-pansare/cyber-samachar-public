import { handleReadingHistory } from '@/lib/auth-handlers';

export async function GET(request) {
  return handleReadingHistory(request);
}

export async function POST(request) {
  return handleReadingHistory(request);
}
