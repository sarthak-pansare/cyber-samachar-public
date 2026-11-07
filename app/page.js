import { ArticleCard } from '@/components/ArticleCard';
import { AudienceFilter } from '@/components/AudienceFilter';
import { NewsletterForm } from '@/components/NewsletterForm';
import { getCategories, getFeed, getScamSpotlight } from '@/lib/content';

export const revalidate = 120;

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const audience = params?.audience || 'all';
  const cat = params?.cat || 'all';
  const [articles, categories, scam] = await Promise.all([
    getFeed({ audience, cat, pageSize: 9 }),
    getCategories(),
    getScamSpotlight(),
  ]);
  const critical = articles.find((article) => article.is_breaking) || articles[0];

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <img className="hero-logo" src="/brand/logo.png" alt="Cyber Samachar" />
          <p className="hero-kicker">India&apos;s Cybersecurity Intelligence Platform</p>
          <h1>Your Daily Dose of Cyber Awareness</h1>
          <p>
            Real cyber news, scam awareness, cyber-law references, and citizen tools for India.
          </p>
          <div className="hero-actions">
            <a href="#feed">Read latest</a>
            <a href="/law">Explore cyber law</a>
          </div>
          <AudienceFilter current={audience} />
        </div>
        {critical && (
          <a className="critical-card" href={`/article/${critical.id}`}>
            <span>Critical alert</span>
            <strong>{critical.title}</strong>
            <small>{critical.summary}</small>
          </a>
        )}
      </section>

      <section className="filter-strip" aria-label="Categories">
        {categories.map((category) => (
          <a key={category.id} href={`/?cat=${category.id}`}>
            {category.label || category.id}
          </a>
        ))}
      </section>

      <section className="layout-grid" id="feed">
        <div>
          <div className="section-heading">
            <p>Latest intelligence</p>
            <h2>Feed</h2>
          </div>
          <div className="news-grid">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
        <aside className="side-panel">
          <h2>Scam of the Week</h2>
          <strong>{scam.title}</strong>
          <p>{scam.summary}</p>
          <ul>
            {(scam.prevention_steps || []).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </aside>
      </section>

      <NewsletterForm />
    </>
  );
}
