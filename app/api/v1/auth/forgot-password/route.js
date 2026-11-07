import { handleForgotPassword } from '@/lib/auth-handlers';

export async function POST(request) {
  return handleForgotPassword(request);
}
