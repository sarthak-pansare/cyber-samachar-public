export const fallbackArticles = [
  {
    id: 'local-apt-campaign',
    generated_headline: 'Indian Firms Warned After New Phishing Campaign Targets Finance Teams',
    generated_article:
      'Security teams are tracking a fresh phishing campaign aimed at finance and operations employees. The campaign uses fake vendor invoices, lookalike domains, and urgent payment language to push victims toward credential-harvesting pages. Organizations should verify payment changes through a separate channel, enforce MFA, and review mail rules for suspicious forwarding.',
    social_copy: 'Fresh phishing wave targets Indian finance teams with fake invoice lures.',
    card_image_url: null,
    metadata: {
      meta_description: 'A phishing campaign is targeting Indian finance teams through fake invoice lures and lookalike domains.',
    },
    categories: ['scam', 'phishing'],
    sub_categories: ['invoice fraud', 'credential theft'],
    tags: ['phishing', 'finance', 'india', 'awareness'],
    severity: 'high',
    track: 'both',
    is_general: true,
    is_technical: true,
    india_relevant: true,
    is_breaking: true,
    source_name: 'Cyber Samachar Desk',
    source_domain: 'cybersamachar.ai',
    original_url: 'https://cybersamachar.ai',
    original_published_at: '2026-06-01T04:30:00.000Z',
    published_at: '2026-06-01T04:30:00.000Z',
    status: 'published',
    view_count: 1840,
    share_count: 94,
  },
  {
    id: 'local-ransomware-healthcare',
    generated_headline: 'Healthcare Providers Review Backups After Ransomware Advisory',
    generated_article:
      'Hospitals and clinics are being urged to test backup recovery, restrict exposed remote access, and monitor for unusual administrative logins. The advisory highlights the need for phishing-resistant MFA, endpoint detection coverage, and incident response drills that include clinical operations.',
    social_copy: 'Healthcare teams should test backups and lock down exposed remote access.',
    card_image_url: null,
    metadata: {
      meta_description: 'Healthcare providers are reviewing backups and remote access controls after a ransomware advisory.',
    },
    categories: ['ransomware', 'healthcare'],
    sub_categories: ['backup readiness', 'incident response'],
    tags: ['ransomware', 'backup', 'mfa', 'healthcare'],
    severity: 'critical',
    track: 'professional',
    is_general: false,
    is_technical: true,
    india_relevant: true,
    is_breaking: false,
    source_name: 'Cyber Samachar Desk',
    source_domain: 'cybersamachar.ai',
    original_url: 'https://cybersamachar.ai/ransomware-healthcare',
    original_published_at: '2026-05-31T10:20:00.000Z',
    published_at: '2026-05-31T10:20:00.000Z',
    status: 'published',
    view_count: 1210,
    share_count: 41,
  },
  {
    id: 'local-dpdp-awareness',
    generated_headline: 'DPDP Readiness: What Cyber Teams Should Check Before Collecting User Data',
    generated_article:
      'Any digital service collecting personal information should document purpose, consent, retention, access controls, breach response, and erasure workflows. For cybersecurity products, incident reports and contact details require special care because the submitted context may include sensitive personal and financial information.',
    social_copy: 'A practical DPDP checklist for cybersecurity products collecting user data.',
    card_image_url: null,
    metadata: {
      meta_description: 'Cybersecurity teams should document consent, retention, access controls, and erasure flows before collecting user data.',
    },
    categories: ['regulation', 'privacy'],
    sub_categories: ['DPDP', 'compliance'],
    tags: ['dpdp', 'privacy', 'compliance', 'india'],
    severity: 'medium',
    track: 'both',
    is_general: true,
    is_technical: true,
    india_relevant: true,
    is_breaking: false,
    source_name: 'Cyber Samachar Desk',
    source_domain: 'cybersamachar.ai',
    original_url: 'https://cybersamachar.ai/dpdp-readiness',
    original_published_at: '2026-05-30T06:00:00.000Z',
    published_at: '2026-05-30T06:00:00.000Z',
    status: 'published',
    view_count: 980,
    share_count: 32,
  },
];

export const fallbackCategories = [
  { id: 'all', label: 'All', label_hi: 'सभी', description: 'All published stories', sort_order: 0, is_active: true },
  { id: 'scam', label: 'Scam', label_hi: 'स्कैम', description: 'Fraud and citizen-awareness stories', sort_order: 1, is_active: true },
  { id: 'ransomware', label: 'Ransomware', label_hi: 'रैनसमवेयर', description: 'Extortion and recovery updates', sort_order: 2, is_active: true },
  { id: 'regulation', label: 'Regulation', label_hi: 'नियम', description: 'Law, policy, and compliance', sort_order: 3, is_active: true },
  { id: 'phishing', label: 'Phishing', label_hi: 'फिशिंग', description: 'Credential and social-engineering attacks', sort_order: 4, is_active: true },
];

export const fallbackLawActs = [
  { id: 'it-act', name: 'Information Technology Act', short_name: 'IT Act', sort_order: 1, is_active: true },
  { id: 'dpdp', name: 'Digital Personal Data Protection Act', short_name: 'DPDP 2023', sort_order: 2, is_active: true },
  { id: 'bns', name: 'Bharatiya Nyaya Sanhita', short_name: 'BNS 2023', sort_order: 3, is_active: true },
];

export const fallbackLawSections = [
  {
    id: 'it-66c',
    act_id: 'it-act',
    section_number: '66C',
    title: 'Identity theft',
    plain_english: 'Covers dishonest use of another person’s electronic signature, password, or digital identity.',
    penalty: 'Imprisonment and fine as prescribed by law.',
    is_active: true,
  },
  {
    id: 'it-66d',
    act_id: 'it-act',
    section_number: '66D',
    title: 'Cheating by personation using computer resources',
    plain_english: 'Often relevant to phishing, fake support calls, and impersonation scams.',
    penalty: 'Imprisonment and fine as prescribed by law.',
    is_active: true,
  },
  {
    id: 'dpdp-consent',
    act_id: 'dpdp',
    section_number: 'Consent',
    title: 'Consent and notice obligations',
    plain_english: 'Requires clear purpose, notice, consent, and user rights handling for personal data.',
    penalty: 'Penalties depend on the nature of non-compliance.',
    is_active: true,
  },
];

export const fallbackCyberCells = [
  {
    id: 'mh-mumbai',
    state: 'Maharashtra',
    city: 'Mumbai',
    type: 'Cyber Cell',
    address: 'Mumbai Police Cyber Cell',
    hotline: '1930',
    portal_url: 'https://cybercrime.gov.in/',
    is_active: true,
  },
  {
    id: 'dl-delhi',
    state: 'Delhi',
    city: 'New Delhi',
    type: 'Cyber Cell',
    address: 'Delhi Police Cyber Crime Unit',
    hotline: '1930',
    portal_url: 'https://cybercrime.gov.in/',
    is_active: true,
  },
];

export const fallbackScam = {
  id: 'upi-refund-scam',
  title: 'Fake UPI Refund Calls',
  summary:
    'Fraudsters claim a refund is pending and ask victims to approve a collect request. A real refund never needs your UPI PIN.',
  prevention_steps: [
    'Never enter UPI PIN to receive money.',
    'Verify caller identity through the official app or support channel.',
    'Report suspicious collect requests immediately.',
  ],
  share_text: 'Scam alert: A real refund never needs your UPI PIN. Reject suspicious collect requests.',
  is_active: true,
};
