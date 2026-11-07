import { getEnvironmentPolicy } from './environment-policy.js';

export function getCaptchaPolicy() {
  const requestedMode = String(process.env.AUTH_CAPTCHA_MODE || 'enforced').trim().toLowerCase() === 'disabled'
    ? 'disabled'
    : 'enforced';
  const environmentPolicy = getEnvironmentPolicy();
  const environment = environmentPolicy.appEnv;
  const bypassEnabled = requestedMode === 'disabled'
    && environmentPolicy.captchaBypassAllowed;

  return {
    requestedMode,
    mode: bypassEnabled ? 'disabled' : 'enforced',
    enforced: !bypassEnabled,
    bypassEnabled,
    environment,
  };
}

export async function validateTurnstile(token, remoteIp) {
  const policy = getCaptchaPolicy();
  if (policy.bypassEnabled) {
    return {
      ok: true,
      bypassed: true,
      reason: 'captcha_temporarily_disabled',
    };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, reason: 'turnstile_not_configured' };
  if (!token) return { ok: false, reason: 'missing_turnstile_token' };
  if (String(token).length > 2048) return { ok: false, reason: 'turnstile_token_too_long' };

  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (remoteIp) form.append('remoteip', remoteIp);
  if (globalThis.crypto?.randomUUID) form.append('idempotency_key', globalThis.crypto.randomUUID());

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    return { ok: Boolean(response.ok && data.success), reason: data['error-codes']?.join(',') || null };
  } catch {
    return { ok: false, reason: 'turnstile_validation_error' };
  }
}
