import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const ACCESS_COOKIE = 'cs_access_token';
export const REFRESH_COOKIE = 'cs_refresh_token';
export const SESSION_COOKIE = 'cs_session_id';
export const RESET_VERIFICATION_COOKIE = 'cs_reset_verified';
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;
export const RESET_VERIFICATION_MAX_AGE = 60 * 10;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_RE = /^[a-z0-9]{3,30}$/;

export function getClientIp(request) {
  return (
    request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  );
}

export function getUserAgent(request) {
  return request.headers.get('user-agent') || 'unknown';
}

export function hashValue(value) {
  if (!value) return null;
  return createHash('sha256').update(String(value)).digest('hex');
}

export function getAccessTokenFromRequest(request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : request.cookies.get(ACCESS_COOKIE)?.value || null;
}

export function getRefreshTokenFromRequest(request) {
  return request.cookies.get(REFRESH_COOKIE)?.value || null;
}

function cookieOptions(remember = false) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };

  if (remember) options.maxAge = REMEMBER_MAX_AGE;
  return options;
}

export function setAuthCookies(response, session, remember = false) {
  if (!session?.access_token || !session?.refresh_token) return response;

  response.cookies.set(ACCESS_COOKIE, session.access_token, cookieOptions(remember));
  response.cookies.set(REFRESH_COOKIE, session.refresh_token, cookieOptions(remember));
  response.cookies.set(SESSION_COOKIE, hashValue(session.access_token).slice(0, 24), {
    ...cookieOptions(remember),
    httpOnly: false,
  });
  return response;
}

function resetVerificationSecret() {
  return process.env.AUTH_RESET_COOKIE_SECRET || process.env.USER_DB_SERVICE_KEY || '';
}

export function createResetVerification(userId, now = Math.floor(Date.now() / 1000)) {
  const secret = resetVerificationSecret();
  if (!secret || !userId) return null;
  const expiresAt = now + RESET_VERIFICATION_MAX_AGE;
  const payload = `${userId}.${expiresAt}`;
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyResetVerification(value, userId, now = Math.floor(Date.now() / 1000)) {
  const secret = resetVerificationSecret();
  const parts = String(value || '').split('.');
  if (!secret || !userId || parts.length !== 3) return false;
  const [signedUserId, expiresAtText, suppliedSignature] = parts;
  const expiresAt = Number(expiresAtText);
  if (signedUserId !== userId || !Number.isFinite(expiresAt) || expiresAt < now) return false;

  const expectedSignature = createHmac('sha256', secret)
    .update(`${signedUserId}.${expiresAtText}`)
    .digest('base64url');
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function setResetVerificationCookie(response, userId) {
  const value = createResetVerification(userId);
  if (!value) return response;
  response.cookies.set(RESET_VERIFICATION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: RESET_VERIFICATION_MAX_AGE,
  });
  return response;
}

export function verifyResetVerificationCookie(request, userId) {
  return verifyResetVerification(request.cookies.get(RESET_VERIFICATION_COOKIE)?.value, userId);
}

export function clearResetVerificationCookie(response) {
  response.cookies.set(RESET_VERIFICATION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}

export function clearAuthCookies(response) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, RESET_VERIFICATION_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: name !== SESSION_COOKIE,
      secure: process.env.NODE_ENV === 'production',
      sameSite: name === RESET_VERIFICATION_COOKIE ? 'strict' : 'lax',
      path: '/',
      maxAge: 0,
    });
  }
  return response;
}

export function buildRedirectUrl(request, path = '/api/v1/auth/callback') {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  const origin = configured || new URL(request.url).origin;
  return new URL(path, origin).toString();
}

export function validatePassword(password, email = '') {
  const problems = [];
  const localPart = String(email).split('@')[0]?.toLowerCase();
  const value = String(password || '');

  if (value.length < 12) problems.push('Password must be at least 12 characters.');
  if (!/[a-z]/.test(value)) problems.push('Password must include a lowercase letter.');
  if (!/[A-Z]/.test(value)) problems.push('Password must include an uppercase letter.');
  if (!/[0-9]/.test(value)) problems.push('Password must include a number.');
  if (localPart && localPart.length >= 3 && value.toLowerCase().includes(localPart)) {
    problems.push('Password must not include your email name.');
  }

  return {
    ok: problems.length === 0,
    problems,
  };
}

export function publicUser(user, profile = null) {
  const emailVerified = Boolean(user?.email_confirmed_at || user?.confirmed_at);
  return {
    id: user?.id,
    email: user?.email || profile?.email || null,
    emailVerified,
    app_metadata: user?.app_metadata || {},
    accountSetupCompleted: Boolean(profile?.account_setup_completed),
    accountStatus: profile?.account_status || (emailVerified ? 'pending_setup' : 'pending_verification'),
    profile: profile
      ? {
          fullName: profile.full_name || profile.display_name || null,
          username: profile.username || null,
          profession: profile.profession || null,
          organization: profile.organization_company || profile.organization || null,
          country: profile.country || null,
          state: profile.state || null,
          city: profile.city || null,
          avatarPath: profile.profile_photo_path || null,
          bio: profile.bio || null,
          interests: profile.interests || profile.preferred_categories || [],
          socialLinks: profile.social_links || {},
          role: profile.role || 'reader',
          subscriptionStatus: profile.subscription_status || 'free',
        }
      : null,
  };
}
