const APP_ENVIRONMENTS = new Set(['development', 'qa', 'staging', 'production']);

const ENVIRONMENT_DEFAULTS = {
  development: {
    siteUrl: 'https://dev.thecybersamachar.com',
    accessProtected: true,
    noIndex: true,
    debugLogging: true,
    captchaBypassAllowed: true,
    emailDeliveryMode: 'test-only',
    automationEnabled: false,
    adminMutationMode: 'blocked',
  },
  qa: {
    siteUrl: 'https://qa.thecybersamachar.com',
    accessProtected: true,
    noIndex: true,
    debugLogging: true,
    captchaBypassAllowed: false,
    emailDeliveryMode: 'test-only',
    automationEnabled: false,
    adminMutationMode: 'confirmed',
  },
  staging: {
    siteUrl: 'https://staging.thecybersamachar.com',
    accessProtected: true,
    noIndex: true,
    debugLogging: false,
    captchaBypassAllowed: false,
    emailDeliveryMode: 'test-only',
    automationEnabled: false,
    adminMutationMode: 'confirmed',
  },
  production: {
    siteUrl: 'https://cybersamachar.ai',
    accessProtected: false,
    noIndex: false,
    debugLogging: false,
    captchaBypassAllowed: false,
    emailDeliveryMode: 'live',
    automationEnabled: true,
    adminMutationMode: 'confirmed',
  },
  unknown: {
    siteUrl: '',
    accessProtected: true,
    noIndex: true,
    debugLogging: false,
    captchaBypassAllowed: false,
    emailDeliveryMode: 'disabled',
    automationEnabled: false,
    adminMutationMode: 'blocked',
  },
};

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function booleanText(value) {
  return value ? 'true' : 'false';
}

function constantTimeTextEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ''));
  const b = new TextEncoder().encode(String(right || ''));
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }

  return difference === 0;
}

export function getAppEnvironment(env = process.env) {
  const configured = normalized(env.APP_ENV || env.NEXT_PUBLIC_APP_ENV);
  if (APP_ENVIRONMENTS.has(configured)) return configured;

  const isHosted = Boolean(env.VERCEL || env.VERCEL_ENV);
  if (!isHosted) return 'development';
  return 'unknown';
}

export function getEnvironmentPolicy(env = process.env) {
  const appEnv = getAppEnvironment(env);
  return {
    appEnv,
    ...ENVIRONMENT_DEFAULTS[appEnv],
    configuredSiteUrl: String(env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, ''),
  };
}

export function validateEnvironmentConfiguration(env = process.env) {
  const policy = getEnvironmentPolicy(env);
  const errors = [];
  const configuredAppEnv = normalized(env.APP_ENV);
  const publicAppEnv = normalized(env.NEXT_PUBLIC_APP_ENV);
  const siteUrl = String(env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');

  if (!APP_ENVIRONMENTS.has(configuredAppEnv)) {
    errors.push('APP_ENV must be development, qa, staging, or production.');
  }
  if (publicAppEnv !== policy.appEnv) {
    errors.push(`NEXT_PUBLIC_APP_ENV must equal ${policy.appEnv}.`);
  }
  if (siteUrl !== policy.siteUrl) {
    errors.push(`NEXT_PUBLIC_SITE_URL must equal ${policy.siteUrl}.`);
  }
  if (normalized(env.DEBUG_LOGGING) !== booleanText(policy.debugLogging)) {
    errors.push(`DEBUG_LOGGING must equal ${booleanText(policy.debugLogging)}.`);
  }
  const expectedCaptchaMode = policy.captchaBypassAllowed ? 'disabled' : 'enforced';
  if (normalized(env.AUTH_CAPTCHA_MODE) !== expectedCaptchaMode) {
    errors.push(`AUTH_CAPTCHA_MODE must equal ${expectedCaptchaMode}.`);
  }
  if (normalized(env.EMAIL_DELIVERY_MODE) !== policy.emailDeliveryMode) {
    errors.push(`EMAIL_DELIVERY_MODE must equal ${policy.emailDeliveryMode}.`);
  }
  if (normalized(env.AUTOMATION_ENABLED) !== booleanText(policy.automationEnabled)) {
    errors.push(`AUTOMATION_ENABLED must equal ${booleanText(policy.automationEnabled)}.`);
  }
  if (normalized(env.ADMIN_MUTATION_MODE) !== policy.adminMutationMode) {
    errors.push(`ADMIN_MUTATION_MODE must equal ${policy.adminMutationMode}.`);
  }

  if (policy.accessProtected) {
    if (!String(env.NON_PROD_ACCESS_USERNAME || '').trim()) {
      errors.push('NON_PROD_ACCESS_USERNAME is required outside Production.');
    }
    if (String(env.NON_PROD_ACCESS_PASSWORD || '').length < 16) {
      errors.push('NON_PROD_ACCESS_PASSWORD must contain at least 16 characters.');
    }
  }
  if (policy.emailDeliveryMode === 'test-only' && !String(env.TEST_EMAIL_ALLOWLIST || '').trim()) {
    errors.push('TEST_EMAIL_ALLOWLIST is required when email delivery is test-only.');
  }

  return {
    ok: errors.length === 0,
    appEnv: policy.appEnv,
    errors,
  };
}

export function isNonProductionAccessAuthorized(authorizationHeader, env = process.env) {
  const policy = getEnvironmentPolicy(env);
  if (!policy.accessProtected) return true;

  const expectedUsername = String(env.NON_PROD_ACCESS_USERNAME || '');
  const expectedPassword = String(env.NON_PROD_ACCESS_PASSWORD || '');
  if (!expectedUsername || !expectedPassword) return false;

  const [scheme, encoded] = String(authorizationHeader || '').trim().split(/\s+/, 2);
  if (normalized(scheme) !== 'basic' || !encoded) return false;

  let decoded;
  try {
    decoded = globalThis.atob(encoded);
  } catch {
    return false;
  }

  const separator = decoded.indexOf(':');
  if (separator < 0) return false;
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  return constantTimeTextEqual(username, expectedUsername)
    && constantTimeTextEqual(password, expectedPassword);
}

export function isEmailDeliveryAllowed(email, env = process.env) {
  const policy = getEnvironmentPolicy(env);
  if (policy.emailDeliveryMode === 'live') return true;
  if (policy.emailDeliveryMode !== 'test-only') return false;

  const candidate = normalized(email);
  if (!candidate) return false;

  const allowlist = String(env.TEST_EMAIL_ALLOWLIST || '')
    .split(',')
    .map(normalized)
    .filter(Boolean);

  return allowlist.some((entry) => (
    entry.startsWith('*@')
      ? candidate.endsWith(entry.slice(1))
      : constantTimeTextEqual(candidate, entry)
  ));
}

export function requireAdminEnvironmentConfirmation(headers, env = process.env) {
  const policy = getEnvironmentPolicy(env);
  if (policy.adminMutationMode === 'blocked') {
    return { ok: false, reason: 'admin_mutations_blocked', appEnv: policy.appEnv };
  }

  const confirmation = normalized(headers?.get?.('x-cyber-samachar-environment-confirm'));
  if (!constantTimeTextEqual(confirmation, policy.appEnv)) {
    return { ok: false, reason: 'environment_confirmation_required', appEnv: policy.appEnv };
  }

  return { ok: true, reason: null, appEnv: policy.appEnv };
}

export function environmentEventName(eventName, env = process.env) {
  const policy = getEnvironmentPolicy(env);
  const name = String(eventName || '').trim();
  return policy.appEnv === 'production' ? name : `${policy.appEnv}:${name}`;
}

export function environmentSourceName(sourceName, env = process.env) {
  const policy = getEnvironmentPolicy(env);
  const name = String(sourceName || 'website').trim() || 'website';
  return policy.appEnv === 'production' ? name : `${policy.appEnv}:${name}`;
}

export function environmentResponseHeaders(env = process.env) {
  const policy = getEnvironmentPolicy(env);
  const headers = {
    'X-Cyber-Samachar-Environment': policy.appEnv,
  };
  if (policy.noIndex) headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive';
  return headers;
}

export function buildEnvironmentBannerHtml(env = process.env) {
  const policy = getEnvironmentPolicy(env);
  if (policy.appEnv === 'production') return '';

  const label = policy.appEnv === 'unknown'
    ? 'UNVERIFIED ENVIRONMENT'
    : `${policy.appEnv.toUpperCase()} ENVIRONMENT`;

  return `<style id="environment-banner-style">
.environment-banner{position:fixed;right:12px;bottom:12px;z-index:2147483647;border:1px solid #ffb347;border-radius:999px;background:#261500;color:#fff4de;padding:8px 13px;font:800 12px/1.2 ui-sans-serif,system-ui,sans-serif;letter-spacing:.08em;box-shadow:0 8px 28px rgba(0,0,0,.38)}
</style><div class="environment-banner" role="status" aria-label="${label}">${label} - SHARED DATABASE</div>`;
}
