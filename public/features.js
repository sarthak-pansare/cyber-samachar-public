/* ═══════════════════════════════════════════════════════════════════
   CYBER SAMACHAR — FEATURES MODULE
   Personalization (Role / Daily Brief / Keyword Alerts) +
   Cyber Law extensions (Map-to-Law / Bare-act / Compare mode / Cases)
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────── */
const ROLES = [
  {
    id:'ciso',
    title:'CISO',
    sub:'Boardroom',
    desc:'Strategic risk, regulatory posture, breach disclosure, audit-ready intel for the C-suite.',
    tags:['DPDP', 'CERT-In Dir.', 'Board reports', 'Compliance'],
    register:'executive',
    priority:['breach','nation','vuln'],
    snippet:'<b>Board-ready briefings.</b> Regulatory deltas, breach disclosure clocks, sector risk.',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z"/><path d="M9 12l2 2 4-4"/></svg>'
  },
  {
    id:'soc',
    title:'SOC Analyst',
    sub:'Tier 1–3',
    desc:'IOCs, TTPs, CVE patches, threat-actor moves, detection rules, malware analysis.',
    tags:['IOCs','MITRE ATT&CK','Patches','Telemetry'],
    register:'technical',
    priority:['vuln','malware','nation'],
    snippet:'<b>Hunt-ready feed.</b> IOCs, CVSS scores, exploit chains, YARA-rule callouts.',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M7 8l3 2-3 2"/><line x1="13" y1="12" x2="17" y2="12"/></svg>'
  },
  {
    id:'journalist',
    title:'Journalist',
    sub:'Newsroom',
    desc:'Verifiable sources, named victims, policy angles, public-interest stories.',
    tags:['Sources','On-record','Beat','Public-interest'],
    register:'editorial',
    priority:['breach','nation','fraud'],
    snippet:'<b>Newsroom-ready angles.</b> Named sources, victim impact, policy reactions.',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8z"/></svg>'
  },
  {
    id:'student',
    title:'Student',
    sub:'Learning',
    desc:'Beginner-friendly explainers, glossary terms, cyber-law basics, lab walkthroughs.',
    tags:['Explainers','Glossary','Basics','Tutorials'],
    register:'plain',
    priority:['vuln','fraud','general'],
    snippet:'<b>Plain-language explainers.</b> Glossary, walkthroughs, "ELI5" notes.',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>'
  },
  {
    id:'consumer',
    title:'Consumer',
    sub:'Everyday',
    desc:'UPI scams, SIM swap, fake apps, family-safety tips. No jargon, just what to do.',
    tags:['Scams','UPI','Family','How-to'],
    register:'simple',
    priority:['fraud','breach','general'],
    snippet:'<b>What-to-do alerts.</b> UPI scams, fake-call frauds, family safety guides.',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
  },
];

const ROLE_REGISTER_HEADLINES = {
  ciso: { feed_subtitle:'Board-ready cyber intelligence · India' },
  soc: { feed_subtitle:'Tactical threat intel for blue teams · India' },
  journalist: { feed_subtitle:'Newsroom desk · Verified cyber stories · India' },
  student: { feed_subtitle:'Learn cybersecurity, in plain English · India' },
  consumer: { feed_subtitle:'Stay safe online · India\'s cyber news' },
};

const CHANNEL_META = {
  email:    {label:'Email',    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'},
  whatsapp: {label:'WhatsApp', icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm5.46 14.16c-.23.64-1.34 1.22-1.86 1.3-.48.07-1.09.1-1.76-.11-.4-.13-.92-.3-1.58-.59-2.78-1.2-4.6-4-4.74-4.18-.14-.18-1.13-1.5-1.13-2.86 0-1.36.71-2.03.97-2.31.25-.27.55-.34.74-.34s.37 0 .54.01c.17.01.4-.07.63.48.23.55.79 1.91.86 2.05.07.14.12.3.02.49-.1.18-.15.3-.29.46-.15.16-.31.36-.45.49-.14.14-.29.29-.13.57.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.18 1.34.27.13.43.11.59-.07.16-.18.69-.8.87-1.08.18-.27.36-.23.61-.14.25.09 1.6.75 1.87.89.27.13.45.21.52.32.07.12.07.69-.16 1.33z"/></svg>'},
  telegram: {label:'Telegram', icon:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>'},
};

/* Persist + load */
function loadPzState() {
  try {
    return {
      role: localStorage.getItem('csRole') || 'consumer',
      alerts: JSON.parse(localStorage.getItem('csAlerts') || 'null') || [
        {kw:'AIIMS', channels:{email:true,whatsapp:true,telegram:false}, freq:'realtime'},
        {kw:'CVE-2026', channels:{email:true,whatsapp:false,telegram:true}, freq:'daily'},
      ],
      kw_channels: JSON.parse(localStorage.getItem('csKwChannels') || 'null') || {email:true,whatsapp:false,telegram:false},
      kw_freq: localStorage.getItem('csKwFreq') || 'realtime',
    };
  } catch(e) { return {role:'consumer', alerts:[], kw_channels:{email:true}, kw_freq:'realtime'}; }
}
let PZ = loadPzState();
function savePzState() {
  localStorage.setItem('csRole', PZ.role);
  localStorage.setItem('csAlerts', JSON.stringify(PZ.alerts));
  localStorage.setItem('csKwChannels', JSON.stringify(PZ.kw_channels));
  localStorage.setItem('csKwFreq', PZ.kw_freq);
}

/* ─────────────────────────────────────────────
   RENDER: PERSONALIZE PAGE
   ───────────────────────────────────────────── */
function renderPersonalize() {
  const role = ROLES.find(r => r.id === PZ.role) || ROLES[4];

  // 1. ROLE GRID
  const grid = document.getElementById('pzRoleGrid');
  if (grid) {
    grid.innerHTML = ROLES.map(r => `
      <button class="pz-role ${r.id===PZ.role?'active':''}" onclick="setRole('${r.id}')">
        <div class="pz-role-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
        <div class="pz-role-icon">${r.icon}</div>
        <h4>${r.title}</h4>
        <div class="pz-role-sub">${r.sub}</div>
        <div class="pz-role-desc">${r.desc}</div>
        <div class="pz-role-tags">${r.tags.map(t=>`<span>${t}</span>`).join('')}</div>
      </button>
    `).join('');
  }

  // role preview strip
  const prev = document.getElementById('pzRolePreview');
  if (prev) {
    prev.innerHTML = `
      <div class="pz-pre-label">↳ feed register</div>
      <div class="pz-pre-snippet">${role.snippet}</div>
      <div class="pz-pre-priority">${role.priority.map(p=>`<span>${catLabelFor(p)}</span>`).join('')}</div>
    `;
  }

  // 2. DAILY BRIEF
  renderDailyBrief();

  // 3. KEYWORD ALERTS
  renderAlerts();

  // status badges
  const briefStatus = document.getElementById('pzBriefStatus');
  if (briefStatus) {
    briefStatus.textContent = 'Auto-generated · 90s';
    briefStatus.classList.add('on');
  }
  const alertsStatus = document.getElementById('pzAlertsStatus');
  if (alertsStatus) {
    alertsStatus.textContent = PZ.alerts.length ? `${PZ.alerts.length} active` : 'None set';
    alertsStatus.classList.toggle('on', PZ.alerts.length>0);
  }
}

function catLabelFor(c) {
  const map = {breach:'Data Breaches', nation:'Nation-State', vuln:'Vulnerabilities', fraud:'Cyber Fraud', malware:'Malware', general:'Security News'};
  return map[c] || c;
}

function setRole(id) {
  PZ.role = id;
  savePzState();
  renderPersonalize();
  // update hero subtitle
  const sub = document.getElementById('heroSub');
  if (sub && ROLE_REGISTER_HEADLINES[id]) {
    sub.textContent = ROLE_REGISTER_HEADLINES[id].feed_subtitle;
  }
  // small confirm toast
  toast(`Switched to ${ROLES.find(r=>r.id===id).title} view — feed reordered`);
}

/* ─────────────────────────────────────────────
   DAILY CYBER BRIEF
   ───────────────────────────────────────────── */
const BRIEF_DURATION = 90; // seconds
let briefState = { playing:false, t:0, timer:null, speed:1 };

function getBriefScript() {
  const role = ROLES.find(r=>r.id===PZ.role) || ROLES[4];
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long'});
  // pick top items by role priority categories (uses global NEWS if present)
  let top = [];
  try {
    if (typeof NEWS !== 'undefined') {
      top = NEWS
        .filter(n => role.priority.includes(n.cat) || n.severity==='critical')
        .slice(0, 3);
    }
  } catch(e){}
  if (!top.length && typeof NEWS !== 'undefined') top = NEWS.slice(0,3);

  const intro = {
    ciso: `Good morning. Here's your <b>${dateStr}</b> board-level cyber digest — three items to brief your leadership on today.`,
    soc: `Morning, analyst. Three incidents worth your shift handover for <b>${dateStr}</b>.`,
    journalist: `Top of <b>${dateStr}</b>: three cyber stories developing that may need newsroom follow-up.`,
    student: `Good morning! Today is <b>${dateStr}</b>. Three cyber stories explained — what happened, why it matters, what to learn.`,
    consumer: `Hi! It's <b>${dateStr}</b>. Three things happening online today, and what you can do to stay safe.`,
  }[role.id] || `Top stories for <b>${dateStr}</b>.`;

  const items = top.map((n,i) => {
    return `<p><span class="b-tag">${String(i+1).padStart(2,'0')}</span><b>${n.title.replace(/<[^>]+>/g,'')}</b> — ${n.summary || ''}</p>`;
  }).join('');

  const outro = {
    ciso: `<p>Action items will land in your inbox at 9:00 IST. Stay vigilant.</p>`,
    soc: `<p>Patching priorities and IOCs are pinned in the SOC dashboard. Hunt well.</p>`,
    journalist: `<p>Verified sources and contacts are linked in each story. Filing template attached.</p>`,
    student: `<p>Each story has a "what to learn" tag — click through for the explainer and glossary.</p>`,
    consumer: `<p>If anything sounds familiar, share with your family group. Stay safe online today.</p>`,
  }[role.id] || '';

  return `<p>${intro}</p>${items}${outro}`;
}

function renderDailyBrief() {
  const date = document.getElementById('pzBriefDate');
  if (date) {
    const today = new Date();
    date.textContent = today.toLocaleDateString('en-IN', {weekday:'short', day:'2-digit', month:'short', year:'numeric'}).toUpperCase();
  }
  const script = document.getElementById('pzBriefScript');
  if (script) script.innerHTML = getBriefScript();

  // waveform: 60 bars, random heights, stable per render
  const wave = document.getElementById('pzWaveform');
  if (wave) {
    if (!wave.dataset.built) {
      let html = '';
      for (let i=0; i<60; i++) {
        const h = 20 + Math.round(((Math.sin(i*0.6)+Math.cos(i*1.4))+2)*15);
        html += `<div class="bar" style="height:${h}%"></div>`;
      }
      wave.innerHTML = html;
      wave.dataset.built = '1';
    }
  }
  updateBriefUi();
}

function updateBriefUi() {
  const timer = document.getElementById('pzBriefTimer');
  if (timer) {
    const remaining = Math.max(0, BRIEF_DURATION - briefState.t);
    const m = Math.floor(remaining/60), s = Math.floor(remaining%60);
    timer.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} / 01:30`;
  }
  const playBtn = document.getElementById('pzPlayBtn');
  if (playBtn) {
    playBtn.classList.toggle('playing', briefState.playing);
    playBtn.innerHTML = briefState.playing
      ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }
  const wave = document.getElementById('pzWaveform');
  if (wave) {
    const bars = wave.querySelectorAll('.bar');
    const total = bars.length;
    const progress = briefState.t / BRIEF_DURATION;
    const idx = Math.floor(progress * total);
    bars.forEach((b,i) => {
      b.classList.toggle('played', i < idx);
      b.classList.toggle('active', briefState.playing && i === idx);
    });
  }
  const sp = document.getElementById('pzBriefSpeed');
  if (sp) sp.textContent = briefState.speed + '×';
}

function togglePlayBrief() {
  briefState.playing = !briefState.playing;
  if (briefState.playing) {
    if (briefState.t >= BRIEF_DURATION) briefState.t = 0;
    briefState.timer = setInterval(()=>{
      briefState.t += 0.5 * briefState.speed;
      if (briefState.t >= BRIEF_DURATION) {
        briefState.t = BRIEF_DURATION;
        briefState.playing = false;
        clearInterval(briefState.timer);
      }
      updateBriefUi();
    }, 500);
  } else {
    clearInterval(briefState.timer);
  }
  updateBriefUi();
}

function cycleSpeed() {
  briefState.speed = briefState.speed === 1 ? 1.25 : briefState.speed === 1.25 ? 1.5 : briefState.speed === 1.5 ? 2 : 1;
  updateBriefUi();
}

function refreshBrief() {
  briefState.t = 0; briefState.playing = false;
  clearInterval(briefState.timer);
  renderDailyBrief();
  toast('Brief refreshed with latest stories');
}

function emailBrief() { toast('Daily Brief will be emailed at 07:00 IST'); }
function calendarBrief() { toast('Added to your calendar as a recurring 07:00 IST event'); }

/* ─────────────────────────────────────────────
   KEYWORD ALERTS
   ───────────────────────────────────────────── */
function renderAlerts() {
  // channel toggles
  ['email','whatsapp','telegram'].forEach(c => {
    const el = document.querySelector(`.pz-ch[data-ch="${c}"]`);
    if (el) el.classList.toggle('on', !!PZ.kw_channels[c]);
  });
  // frequency
  document.querySelectorAll('.pz-freq-row button').forEach(b => {
    b.classList.toggle('on', b.dataset.freq === PZ.kw_freq);
  });
  // list
  const list = document.getElementById('pzAlertList');
  if (!list) return;
  if (PZ.alerts.length === 0) {
    list.innerHTML = '<div class="pz-empty">No keyword alerts yet — add one above to get notified when topics appear.</div>';
    return;
  }
  list.innerHTML = PZ.alerts.map((a,i) => {
    const chHtml = Object.entries(a.channels).filter(([k,v])=>v).map(([k]) => {
      return `<span title="${CHANNEL_META[k].label}">${CHANNEL_META[k].icon}</span>`;
    }).join('') || '<span style="color:var(--text3);font-size:9px;padding:0 6px;">no channels</span>';
    return `<div class="pz-alert-item">
      <div class="pz-alert-kw">"${a.kw}"</div>
      <div class="pz-alert-meta">Notify on <b>${a.freq==='realtime'?'every match':a.freq==='daily'?'daily digest':'weekly digest'}</b></div>
      <div class="pz-alert-channels">${chHtml}</div>
      <button class="pz-alert-del" onclick="removeAlert(${i})" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>
    </div>`;
  }).join('');
}

function toggleChannel(ch) {
  PZ.kw_channels[ch] = !PZ.kw_channels[ch];
  savePzState();
  renderAlerts();
}
function setFreq(f) {
  PZ.kw_freq = f;
  savePzState();
  renderAlerts();
}
function addAlert() {
  const input = document.getElementById('pzKwInput');
  const kw = (input.value || '').trim();
  if (!kw) { input.focus(); return; }
  PZ.alerts.unshift({
    kw, channels: {...PZ.kw_channels}, freq: PZ.kw_freq
  });
  input.value = '';
  savePzState();
  renderAlerts();
  // update status pill
  const alertsStatus = document.getElementById('pzAlertsStatus');
  if (alertsStatus) {
    alertsStatus.textContent = `${PZ.alerts.length} active`;
    alertsStatus.classList.add('on');
  }
  toast(`Alert added for "${kw}"`);
}
function removeAlert(i) {
  PZ.alerts.splice(i,1);
  savePzState();
  renderAlerts();
  const alertsStatus = document.getElementById('pzAlertsStatus');
  if (alertsStatus) {
    alertsStatus.textContent = PZ.alerts.length ? `${PZ.alerts.length} active` : 'None set';
    alertsStatus.classList.toggle('on', PZ.alerts.length>0);
  }
}
function kwKeydown(e) { if (e.key==='Enter') addAlert(); }

/* ─────────────────────────────────────────────
   MAP-THIS-INCIDENT-TO-LAW
   ───────────────────────────────────────────── */
const LAW_MAP_BY_CAT = {
  breach: [
    {act:'it2000', num:'§ 43'},
    {act:'it2000', num:'§ 43A'},
    {act:'it2000', num:'§ 66'},
    {act:'it2000', num:'§ 72'},
    {act:'it2000', num:'§ 72A'},
    {act:'dpdp',   num:'§ 8'},
    {act:'dpdp',   num:'§ 33'},
  ],
  nation: [
    {act:'it2000', num:'§ 66F'},
    {act:'it2000', num:'§ 70'},
    {act:'it2000', num:'§ 70A / 70B'},
    {act:'it2000', num:'§ 69'},
  ],
  vuln: [
    {act:'it2000', num:'§ 43'},
    {act:'it2000', num:'§ 66'},
    {act:'it2000', num:'§ 70A / 70B'},
  ],
  fraud: [
    {act:'it2000', num:'§ 66C'},
    {act:'it2000', num:'§ 66D'},
    {act:'bns',    num:'§ 318'},
    {act:'bns',    num:'§ 319'},
    {act:'ipc',    num:'§ 420'},
  ],
  malware: [
    {act:'it2000', num:'§ 43'},
    {act:'it2000', num:'§ 65'},
    {act:'it2000', num:'§ 66'},
  ],
  general: [
    {act:'it2000', num:'§ 43'},
    {act:'it2000', num:'§ 66'},
  ],
};

let mtlContext = null; // {articleId, title, hits:[{act,num}]}

function mapArticleToLaw(articleId) {
  if (typeof NEWS === 'undefined') return;
  const a = NEWS.find(n=>n.id===articleId);
  if (!a) return;
  let hits = (a.laws || LAW_MAP_BY_CAT[a.cat] || []).slice();
  // Title heuristics — boost specific signals
  const title = (a.title + ' ' + (a.summary||'')).toLowerCase();
  if (/cve-/.test(title))      hits.push({act:'it2000', num:'§ 70A / 70B'});
  if (/ransom/.test(title))    hits.push({act:'it2000', num:'§ 66F'});
  if (/upi|sim swap|phish/.test(title)) hits.push({act:'it2000', num:'§ 66D'});
  if (/spyware|surveillance/.test(title)) hits.push({act:'it2000', num:'§ 66E'});
  // de-dupe
  const seen = new Set();
  hits = hits.filter(h => { const k = h.act+'|'+h.num; if (seen.has(k)) return false; seen.add(k); return true; });

  mtlContext = {articleId, title: a.title, hits};

  // close article + switch to law page
  if (typeof closeArticle === 'function') closeArticle();
  if (typeof showPage === 'function') showPage('law');
  setTimeout(()=>applyMtlHighlight(), 60);
}

function applyMtlHighlight() {
  if (!mtlContext) return;
  // expand all relevant acts
  if (typeof lawExpanded !== 'undefined') {
    lawExpanded.add('__root__');
    mtlContext.hits.forEach(h => lawExpanded.add(h.act));
  }
  if (typeof renderLawTree === 'function') renderLawTree();
  // highlight banner
  const wrap = document.getElementById('lawTreeView');
  if (!wrap) return;
  let banner = document.getElementById('mtlBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'mtlBanner';
    banner.className = 'mtl-banner';
    wrap.insertBefore(banner, wrap.firstChild);
  }
  banner.innerHTML = `
    <div class="mtl-banner-icon">⚖</div>
    <div class="mtl-banner-body">
      <div class="mtl-banner-label">Mapping incident to applicable law</div>
      <div class="mtl-banner-title">${escapeHtml(mtlContext.title)}</div>
    </div>
    <div class="mtl-banner-count">${mtlContext.hits.length} sections</div>
    <button class="mtl-banner-close" onclick="clearMtl()" title="Clear highlight">×</button>
  `;
  // highlight matching section nodes
  setTimeout(()=>{
    mtlContext.hits.forEach(h => {
      const sel = `#lawTree .ltree-node.section[data-act="${h.act}"][data-num="${cssAttr(h.num)}"]`;
      const node = document.querySelector(sel);
      if (node) node.classList.add('mtl-hit');
    });
    // scroll first hit into view (within page, not the whole doc)
    const first = document.querySelector('#lawTree .ltree-node.section.mtl-hit');
    if (first) {
      const rect = first.getBoundingClientRect();
      const wrap = document.querySelector('.law-tree-wrap');
      if (wrap) wrap.scrollTop = Math.max(0, rect.top - wrap.getBoundingClientRect().top - 40);
    }
  }, 100);
}

function clearMtl() {
  mtlContext = null;
  const b = document.getElementById('mtlBanner'); if (b) b.remove();
  document.querySelectorAll('#lawTree .ltree-node.section.mtl-hit').forEach(n=>n.classList.remove('mtl-hit'));
}

function cssAttr(s) { return String(s).replace(/"/g,'\\"'); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

/* ─────────────────────────────────────────────
   BARE ACT DOWNLOADS — fake-URL stubs (per node)
   ───────────────────────────────────────────── */
const BARE_ACT_SOURCES = {
  it2000: [
    {label:'IT Act, 2000 (Bare Act)', sub:'PDF · 1.2 MB · Gazette of India', url:'https://www.indiacode.nic.in/handle/123456789/1999'},
    {label:'IT Amendment Act, 2008', sub:'PDF · 0.8 MB · MeitY', url:'https://www.meity.gov.in/writereaddata/files/itact2000/it_amendment_act2008.pdf'},
  ],
  bns: [
    {label:'BNS, 2023 (Bare Act)', sub:'PDF · 2.1 MB · Gazette', url:'https://www.indiacode.nic.in/bitstream/123456789/20062/1/a2023-45.pdf'},
    {label:'BNS — Section-wise', sub:'PDF · 0.9 MB · MHA', url:'https://www.mha.gov.in/sites/default/files/Bharatiya%20Nyaya%20Sanhita%202023.pdf'},
  ],
  ipc: [
    {label:'Indian Penal Code, 1860', sub:'PDF · 1.4 MB · MHA', url:'https://www.indiacode.nic.in/handle/123456789/2263'},
  ],
  dpdp: [
    {label:'DPDP Act, 2023 (Bare Act)', sub:'PDF · 0.6 MB · MeitY', url:'https://www.meity.gov.in/writereaddata/files/Digital%20Personal%20Data%20Protection%20Act%202023.pdf'},
    {label:'DPDP Rules, 2025 (Draft)', sub:'PDF · 0.4 MB · MeitY', url:'https://www.meity.gov.in/writereaddata/files/DPDP_Rules_2025_Draft.pdf'},
  ],
  other: [
    {label:'IT Rules, 2021', sub:'PDF · 0.5 MB · MeitY', url:'https://www.meity.gov.in/writereaddata/files/IT(Intermediary%20Guidelines%20and%20Digital%20Media%20Ethics%20Code)%20Rules%202021.pdf'},
  ],
};

function renderBareActSection(actId) {
  const src = BARE_ACT_SOURCES[actId] || [];
  if (!src.length) return '';
  return `<div class="ltree-detail-section" data-extra><h5>Download Bare Act</h5>
    <div class="ltd-download">
      ${src.map(d => `
        <a class="ltd-dl-btn" href="${d.url}" target="_blank" rel="noopener" onclick="event.stopPropagation();bareActClick('${escapeHtml(d.label)}');return true;">
          <span class="ltd-dl-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </span>
          <span class="ltd-dl-meta">
            <b>${d.label}</b>
            <i>${d.sub}</i>
          </span>
        </a>
      `).join('')}
    </div>
  </div>`;
}

function bareActClick(label) { /* analytics stub */ }

/* ─────────────────────────────────────────────
   COMPARE MODE
   ───────────────────────────────────────────── */
let cmpMode = false;
let cmpPair = { a: null, b: null }; // each: {act, num}

function toggleCompareMode() {
  cmpMode = !cmpMode;
  const btn = document.getElementById('cmpToggleBtn');
  if (btn) btn.classList.toggle('active', cmpMode);
  const bar = document.getElementById('cmpBar');
  if (bar) bar.classList.toggle('on', cmpMode);
  if (!cmpMode) {
    cmpPair = {a:null,b:null};
    updateCmpBar();
    document.querySelectorAll('#lawTree .ltree-node.section').forEach(n => {
      n.classList.remove('cmp-a','cmp-b');
    });
  } else {
    updateCmpBar();
    toast('Compare mode — pick two sections to diff side-by-side');
  }
}

function tryAddToCompare(actId, num) {
  if (!cmpMode) return false;
  if (cmpPair.a && cmpPair.a.act===actId && cmpPair.a.num===num) {
    cmpPair.a = null;
  } else if (cmpPair.b && cmpPair.b.act===actId && cmpPair.b.num===num) {
    cmpPair.b = null;
  } else if (!cmpPair.a) {
    cmpPair.a = {act:actId, num};
  } else if (!cmpPair.b) {
    cmpPair.b = {act:actId, num};
  } else {
    // both filled — replace A and shift
    cmpPair.a = cmpPair.b;
    cmpPair.b = {act:actId, num};
  }
  applyCmpClasses();
  updateCmpBar();
  return true;
}

function applyCmpClasses() {
  document.querySelectorAll('#lawTree .ltree-node.section').forEach(n => {
    n.classList.remove('cmp-a','cmp-b');
  });
  if (cmpPair.a) {
    const n = document.querySelector(`#lawTree .ltree-node.section[data-act="${cmpPair.a.act}"][data-num="${cssAttr(cmpPair.a.num)}"]`);
    if (n) n.classList.add('cmp-a');
  }
  if (cmpPair.b) {
    const n = document.querySelector(`#lawTree .ltree-node.section[data-act="${cmpPair.b.act}"][data-num="${cssAttr(cmpPair.b.num)}"]`);
    if (n) n.classList.add('cmp-b');
  }
}

function updateCmpBar() {
  const a = document.getElementById('cmpSlotA');
  const b = document.getElementById('cmpSlotB');
  const go = document.getElementById('cmpGoBtn');
  const slot = (which) => {
    const data = cmpPair[which];
    if (!data) return `<span class="cmp-slot-letter">${which.toUpperCase()}</span><span>Pick a section…</span>`;
    const act = typeof LAWS!=='undefined' ? LAWS.find(l=>l.id===data.act) : null;
    const short = act ? act.short : '';
    return `<span class="cmp-slot-letter">${which.toUpperCase()}</span><span><b>${short} ${data.num}</b></span><span class="cmp-slot-clear" onclick="event.stopPropagation();clearCmpSlot('${which}')">×</span>`;
  };
  if (a) {
    a.innerHTML = slot('a');
    a.classList.toggle('filled', !!cmpPair.a);
  }
  if (b) {
    b.innerHTML = slot('b');
    b.classList.toggle('filled', !!cmpPair.b);
    b.classList.add('b');
  }
  if (go) go.disabled = !(cmpPair.a && cmpPair.b);
}

function clearCmpSlot(which) {
  cmpPair[which] = null;
  applyCmpClasses();
  updateCmpBar();
}

function runCompare() {
  if (!cmpPair.a || !cmpPair.b) return;
  if (typeof LAWS === 'undefined') return;
  const actA = LAWS.find(l=>l.id===cmpPair.a.act);
  const actB = LAWS.find(l=>l.id===cmpPair.b.act);
  if (!actA || !actB) return;
  const secA = actA.sections.find(s=>s.num===cmpPair.a.num);
  const secB = actB.sections.find(s=>s.num===cmpPair.b.num);
  if (!secA || !secB) return;
  const drawer = document.getElementById('cmpDrawer');
  if (!drawer) return;

  const sideHtml = (act, sec, side) => `
    <div class="cmp-drawer-side ${side}">
      <div class="cmp-side-pill">${act.short || act.kind?.toUpperCase()}</div>
      <div class="cmp-side-num">${sec.num}</div>
      <div class="cmp-side-title">${sec.title}</div>
      <div class="cmp-side-act">${act.title} · ${act.year}</div>
      <div class="cmp-side-block">
        <h6>Description</h6>
        <p>${sec.desc || '—'}</p>
      </div>
      <div class="cmp-side-block">
        <h6>Penalty / Status</h6>
        <div class="cmp-pen ${(sec.pen==='Procedural'||!sec.pen||sec.pen==='—')?'proc':''}">${sec.pen==='Procedural'?'◆ Procedural / framework':sec.pen==='—'||!sec.pen?'◆ No standalone penalty':'⚖ '+sec.pen}</div>
      </div>
      ${(sec.cog||sec.bail||sec.court)?`<div class="cmp-side-block"><h6>Triable / Status</h6>
        <div class="cmp-side-tags">
          <span>${sec.cog==='Y'?'Cognizable':sec.cog==='N'?'Non-cognizable':sec.cog||'—'}</span>
          <span>${sec.bail==='Y'?'Bailable':sec.bail==='N'?'Non-bailable':sec.bail||'—'}</span>
          <span>${sec.court||'—'}</span>
        </div></div>`:''}
      ${sec.related&&sec.related.length?`<div class="cmp-side-block"><h6>Related</h6>
        <div class="cmp-side-tags">${sec.related.map(r=>`<span>${r}</span>`).join('')}</div></div>`:''}
      ${sec.cases&&sec.cases.length?`<div class="cmp-side-block"><h6>Landmark Cases</h6>
        <ul style="font-size:12px;line-height:1.6;color:var(--text2);padding-left:18px;">${sec.cases.map(c=>`<li>${c}</li>`).join('')}</ul></div>`:''}
      ${sec.notes?`<div class="cmp-side-block"><h6>Practitioner Note</h6>
        <p style="font-style:italic;border-left:2px solid var(--accent);padding-left:10px;font-size:12px;">${sec.notes}</p></div>`:''}
    </div>
  `;

  // diff bar
  const samePen = (secA.pen||'') === (secB.pen||'');
  const sameCog = (secA.cog||'') === (secB.cog||'');
  const sameBail = (secA.bail||'') === (secB.bail||'');
  const sameCourt = (secA.court||'') === (secB.court||'');

  drawer.innerHTML = `
    <div class="cmp-drawer-head">
      <h3>⇄ Comparing: ${actA.short} ${secA.num} <span style="color:var(--text3);font-weight:400;">vs</span> ${actB.short} ${secB.num}</h3>
      <button class="cmp-export" onclick="exportCompare()">↓ Export</button>
      <button class="cmp-drawer-close" onclick="closeCompare()">×</button>
    </div>
    <div class="cmp-drawer-grid">
      ${sideHtml(actA, secA, 'a')}
      ${sideHtml(actB, secB, 'b')}
    </div>
    <div class="cmp-diff-bar">
      <span class="pill ${samePen?'same':'diff'}">Penalty <b>${samePen?'same':'different'}</b></span>
      <span class="pill ${sameCog?'same':'diff'}">Cognizable <b>${sameCog?'same':'different'}</b></span>
      <span class="pill ${sameBail?'same':'diff'}">Bailable <b>${sameBail?'same':'different'}</b></span>
      <span class="pill ${sameCourt?'same':'diff'}">Triable by <b>${sameCourt?'same':'different'}</b></span>
    </div>
  `;
  drawer.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCompare() {
  const d = document.getElementById('cmpDrawer'); if (d) d.classList.remove('open');
  document.body.style.overflow = '';
}
function exportCompare() { toast('Compare report → PDF download starting'); }

/* ─────────────────────────────────────────────
   HOOKS — wrap existing functions
   ───────────────────────────────────────────── */
(function installHooks(){
  // 1. showPage — render personalize page when shown
  if (typeof window.showPage === 'function') {
    const orig = window.showPage;
    window.showPage = function(p) {
      orig(p);
      if (p === 'personalize') renderPersonalize();
    };
  }

  // 2. openArticle — inject Map-to-Law bar
  if (typeof window.openArticle === 'function') {
    const orig = window.openArticle;
    window.openArticle = function(id) {
      orig(id);
      // after panel renders, inject MTL bar before share-bar
      setTimeout(()=>{
        const panel = document.getElementById('articlePanel');
        if (!panel) return;
        const shareBar = panel.querySelector('.share-bar');
        if (!shareBar || panel.querySelector('.mtl-bar')) return;
        const bar = document.createElement('div');
        bar.className = 'mtl-bar';
        bar.innerHTML = `
          <div class="mtl-icon">⚖</div>
          <div class="mtl-text">
            <div class="mtl-title">Which laws apply to this incident?</div>
            <div class="mtl-sub">See the exact IT Act / BNS / DPDP sections this maps to</div>
          </div>
          <button class="mtl-go" onclick="mapArticleToLaw('${id}')">Map to Law →</button>
        `;
        shareBar.parentNode.insertBefore(bar, shareBar);
      }, 30);
    };
  }

  // 3. openLawDetail — inject Bare Act download + Compare button
  if (typeof window.openLawDetail === 'function') {
    const orig = window.openLawDetail;
    window.openLawDetail = function(actId, num) {
      // if in compare mode, intercept and add to slot
      if (cmpMode) {
        tryAddToCompare(actId, num);
        return;
      }
      orig(actId, num);
      setTimeout(()=>{
        const body = document.querySelector('.ltree-detail-body');
        if (!body) return;
        // add bare-act block after existing extras
        const html = renderBareActSection(actId);
        if (html) body.insertAdjacentHTML('beforeend', html);
        // add compare button at the top of body if not already
        const detailHead = document.querySelector('.ltree-detail-head');
        if (detailHead && !document.getElementById('ltdCompareBtn')) {
          const btn = document.createElement('button');
          btn.id = 'ltdCompareBtn';
          btn.className = 'ltd-compare-btn';
          btn.style.marginTop = '12px';
          btn.innerHTML = '⇄ Compare with another section';
          btn.onclick = ()=>{
            // set this as A, enter compare mode, close detail panel
            cmpMode = true;
            const cmpBtn = document.getElementById('cmpToggleBtn');
            if (cmpBtn) cmpBtn.classList.add('active');
            const bar = document.getElementById('cmpBar'); if (bar) bar.classList.add('on');
            cmpPair.a = {act: actId, num};
            cmpPair.b = null;
            applyCmpClasses();
            updateCmpBar();
            closeLawDetail();
            toast('Now pick a second section to compare against');
          };
          detailHead.appendChild(btn);
        } else if (document.getElementById('ltdCompareBtn')) {
          // update to set as A again
          const btn = document.getElementById('ltdCompareBtn');
          btn.onclick = ()=>{
            cmpMode = true;
            const cmpBtn = document.getElementById('cmpToggleBtn'); if (cmpBtn) cmpBtn.classList.add('active');
            const bar = document.getElementById('cmpBar'); if (bar) bar.classList.add('on');
            cmpPair.a = {act: actId, num};
            cmpPair.b = null;
            applyCmpClasses();
            updateCmpBar();
            closeLawDetail();
            toast('Now pick a second section to compare against');
          };
        }
      }, 30);
    };
  }

  // 4. Apply role hero-subtitle on initial load
  setTimeout(()=>{
    const role = ROLES.find(r=>r.id===PZ.role);
    if (role && ROLE_REGISTER_HEADLINES[PZ.role]) {
      const sub = document.getElementById('heroSub');
      if (sub) sub.textContent = ROLE_REGISTER_HEADLINES[PZ.role].feed_subtitle;
    }
  }, 100);
})();

/* ─────────────────────────────────────────────
   TOAST
   ───────────────────────────────────────────── */
function toast(msg) {
  let el = document.getElementById('csToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'csToast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-card);border:1px solid var(--accent);color:var(--text);padding:12px 18px;border-radius:14px;font-family:var(--font-mono);font-size:11px;letter-spacing:.4px;z-index:10000;box-shadow:0 10px 30px rgba(0,0,0,.3);opacity:0;transition:opacity .2s, transform .2s;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(()=>{ el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });
  clearTimeout(el._t);
  el._t = setTimeout(()=>{ el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(8px)'; }, 2400);
}
