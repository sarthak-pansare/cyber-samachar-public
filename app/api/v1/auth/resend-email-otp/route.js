import { handleResendEmailOtp } from '@/lib/auth-handlers';

export async function POST(request) {
  return handleResendEmailOtp(request);
}
