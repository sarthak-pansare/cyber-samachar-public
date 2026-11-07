import { handleLogout } from '@/lib/auth-handlers';

export async function POST(request) {
  return handleLogout(request);
}
