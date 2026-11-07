import { ArticleCard } from '@/components/ArticleCard';
import { getArchive } from '@/lib/content';

export const metadata = { title: 'Archive' };
export const revalidate = 300;

export default async function ArchivePage({ searchParams }) {
  const params = await searchParams;
  const year = params?.year || new Date().getFullYear();
  const articles = await getArchive(year);

  return (
    <section className="page-section">
      <div className="section-heading">
        <p>{year}</p>
        <h1>Archive</h1>
      </div>
      <div className="news-grid">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
