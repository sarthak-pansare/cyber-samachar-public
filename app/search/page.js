import { ArticleCard } from '@/components/ArticleCard';
import { getFeed, getLawData } from '@/lib/content';

export const metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const q = params?.q || '';
  const [articles, law] = await Promise.all([getFeed({ q, pageSize: 30 }), getLawData()]);
  const lawMatches = law.sections.filter((section) =>
    [section.title, section.plain_english, section.section_number].join(' ').toLowerCase().includes(String(q).toLowerCase()),
  );

  return (
    <section className="page-section">
      <div className="section-heading">
        <p>Cross-surface search</p>
        <h1>Search</h1>
      </div>
      <form className="search-page-form">
        <input name="q" defaultValue={q} placeholder="Search articles and laws" />
        <button>Search</button>
      </form>
      <h2>Articles</h2>
      <div className="news-grid compact">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
      <h2>Law matches</h2>
      <div className="law-list">
        {lawMatches.map((section) => (
          <a key={section.id} href={`/law/${section.id}`}>
            <span>{section.section_number}</span>
            <strong>{section.title}</strong>
            <small>{section.plain_english}</small>
          </a>
        ))}
      </div>
    </section>
  );
}
