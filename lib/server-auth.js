import { NextResponse } from 'next/server';
import { getUserAdminClient } from './supabase';
import { getAccessTokenFromRequest } from './auth-session';

export function getBearerToken(request) {
  return getAccessTokenFromRequest(request);
}

export async function getRequestUser(request) {
  const token = getAccessTokenFromRequest(request);
  if (!token) return { user: null, error: 'missing_bearer_token' };

  const client = getUserAdminClient();
  if (!client) return { user: null, error: 'user_db_not_configured' };

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { user: null, error: 'invalid_session' };
  return { user: data.user, error: null };
}

export async function getRequestProfile(userId) {
  const client = getUserAdminClient();
  if (!client || !userId) return { profile: null, error: 'user_db_not_configured' };

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) return { profile: null, error: 'profile_lookup_failed' };
  return { profile: data || null, error: null };
}

export function userIsAdmin(user) {
  const metadata = user?.app_metadata || {};
  const role = metadata.role || metadata.cs_role;
  const roles = Array.isArray(metadata.roles) ? metadata.roles : [];
  return role === 'admin' || role === 'editor' || roles.includes('admin') || roles.includes('editor');
}

export function profileIsBlocked(profile) {
  return ['suspended', 'banned', 'deleted'].includes(profile?.account_status);
}

export async function requireUser(request) {
  const result = await getRequestUser(request);
  if (!result.user) {
    return {
      ...result,
      response: NextResponse.json({ error: result.error || 'Unauthorized' }, { status: 401 }),
    };
  }
  return result;
}

export async function requireVerifiedUser(request) {
  const result = await requireUser(request);
  if (result.response) return result;

  if (!result.user.email_confirmed_at && !result.user.confirmed_at) {
    return {
      ...result,
      response: NextResponse.json({ error: 'Email verification required.' }, { status: 403 }),
    };
  }

  return result;
}

export async function requireSetupUser(request) {
  const result = await requireVerifiedUser(request);
  if (result.response) return result;

  const profileResult = await getRequestProfile(result.user.id);
  if (profileIsBlocked(profileResult.profile)) {
    return {
      ...result,
      profile: profileResult.profile,
      response: NextResponse.json({ error: 'This account cannot access protected features. Contact support.' }, { status: 403 }),
    };
  }

  if (!profileResult.profile?.account_setup_completed) {
    return {
      ...result,
      profile: profileResult.profile,
      response: NextResponse.json({ error: 'Account setup required.' }, { status: 403 }),
    };
  }

  return { ...result, profile: profileResult.profile };
}

export async function requireAdmin(request) {
  const result = await requireUser(request);
  if (result.response) return result;
  if (!userIsAdmin(result.user)) {
    return {
      ...result,
      response: NextResponse.json({ error: 'Admin role required.' }, { status: 403 }),
    };
  }
  return result;
}
