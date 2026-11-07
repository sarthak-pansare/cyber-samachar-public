# Cyber Samachar Edge Function Boundary

Most v1 reads and authenticated user-owned writes use Supabase Direct with RLS.
Use Edge Functions only for operations that need secrets or external verification:

- Turnstile/hCaptcha verification before sensitive public writes.
- WhatsApp OTP delivery and provider callbacks.
- Transactional email for verification, reset, newsletter, and report receipts.
- Report submission if the server must encrypt PII before storing ciphertext.
- Future admin/editor actions that should not expose `service_role` to n8n code nodes.

Do not ship `service_role` or provider keys to browser code. Keep secret-bearing
logic in Edge Functions or a locked-down backend worker.
