import { NextResponse } from 'next/server';
import { getUserAdminClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/server-auth';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const client = getUserAdminClient();
  if (!client) return NextResponse.json({ error: 'User database is not configured.' }, { status: 503 });

  const { data, error } = await client
    .from('reports')
    .select('id,user_id,crime_type,city,channel,status,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: 'Could not load reports.' }, { status: 500 });

  await client.from('admin_audit_logs').insert({
    actor_id: auth.user.id,
    action: 'report.list',
    target_table: 'reports',
    metadata: { count: data?.length || 0 },
  });

  return NextResponse.json({ ok: true, reports: data });
}
