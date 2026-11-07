# Cyber Samachar Auth Email Templates

Use Supabase Auth default delivery for Phase 1.5.

- Copy `signup-verification.html` into the Supabase confirmation template.
- Copy `password-reset.html` into the Supabase recovery template.
- Keep `welcome.html`, `security-alert.html`, and `account-change.html` queued/deferred until a custom SMTP or email provider is approved.

Required redirect allow-list:

- `http://localhost:3000/api/v1/auth/callback`
- `https://dev.thecybersamachar.com/api/v1/auth/callback`
- `https://staging.thecybersamachar.com/api/v1/auth/callback`
- `https://thecybersamachar.com/api/v1/auth/callback`
