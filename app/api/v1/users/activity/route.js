import { handleReadingHistory } from '@/lib/auth-handlers';

export async function GET(request) {
  return handleReadingHistory(request);
}
