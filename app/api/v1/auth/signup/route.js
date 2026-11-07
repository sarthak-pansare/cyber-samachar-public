import { handleSignup } from '@/lib/auth-handlers';

export async function POST(request) {
  return handleSignup(request);
}
