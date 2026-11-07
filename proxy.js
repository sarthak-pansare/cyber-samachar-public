import { NextResponse } from 'next/server';
import {
  environmentResponseHeaders,
  getEnvironmentPolicy,
  isNonProductionAccessAuthorized,
  validateEnvironmentConfiguration,
} from './lib/environment-policy';

const PUBLIC_FILE = /\.(?:avif|css|gif|html|ico|jpg|jpeg|js|map|png|svg|txt|webp|woff|woff2)$/i;

const EXACT_UI_PAGES = new Set([
  '',
  'about',
  'archive',
  'bookmarks',
  'categories',
  'cell',
  'law',
  'privacy',
  'report',
  'scam',
  'search',
  'terms',
  'article',
]);

function withEnvironmentHeaders(response) {
  for (const [name, value] of Object.entries(environmentResponseHeaders())) {
    response.headers.set(name, value);
  }
  return response;
}

function localRequestCanBypassAccess(request) {
  if (process.env.VERCEL || process.env.VERCEL_ENV) return false;
  return ['localhost', '127.0.0.1', '[::1]'].includes(request.nextUrl.hostname);
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const lowerPathname = pathname.toLowerCase();
  const environment = getEnvironmentPolicy();
  const environmentValidation = validateEnvironmentConfiguration();

  if ((process.env.VERCEL || process.env.VERCEL_ENV) && !environmentValidation.ok) {
    return withEnvironmentHeaders(new NextResponse('Environment configuration is invalid.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    }));
  }

  if (
    environment.accessProtected
    && !localRequestCanBypassAccess(request)
    && !isNonProductionAccessAuthorized(request.headers.get('authorization'))
  ) {
    return withEnvironmentHeaders(new NextResponse('Authentication required.', {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
        'WWW-Authenticate': 'Basic realm="Cyber Samachar non-production", charset="UTF-8"',
      },
    }));
  }

  if (lowerPathname === '/guest-profile') {
    const url = request.nextUrl.clone();
    url.pathname = '/Guest-Profile.html';
    return withEnvironmentHeaders(NextResponse.rewrite(url));
  }

  if (lowerPathname === '/auth.html') {
    const url = request.nextUrl.clone();
    const mode = (url.searchParams.get('mode') || '').toLowerCase();
    url.pathname = '/auth';
    url.searchParams.delete('mode');
    if (mode === 'signup') url.searchParams.set('view', 'signup');
    else url.searchParams.set('view', 'login');
    return withEnvironmentHeaders(NextResponse.redirect(url));
  }

  if (lowerPathname === '/auth/login' || lowerPathname === '/auth/signup' || lowerPathname === '/auth/forgot') {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.search = '';
    url.searchParams.set('view', lowerPathname.split('/').pop());
    return withEnvironmentHeaders(NextResponse.redirect(url));
  }

  if (lowerPathname === '/setup-account') {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.search = '';
    url.searchParams.set('setup', '1');
    return withEnvironmentHeaders(NextResponse.redirect(url));
  }

  if (lowerPathname === '/cyber%20samachar%20unified.html' || lowerPathname === '/cyber samachar unified.html') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return withEnvironmentHeaders(NextResponse.redirect(url));
  }

  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/exact-ui-shell') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return withEnvironmentHeaders(NextResponse.next());
  }

  const firstSegment = pathname.split('/').filter(Boolean)[0] || '';

  if (firstSegment === 'auth') {
    const url = request.nextUrl.clone();
    url.pathname = '/exact-ui-shell';
    url.searchParams.set('screen', 'auth');
    url.searchParams.set('path', pathname);
    return withEnvironmentHeaders(NextResponse.rewrite(url));
  }

  if (EXACT_UI_PAGES.has(firstSegment)) {
    const url = request.nextUrl.clone();
    url.pathname = '/exact-ui-shell';
    url.searchParams.set('screen', 'app');
    url.searchParams.set('path', pathname);
    return withEnvironmentHeaders(NextResponse.rewrite(url));
  }

  return withEnvironmentHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
