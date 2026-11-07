import { createClient } from '@supabase/supabase-js';

let contentClient;
let userAdminClient;
let userAnonClient;

export function getContentClient() {
  const url = process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  if (!contentClient) {
    contentClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return contentClient;
}

export function getUserAdminClient() {
  const url = process.env.USER_DB_URL;
  const key = process.env.USER_DB_SERVICE_KEY;

  if (!url || !key) return null;
  if (!userAdminClient) {
    userAdminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return userAdminClient;
}

export function getUserAnonClient() {
  const url = process.env.NEXT_PUBLIC_USER_SUPABASE_URL || process.env.USER_DB_URL;
  const key = process.env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  if (!userAnonClient) {
    userAnonClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return userAnonClient;
}

export function getUserSessionClient(accessToken) {
  const url = process.env.NEXT_PUBLIC_USER_SUPABASE_URL || process.env.USER_DB_URL;
  const key = process.env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY;

  if (!url || !key || !accessToken) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
