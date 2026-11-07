import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateEnvironmentConfiguration } from './environment-policy.js';

const REQUIRED_FILES = [
  'supabase/reference/content-database.sql',
  'supabase/reference/user-database.sql',
  'next.config.mjs',
  'package-lock.json',
  'vercel.json',
  '.env.example',
  '.github/workflows/ci-cd.yml',
  '.github/workflows/post-deployment-smoke.yml',
];

const PUBLIC_ENV = [
  'NEXT_PUBLIC_CONTENT_SUPABASE_URL',
  'NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_USER_SUPABASE_URL',
  'NEXT_PUBLIC_USER_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'NEXT_PUBLIC_SITE_URL',
];

const SERVER_ENV = [
  'USER_DB_URL',
  'USER_DB_SERVICE_KEY',
  'TURNSTILE_SECRET_KEY',
];

const FORBIDDEN_PUBLIC_WORDS = ['SERVICE', 'SECRET', 'TOKEN', 'GEMINI', 'N8N', 'R2', 'WHATSAPP'];
const SECRET_VALUE_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]{20,}/,
  /AIza[A-Za-z0-9_-]{20,}/,
  /(?:ghp_|github_pat_|cfat_|vcp_)[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

const PROFILE_ENVIRONMENTS = {
  development: {
    NEXT_PUBLIC_SITE_URL: 'https://dev.thecybersamachar.com',
    DEBUG_LOGGING: 'true',
    AUTH_CAPTCHA_MODE: 'disabled',
    EMAIL_DELIVERY_MODE: 'test-only',
    AUTOMATION_ENABLED: 'false',
    ADMIN_MUTATION_MODE: 'blocked',
  },
  qa: {
    NEXT_PUBLIC_SITE_URL: 'https://qa.thecybersamachar.com',
    DEBUG_LOGGING: 'true',
    AUTH_CAPTCHA_MODE: 'enforced',
    EMAIL_DELIVERY_MODE: 'test-only',
    AUTOMATION_ENABLED: 'false',
    ADMIN_MUTATION_MODE: 'confirmed',
  },
  staging: {
    NEXT_PUBLIC_SITE_URL: 'https://staging.thecybersamachar.com',
    DEBUG_LOGGING: 'false',
    AUTH_CAPTCHA_MODE: 'enforced',
    EMAIL_DELIVERY_MODE: 'test-only',
    AUTOMATION_ENABLED: 'false',
    ADMIN_MUTATION_MODE: 'confirmed',
  },
  production: {
    NEXT_PUBLIC_SITE_URL: 'https://cybersamachar.ai',
    DEBUG_LOGGING: 'false',
    AUTH_CAPTCHA_MODE: 'enforced',
    EMAIL_DELIVERY_MODE: 'live',
    AUTOMATION_ENABLED: 'true',
    ADMIN_MUTATION_MODE: 'confirmed',
  },
};

function filePresence(root) {
  return Object.fromEntries(REQUIRED_FILES.map((file) => [file, existsSync(join(root, file))]));
}

function envPresence(env, names) {
  return Object.fromEntries(names.map((name) => [name, Boolean(String(env[name] || '').trim())]));
}

function forbiddenPublicNames(env) {
  return Object.keys(env).filter((name) => (
    name.startsWith('NEXT_PUBLIC_')
      && FORBIDDEN_PUBLIC_WORDS.some((word) => name.toUpperCase().includes(word))
  ));
}

function environmentFixture(appEnv) {
  return {
    APP_ENV: appEnv,
    NEXT_PUBLIC_APP_ENV: appEnv,
    NON_PROD_ACCESS_USERNAME: appEnv === 'production' ? '' : 'ci-tester',
    NON_PROD_ACCESS_PASSWORD: appEnv === 'production' ? '' : 'ci-placeholder-password',
    TEST_EMAIL_ALLOWLIST: appEnv === 'production' ? '' : 'tester@example.test',
    ...PROFILE_ENVIRONMENTS[appEnv],
  };
}

export function runCiDeployPreflight(root = process.cwd()) {
  const files = filePresence(root);
  const example = existsSync(join(root, '.env.example'))
    ? readFileSync(join(root, '.env.example'), 'utf8')
    : '';
  const profileResults = Object.keys(PROFILE_ENVIRONMENTS).map((appEnv) => (
    validateEnvironmentConfiguration(environmentFixture(appEnv))
  ));
  const secretLikeExampleValues = SECRET_VALUE_PATTERNS
    .filter((pattern) => pattern.test(example))
    .map((pattern) => String(pattern));
  const missingFiles = Object.entries(files)
    .filter(([, present]) => !present)
    .map(([file]) => file);
  const invalidProfiles = profileResults.filter((result) => !result.ok);
  const errors = [
    ...missingFiles.map((file) => `Missing required file: ${file}`),
    ...invalidProfiles.flatMap((result) => result.errors.map((error) => `${result.appEnv}: ${error}`)),
    ...secretLikeExampleValues.map(() => '.env.example contains a secret-shaped value.'),
  ];

  return {
    ok: errors.length === 0,
    ciMode: true,
    environmentProfiles: Object.keys(PROFILE_ENVIRONMENTS),
    files,
    Vercel: {
      configurationFile: files['vercel.json'],
      qualityWorkflow: files['.github/workflows/ci-cd.yml'],
      postDeploymentWorkflow: files['.github/workflows/post-deployment-smoke.yml'],
    },
    Supabase: {
      contentSchemaFile: files['supabase/reference/content-database.sql'],
      userSchemaFile: files['supabase/reference/user-database.sql'],
    },
    errors,
    secretHandling: 'CI preflight checks names, structure, and placeholder patterns only. It never requires or prints secret values.',
  };
}

export function runLocalDeployPreflight(root = process.cwd(), env = process.env) {
  const base = runCiDeployPreflight(root);
  const publicEnv = envPresence(env, PUBLIC_ENV);
  const serverEnv = envPresence(env, SERVER_ENV);
  const environment = validateEnvironmentConfiguration(env);
  const forbiddenNames = forbiddenPublicNames(env);
  const missingRuntime = [
    ...Object.entries(publicEnv).filter(([, present]) => !present).map(([name]) => `Missing public environment variable: ${name}`),
    ...Object.entries(serverEnv).filter(([, present]) => !present).map(([name]) => `Missing server environment variable: ${name}`),
  ];
  const errors = [
    ...base.errors,
    ...environment.errors,
    ...missingRuntime,
    ...(forbiddenNames.length ? ['Secret-like NEXT_PUBLIC_* variable names are present.'] : []),
  ];

  return {
    ...base,
    ok: errors.length === 0,
    ciMode: false,
    appEnv: environment.appEnv,
    environmentConfigurationValid: environment.ok,
    env: {
      public: publicEnv,
      server: serverEnv,
      forbiddenPublicNames: forbiddenNames,
    },
    Vercel: {
      ...base.Vercel,
      linkedProject: existsSync(join(root, '.vercel', 'project.json')),
    },
    errors,
    secretHandling: 'Local preflight reports only file, variable-name, and presence checks. It never prints secret values.',
  };
}
