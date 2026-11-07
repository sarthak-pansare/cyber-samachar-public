import { NextResponse } from 'next/server';
import {
  buildRedirectUrl,
  clearAuthCookies,
  clearResetVerificationCookie,
  EMAIL_RE,
  getAccessTokenFromRequest,
  getClientIp,
  getRefreshTokenFromRequest,
  getUserAgent,
  hashValue,
  publicUser,
  setResetVerificationCookie,
  setAuthCookies,
  USERNAME_RE,
  validatePassword,
  verifyResetVerificationCookie,
} from './auth-session';
import { rateLimit } from './rate-limit';
import { getUserAdminClient, getUserAnonClient, getUserSessionClient } from './supabase';
import { getRequestProfile, getRequestUser, profileIsBlocked, requireSetupUser, requireVerifiedUser } from './server-auth';
import { validateTurnstile } from './turnstile';
import {
  environmentEventName,
  getEnvironmentPolicy,
  isEmailDeliveryAllowed,
} from './environment-policy';

const PROFILE_SELECT = '*';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function json(data, init) {
  return NextResponse.json(data, init);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanText(value, max = 500) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function cleanArray(value, max = 40) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, max)
    : [];
}

function cleanObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanOtp(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

async function requireTurnstile(request, body) {
  const token = body.turnstileToken || body.turnstile_token || body.cfTurnstileResponse || body['cf-turnstile-response'];
  const ip = getClientIp(request);
  const result = await validateTurnstile(token, ip === 'unknown' ? null : ip);
  if (result.ok) return null;

  return json({
    error: 'Verification failed. Please try again.',
    code: result.reason || 'turnstile_failed',
  }, { status: 403 });
}

async function writeSecurityEvent(request, eventType, payload = {}) {
  const client = getUserAdminClient();
  if (!client) return;

  const ip = getClientIp(request);
  const environment = getEnvironmentPolicy();
  const recordedEventType = environmentEventName(eventType);
  await client.from('security_events').insert({
    user_id: payload.userId || null,
    email: payload.email || null,
    event: recordedEventType,
    event_type: recordedEventType,
    severity: payload.severity || 'info',
    ip_address: ip === 'unknown' ? null : ip,
    user_agent: getUserAgent(request),
    metadata: {
      ...(payload.metadata || {}),
      app_env: environment.appEnv,
    },
  });
}

function emailDeliveryResponse(email) {
  if (isEmailDeliveryAllowed(email)) return null;
  return json({
    error: 'This email address is not approved for testing in this environment.',
    code: 'email_not_allowlisted',
  }, { status: 403 });
}

async function getProfile(userId) {
  const client = getUserAdminClient();
  if (!client || !userId) return null;

  const { data } = await client
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  return data || null;
}

async function upsertInitialProfile(user, body = {}) {
  const client = getUserAdminClient();
  if (!client || !user?.id) return null;

  const fullName = cleanText(body.fullName || body.full_name, 140);
  const email = normalizeEmail(user.email);
  const verified = Boolean(user.email_confirmed_at || user.confirmed_at);
  const existing = await client
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', user.id)
    .maybeSingle();

  if (existing.data) {
    const update = {
      email,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (fullName && !existing.data.full_name) update.full_name = fullName;
    if (fullName && !existing.data.display_name) update.display_name = fullName;
    if (!existing.data.account_setup_completed) {
      update.account_status = verified ? 'pending_setup' : 'pending_verification';
    }

    const { data } = await client
      .from('profiles')
      .update(update)
      .eq('id', user.id)
      .select(PROFILE_SELECT)
      .maybeSingle();

    return data || existing.data;
  }

  const { data } = await client
    .from('profiles')
    .upsert({
      id: user.id,
      user_id: user.id,
      email,
      full_name: fullName,
      display_name: fullName,
      account_status: verified ? 'pending_setup' : 'pending_verification',
      account_setup_completed: false,
      role: 'reader',
      subscription_status: 'free',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select(PROFILE_SELECT)
    .maybeSingle();

  return data || null;
}

async function recordLoginSuccess(request, user, session, remember, profile) {
  const client = getUserAdminClient();
  if (!client || !user?.id || !session?.access_token) return;

  const now = new Date().toISOString();
  const tokenHash = hashValue(session.access_token);
  const userAgent = getUserAgent(request);
  const ip = getClientIp(request);

  await client.from('login_history').insert({
    user_id: user.id,
    email: normalizeEmail(user.email),
    event_type: 'login.success',
    ip_address: ip,
    user_agent: userAgent,
    device_info: { userAgent },
    metadata: { remember, account_setup_completed: Boolean(profile?.account_setup_completed) },
  });

  await client.from('user_sessions').upsert({
    user_id: user.id,
    session_token_hash: tokenHash,
    device_info: { userAgent },
    ip_address: ip,
    user_agent: userAgent,
    remembered: remember,
    expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    last_seen_at: now,
  }, { onConflict: 'session_token_hash' });

  await client.from('profiles').update({
    last_active_at: now,
    account_status: profile?.account_setup_completed ? 'active' : 'pending_setup',
    updated_at: now,
  }).eq('id', user.id);
}

export async function handleSignup(request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`auth-signup:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limited.ok) return json({ error: 'Too many signup attempts.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const passwordConfirm = String(body.passwordConfirm || body.password_confirm || '');
  const fullName = cleanText(body.fullName || body.full_name, 140);
  const phone = cleanText(body.phone, 32);
  const acceptedTerms = body.acceptedTerms === true || body.accepted_terms === true;
  const acceptedPrivacy = body.acceptedPrivacy === true || body.accepted_privacy === true;
  const acceptedComms = body.acceptedComms === true || body.accepted_comms === true;
  const passwordCheck = validatePassword(password, email);
  const turnstileResponse = await requireTurnstile(request, body);
  if (turnstileResponse) return turnstileResponse;

  if (password !== passwordConfirm) {
    return json({ error: 'Passwords do not match.' }, { status: 400 });
  }

  if (!acceptedTerms || !acceptedPrivacy) {
    return json({ error: 'Accept the Terms and Privacy Policy to create an account.' }, { status: 400 });
  }

  if (!fullName || fullName.length < 2 || !EMAIL_RE.test(email) || !passwordCheck.ok) {
    return json({
      error: passwordCheck.problems[0] || 'Enter a valid name, email, and password.',
      passwordProblems: passwordCheck.problems,
    }, { status: 400 });
  }
  const deliveryResponse = emailDeliveryResponse(email);
  if (deliveryResponse) return deliveryResponse;

  const client = getUserAnonClient();
  if (!client) return json({ error: 'User auth is not configured.' }, { status: 503 });

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: buildRedirectUrl(request, '/api/v1/auth/callback?next=/setup-account'),
      data: {
        full_name: fullName,
        phone,
        account_setup_completed: false,
        consent_version: body.consentVersion || body.consent_version || 'v1-auth-phase-1-5',
      },
    },
  });

  if (error) {
    await writeSecurityEvent(request, 'signup.failed', { email, severity: 'warn', metadata: { message: error.message } });
    return json({ error: error.message || 'Could not create account.' }, { status: 400 });
  }

  if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
    await writeSecurityEvent(request, 'signup.duplicate', { email, severity: 'warn' });
    return json({ error: 'Email is already registered.' }, { status: 409 });
  }

  const profile = await upsertInitialProfile(data.user, { fullName });
  await writeSecurityEvent(request, 'signup.requested', {
    userId: data.user?.id,
    email,
    metadata: {
      needs_email_verification: true,
      accepted_terms: acceptedTerms,
      accepted_privacy: acceptedPrivacy,
      accepted_comms: acceptedComms,
      consent_version: body.consentVersion || body.consent_version || 'v1-auth-phase-1-5',
    },
  });

  return json({
    ok: true,
    needsEmailVerification: true,
    otpRequired: true,
    user: publicUser(data.user, profile),
  });
}

async function verifyEmailOtp(client, email, token) {
  const first = await client.auth.verifyOtp({ email, token, type: 'signup' });
  if (!first.error || first.data?.session) return first;
  const fallback = await client.auth.verifyOtp({ email, token, type: 'email' });
  return fallback.error ? first : fallback;
}

export async function handleVerifyEmailOtp(request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`auth-verify-email-otp:${ip}`, { limit: 8, windowMs: 60_000 });
  if (!limited.ok) return json({ error: 'Too many verification attempts.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const token = cleanOtp(body.token || body.otp || body.code);
  const remember = body.remember === true;
  const turnstileResponse = await requireTurnstile(request, body);
  if (turnstileResponse) return turnstileResponse;

  if (!EMAIL_RE.test(email) || token.length !== 6) {
    return json({ error: 'Enter the 6-digit email verification code.' }, { status: 400 });
  }

  const client = getUserAnonClient();
  if (!client) return json({ error: 'User auth is not configured.' }, { status: 503 });

  const { data, error } = await verifyEmailOtp(client, email, token);
  if (error || !data?.session || !data?.user) {
    await writeSecurityEvent(request, 'email_otp.failed', { email, severity: 'warn', metadata: { message: error?.message || 'invalid_otp' } });
    return json({ error: 'Invalid or expired verification code.' }, { status: 400 });
  }

  const profile = await upsertInitialProfile(data.user, {});
  await writeSecurityEvent(request, 'email_otp.verified', { userId: data.user.id, email });
  await writeSecurityEvent(request, 'email.verified', { userId: data.user.id, email });

  const response = json({
    ok: true,
    user: publicUser(data.user, profile),
    accountSetupRequired: !profile?.account_setup_completed,
  });
  return setAuthCookies(response, data.session, remember);
}

export async function handleResendEmailOtp(request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`auth-resend-email-otp:${ip}`, { limit: 4, windowMs: 60_000 });
  if (!limited.ok) return json({ error: 'Please wait before requesting another code.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const turnstileResponse = await requireTurnstile(request, body);
  if (turnstileResponse) return turnstileResponse;
  if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email.' }, { status: 400 });
  const deliveryResponse = emailDeliveryResponse(email);
  if (deliveryResponse) return deliveryResponse;

  const client = getUserAnonClient();
  if (!client) return json({ error: 'User auth is not configured.' }, { status: 503 });

  const { error } = await client.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: buildRedirectUrl(request, '/api/v1/auth/callback?next=/setup-account'),
    },
  });

  await writeSecurityEvent(request, error ? 'email_otp.resend_failed' : 'email_otp.resent', {
    email,
    severity: error ? 'warn' : 'info',
    metadata: error ? { message: error.message } : {},
  });

  if (error) return json({ error: 'Could not resend verification code.' }, { status: 400 });
  return json({ ok: true, message: 'A new verification code has been sent.' });
}

export async function handleLogin(request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`auth-login:${ip}`, { limit: 8, windowMs: 60_000 });
  if (!limited.ok) return json({ error: 'Too many login attempts.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const remember = body.remember !== false;
  const turnstileResponse = await requireTurnstile(request, body);
  if (turnstileResponse) return turnstileResponse;

  if (!EMAIL_RE.test(email) || !password) return json({ error: 'Enter a valid email and password.' }, { status: 400 });

  const client = getUserAnonClient();
  if (!client) return json({ error: 'User auth is not configured.' }, { status: 503 });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.session || !data?.user) {
    await writeSecurityEvent(request, 'login.failed', { email, severity: 'warn', metadata: { message: error?.message || 'invalid_credentials' } });
    return json({ error: error?.message?.toLowerCase().includes('confirm') ? 'Verify your email before signing in.' : 'Incorrect email or password.' }, { status: 401 });
  }

  if (!data.user.email_confirmed_at && !data.user.confirmed_at) {
    await writeSecurityEvent(request, 'login.unverified', { userId: data.user.id, email, severity: 'warn' });
    return json({ error: 'Verify your email before signing in.' }, { status: 403 });
  }

  const profile = await getProfile(data.user.id) || await upsertInitialProfile(data.user, {});
  if (['suspended', 'banned', 'deleted'].includes(profile?.account_status)) {
    await writeSecurityEvent(request, 'login.blocked', { userId: data.user.id, email, severity: 'critical', metadata: { account_status: profile.account_status } });
    return json({ error: 'This account cannot sign in. Contact support.' }, { status: 403 });
  }

  await recordLoginSuccess(request, data.user, data.session, remember, profile);
  await writeSecurityEvent(request, 'login.success', { userId: data.user.id, email });

  const response = json({
    ok: true,
    user: publicUser(data.user, profile),
    accountSetupRequired: !profile?.account_setup_completed,
  });
  return setAuthCookies(response, data.session, remember);
}

export async function handleLogout(request) {
  const token = getAccessTokenFromRequest(request);
  const { user } = token ? await getRequestUser(request) : { user: null };
  await writeSecurityEvent(request, 'logout', { userId: user?.id, email: user?.email || null });

  const response = json({ ok: true });
  return clearAuthCookies(response);
}

export async function handleSession(request) {
  const token = getAccessTokenFromRequest(request);
  const refreshToken = getRefreshTokenFromRequest(request);
  let session = null;
  let user = null;

  if (token) {
    const result = await getRequestUser(request);
    user = result.user;
  }

  if (!user && refreshToken) {
    const client = getUserAnonClient();
    if (client) {
      const refreshed = await client.auth.refreshSession({ refresh_token: refreshToken });
      if (refreshed.data?.session?.access_token) {
        session = refreshed.data.session;
        user = refreshed.data.user;
        await writeSecurityEvent(request, 'session.refresh', { userId: user?.id, email: user?.email || null });
      }
    }
  }

  if (!user) return json({ ok: true, authenticated: false });

  const profile = await getProfile(user.id);
  if (profileIsBlocked(profile)) {
    await writeSecurityEvent(request, 'session.blocked', {
      userId: user.id,
      email: user.email || null,
      severity: 'warn',
      metadata: { account_status: profile?.account_status },
    });
    const response = json({
      ok: true,
      authenticated: false,
      error: 'account_blocked',
    });
    return clearAuthCookies(response);
  }

  const response = json({
    ok: true,
    authenticated: true,
    user: publicUser(user, profile),
    accountSetupRequired: !profile?.account_setup_completed,
  });

  return session ? setAuthCookies(response, session, true) : response;
}

export async function handleForgotPassword(request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`auth-forgot:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limited.ok) return json({ error: 'Too many password reset attempts.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const turnstileResponse = await requireTurnstile(request, body);
  if (turnstileResponse) return turnstileResponse;
  if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email.' }, { status: 400 });
  const deliveryResponse = emailDeliveryResponse(email);
  if (deliveryResponse) return deliveryResponse;

  const client = getUserAnonClient();
  if (!client) return json({ error: 'User auth is not configured.' }, { status: 503 });

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: buildRedirectUrl(request, '/auth?reset=1'),
  });

  await writeSecurityEvent(request, error ? 'password_reset.failed' : 'password_reset.requested', {
    email,
    severity: error ? 'warn' : 'info',
    metadata: error ? { message: error.message } : {},
  });

  return json({ ok: true, message: 'If the account exists, a reset email has been sent.' });
}

export async function handleVerifyResetOtp(request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`auth-verify-reset-otp:${ip}`, { limit: 8, windowMs: 60_000 });
  if (!limited.ok) return json({ error: 'Too many reset verification attempts.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const token = cleanOtp(body.token || body.otp || body.code);
  const turnstileResponse = await requireTurnstile(request, body);
  if (turnstileResponse) return turnstileResponse;

  if (!EMAIL_RE.test(email) || token.length !== 6) {
    return json({ error: 'Enter the 6-digit reset code.' }, { status: 400 });
  }

  const client = getUserAnonClient();
  if (!client) return json({ error: 'User auth is not configured.' }, { status: 503 });

  const { data, error } = await client.auth.verifyOtp({ email, token, type: 'recovery' });
  if (error || !data?.session || !data?.user) {
    await writeSecurityEvent(request, 'password_reset_otp.failed', { email, severity: 'warn', metadata: { message: error?.message || 'invalid_otp' } });
    return json({ error: 'Invalid or expired reset code.' }, { status: 400 });
  }

  const profile = await upsertInitialProfile(data.user, {});
  await writeSecurityEvent(request, 'password_reset_otp.verified', { userId: data.user.id, email });

  const response = json({
    ok: true,
    user: publicUser(data.user, profile),
    resetSessionReady: true,
  });
  setAuthCookies(response, data.session, false);
  return setResetVerificationCookie(response, data.user.id);
}

export async function handleResetPassword(request) {
  const ip = getClientIp(request);
  const limited = rateLimit(`auth-reset:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limited.ok) return json({ error: 'Too many password reset attempts.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const password = String(body.password || '');
  const token = body.accessToken || getAccessTokenFromRequest(request);
  const passwordCheck = validatePassword(password, body.email || '');
  const turnstileResponse = await requireTurnstile(request, body);
  if (turnstileResponse) return turnstileResponse;

  if (!passwordCheck.ok) {
    return json({ error: passwordCheck.problems[0], passwordProblems: passwordCheck.problems }, { status: 400 });
  }

  const { user } = token ? await getRequestUser(request) : { user: null };
  if (!user || !verifyResetVerificationCookie(request, user.id)) {
    return json({ error: 'A valid reset session is required.' }, { status: 401 });
  }

  const client = getUserAdminClient();
  if (!client) return json({ error: 'User auth is not configured.' }, { status: 503 });
  const { data, error } = await client.auth.admin.updateUserById(user.id, { password });
  if (error) {
    await writeSecurityEvent(request, 'password_reset.failed', {
      userId: user.id,
      email: user.email || null,
      severity: 'warn',
      metadata: { message: error.message },
    });
    return json({ error: 'Could not update password.' }, { status: 400 });
  }

  await writeSecurityEvent(request, 'password_reset.completed', { userId: data.user?.id, email: data.user?.email || null });
  const response = json({ ok: true });
  clearResetVerificationCookie(response);
  return clearAuthCookies(response);
}

export async function handleCallback(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/auth?setup=1';
  const client = getUserAnonClient();

  if (!client || !code) {
    return NextResponse.redirect(new URL('/auth?error=auth_callback_failed', request.url));
  }

  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error || !data?.session) {
    await writeSecurityEvent(request, 'auth_callback.failed', { severity: 'warn', metadata: { message: error?.message || 'missing_session' } });
    return NextResponse.redirect(new URL('/auth?error=auth_callback_failed', request.url));
  }

  await upsertInitialProfile(data.user, {});
  await writeSecurityEvent(request, 'email.verified', { userId: data.user?.id, email: data.user?.email || null });

  const response = NextResponse.redirect(new URL(next, request.url));
  return setAuthCookies(response, data.session, true);
}

export async function handleBrowserCallback(request) {
  const body = await request.json().catch(() => ({}));
  const accessToken = body.accessToken || body.access_token;
  const refreshToken = body.refreshToken || body.refresh_token;
  const expiresAt = Number(body.expiresAt || body.expires_at || 0) || undefined;

  if (!accessToken || !refreshToken) {
    return json({ error: 'Missing Supabase callback tokens.' }, { status: 400 });
  }

  const client = getUserSessionClient(accessToken);
  if (!client) return json({ error: 'User auth is not configured.' }, { status: 503 });

  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    await writeSecurityEvent(request, 'auth_callback.failed', { severity: 'warn', metadata: { message: error?.message || 'invalid_fragment_session' } });
    return json({ error: 'Could not verify callback session.' }, { status: 401 });
  }

  const profile = await upsertInitialProfile(data.user, {});
  await writeSecurityEvent(request, 'email.verified', { userId: data.user.id, email: data.user.email || null });

  const response = json({
    ok: true,
    user: publicUser(data.user, profile),
    accountSetupRequired: !profile?.account_setup_completed,
  });

  return setAuthCookies(response, {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
  }, true);
}

function usernameBase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/@.*/, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);
}

function setupPayload(body, user) {
  const fullName = cleanText(body.fullName || body.full_name || body.name, 140);
  const requestedUsername = cleanText(body.username, 30)?.toLowerCase();
  const generatedUsername = `${usernameBase(fullName || user.email) || 'reader'}${String(user.id).replace(/-/g, '').slice(0, 8)}`;
  const username = requestedUsername || generatedUsername.slice(0, 30);
  const profession = cleanText(body.profession, 120);
  const organization = cleanText(body.organization || body.organizationCompany || body.organization_name || body.org, 160);
  const college = cleanText(
    body.college
    || body.collegeName
    || body.college_name
    || body.preferences?.education?.college
    || body.preferences?.education?.collegeName,
    160,
  );
  const bio = cleanText(body.bio, 500);
  const country = cleanText(body.country, 80);
  const state = cleanText(body.state, 80);
  const city = cleanText(body.city, 80);
  const interests = cleanArray(body.interests || body.interest_categories);
  const notificationChannels = cleanObject(body.notificationChannels || body.notification_channels);

  if (!fullName || !profession || !country || !state || !city) {
    return { error: 'Full name, profession, country, state, and city are required.' };
  }

  if (username && !USERNAME_RE.test(username)) {
    return { error: 'Username must be 3-30 characters using lowercase letters and numbers only.' };
  }

  if (!organization && !college) {
    return { error: 'Organization or college is required.' };
  }

  if (!bio) {
    return { error: 'A short bio is required to complete account setup.' };
  }

  if (!interests.length) {
    return { error: 'Choose at least one interest to complete account setup.' };
  }

  return {
    id: user.id,
    user_id: user.id,
    email: normalizeEmail(user.email),
    display_name: fullName,
    full_name: fullName,
    username,
    profession,
    organization_company: organization || college,
    job_title: cleanText(body.jobTitle || body.job_title, 120),
    country,
    state,
    city,
    profile_photo_path: cleanText(body.profilePhotoPath || body.profile_photo_path, 500),
    bio,
    interests,
    social_links: cleanObject(body.socialLinks || body.social_links),
    preferred_categories: interests,
    preferences: cleanObject(body.preferences),
    notification_channels: notificationChannels,
    account_status: 'active',
    account_setup_completed: true,
    account_setup_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function handleGetMe(request) {
  const auth = await requireVerifiedUser(request);
  if (auth.response) return auth.response;

  const profile = await getProfile(auth.user.id);
  if (profileIsBlocked(profile)) {
    await writeSecurityEvent(request, 'profile.blocked', {
      userId: auth.user.id,
      email: auth.user.email || null,
      severity: 'warn',
      metadata: { account_status: profile?.account_status },
    });
    const response = json({ error: 'This account cannot access protected features. Contact support.' }, { status: 403 });
    return clearAuthCookies(response);
  }

  return json({
    ok: true,
    user: publicUser(auth.user, profile),
    accountSetupRequired: !profile?.account_setup_completed,
  });
}

export async function handleAccountSetup(request) {
  const auth = await requireVerifiedUser(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const payload = setupPayload(body, auth.user);
  if (payload.error) return json({ error: payload.error }, { status: 400 });

  const client = getUserAdminClient();
  if (!client) return json({ error: 'User database is not configured.' }, { status: 503 });

  const { data, error } = await client
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    const duplicateUsername = error.code === '23505' || /username/i.test(error.message || '');
    return json({ error: duplicateUsername ? 'Username is already taken.' : 'Could not complete account setup.' }, { status: duplicateUsername ? 409 : 500 });
  }

  await writeSecurityEvent(request, 'account_setup.completed', { userId: auth.user.id, email: auth.user.email });
  return json({ ok: true, user: publicUser(auth.user, data) });
}

export async function handlePreferences(request) {
  const auth = await requireSetupUser(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const preferences = cleanObject(body.preferences);
  const client = getUserAdminClient();
  if (!client) return json({ error: 'User database is not configured.' }, { status: 503 });

  const update = {
    id: auth.user.id,
    user_id: auth.user.id,
    audience: preferences.audience === 'pro' ? 'professional' : preferences.audience || 'general',
    language: preferences.language || 'en',
    interests: cleanArray(preferences.interests),
    preferred_categories: cleanArray(preferences.interests),
    notification_channels: cleanObject(preferences.notifs || preferences.notification_channels),
    preferences,
    updated_at: new Date().toISOString(),
  };

  await client.from('user_preferences').upsert({
    user_id: auth.user.id,
    audience: update.audience,
    language: update.language,
    interests: update.interests,
    notification_channels: update.notification_channels,
    feed_preferences: preferences,
    updated_at: update.updated_at,
  }, { onConflict: 'user_id' });

  const { error } = await client.from('profiles').upsert(update, { onConflict: 'id' });
  if (error) return json({ error: 'Could not save profile preferences.' }, { status: 500 });

  await writeSecurityEvent(request, 'account.preferences_updated', { userId: auth.user.id, email: auth.user.email });
  return json({ ok: true });
}

export async function handleAvatarUpload(request) {
  const auth = await requireVerifiedUser(request);
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const contentType = String(body.contentType || '').toLowerCase();
  const rawName = String(body.fileName || 'profile-photo').toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 80);

  if (!IMAGE_TYPES.has(contentType)) return json({ error: 'Only JPG, PNG, or WebP profile photos are allowed.' }, { status: 400 });

  const client = getUserAdminClient();
  if (!client) return json({ error: 'User database is not configured.' }, { status: 503 });

  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${auth.user.id}/${Date.now()}-${rawName.replace(/\.[a-z0-9]+$/, '')}.${ext}`;
  const { data, error } = await client.storage.from('profile-photos').createSignedUploadUrl(path);

  if (error) return json({ error: 'Could not create upload URL.' }, { status: 500 });
  return json({ ok: true, path, signedUrl: data.signedUrl, token: data.token });
}

async function syncSavedArticle(client, userId, articleId, saved) {
  const savedQuery = client.from('saved_articles');
  const savedResult = saved
    ? await savedQuery.upsert({ user_id: userId, article_id: articleId }, { onConflict: 'user_id,article_id' })
    : await savedQuery.delete().eq('user_id', userId).eq('article_id', articleId);

  if (!savedResult.error) return savedResult;

  const bookmarkQuery = client.from('bookmarks');
  return saved
    ? bookmarkQuery.upsert({ user_id: userId, article_id: articleId }, { onConflict: 'user_id,article_id' })
    : bookmarkQuery.delete().eq('user_id', userId).eq('article_id', articleId);
}

export async function handleBookmarks(request) {
  const auth = await requireSetupUser(request);
  if (auth.response) return auth.response;

  const client = getUserAdminClient();
  if (!client) return json({ error: 'User database is not configured.' }, { status: 503 });

  if (request.method === 'GET') {
    const { data, error } = await client
      .from('saved_articles')
      .select('article_id,saved_at')
      .eq('user_id', auth.user.id)
      .order('saved_at', { ascending: false });

    if (error) return json({ error: 'Could not load saved articles.' }, { status: 500 });
    return json({ ok: true, articles: data || [] });
  }

  const body = await request.json().catch(() => ({}));
  const articleId = cleanText(body.articleId || body.article_id, 180);
  if (!articleId) return json({ error: 'Article id is required.' }, { status: 400 });

  const saved = body.saved !== false;
  const { error } = await syncSavedArticle(client, auth.user.id, articleId, saved);
  if (error) return json({ error: 'Could not sync bookmark.' }, { status: 500 });
  return json({ ok: true, saved });
}

export async function handleLikedArticles(request) {
  const auth = await requireSetupUser(request);
  if (auth.response) return auth.response;

  const client = getUserAdminClient();
  if (!client) return json({ error: 'User database is not configured.' }, { status: 503 });

  if (request.method === 'GET') {
    const { data, error } = await client
      .from('liked_articles')
      .select('article_id,liked_at')
      .eq('user_id', auth.user.id)
      .order('liked_at', { ascending: false });

    if (error) return json({ error: 'Could not load liked articles.' }, { status: 500 });
    return json({ ok: true, articles: data || [] });
  }

  const body = await request.json().catch(() => ({}));
  const articleId = cleanText(body.articleId || body.article_id, 180);
  if (!articleId) return json({ error: 'Article id is required.' }, { status: 400 });

  const liked = body.liked !== false;
  const query = client.from('liked_articles');
  const { error } = liked
    ? await query.upsert({ user_id: auth.user.id, article_id: articleId }, { onConflict: 'user_id,article_id' })
    : await query.delete().eq('user_id', auth.user.id).eq('article_id', articleId);

  if (error) return json({ error: 'Could not sync like.' }, { status: 500 });
  return json({ ok: true, liked });
}

export async function handleReadingHistory(request) {
  const auth = await requireSetupUser(request);
  if (auth.response) return auth.response;

  const client = getUserAdminClient();
  if (!client) return json({ error: 'User database is not configured.' }, { status: 503 });

  if (request.method === 'GET') {
    const { data, error } = await client
      .from('reading_history')
      .select('article_id,first_read_at,last_read_at,read_count')
      .eq('user_id', auth.user.id)
      .order('last_read_at', { ascending: false })
      .limit(100);

    if (error) return json({ error: 'Could not load reading history.' }, { status: 500 });
    return json({ ok: true, articles: data || [] });
  }

  const body = await request.json().catch(() => ({}));
  const articleId = cleanText(body.articleId || body.article_id, 180);
  if (!articleId) return json({ error: 'Article id is required.' }, { status: 400 });

  const existing = await client
    .from('reading_history')
    .select('read_count')
    .eq('user_id', auth.user.id)
    .eq('article_id', articleId)
    .maybeSingle();

  const { error } = await client.from('reading_history').upsert({
    user_id: auth.user.id,
    article_id: articleId,
    read_count: Number(existing.data?.read_count || 0) + 1,
    last_read_at: new Date().toISOString(),
  }, { onConflict: 'user_id,article_id' });

  if (error) return json({ error: 'Could not record reading history.' }, { status: 500 });
  return json({ ok: true });
}
