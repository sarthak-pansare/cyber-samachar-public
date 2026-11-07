import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getContentClient } from '@/lib/supabase';
import { buildEnvironmentBannerHtml, getEnvironmentPolicy } from '@/lib/environment-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FRONTEND_ROUTE_TO_ORIGINAL_PAGE = {
  '/': 'feed',
  '/about': 'about',
  '/archive': 'archive',
  '/bookmarks': 'bookmarks',
  '/categories': 'categories',
  '/cell': 'cell',
  '/law': 'law',
  '/privacy': 'privacy',
  '/report': 'report',
  '/scam': 'scam',
  '/terms': 'terms',
};

const LIVE_NEWS_MINIMUM = 6;
const LIVE_LIST_MINIMUM = 1;
const CATEGORY_ALIASES = [
  ['malware', ['malware', 'rat', 'trojan', 'android', 'payload']],
  ['breach', ['breach', 'ransomware', 'leak', 'healthcare', 'data']],
  ['nation', ['nation', 'apt', 'espionage', 'state', 'defence', 'ministry']],
  ['vuln', ['vuln', 'cve', 'zero-day', 'patch', 'rce', 'exploit']],
  ['fraud', ['fraud', 'scam', 'phishing', 'upi', 'sim', 'digital arrest']],
];

function escapeHtml(value) {
  return String(value || '')
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

function clientCaptchaDisabled() {
  const requested = String(process.env.NEXT_PUBLIC_AUTH_CAPTCHA_MODE || '').trim().toLowerCase() === 'disabled';
  return requested && getEnvironmentPolicy().captchaBypassAllowed;
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value) && value.length) || [];
}

function chooseCategory(article) {
  const haystack = firstArray(article.categories, article.tags, article.sub_categories)
    .join(' ')
    .toLowerCase();

  for (const [category, needles] of CATEGORY_ALIASES) {
    if (needles.some((needle) => haystack.includes(needle))) return category;
  }

  return 'general';
}

function normalizeSeverity(value) {
  const severity = String(value || '').toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(severity)) return severity;
  return 'medium';
}

function relativeTime(dateValue) {
  const timestamp = dateValue ? new Date(dateValue).getTime() : 0;
  if (!timestamp) return 'now';

  const diffHours = Math.max(1, Math.round((Date.now() - timestamp) / 36e5));
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function plainTextToArticleHtml(value) {
  const text = String(value || '').trim();
  if (!text) return '<p>Full article details are being prepared by the Cyber Samachar desk.</p>';

  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function estimateReadMins(value) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.ceil(words / 220));
}

function mapLiveArticleToOriginalNews(article, index) {
  const title = article.generated_headline || article.title || 'Cyber Samachar update';
  const body = article.generated_article || article.body || article.content || '';
  const summary =
    article.social_copy ||
    article.summary ||
    article.metadata?.meta_description ||
    String(body).slice(0, 220);
  const publishedAt = article.published_at || article.original_published_at || article.created_at;
  const tags = firstArray(article.tags, article.categories, article.sub_categories).slice(0, 4);

  return {
    id: String(article.id || article.processed_id || index + 1),
    author: article.source_name || article.author || 'Cyber Samachar Desk',
    date: publishedAt
      ? new Date(publishedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Cyber Samachar',
    breaking: Boolean(article.is_breaking || index === 0),
    featured: index === 0,
    tags,
    likes: Number(article.like_count || article.likes || 0),
    saves: Number(article.save_count || article.saves || 0),
    subtitle: summary,
    title,
    cat: chooseCategory(article),
    severity: normalizeSeverity(article.severity),
    source: article.source_name || article.source_domain || 'Cyber Samachar',
    time: relativeTime(publishedAt),
    views: Number(article.view_count || article.views || 0),
    readMins: Number(article.read_mins || article.readMins || estimateReadMins(body)),
    summary,
    content: plainTextToArticleHtml(body),
    cover: article.card_image_url || article.image || undefined,
    audience:
      article.track === 'professional' || (article.is_technical && !article.is_general)
        ? 'pro'
        : article.track === 'general' || (article.is_general && !article.is_technical)
          ? 'general'
          : 'both',
  };
}

function mapLiveCategory(category, articles) {
  const id = String(category.id || category.slug || '').trim();
  if (!id) return null;
  const count = articles.filter((article) => article.cat === id).length;

  return {
    id,
    label: category.label_en || category.label || id,
    label_hi: category.label_hi || undefined,
    icon: category.icon_key || '',
    count,
    color: category.color || 'var(--accent)',
    desc: category.description || '',
  };
}

function mapLiveNotification(notification) {
  return {
    id: String(notification.id),
    icon: '',
    title: notification.title_en || notification.title || 'Cyber Samachar alert',
    title_hi: notification.title_hi || undefined,
    time: relativeTime(notification.published_at || notification.created_at).replace(/\s+ago$/, ''),
    unread: true,
    articleId: notification.target_type === 'article' && notification.target_id ? String(notification.target_id) : '1',
  };
}

function mapLiveLawLib(sections, acts) {
  const actById = new Map(acts.map((act) => [act.id, act]));
  return Object.fromEntries(
    sections
      .filter((section) => section.act_id && section.section_number && section.title_en)
      .map((section) => {
        const act = actById.get(section.act_id) || {};
        const key = `${section.act_id}.${String(section.section_number).replace(/[^\w-]+/g, '').toLowerCase()}`;
        return [
          key,
          {
            num: `§ ${section.section_number}`,
            act: act.short_name || act.name_en || section.act_id,
            title: section.title_en,
            title_hi: section.title_hi || undefined,
            kind: section.act_id,
          },
        ];
      }),
  );
}

function normalizeCellType(value) {
  const type = String(value || '').toLowerCase();
  if (type.includes('women')) return 'women';
  if (type.includes('hq') || type.includes('head')) return 'hq';
  return 'cybercell';
}

function mapLiveCyberCell(cell) {
  return {
    id: String(cell.id),
    state: cell.state || '',
    city: cell.city || cell.state || '',
    type: normalizeCellType(cell.type),
    name: cell.name || 'Cyber Cell',
    station: cell.address || cell.city || '',
    phone: cell.phone || '',
    email: cell.email || '',
    juris: cell.officer_contact || cell.address || cell.portal_url || 'Jurisdiction details will be updated.',
    lat: Number(cell.latitude || 0),
    lng: Number(cell.longitude || 0),
  };
}

function mapLiveScamSpotlight(spotlight) {
  const published = spotlight.week_start || spotlight.published_at || spotlight.created_at;
  const date = published ? new Date(published) : null;
  return {
    week: date
      ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      : 'Current',
    num: Number(spotlight.issue_number || 1),
    title: spotlight.title_en || 'Scam spotlight',
    title_hi: spotlight.title_hi || undefined,
    loss: spotlight.loss_figure || '',
    hook: spotlight.hook_en || spotlight.body_en || '',
  };
}

async function safeSelect(client, table, query, fallback = []) {
  const { data, error } = await query(client.from(table));
  if (error || !Array.isArray(data)) return fallback;
  return data;
}

async function getLiveContentOverrides() {
  const client = getContentClient();
  if (!client) return null;

  const { data: rpcFeedData, error: feedError } = await client.rpc('get_feed', {
    cat: 'all',
    audience: 'all',
    q: '',
    page: 1,
    page_size: 24,
  });

  let feedData = rpcFeedData;
  if (feedError || !Array.isArray(feedData)) {
    const direct = await client
      .from('published_data')
      .select('*')
      .eq('status', 'published')
      .not('generated_headline', 'is', null)
      .not('generated_article', 'is', null)
      .order('published_at', { ascending: false })
      .limit(24);
    if (!direct.error) feedData = direct.data;
  }

  if (!Array.isArray(feedData) || feedData.length < LIVE_NEWS_MINIMUM) return null;

  const articles = feedData.map(mapLiveArticleToOriginalNews);
  const [categories, notifications, lawActs, lawSections, cyberCells, scamSpotlights] = await Promise.all([
    safeSelect(client, 'categories', (q) => q.select('*').eq('is_active', true).order('display_order')),
    safeSelect(client, 'notifications', (q) => q.select('*').eq('is_public', true).order('published_at', { ascending: false }).limit(8)),
    safeSelect(client, 'law_acts', (q) => q.select('*').eq('is_active', true).order('display_order')),
    safeSelect(client, 'law_sections', (q) => q.select('*').eq('is_active', true).limit(250)),
    safeSelect(client, 'cyber_cells', (q) => q.select('*').eq('is_active', true).limit(200)),
    safeSelect(client, 'scam_spotlights', (q) => q.select('*').order('published_at', { ascending: false }).limit(12)),
  ]);

  return {
    NEWS: articles,
    CATEGORIES: categories.map((category) => mapLiveCategory(category, articles)).filter(Boolean),
    NOTIFICATIONS: notifications.map(mapLiveNotification),
    LAW_LIB: mapLiveLawLib(lawSections, lawActs),
    CYBER_CELLS: cyberCells.map(mapLiveCyberCell).filter((cell) => cell.name && cell.state),
    SCAM_ARCHIVE: scamSpotlights.map(mapLiveScamSpotlight),
  };
}

function replaceConst(html, name, value) {
  const serialized = safeJson(value);
  const arrayPattern = new RegExp(`const ${name} = \\[[\\s\\S]*?\\];`);
  const objectPattern = new RegExp(`const ${name} = \\{[\\s\\S]*?\\};`);
  if (arrayPattern.test(html)) return html.replace(arrayPattern, `const ${name} = ${serialized};`);
  if (objectPattern.test(html)) return html.replace(objectPattern, `const ${name} = ${serialized};`);
  return html;
}

function injectLiveContent(html, overrides) {
  if (!overrides || !Array.isArray(overrides.NEWS) || overrides.NEWS.length < LIVE_NEWS_MINIMUM) return html;

  let nextHtml = replaceConst(html, 'NEWS', overrides.NEWS);
  for (const name of ['CATEGORIES', 'NOTIFICATIONS', 'CYBER_CELLS', 'SCAM_ARCHIVE']) {
    if (Array.isArray(overrides[name]) && overrides[name].length >= LIVE_LIST_MINIMUM) {
      nextHtml = replaceConst(nextHtml, name, overrides[name]);
    }
  }

  if (overrides.LAW_LIB && Object.keys(overrides.LAW_LIB).length >= LIVE_LIST_MINIMUM) {
    nextHtml = replaceConst(nextHtml, 'LAW_LIB', overrides.LAW_LIB);
  }

  return nextHtml;
}

function buildRouteBridge(routePath) {
  const pathLiteral = JSON.stringify(routePath || '/');

  return `<script id="cs-next-route-bridge">
(function () {
  var routePath = ${pathLiteral};
  var pageMap = ${JSON.stringify(FRONTEND_ROUTE_TO_ORIGINAL_PAGE)};

  function getRouteParts() {
    return String(routePath || '/').replace(/^\\/+|\\/+$/g, '').split('/').filter(Boolean);
  }

  function activateOriginalPage() {
    var parts = getRouteParts();
    var first = parts[0] || '';
    var target = pageMap['/' + first] || pageMap['/'];

    if (first === 'search') {
      target = 'feed';
    }

    if (typeof window.showPage !== 'function') {
      window.setTimeout(activateOriginalPage, 60);
      return;
    }

    try {
      if (first === 'article' && typeof window.openArticle === 'function') {
        var articleId = parts[1] || '1';
        var hasMatchingCard = Array.prototype.some.call(document.querySelectorAll('[onclick]'), function (el) {
          var action = el.getAttribute('onclick') || '';
          return action.indexOf("openArticle('" + articleId + "')") !== -1 || action.indexOf('openArticle("' + articleId + '")') !== -1;
        });
        window.showPage('feed');
        window.openArticle(hasMatchingCard ? articleId : '1');
        return;
      }

      if (document.getElementById('page-' + target)) {
        window.showPage(target);
      }

      if (first === 'search') {
        var q = new URLSearchParams(window.location.search).get('q') || '';
        var navInput = document.getElementById('navSearchInput');
        var mobileInput = document.getElementById('mSearchInput');
        document.body.setAttribute('data-cs-search-route', q);
        if (navInput) navInput.value = q;
        if (mobileInput) mobileInput.value = q;
        if (q && typeof window.filterFeed === 'function') {
          window.filterFeed(q);
        }
      }
    } catch (error) {
      console.warn('Cyber Samachar route bridge could not activate page', error);
    }
  }

  if (document.readyState === 'complete') {
    window.setTimeout(activateOriginalPage, 80);
  } else {
    window.addEventListener('load', function () {
      window.setTimeout(activateOriginalPage, 80);
    });
  }
})();
</script>`;
}

function buildBehaviorBridge() {
  const turnstileSiteKey = safeJson(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '');
  const captchaClientDisabled = safeJson(clientCaptchaDisabled());

  return `<script id="cs-backend-behavior-bridge">
(function () {
  var turnstileSiteKey = ${turnstileSiteKey};
  var captchaClientDisabled = ${captchaClientDisabled};
  var turnstileScriptLoading = null;

  function loadTurnstile() {
    if (captchaClientDisabled) return Promise.resolve(false);
    if (!turnstileSiteKey) return Promise.resolve(false);
    if (window.turnstile) return Promise.resolve(true);
    if (turnstileScriptLoading) return turnstileScriptLoading;
    turnstileScriptLoading = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = false;
      script.onload = function () { resolve(Boolean(window.turnstile)); };
      script.onerror = function () { resolve(false); };
      document.head.appendChild(script);
    });
    return turnstileScriptLoading;
  }

  function getTurnstileToken(action) {
    if (captchaClientDisabled) return Promise.resolve(null);
    if (!turnstileSiteKey) return Promise.resolve(null);
    return loadTurnstile().then(function (ready) {
      if (!ready || !window.turnstile) return null;
      return new Promise(function (resolve) {
        function renderChallenge() {
        var container = document.createElement('div');
        var containerId = 'cs-turnstile-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        container.id = containerId;
        container.style.position = 'fixed';
        container.style.right = '0';
        container.style.bottom = '0';
        container.style.width = '300px';
        container.style.minHeight = '65px';
        container.style.zIndex = '2147483647';
        document.body.appendChild(container);
        var resolved = false;
        function finish(token) {
          if (resolved) return;
          resolved = true;
          try { window.turnstile.remove(widgetId); } catch (_) {}
          try { container.remove(); } catch (_) {}
          resolve(token || null);
        }
        var widgetId = window.turnstile.render(container, {
          sitekey: turnstileSiteKey,
          execution: 'execute',
          appearance: 'interaction-only',
          action: action || 'submit',
          callback: finish,
          'error-callback': function (code) { window.__csTurnstileLastError = code || 'error'; finish(null); },
          'expired-callback': function () { window.__csTurnstileLastError = 'expired'; finish(null); },
          'timeout-callback': function () { window.__csTurnstileLastError = 'timeout'; finish(null); }
        });
        window.turnstile.execute(widgetId);
        window.setTimeout(function () { window.__csTurnstileLastError = 'local_timeout'; finish(null); }, 60000);
        }
        if (typeof window.turnstile.ready === 'function') window.turnstile.ready(renderChallenge);
        else renderChallenge();
      });
    });
  }

  function needsTurnstile(url) {
    if (captchaClientDisabled) return false;
    return /\\/api\\/(newsletter|waitlist|report)(\\/|$)/.test(String(url || ''));
  }

  async function postJson(url, payload) {
    try {
      var headers = { 'Content-Type': 'application/json' };
      var nextPayload = Object.assign({}, payload || {});
      if (needsTurnstile(url) && !nextPayload.turnstileToken) {
        nextPayload.turnstileToken = await getTurnstileToken(String(url).replace(/^\\/api\\//, '').replace(/[^a-z0-9_-]+/gi, '-'));
      }
      return fetch(url, {
        method: 'POST',
        headers: headers,
        credentials: 'same-origin',
        body: JSON.stringify(nextPayload),
        keepalive: true
      }).catch(function () {});
    } catch (_) {}
  }

  function anonId() {
    try {
      var key = 'csAnonId';
      var existing = localStorage.getItem(key);
      if (existing) return existing;
      var next = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
      localStorage.setItem(key, next);
      return next;
    } catch (_) {
      return 'anonymous';
    }
  }

  function wrapWhenReady() {
    if (typeof window.openArticle !== 'function' || typeof window.toggleLike !== 'function' || typeof window.toggleBookmark !== 'function') {
      window.setTimeout(wrapWhenReady, 80);
      return;
    }

    if (!window.__csBackendBridgeReady) {
      window.__csBackendBridgeReady = true;

      var originalOpenArticle = window.openArticle;
      window.openArticle = function (id) {
        var result = originalOpenArticle.apply(this, arguments);
        postJson('/api/article/' + encodeURIComponent(id) + '/view', { anonId: anonId() });
        postJson('/api/v1/articles/reading-history', { articleId: String(id) });
        return result;
      };

      var originalToggleLike = window.toggleLike;
      window.toggleLike = function (id, btn) {
        var result = originalToggleLike.apply(this, arguments);
        postJson('/api/article/' + encodeURIComponent(id) + '/like', { anonId: anonId() });
        postJson('/api/v1/articles/likes', { articleId: String(id), liked: true });
        return result;
      };

      var originalToggleBookmark = window.toggleBookmark;
      window.toggleBookmark = function (id, btn) {
        var result = originalToggleBookmark.apply(this, arguments);
        var saved = false;
        try { saved = JSON.parse(localStorage.getItem('csBookmarks') || '[]').indexOf(String(id)) !== -1; } catch (_) {}
        postJson('/api/v1/articles/bookmarks', { articleId: String(id), saved: saved });
        return result;
      };

      if (typeof window.subscribeNL === 'function') {
        var originalSubscribeNL = window.subscribeNL;
        window.subscribeNL = function () {
          var result = originalSubscribeNL.apply(this, arguments);
          var email = document.getElementById('nlEmail') && document.getElementById('nlEmail').value;
          var name = document.getElementById('nlName') && document.getElementById('nlName').value;
          if (email) postJson('/api/newsletter', { email: email, name: name, source: 'locked-ui' });
          return result;
        };
      }

      if (typeof window.pfSave === 'function') {
        var originalPfSave = window.pfSave;
        window.pfSave = function () {
          var result = originalPfSave.apply(this, arguments);
          try { postJson('/api/profile/preferences', { preferences: JSON.parse(localStorage.getItem('cs_pf') || '{}') }); } catch (_) {}
          return result;
        };
      }

      var originalShowPage = window.showPage;
      window.showPage = function (page) {
        if (page === 'profile') {
          fetch('/api/v1/auth/session', {
            credentials: 'same-origin',
            cache: 'no-store'
          })
            .then(function (response) { return response.ok ? response.json() : null; })
            .then(function (data) {
              window.location.href = data && data.authenticated ? '/profile' : '/Guest-Profile';
            })
            .catch(function () {
              window.location.href = '/Guest-Profile';
            });
          return;
        }
        return originalShowPage.apply(this, arguments);
      };
    }
  }

  wrapWhenReady();
})();
</script>`;
}

function buildAuthBridge() {
  const turnstileSiteKey = safeJson(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '');
  const captchaClientDisabled = safeJson(clientCaptchaDisabled());

  return `<script id="cs-auth-backend-bridge">
(function () {
  var currentUser = null;
  var currentResetEmail = '';
  var resetSessionReady = false;
  var turnstileSiteKey = ${turnstileSiteKey};
  var captchaClientDisabled = ${captchaClientDisabled};
  var turnstileScriptLoading = null;
  var turnstileTokens = {};
  var turnstileMounts = {};

  function saveSession(_) {}

  function loadTurnstile() {
    if (captchaClientDisabled) return Promise.resolve(false);
    if (!turnstileSiteKey) return Promise.resolve(false);
    if (window.turnstile) return Promise.resolve(true);
    if (turnstileScriptLoading) return turnstileScriptLoading;
    turnstileScriptLoading = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = false;
      script.onload = function () { resolve(Boolean(window.turnstile)); };
      script.onerror = function () { resolve(false); };
      document.head.appendChild(script);
    });
    return turnstileScriptLoading;
  }

  function normalizeTurnstileAction(action) {
    return String(action || 'auth').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 32) || 'auth';
  }

  function captchaIdForTurnstileAction(action) {
    if (/signup/.test(action)) return 'su-captcha';
    if (/login/.test(action)) return 'lg-captcha';
    if (/forgot-password/.test(action)) return 'fp-captcha';
    if (/reset-password/.test(action)) return 'cs-reset-captcha';
    return null;
  }

  function cacheTurnstileToken(action, token) {
    var key = normalizeTurnstileAction(action);
    window.__csTurnstileReadyActions = window.__csTurnstileReadyActions || {};
    if (!token) {
      delete turnstileTokens[key];
      window.__csTurnstileReadyActions[key] = false;
      return;
    }
    turnstileTokens[key] = { token: token, expiresAt: Date.now() + 240000 };
    window.__csTurnstileReadyActions[key] = true;
  }

  function cachedTurnstileToken(action) {
    var key = normalizeTurnstileAction(action);
    var entry = turnstileTokens[key];
    if (!entry || !entry.token || entry.expiresAt <= Date.now()) {
      delete turnstileTokens[key];
      return null;
    }
    return entry.token;
  }

  function markCaptchaTurnstileState(id, state) {
    var el = id && document.getElementById(id);
    if (!el) return;
    el.classList.toggle('checked', state === 'ok');
    el.classList.toggle('loading', state === 'loading');
    el.setAttribute('aria-checked', state === 'ok' ? 'true' : 'false');
  }

  function markCaptchaTemporarilyDisabled(id) {
    var captcha = id && document.getElementById(id);
    if (!captcha) return;
    captcha.setAttribute('aria-disabled', 'true');
    captcha.setAttribute('data-captcha-mode', 'disabled');
    if (captcha.getAttribute('aria-checked') !== 'true' && typeof captcha.click === 'function') {
      captcha.click();
    }
    window.setTimeout(function () {
      var text = document.getElementById(id + '-txt');
      captcha.classList.remove('loading');
      captcha.classList.add('checked');
      captcha.setAttribute('aria-checked', 'true');
      if (text) text.textContent = 'Development environment only';
    }, 950);
  }

  function captchaIsVisible(el) {
    return Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }

  function mountTurnstileInCaptcha(action) {
    var normalizedAction = normalizeTurnstileAction(action);
    if (captchaClientDisabled) {
      markCaptchaTemporarilyDisabled(captchaIdForTurnstileAction(normalizedAction));
      return Promise.resolve(null);
    }
    if (turnstileMounts[normalizedAction]) return turnstileMounts[normalizedAction].promise;
    var captchaId = captchaIdForTurnstileAction(normalizedAction);
    var captcha = captchaId && document.getElementById(captchaId);
    if (!captcha || !turnstileSiteKey || !captchaIsVisible(captcha)) return null;
    markCaptchaTurnstileState(captchaId, 'loading');
    var promise = loadTurnstile().then(function (ready) {
      if (!ready || !window.turnstile) return null;
      return new Promise(function (resolve) {
        var mount = document.createElement('div');
        mount.className = 'cs-turnstile-mount';
        mount.style.width = '300px';
        mount.style.maxWidth = '100%';
        mount.style.minHeight = '65px';
        mount.style.margin = '0 auto';
        Array.prototype.forEach.call(captcha.children, function (child) {
          child.style.display = 'none';
        });
        captcha.appendChild(mount);
        var resolved = false;
        function finish(token) {
          if (resolved) return;
          resolved = true;
          cacheTurnstileToken(normalizedAction, token);
          markCaptchaTurnstileState(captchaId, token ? 'ok' : '');
          resolve(token || null);
        }
        function renderWidget() {
          var widgetId = window.turnstile.render(mount, {
            sitekey: turnstileSiteKey,
            execution: 'execute',
            appearance: 'always',
            theme: 'auto',
            action: normalizedAction,
            callback: finish,
            'error-callback': function (code) {
              window.__csTurnstileLastError = code || 'error';
              cacheTurnstileToken(normalizedAction, null);
              markCaptchaTurnstileState(captchaId, '');
              resolve(null);
            },
            'expired-callback': function () {
              window.__csTurnstileLastError = 'expired';
              cacheTurnstileToken(normalizedAction, null);
              markCaptchaTurnstileState(captchaId, '');
            },
            'timeout-callback': function () {
              window.__csTurnstileLastError = 'timeout';
              cacheTurnstileToken(normalizedAction, null);
              markCaptchaTurnstileState(captchaId, '');
              resolve(null);
            }
          });
          if (turnstileMounts[normalizedAction]) turnstileMounts[normalizedAction].widgetId = widgetId;
          window.turnstile.execute(widgetId);
        }
        if (typeof window.turnstile.ready === 'function') window.turnstile.ready(renderWidget);
        else renderWidget();
        window.setTimeout(function () {
          if (!resolved) {
            window.__csTurnstileLastError = 'local_timeout';
            finish(null);
          }
        }, 60000);
      });
    });
    turnstileMounts[normalizedAction] = { promise: promise };
    return promise;
  }

  function mountAuthTurnstiles() {
    if (captchaClientDisabled) {
      ['lg-captcha', 'su-captcha', 'fp-captcha', 'cs-reset-captcha'].forEach(markCaptchaTemporarilyDisabled);
      return;
    }
    ['v1-auth-signup', 'v1-auth-login', 'v1-auth-forgot-password'].forEach(function (action) {
      mountTurnstileInCaptcha(action);
    });
  }

  function remountTurnstileInCaptcha(action) {
    var normalizedAction = normalizeTurnstileAction(action);
    var captchaId = captchaIdForTurnstileAction(normalizedAction);
    var captcha = captchaId && document.getElementById(captchaId);
    if (!captcha) return null;
    var existing = turnstileMounts[normalizedAction];
    if (existing && existing.widgetId !== undefined && window.turnstile) {
      try { window.turnstile.remove(existing.widgetId); } catch (_) {}
    }
    Array.prototype.forEach.call(captcha.querySelectorAll('.cs-turnstile-mount'), function (mount) {
      mount.remove();
    });
    delete turnstileMounts[normalizedAction];
    cacheTurnstileToken(normalizedAction, null);
    return mountTurnstileInCaptcha(normalizedAction);
  }

  window.__csRemountTurnstileForAction = remountTurnstileInCaptcha;

  function getOverlayTurnstileToken(action) {
    if (captchaClientDisabled) return Promise.resolve(null);
    if (!turnstileSiteKey) return Promise.resolve(null);
    return loadTurnstile().then(function (ready) {
      if (!ready || !window.turnstile) return null;
      return new Promise(function (resolve) {
        function renderChallenge() {
        var container = document.createElement('div');
        var containerId = 'cs-auth-turnstile-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        container.id = containerId;
        container.style.position = 'fixed';
        container.style.right = '0';
        container.style.bottom = '0';
        container.style.width = '300px';
        container.style.minHeight = '65px';
        container.style.zIndex = '2147483647';
        document.body.appendChild(container);
        var widgetId = null;
        var resolved = false;
        function finish(token) {
          if (resolved) return;
          resolved = true;
          try { if (widgetId !== null) window.turnstile.remove(widgetId); } catch (_) {}
          try { container.remove(); } catch (_) {}
          resolve(token || null);
        }
        widgetId = window.turnstile.render(container, {
          sitekey: turnstileSiteKey,
          execution: 'execute',
          appearance: 'interaction-only',
          action: action || 'auth',
          callback: finish,
          'error-callback': function (code) { window.__csTurnstileLastError = code || 'error'; finish(null); },
          'expired-callback': function () { window.__csTurnstileLastError = 'expired'; finish(null); },
          'timeout-callback': function () { window.__csTurnstileLastError = 'timeout'; finish(null); }
        });
        window.turnstile.execute(widgetId);
        window.setTimeout(function () { window.__csTurnstileLastError = 'local_timeout'; finish(null); }, 60000);
        }
        if (typeof window.turnstile.ready === 'function') window.turnstile.ready(renderChallenge);
        else renderChallenge();
      });
    });
  }

  function getTurnstileToken(action) {
    if (captchaClientDisabled) return Promise.resolve(null);
    var normalizedAction = normalizeTurnstileAction(action);
    var cached = cachedTurnstileToken(normalizedAction);
    if (cached) return Promise.resolve(cached);
    var placeholderPromise = mountTurnstileInCaptcha(normalizedAction);
    if (placeholderPromise) {
      return placeholderPromise.then(function (token) {
        return token || cachedTurnstileToken(normalizedAction) || getOverlayTurnstileToken(normalizedAction);
      });
    }
    return getOverlayTurnstileToken(normalizedAction);
  }

  function needsTurnstile(url) {
    if (captchaClientDisabled) return false;
    return /\\/api\\/(v1\\/)?auth\\/(signup|login|forgot-password|reset-password|verify-email-otp|resend-email-otp|verify-reset-otp)(\\/|$)/.test(String(url || ''));
  }

  function showLoginScene(name) {
    document.querySelectorAll('#view-login .scene').forEach(function (scene) { scene.classList.remove('show'); });
    var target = document.getElementById('lg-scene-' + name);
    if (target) target.classList.add('show');
  }

  function showSignupScene(name) {
    document.querySelectorAll('#view-signup .scene').forEach(function (scene) { scene.classList.remove('show'); });
    var target = document.getElementById('su-scene-' + name);
    if (target) target.classList.add('show');
  }

  function setButtonLoading(button, loading, label) {
    if (!button) return;
    button.classList.toggle('loading', loading);
    button.disabled = loading;
    var labelEl = button.querySelector('.btn-label');
    if (labelEl && label) labelEl.textContent = label;
  }

  async function postAuth(url, payload) {
    var nextPayload = Object.assign({}, payload || {});
    if (needsTurnstile(url) && !nextPayload.turnstileToken) {
      nextPayload.turnstileToken = await getTurnstileToken(String(url).replace(/^\\/api\\//, '').replace(/[^a-z0-9_-]+/gi, '-'));
    }
    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(nextPayload)
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || 'Authentication failed.');
    return data;
  }

  function readValue(id) {
    var el = document.getElementById(id);
    return el && typeof el.value === 'string' ? el.value.trim() : '';
  }

  function applySignupPasswordPolicy() {
    var specialRequirement = document.querySelector('[data-rule="special"]');
    if (!specialRequirement) return;
    specialRequirement.hidden = true;
    specialRequirement.setAttribute('aria-hidden', 'true');
  }

  function readOtp(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector + ' input')).map(function (box) {
      return String(box.value || '').replace(/\\D/g, '').slice(0, 1);
    }).join('');
  }

  function clearOtp(selector) {
    Array.prototype.slice.call(document.querySelectorAll(selector + ' input')).forEach(function (box) {
      box.value = '';
      box.disabled = false;
      box.classList.remove('filled');
    });
  }

  function setSignupOtpStatus(kind, message) {
    var status = document.getElementById('su-status-email');
    var group = document.getElementById('su-otp-inputs-email');
    if (status) {
      status.className = kind ? 'otp-status ' + kind : 'otp-status';
      status.innerHTML = message ? '<span>' + message + '</span>' : '';
    }
    if (group) {
      group.classList.toggle('invalid', kind === 'err');
      group.classList.toggle('verified', kind === 'ok');
    }
  }

  function setForgotOtpHint(kind, message) {
    var hint = document.getElementById('fp-otp-hint');
    var group = document.getElementById('fp-otp-inputs');
    if (hint) {
      hint.className = kind ? 'hint otp-hint ' + kind : 'hint otp-hint';
      hint.innerHTML = message ? '<span>' + message + '</span>' : '';
    }
    if (group) {
      group.classList.toggle('invalid', kind === 'err');
      group.classList.toggle('ok', kind === 'ok');
    }
  }

  function prepareSignupOtpScene(email) {
    var target = document.getElementById('su-email-target');
    if (target) target.textContent = email || 'your email';
    var emailStat = document.getElementById('su-vstat-email');
    if (emailStat) emailStat.textContent = 'Code sent';
    var whatsapp = document.getElementById('su-otp-whatsapp');
    if (whatsapp) whatsapp.style.display = 'none';
    var whatsappTrack = document.querySelector('.vtrack-item[data-v="whatsapp"]');
    if (whatsappTrack) whatsappTrack.style.display = 'none';
    var banner = document.querySelector('#su-scene-verify .verify-banner span');
    if (banner) banner.innerHTML = 'Your account activates after <b>Email OTP</b> verification.';
    var desc = document.querySelector('#su-scene-verify .card-desc');
    if (desc) desc.textContent = 'Enter the 6-digit code sent to your email.';
    var demo = document.querySelector('#su-otp-email .demo-hint');
    if (demo) demo.style.display = 'none';
    clearOtp('#su-otp-inputs-email');
    setSignupOtpStatus('', 'Code sent. Check your inbox.');
    var resend = document.getElementById('su-resend-email');
    if (resend) window.setTimeout(function () { resend.disabled = false; }, 30000);
  }

  function finishSignupOtp(data, email) {
    currentUser = data.user || currentUser || { email: email };
    var emailStat = document.getElementById('su-vstat-email');
    if (emailStat) emailStat.textContent = 'Verified';
    setSignupOtpStatus('ok', 'Email verified successfully.');
    var done = document.querySelector('#su-scene-done p');
    if (done) done.innerHTML = 'Welcome to Cyber Samachar, <b id="su-welcome" style="color:var(--text)"></b>. Email is verified - one quick step left to tailor your experience.';
    var welcome = document.getElementById('su-welcome');
    if (welcome) {
      var name = (currentUser && currentUser.profile && currentUser.profile.fullName) || (email ? email.split('@')[0] : 'defender');
      welcome.textContent = String(name).trim().split(/\\s+/)[0] || 'defender';
    }
    var chips = document.querySelectorAll('#su-scene-done .success-chips .trust-pill');
    if (chips[1]) chips[1].style.display = 'none';
    showSignupScene('done');
    window.setTimeout(function () { window.location.href = '/setup-account'; }, 900);
  }

  function selectedChips(id) {
    return Array.prototype.slice.call(document.querySelectorAll('#' + id + ' .sel-chip.on')).map(function (chip) {
      return chip.getAttribute('data-val') || chip.textContent.trim();
    });
  }

  function prefState() {
    var out = {};
    Array.prototype.slice.call(document.querySelectorAll('#view-setup .pref-item')).forEach(function (item) {
      var key = item.getAttribute('data-key');
      if (key) out[key] = item.classList.contains('on');
    });
    return out;
  }

  function setupPayload() {
    var profile = currentUser && currentUser.profile ? currentUser.profile : {};
    var email = currentUser && currentUser.email ? currentUser.email : '';
    var fallbackName = profile.fullName || (email ? email.split('@')[0] : 'Cyber Samachar Reader');
    return {
      fullName: fallbackName,
      username: readValue('sw-username'),
      profession: readValue('sw-profession'),
      organization: readValue('sw-org'),
      college: readValue('sw-college'),
      jobTitle: readValue('sw-title'),
      country: readValue('sw-country'),
      state: readValue('sw-state'),
      city: readValue('sw-city'),
      interests: selectedChips('sw-interests'),
      preferences: {
        language: document.documentElement.getAttribute('lang') || 'en',
        education: {
          college: readValue('sw-college'),
          course: readValue('sw-course'),
          specialization: readValue('sw-spec'),
          graduationYear: readValue('sw-gradyear')
        },
        purposes: selectedChips('sw-purpose'),
        channels: prefState()
      },
      notificationChannels: prefState(),
      bio: readValue('sw-bio')
    };
  }

  function openSetup(user) {
    currentUser = user || currentUser;
    if (typeof window.__openSetup === 'function') {
      window.__openSetup({
        name: (currentUser && currentUser.profile && currentUser.profile.fullName) || (currentUser && currentUser.email) || 'Cyber Samachar Reader',
        email: (currentUser && currentUser.email) || '',
        phone: ''
      });
    }
  }

  function showForgotScene(name) {
    document.querySelectorAll('.view').forEach(function (view) { view.classList.remove('show'); });
    var forgotView = document.getElementById('view-forgot');
    if (forgotView) forgotView.classList.add('show');
    document.querySelectorAll('#view-forgot .scene').forEach(function (scene) { scene.classList.remove('show'); });
    var scene = document.getElementById('fp-scene-' + name);
    if (scene) scene.classList.add('show');
  }

  function mountResetPasswordForm() {
    var wrap = document.querySelector('#fp-scene-verified .state-back');
    if (!wrap || wrap.dataset.backendResetForm) return;
    wrap.dataset.backendResetForm = '1';
    wrap.innerHTML = ''
      + '<form id="cs-reset-form" style="display:grid;gap:11px;">'
      + '<div class="input-wrap"><input type="password" id="cs-reset-pass" autocomplete="new-password" placeholder="New password" required></div>'
      + '<div class="input-wrap"><input type="password" id="cs-reset-confirm" autocomplete="new-password" placeholder="Confirm new password" required></div>'
      + '<div id="cs-reset-captcha" style="display:flex;justify-content:center;min-height:65px;"></div>'
      + '<button type="submit" class="btn btn-primary" id="cs-reset-btn"><span class="btn-label">Update password</span><span class="spinner"></span></button>'
      + '</form>'
      + '<span class="cn-link" data-goto="login" role="link" tabindex="0" style="justify-content:center;font-size:13px;">Return to login instead -></span>';

    mountTurnstileInCaptcha('v1-auth-reset-password');

    var form = document.getElementById('cs-reset-form');
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      var button = document.getElementById('cs-reset-btn');
      var password = (document.getElementById('cs-reset-pass') || {}).value || '';
      var confirm = (document.getElementById('cs-reset-confirm') || {}).value || '';
      if (password !== confirm) {
        alert('Passwords do not match.');
        return;
      }
      setButtonLoading(button, true, 'Updating...');
      try {
        await postAuth('/api/v1/auth/reset-password', { password: password, email: currentUser && currentUser.email });
        alert('Password updated. Please sign in with your new password.');
        window.location.href = '/auth';
      } catch (error) {
        alert(error.message || 'Could not update password.');
      } finally {
        setButtonLoading(button, false, 'Update password');
      }
    }, true);
  }

  function applyRequestedAuthView() {
    var view = new URLSearchParams(location.search).get('view')
      || new URLSearchParams(location.search).get('mode')
      || '';
    view = String(view).toLowerCase();
    if (view !== 'login' && view !== 'signup' && view !== 'forgot') return;
    window.setTimeout(function () {
      var target = document.querySelector('[data-goto="' + view + '"]');
      if (target && typeof target.click === 'function') target.click();
      window.setTimeout(mountAuthTurnstiles, 250);
    }, 120);
  }

  async function bootSession() {
    try {
      var hash = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
      var isResetCallback = hash.get('type') === 'recovery' || /[?&]reset=1/.test(location.search);
      var search = new URLSearchParams(location.search);
      var code = search.get('code');
      if (code) {
        var next = isResetCallback ? '/auth?reset=1' : '/setup-account';
        window.location.replace('/api/v1/auth/callback?code=' + encodeURIComponent(code) + '&next=' + encodeURIComponent(next));
        return;
      }
      if (hash.get('access_token') && hash.get('refresh_token')) {
        await postAuth('/api/v1/auth/callback', {
          accessToken: hash.get('access_token'),
          refreshToken: hash.get('refresh_token'),
          expiresAt: hash.get('expires_at')
        });
        history.replaceState(null, document.title, location.pathname + location.search);
      }
      var data = await fetch('/api/v1/auth/session', { credentials: 'same-origin' }).then(function (response) { return response.json(); });
      if (data && data.authenticated) {
        currentUser = data.user || null;
        if (isResetCallback || /[?&]reset=1/.test(location.search)) {
          resetSessionReady = true;
          window.setTimeout(function () {
            showForgotScene('verified');
            var email = document.getElementById('fp-verified-email');
            if (email && currentUser && currentUser.email) email.textContent = currentUser.email;
            mountResetPasswordForm();
          }, 250);
          return;
        }
        if (data.accountSetupRequired && /[?&]setup=1/.test(location.search)) {
          window.setTimeout(function () { openSetup(currentUser); }, 250);
          return;
        }
        if (data.accountSetupRequired) {
          window.location.href = '/setup-account';
          return;
        }
        if (!/[?&](view|mode|reset|setup)=/.test(location.search)) {
          window.location.href = '/profile';
        }
      }
    } catch (_) {}
  }

  function attach() {
    applySignupPasswordPolicy();
    var loginForm = document.getElementById('lg-form');
    var signupForm = document.getElementById('su-form');

    if (loginForm && !loginForm.dataset.backendAuth) {
      loginForm.dataset.backendAuth = '1';
      loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        var button = document.getElementById('lg-btn');
        var email = (document.getElementById('lg-email') || {}).value || '';
        var password = (document.getElementById('lg-pass') || {}).value || '';
        var remember = !!((document.getElementById('lg-remember') || {}).checked);
        setButtonLoading(button, true, 'Authenticating...');
        try {
          var data = await postAuth('/api/v1/auth/login', { email: email, password: password, remember: remember });
          currentUser = data.user || null;
          saveSession(null);
          if (data.accountSetupRequired) {
            window.location.href = '/setup-account';
            return;
          }
          window.location.href = '/profile';
        } catch (error) {
          var alert = document.getElementById('lg-alert');
          if (alert) {
            alert.className = 'alert';
            var title = document.getElementById('lg-alert-title');
            var msg = document.getElementById('lg-alert-msg');
            if (title) title.textContent = 'Sign-in failed';
            if (msg) msg.textContent = error.message;
          }
        } finally {
          setButtonLoading(button, false, 'Sign in securely');
        }
      }, true);
    }

    if (signupForm && !signupForm.dataset.backendAuth) {
      signupForm.dataset.backendAuth = '1';
      signupForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        var button = document.getElementById('su-btn');
        var fullName = (document.getElementById('su-name') || {}).value || '';
        var email = (document.getElementById('su-email') || {}).value || '';
        var password = (document.getElementById('su-pass') || {}).value || '';
        var passwordConfirm = (document.getElementById('su-confirm') || {}).value || '';
        var country = (document.getElementById('su-cc') || {}).value || '';
        var phone = (document.getElementById('su-phone') || {}).value || '';
        var acceptedPrivacy = !!((document.getElementById('su-agree-privacy') || {}).checked);
        var acceptedTerms = !!((document.getElementById('su-agree-terms') || {}).checked);
        var acceptedComms = !!((document.getElementById('su-agree-comms') || {}).checked);
        setButtonLoading(button, true, 'Creating account...');
        try {
          var data = await postAuth('/api/v1/auth/signup', {
            fullName: fullName,
            email: email,
            password: password,
            passwordConfirm: passwordConfirm,
            phone: country + phone,
            acceptedPrivacy: acceptedPrivacy,
            acceptedTerms: acceptedTerms,
            acceptedComms: acceptedComms,
            consentVersion: 'v1-auth-phase-1-5'
          });
          currentUser = data.user || { email: email, profile: { fullName: fullName } };
          saveSession(null);
          var welcome = document.getElementById('su-welcome');
          if (welcome) welcome.textContent = String(fullName).trim().split(/\\s+/)[0] || 'defender';
          prepareSignupOtpScene(email);
          showSignupScene('verify');
        } catch (error) {
          var notice = document.getElementById('su-bot-notice');
          if (notice) {
            notice.style.display = 'flex';
            notice.querySelector('span').innerHTML = '<b>Signup failed.</b> ' + error.message;
          }
        } finally {
          setButtonLoading(button, false, 'Create account');
        }
      }, true);
    }

    var signupOtpGroup = document.getElementById('su-otp-inputs-email');
    if (signupOtpGroup && !signupOtpGroup.dataset.backendAuth) {
      signupOtpGroup.dataset.backendAuth = '1';
      // Capture before the locked demo OTP validator.
      signupOtpGroup.addEventListener('input', function () {
        window.setTimeout(async function () {
          var token = readOtp('#su-otp-inputs-email');
          if (token.length !== 6 || signupOtpGroup.dataset.verifying === '1' || signupOtpGroup.classList.contains('verified')) return;
          signupOtpGroup.dataset.verifying = '1';
          setSignupOtpStatus('', 'Verifying code...');
          var email = (currentUser && currentUser.email) || readValue('su-email');
          try {
            var data = await postAuth('/api/v1/auth/verify-email-otp', { email: email, token: token });
            finishSignupOtp(data, email);
          } catch (error) {
            setSignupOtpStatus('err', error.message || 'Invalid or expired code.');
            clearOtp('#su-otp-inputs-email');
          } finally {
            signupOtpGroup.dataset.verifying = '0';
          }
        }, 20);
      }, true);
    }

    var signupResend = document.getElementById('su-resend-email');
    if (signupResend && !signupResend.dataset.backendAuth) {
      signupResend.dataset.backendAuth = '1';
      signupResend.addEventListener('click', async function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (signupResend.disabled) return;
        signupResend.disabled = true;
        var email = (currentUser && currentUser.email) || readValue('su-email');
        try {
          await postAuth('/api/v1/auth/resend-email-otp', { email: email });
          clearOtp('#su-otp-inputs-email');
          setSignupOtpStatus('', 'New code sent. Check your inbox.');
          window.setTimeout(function () { signupResend.disabled = false; }, 30000);
        } catch (error) {
          setSignupOtpStatus('err', error.message || 'Could not resend code.');
          window.setTimeout(function () { signupResend.disabled = false; }, 10000);
        }
      }, true);
    }

    var forgotForm = document.getElementById('fp-form');
    if (forgotForm && !forgotForm.dataset.backendAuth) {
      forgotForm.dataset.backendAuth = '1';
      forgotForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        var button = document.getElementById('fp-btn');
        var email = (document.getElementById('fp-email') || {}).value || '';
        setButtonLoading(button, true, 'Sending...');
        try {
          await postAuth('/api/v1/auth/forgot-password', { email: email });
          currentResetEmail = email;
          var otpEmail = document.getElementById('fp-otp-email');
          if (otpEmail) otpEmail.textContent = email;
          var demo = document.getElementById('fp-demo-code');
          if (demo) demo.textContent = 'sent';
          clearOtp('#fp-otp-inputs');
          setForgotOtpHint('', '');
          var alert = document.getElementById('fp-alert');
          if (alert) {
            alert.className = 'alert';
            var title = document.getElementById('fp-alert-title');
            var msg = document.getElementById('fp-alert-msg');
            if (title) title.textContent = 'Reset code sent';
            if (msg) msg.textContent = 'If the account exists, we sent a 6-digit reset code.';
          }
          showForgotScene('otp');
          var resend = document.getElementById('fp-resend');
          if (resend) window.setTimeout(function () { resend.disabled = false; }, 30000);
        } catch (error) {
          var fpAlert = document.getElementById('fp-alert');
          if (fpAlert) {
            fpAlert.className = 'alert';
            var fpTitle = document.getElementById('fp-alert-title');
            var fpMsg = document.getElementById('fp-alert-msg');
            if (fpTitle) fpTitle.textContent = 'Reset failed';
            if (fpMsg) fpMsg.textContent = error.message;
          }
        } finally {
          setButtonLoading(button, false, 'Send OTP code');
        }
      }, true);
    }

    var forgotOtpForm = document.getElementById('fp-otp-form');
    if (forgotOtpForm && !forgotOtpForm.dataset.backendAuth) {
      forgotOtpForm.dataset.backendAuth = '1';
      forgotOtpForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        var button = document.getElementById('fp-verify-otp-btn');
        var email = currentResetEmail || (document.getElementById('fp-otp-email') || {}).textContent || '';
        var token = readOtp('#fp-otp-inputs');
        if (token.length !== 6) {
          setForgotOtpHint('err', 'Enter all 6 digits.');
          return;
        }
        setButtonLoading(button, true, 'Verifying...');
        try {
          var data = await postAuth('/api/v1/auth/verify-reset-otp', { email: email, token: token });
          currentUser = data.user || currentUser;
          resetSessionReady = true;
          var verifiedEmail = document.getElementById('fp-verified-email');
          if (verifiedEmail) verifiedEmail.textContent = email;
          setForgotOtpHint('ok', 'OTP verified.');
          showForgotScene('verified');
          mountResetPasswordForm();
        } catch (error) {
          setForgotOtpHint('err', error.message || 'Invalid or expired code.');
          clearOtp('#fp-otp-inputs');
        } finally {
          setButtonLoading(button, false, 'Verify code');
        }
      }, true);
    }

    var forgotResend = document.getElementById('fp-resend');
    if (forgotResend && !forgotResend.dataset.backendAuth) {
      forgotResend.dataset.backendAuth = '1';
      forgotResend.addEventListener('click', async function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        var email = currentResetEmail || (document.getElementById('fp-otp-email') || {}).textContent || '';
        forgotResend.disabled = true;
        try {
          await postAuth('/api/v1/auth/forgot-password', { email: email });
          clearOtp('#fp-otp-inputs');
          setForgotOtpHint('ok', 'New reset code sent.');
          window.setTimeout(function () { forgotResend.disabled = false; }, 30000);
        } catch (error) {
          setForgotOtpHint('err', error.message || 'Could not resend code.');
          window.setTimeout(function () { forgotResend.disabled = false; }, 10000);
        }
      }, true);
    }

    var dashboard = document.getElementById('sw-dashboard');
    if (dashboard && !dashboard.dataset.backendAuth) {
      dashboard.dataset.backendAuth = '1';
      dashboard.addEventListener('click', async function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        dashboard.classList.add('loading');
        try {
          var data = await postAuth('/api/v1/users/account-setup', setupPayload());
          currentUser = data.user || currentUser;
          window.location.href = '/profile';
        } catch (error) {
          alert(error.message || 'Could not complete account setup.');
          dashboard.classList.remove('loading');
        }
      }, true);
    }

    var resetContinue = document.getElementById('fp-continue');
    if (resetContinue && !resetContinue.dataset.backendAuth) {
      resetContinue.dataset.backendAuth = '1';
      resetContinue.addEventListener('click', function (event) {
        if (!resetSessionReady) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        mountResetPasswordForm();
      }, true);
    }
  }

  function bootAuthUi() {
    attach();
    applyRequestedAuthView();
    mountAuthTurnstiles();
  }

  bootSession();
  if (document.readyState === 'complete') window.setTimeout(bootAuthUi, 80);
  else window.addEventListener('load', function () { window.setTimeout(bootAuthUi, 80); });
})();
</script>`;
}

export async function GET(request) {
  const url = new URL(request.url);
  const screen = url.searchParams.get('screen');
  const routePath = url.searchParams.get('path') || '/';
  const fileName = screen === 'auth' ? 'auth.html' : 'Cyber Samachar Unified.html';
  const filePath = path.join(process.cwd(), 'public', fileName);
  const html = await readFile(filePath, 'utf8');
  const htmlWithLiveData = screen === 'auth' ? html : injectLiveContent(html, await getLiveContentOverrides());
  const bridges = `${buildRouteBridge(routePath)}\n${buildBehaviorBridge()}`;
  const environmentBanner = buildEnvironmentBannerHtml();
  const body = screen === 'auth'
    ? htmlWithLiveData.replace('</body>', `${buildAuthBridge()}\n${environmentBanner}\n</body>`)
    : htmlWithLiveData.replace('</body>', `${bridges}\n${environmentBanner}\n</body>`);

  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
