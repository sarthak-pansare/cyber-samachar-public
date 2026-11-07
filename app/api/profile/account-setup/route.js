import { handleAccountSetup } from '@/lib/auth-handlers';

export async function POST(request) {
  return handleAccountSetup(request);
}

export async function PATCH(request) {
  return handleAccountSetup(request);
}
