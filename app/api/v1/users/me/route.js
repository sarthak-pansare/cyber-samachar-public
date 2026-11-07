import { handleGetMe } from '@/lib/auth-handlers';

export async function GET(request) {
  return handleGetMe(request);
}
