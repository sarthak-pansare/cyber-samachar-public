import { NewsletterForm } from '@/components/NewsletterForm';
import { getScamSpotlight } from '@/lib/content';

export const metadata = { title: 'Scam of the Week' };
export const revalidate = 300;

export default async function ScamPage() {
  const scam = await getScamSpotlight();

  return (
    <section className="page-section">
      <div className="scam-hero">
        <p className="hero-kicker">Scam of the Week</p>
        <h1>{scam.title}</h1>
        <p>{scam.summary}</p>
        <div className="hero-actions">
          <a href={`https://wa.me/?text=${encodeURIComponent(scam.share_text || scam.summary)}`}>Share on WhatsApp</a>
          <a href={`https://t.me/share/url?text=${encodeURIComponent(scam.share_text || scam.summary)}`}>Share on Telegram</a>
        </div>
      </div>
      <div className="side-panel">
        <h2>Prevention checklist</h2>
        <ul>
          {(scam.prevention_steps || []).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </div>
      <NewsletterForm />
    </section>
  );
}
