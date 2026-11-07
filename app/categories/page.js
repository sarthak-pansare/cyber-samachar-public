import { ArticleCard } from '@/components/ArticleCard';
import { getCategories, getFeed } from '@/lib/content';

export const metadata = { title: 'Categories' };
export const revalidate = 120;

export default async function CategoriesPage() {
  const [categories, articles] = await Promise.all([getCategories(), getFeed({ pageSize: 40 })]);

  return (
    <section className="page-section">
      <div className="section-heading">
        <p>Browse by topic</p>
        <h1>Categories</h1>
      </div>
      <div className="category-grid">
        {categories.map((category) => {
          const count = articles.filter((article) => article.categories?.includes(category.id)).length;
          return (
            <a key={category.id} href={`/?cat=${category.id}`} className="category-card">
              <span>{category.label || category.id}</span>
              <strong>{count}</strong>
              <small>{category.description}</small>
            </a>
          );
        })}
      </div>
      <div className="news-grid compact">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
