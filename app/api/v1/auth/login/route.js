import { handleLogin } from '@/lib/auth-handlers';

export async function POST(request) {
  return handleLogin(request);
}
