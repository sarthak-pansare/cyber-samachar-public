import { NextResponse } from 'next/server';
import { getUserAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/server-auth';
import {
  getEnvironmentPolicy,
  requireAdminEnvironmentConfirmation,
} from '@/lib/environment-policy';

const ALLOWED_STATUS = new Set([
  'pending_verification',
  'pending_setup',
  'active',
  'suspended',
  'banned',
  'deleted',
]);

const PROFILE_SELECT = [
  'id',
  'user_id',
  'email',
  'full_name',
  'display_name',
  'username',
  'profession',
  'organization_company',
  'account_status',
  'role',
  'subscription_status',
  'account_setup_completed',
  'created_at',
  'updated_at',
  'last_active_at',
].join(',');

function cleanText(value, max = 180) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
}

function cleanSearch(value) {
  return cleanText(value, 80).replace(/[%,()]/g, '');
}

function statusFromAction(body) {
  const action = cleanText(body.action, 40).toLowerCase();
  if (action === 'suspend') return 'suspended';
  if (action === 'ban') return 'banned';
  if (action === 'activate' || action === 'restore') return 'active';
  return cleanText(body.accountStatus || body.account_status || body.status, 40).toLowerCase();
}

async function audit(client, actorId, action, targetId, metadata = {}) {
  const environment = getEnvironmentPolicy();
  await client.from('admin_audit_logs').insert({
    actor_id: actorId,
    action,
    target_table: 'profiles',
    target_id: targetId || null,
    metadata: { ...metadata, app_env: environment.appEnv },
  });
}

async function authUserMap(client) {
  try {
    const { data } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = Array.isArray(data?.users) ? data.users : [];
    return new Map(users.map((user) => [user.id, user]));
  } catch (_) {
    return new Map();
  }
}

function publicAdminUser(profile, authUser) {
  return {
    id: profile.id || profile.user_id,
    email: profile.email || authUser?.email || null,
    fullName: profile.full_name || profile.display_name || null,
    username: profile.username || null,
    profession: profile.profession || null,
    organization: profile.organization_company || null,
    accountStatus: profile.account_status || 'pending_setup',
    role: profile.role || 'reader',
    subscriptionStatus: profile.subscription_status || 'free',
    accountSetupCompleted: Boolean(profile.account_setup_completed),
    emailVerified: Boolean(authUser?.email_confirmed_at || authUser?.confirmed_at),
    joinedAt: authUser?.created_at || profile.created_at || null,
    lastActiveAt: profile.last_active_at || null,
    updatedAt: profile.updated_at || null,
  };
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const client = getUserAdminClient();
  if (!client) return NextResponse.json({ error: 'User database is not configured.' }, { status: 503 });

  const url = new URL(request.url);
  const activityUserId = cleanText(url.searchParams.get('activityUserId') || url.searchParams.get('userId'), 80);

  if (activityUserId && url.searchParams.get('includeActivity') === '1') {
    const [events, logins] = await Promise.all([
      client
        .from('security_events')
        .select('id,event,event_type,severity,ip_address,user_agent,metadata,created_at')
        .eq('user_id', activityUserId)
        .order('created_at', { ascending: false })
        .limit(100),
      client
        .from('login_history')
        .select('id,event_type,ip_address,user_agent,device_info,metadata,created_at')
        .eq('user_id', activityUserId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    if (events.error || logins.error) {
      return NextResponse.json({ error: 'Could not load user activity.' }, { status: 500 });
    }

    await audit(client, auth.user.id, 'user.activity.list', activityUserId, {
      eventCount: events.data?.length || 0,
      loginCount: logins.data?.length || 0,
    });

    return NextResponse.json({
      ok: true,
      activity: {
        securityEvents: events.data || [],
        loginHistory: logins.data || [],
      },
    });
  }

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);
  const status = cleanText(url.searchParams.get('status'), 40).toLowerCase();
  const q = cleanSearch(url.searchParams.get('q'));

  let query = client
    .from('profiles')
    .select(PROFILE_SELECT)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (status && ALLOWED_STATUS.has(status)) query = query.eq('account_status', status);
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,username.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Could not load users.' }, { status: 500 });

  const authUsers = await authUserMap(client);
  const users = (data || []).map((profile) => publicAdminUser(profile, authUsers.get(profile.id || profile.user_id)));

  await audit(client, auth.user.id, 'user.list', null, { count: users.length, status: status || null, q: q || null });
  return NextResponse.json({ ok: true, users });
}

export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const environmentConfirmation = requireAdminEnvironmentConfirmation(request.headers);
  if (!environmentConfirmation.ok) {
    return NextResponse.json({
      error: environmentConfirmation.reason === 'admin_mutations_blocked'
        ? 'Admin changes are blocked in Development.'
        : `Confirm the ${environmentConfirmation.appEnv} environment before making this change.`,
      code: environmentConfirmation.reason,
    }, { status: 403 });
  }

  const client = getUserAdminClient();
  if (!client) return NextResponse.json({ error: 'User database is not configured.' }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const userId = cleanText(body.userId || body.user_id || body.id, 80);
  const accountStatus = statusFromAction(body);
  const reason = cleanText(body.reason, 500);

  if (!userId || !ALLOWED_STATUS.has(accountStatus)) {
    return NextResponse.json({ error: 'A valid user id and account status are required.' }, { status: 400 });
  }

  if (userId === auth.user.id && ['suspended', 'banned', 'deleted'].includes(accountStatus)) {
    return NextResponse.json({ error: 'Admins cannot block their own account.' }, { status: 400 });
  }

  const { data, error } = await client
    .from('profiles')
    .update({
      account_status: accountStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: 'Could not update user status.' }, { status: 500 });

  if (['suspended', 'banned', 'deleted'].includes(accountStatus)) {
    await client
      .from('user_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null);
  }

  await audit(client, auth.user.id, 'user.status.update', userId, { accountStatus, reason });
  return NextResponse.json({ ok: true, user: publicAdminUser(data, null) });
}
