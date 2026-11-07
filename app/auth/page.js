import { NewsletterForm } from '@/components/NewsletterForm';

export const metadata = { title: 'Auth - Coming Soon' };

export default function AuthPage() {
  return (
    <section className="coming-soon">
      <p className="hero-kicker">Roadmapped</p>
      <h1>Supabase Auth portal is gated</h1>
      <p>
        Login, signup, onboarding, synced bookmarks, profile settings, and WhatsApp OTP will ship after the user-db split and consent workflows are verified.
      </p>
      <NewsletterForm mode="waitlist" />
    </section>
  );
}
