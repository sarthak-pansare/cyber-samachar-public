import { handleResetPassword } from '@/lib/auth-handlers';

export async function POST(request) {
  return handleResetPassword(request);
}
