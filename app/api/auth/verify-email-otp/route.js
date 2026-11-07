import { handleVerifyEmailOtp } from '@/lib/auth-handlers';

export async function POST(request) {
  return handleVerifyEmailOtp(request);
}
