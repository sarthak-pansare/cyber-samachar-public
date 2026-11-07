import { NextResponse } from 'next/server';
import { getCaptchaPolicy } from '@/lib/turnstile';
import {
  getEnvironmentPolicy,
  validateEnvironmentConfiguration,
} from '@/lib/environment-policy';

export function GET() {
  const contentPublicConfigured = Boolean(
    process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL
      && process.env.NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY,
  );
  const userPublicConfigured = Boolean(
    process.env.NEXT_PUBLIC_USER_SUPABASE_URL
      && process.env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY,
  );
  const userAdminConfigured = Boolean(
    process.env.USER_DB_URL
      && process.env.USER_DB_SERVICE_KEY,
  );
  const turnstileConfigured = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      && process.env.TURNSTILE_SECRET_KEY,
  );
  const captchaPolicy = getCaptchaPolicy();
  const environment = getEnvironmentPolicy();
  const environmentValidation = validateEnvironmentConfiguration();
  const releaseSha = String(
    process.env.VERCEL_GIT_COMMIT_SHA
      || process.env.GITHUB_SHA
      || 'local',
  ).slice(0, 12);

  return NextResponse.json({
    ok: true,
    app: 'cyber-samachar',
    appEnv: environment.appEnv,
    siteUrl: environment.configuredSiteUrl || environment.siteUrl,
    releaseSha,
    environmentConfigurationValid: environmentValidation.ok,
    debugLogging: environment.debugLogging,
    emailDeliveryMode: environment.emailDeliveryMode,
    automationEnabled: environment.automationEnabled,
    adminMutationMode: environment.adminMutationMode,
    contentSupabaseConfigured: contentPublicConfigured,
    userDbConfigured: userPublicConfigured && userAdminConfigured,
    userDbPublicConfigured: userPublicConfigured,
    userDbAdminConfigured: userAdminConfigured,
    turnstileConfigured,
    captchaMode: captchaPolicy.mode,
    captchaEnforced: captchaPolicy.enforced,
    captchaBypassEnabled: captchaPolicy.bypassEnabled,
  });
}
