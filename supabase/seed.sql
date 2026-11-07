insert into public.categories (id, label_en, label_hi, icon_key, display_order)
values
  ('malware', 'Malware', 'मैलवेयर', 'bug', 10),
  ('breach', 'Data Breach', 'डेटा उल्लंघन', 'database', 20),
  ('scam', 'Scam/Fraud', 'घोटाला/धोखाधड़ी', 'shield-alert', 30),
  ('regulation', 'Regulation', 'नियम', 'scale', 40),
  ('apt', 'APT Activity', 'एपीटी गतिविधि', 'radar', 50),
  ('vulnerability', 'Vulnerability', 'कमजोरी', 'scan', 60)
on conflict (id) do update
set label_en = excluded.label_en,
    label_hi = excluded.label_hi,
    icon_key = excluded.icon_key,
    display_order = excluded.display_order,
    is_active = true,
    updated_at = now();

insert into public.law_acts (id, name_en, name_hi, short_name, display_order, is_active)
values
  ('it-act-2000', 'Information Technology Act, 2000', 'सूचना प्रौद्योगिकी अधिनियम, 2000', 'IT Act', 10, true),
  ('bns-2023', 'Bharatiya Nyaya Sanhita, 2023', 'भारतीय न्याय संहिता, 2023', 'BNS', 20, true),
  ('dpdp-2023', 'Digital Personal Data Protection Act, 2023', 'डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023', 'DPDP', 30, true)
on conflict (id) do update
set name_en = excluded.name_en,
    name_hi = excluded.name_hi,
    short_name = excluded.short_name,
    display_order = excluded.display_order,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.law_sections (act_id, section_number, title_en, description_en, severity)
values
  ('it-act-2000', '43', 'Penalty and compensation for damage to computer systems', 'Civil liability for unauthorized access, downloads, disruption, or damage to computer systems.', 'moderate'),
  ('it-act-2000', '66', 'Computer-related offences', 'Criminal liability for dishonest or fraudulent computer-related acts.', 'high'),
  ('it-act-2000', '66C', 'Identity theft', 'Covers fraudulent or dishonest use of electronic signatures, passwords, or unique identification features.', 'high'),
  ('it-act-2000', '66D', 'Cheating by personation using computer resource', 'Covers phishing, impersonation, and online cheating using digital systems.', 'high'),
  ('dpdp-2023', '8', 'Obligations of Data Fiduciary', 'Requires lawful processing, security safeguards, breach notices, and deletion when purpose is complete.', 'high')
on conflict (act_id, section_number) do update
set title_en = excluded.title_en,
    description_en = excluded.description_en,
    severity = excluded.severity,
    is_active = true,
    updated_at = now();

insert into public.scam_spotlights (week_start, issue_number, title_en, hook_en, body_en, loss_figure, is_current)
values (
  date_trunc('week', now())::date,
  1,
  'OTP Relay Scams',
  'Fraudsters pressure victims to reveal OTPs during fake support calls.',
  'Never share OTPs, UPI PINs, or screen-share access with callers claiming to be from banks, delivery companies, or support desks.',
  'Varies by victim',
  true
)
on conflict do nothing;
