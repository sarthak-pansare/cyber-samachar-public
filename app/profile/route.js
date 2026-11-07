import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from '@/lib/auth-session';
import { getContentClient, getUserAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeJson(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function monthYear(value) {
  if (!value) return 'recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function initials(nameOrEmail) {
  const parts = String(nameOrEmail || 'Cyber Samachar Reader')
    .replace(/@.*/, '')
    .split(/\s+|[._-]+/)
    .filter(Boolean);
  return ((parts[0]?.[0] || 'C') + (parts[1]?.[0] || 'S')).toUpperCase();
}

function titleForArticle(articleId, articleMap) {
  const article = articleMap.get(String(articleId));
  return article?.generated_headline || article?.title || `Article ${String(articleId).slice(0, 8)}`;
}

function cleanList(value, fallback = []) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return fallback;
}

function cleanObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function safeQuery(label, query) {
  try {
    const result = await query();
    if (result?.error) return { label, data: null };
    return { label, data: result?.data || null };
  } catch {
    return { label, data: null };
  }
}

async function getSignedAvatar(client, profilePhotoPath) {
  if (!client || !profilePhotoPath) return null;
  try {
    const { data, error } = await client.storage.from('profile-photos').createSignedUrl(profilePhotoPath, 60 * 30);
    if (error) return null;
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

async function getArticleMap(articleIds) {
  const contentClient = getContentClient();
  const ids = [...new Set(articleIds.map(String).filter((id) => /^[0-9a-f-]{32,36}$/i.test(id)))].slice(0, 20);
  if (!contentClient || ids.length === 0) return new Map();

  const { data, error } = await contentClient
    .from('published_data')
    .select('id,title,generated_headline,published_at')
    .in('id', ids);

  if (error || !Array.isArray(data)) return new Map();
  return new Map(data.map((article) => [String(article.id), article]));
}

async function getProfileState(request) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return { authenticated: false };

  const client = getUserAdminClient();
  if (!client) return { authenticated: false };

  const { data: authData, error: authError } = await client.auth.getUser(token);
  const user = authData?.user || null;
  if (authError || !user) return { authenticated: false };

  const userId = user.id;
  const [profileResult, savedResult, likedResult, historyResult, preferencesResult, activityResult] = await Promise.all([
    safeQuery('profile', () => client.from('profiles').select('*').eq('id', userId).maybeSingle()),
    safeQuery('saved', () => client.from('saved_articles').select('article_id,saved_at').eq('user_id', userId).order('saved_at', { ascending: false }).limit(8)),
    safeQuery('liked', () => client.from('liked_articles').select('article_id,liked_at').eq('user_id', userId).order('liked_at', { ascending: false }).limit(8)),
    safeQuery('history', () => client.from('reading_history').select('article_id,first_read_at,last_read_at,read_count').eq('user_id', userId).order('last_read_at', { ascending: false }).limit(8)),
    safeQuery('preferences', () => client.from('user_preferences').select('*').eq('user_id', userId).maybeSingle()),
    safeQuery('activity', () => client.from('login_history').select('event_type,created_at,ip_address,user_agent').eq('user_id', userId).order('created_at', { ascending: false }).limit(6)),
  ]);

  const profile = profileResult.data || {};
  const savedArticles = Array.isArray(savedResult.data) ? savedResult.data : [];
  const likedArticles = Array.isArray(likedResult.data) ? likedResult.data : [];
  const readingHistory = Array.isArray(historyResult.data) ? historyResult.data : [];
  const articleMap = await getArticleMap([
    ...savedArticles.map((item) => item.article_id),
    ...likedArticles.map((item) => item.article_id),
    ...readingHistory.map((item) => item.article_id),
  ]);

  return {
    authenticated: true,
    user,
    profile,
    avatarUrl: await getSignedAvatar(client, profile.profile_photo_path),
    savedArticles,
    likedArticles,
    readingHistory,
    preferences: preferencesResult.data || cleanObject(profile.preferences),
    activity: Array.isArray(activityResult.data) ? activityResult.data : [],
    articleMap,
  };
}

function channelPref(channels, keys) {
  return keys.some((key) => channels[key] === true || channels[key] === 'on' || channels[key] === 'true');
}

function buildProfileData(state) {
  const { user, profile, avatarUrl, savedArticles, likedArticles, readingHistory, preferences, activity, articleMap } = state;
  const prefObject = cleanObject(preferences?.feed_preferences) || cleanObject(preferences);
  const preferenceChannels = cleanObject(preferences?.notification_channels);
  const profileChannels = cleanObject(profile.notification_channels);
  const channels = { ...profileChannels, ...preferenceChannels, ...cleanObject(prefObject.channels) };
  const interests = cleanList(preferences?.interests, cleanList(profile.interests, cleanList(profile.preferred_categories, ['Cyber awareness'])));
  const goals = cleanList(prefObject.purposes, cleanList(profile.joining_reason, ['Stay updated']));
  const displayName = profile.full_name || profile.display_name || user.email || 'Cyber Samachar Reader';
  const email = user.email || profile.email || '';
  const member = monthYear(user.created_at || profile.created_at);
  const profession = profile.profession || 'Cyber Samachar Reader';
  const organisation = profile.organization_company || profile.organization || 'Cyber Samachar';
  const title = profile.job_title || profession;
  const educationParts = cleanObject(prefObject.education);
  const education = [educationParts.college || profile.college, educationParts.course || profile.course].filter(Boolean).join(' - ') || 'Not added';
  const specialisation = [educationParts.specialization || profile.specialization, educationParts.graduationYear || profile.graduation_year].filter(Boolean).join(' - ');
  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ') || 'Not added';

  return {
    displayName,
    initials: initials(displayName || email),
    email,
    phone: profile.phone_number || profile.phone || 'Not added',
    profession,
    organisation,
    title,
    education,
    specialisation,
    location,
    member,
    handle: profile.username ? `@${profile.username}` : `@${String(email || displayName).split('@')[0].replace(/[^a-z0-9]+/gi, '.').toLowerCase()}`,
    bio: profile.bio || 'Your Cyber Samachar profile is ready. Add a short bio from account setup to personalize this space.',
    avatarUrl,
    accountStatus: profile.account_status || (user.email_confirmed_at ? 'pending_setup' : 'pending_verification'),
    emailVerified: Boolean(user.email_confirmed_at || user.confirmed_at),
    interests,
    goals,
    savedArticles: savedArticles.map((item) => ({
      id: item.article_id,
      title: titleForArticle(item.article_id, articleMap),
      at: formatDate(item.saved_at),
    })),
    likedArticles: likedArticles.map((item) => ({
      id: item.article_id,
      title: titleForArticle(item.article_id, articleMap),
      at: formatDate(item.liked_at),
    })),
    readingHistory: readingHistory.map((item) => ({
      id: item.article_id,
      title: titleForArticle(item.article_id, articleMap),
      at: formatDate(item.last_read_at),
      count: item.read_count || 1,
    })),
    activity: activity.map((item) => ({
      type: item.event_type || 'activity',
      at: formatDate(item.created_at),
      ip: item.ip_address || 'IP hidden',
    })),
    stats: {
      saved: savedArticles.length,
      liked: likedArticles.length,
      alerts: Number(profile.active_alert_count || 0),
      streak: Math.max(1, readingHistory.length),
    },
    email_prefs: [
      ['Daily newsletter', 'A morning brief of top stories', channelPref(channels, ['dailyNewsletter', 'daily_newsletter', 'email', 'newsletter'])],
      ['Weekly digest', 'The week in cyber, every Sunday', channelPref(channels, ['weeklyDigest', 'weekly_digest'])],
      ['Breaking news', 'Major incidents as they break', channelPref(channels, ['breakingNews', 'breaking_news', 'alerts'])],
      ['Cyber alerts', 'Threats relevant to your interests', channelPref(channels, ['cyberAlerts', 'cyber_alerts', 'alerts'])],
      ['Government advisories', 'CERT-In & regulatory notices', channelPref(channels, ['governmentAdvisories', 'government_advisories'])],
      ['Event notifications', 'Workshops, webinars & meetups', channelPref(channels, ['eventNotifications', 'event_notifications', 'events'])],
    ],
    wa_prefs: [
      ['WhatsApp news', 'Curated headlines on WhatsApp', channelPref(channels, ['whatsappNews', 'whatsapp_news', 'whatsapp'])],
      ['WhatsApp alerts', 'Urgent threat alerts', channelPref(channels, ['whatsappAlerts', 'whatsapp_alerts', 'whatsapp'])],
      ['WhatsApp events', 'Event reminders & invites', channelPref(channels, ['whatsappEvents', 'whatsapp_events'])],
    ],
  };
}

function replaceFirst(html, pattern, replacement) {
  return html.replace(pattern, replacement);
}

function hydrateStaticHtml(html, profileData) {
  const profileJson = safeJson(profileData);
  let out = html
    .replaceAll('Cyber Samachar Unified.html', '/')
    .replaceAll('auth.html?mode=login', '/auth?view=login')
    .replaceAll('Aarav Sharma', escapeHtml(profileData.displayName))
    .replaceAll('aarav.sharma@gmail.com', escapeHtml(profileData.email))
    .replaceAll('SOC Analyst', escapeHtml(profileData.profession))
    .replaceAll('CERT-In', escapeHtml(profileData.organisation))
    .replaceAll('Tier-2 SOC Analyst', escapeHtml(profileData.title))
    .replaceAll('Pune, Maharashtra, India', escapeHtml(profileData.location))
    .replaceAll('Pune, Maharashtra Â· India', escapeHtml(profileData.location))
    .replaceAll('@aarav.sharma Â· Reader since Jan 2026', `${escapeHtml(profileData.handle)} - Reader since ${escapeHtml(profileData.member)}`)
    .replaceAll('Tier-2 SOC analyst tracking threat intel, ransomware and CERT-In advisories. Here to <strong>stay ahead of incidents</strong> and sharpen the team&#39;s detection playbook.', escapeHtml(profileData.bio));

  out = replaceFirst(out, /<span class="acct-av">[^<]*<\/span>/, `<span class="acct-av">${escapeHtml(profileData.initials)}</span>`);
  out = replaceFirst(out, /<div class="pf-avatar">[\s\S]*?<\/div>/, `<div class="pf-avatar">${profileData.avatarUrl ? `<img src="${escapeHtml(profileData.avatarUrl)}" alt="">` : escapeHtml(profileData.initials)}</div>`);
  out = replaceFirst(out, /<div class="pf-cover-tag">[\s\S]*?<\/div>/, `<div class="pf-cover-tag"><span class="dot"></span>Account ${escapeHtml(profileData.accountStatus.replaceAll('_', ' '))}</div>`);
  out = out.replace(
    /<div class="pf-role-row">[\s\S]*?<\/div>/,
    `<div class="pf-role-row">
          <span class="pf-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg><b>${escapeHtml(profileData.profession)}</b> - ${escapeHtml(profileData.organisation)}</span>
          <span class="pf-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>${escapeHtml(profileData.location)}</span>
        </div>`,
  );
  out = out.replace(/<div class="stat-val">48<\/div>/, `<div class="stat-val">${profileData.stats.saved}</div>`);
  out = out.replace(/<div class="stat-val">126<\/div>/, `<div class="stat-val">${profileData.stats.liked}</div>`);
  out = out.replace(/<div class="stat-val">5<\/div>/, `<div class="stat-val">${profileData.stats.alerts}</div>`);
  out = out.replace(/<div class="stat-val">12<span class="unit">days<\/span><\/div>/, `<div class="stat-val">${profileData.stats.streak}<span class="unit">days</span></div>`);
  out = out.replace(/const profile = \{[\s\S]*?\n  \};/, `const profile = window.__CS_PROFILE_DATA__;`);

  const dataScript = `<script id="cs-profile-data" type="application/json">${profileJson}</script><script>window.__CS_PROFILE_DATA__=JSON.parse(document.getElementById('cs-profile-data').textContent);</script>`;
  const bridge = `<script>
(function () {
  const data = window.__CS_PROFILE_DATA__;
  if (!data) return;
  const qs = (s) => document.querySelector(s);
  const qsa = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const setText = (s, v) => qsa(s).forEach((el) => { el.textContent = v || ''; });
  setText('.acct-av', data.initials);
  setText('.acct-name,.amh-name,.pf-name', data.displayName);
  setText('.pf-handle', data.handle + ' - Reader since ' + data.member);
  setText('.pf-bio', data.bio);
  setText('.amh-mail,.sec-row:first-child .sec-sub', data.email);
  const avatar = qs('.pf-avatar');
  if (avatar && data.avatarUrl) {
    avatar.textContent = '';
    avatar.style.backgroundImage = 'url("' + data.avatarUrl.replace(/"/g, '%22') + '")';
    avatar.style.backgroundSize = 'cover';
    avatar.style.backgroundPosition = 'center';
  }
  qsa('a[href="/auth?view=login"], .signout').forEach((el) => {
    el.addEventListener('click', async (event) => {
      event.preventDefault();
      try { await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
      window.location.href = '/Guest-Profile';
    });
  });
})();
</script>`;
  return out.replace('<script data-cfasync="false"', `${dataScript}<script data-cfasync="false"`).replace('</body>', `${bridge}</body>`);
}

export async function GET(request) {
  const state = await getProfileState(request);
  if (!state.authenticated) {
    return NextResponse.redirect(new URL('/Guest-Profile', request.url));
  }

  const templatePath = path.join(process.cwd(), 'public', 'User Profile.html');
  const html = await readFile(templatePath, 'utf8');
  const profileData = buildProfileData(state);

  return new Response(hydrateStaticHtml(html, profileData), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
