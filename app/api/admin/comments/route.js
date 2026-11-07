import { NextResponse } from 'next/server';
import { getUserAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/server-auth';
import {
  getEnvironmentPolicy,
  requireAdminEnvironmentConfirmation,
} from '@/lib/environment-policy';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const client = getUserAdminClient();
  if (!client) return NextResponse.json({ error: 'User database is not configured.' }, { status: 503 });

  const { data, error } = await client
    .from('article_comments')
    .select('id,article_id,user_id,body,status,created_at,moderated_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: 'Could not load comments.' }, { status: 500 });
  return NextResponse.json({ ok: true, comments: data });
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

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  const status = String(body.status || '');
  if (!id || !['approved', 'rejected', 'hidden'].includes(status)) {
    return NextResponse.json({ error: 'Invalid moderation request.' }, { status: 400 });
  }

  const client = getUserAdminClient();
  if (!client) return NextResponse.json({ error: 'User database is not configured.' }, { status: 503 });

  const { error } = await client
    .from('article_comments')
    .update({
      status,
      moderated_by: auth.user.id,
      moderated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Could not moderate comment.' }, { status: 500 });

  await client.from('admin_audit_logs').insert({
    actor_id: auth.user.id,
    action: 'comment.moderate',
    target_table: 'article_comments',
    target_id: id,
    metadata: { status, app_env: getEnvironmentPolicy().appEnv },
  });

  return NextResponse.json({ ok: true });
}
