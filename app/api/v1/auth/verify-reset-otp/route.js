import { handleVerifyResetOtp } from '@/lib/auth-handlers';

export async function POST(request) {
  return handleVerifyResetOtp(request);
}
