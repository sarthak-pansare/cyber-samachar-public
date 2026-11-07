import { handleAvatarUpload } from '@/lib/auth-handlers';

export async function POST(request) {
  return handleAvatarUpload(request);
}
