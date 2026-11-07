import { handlePreferences } from '@/lib/auth-handlers';

export async function POST(request) {
  return handlePreferences(request);
}

export async function PATCH(request) {
  return handlePreferences(request);
}
