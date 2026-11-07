export const metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <section className="article-page legal-detail">
      <p className="hero-kicker">Effective 21 May 2026</p>
      <h1>Privacy Policy</h1>
      <p>
        The Content MVP reads public content and accepts newsletter/waitlist submissions. Personal profiles, report storage, and synced user features remain gated until DPDP-grade controls are verified.
      </p>
      <p>
        Production public-write forms must use server-side Turnstile validation, rate limiting, explicit purpose notices, retention controls, and audit trails where personal data is stored.
      </p>
    </section>
  );
}
