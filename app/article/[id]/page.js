import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArticleActions } from '@/components/ArticleActions';
import { getArticle } from '@/lib/content';

export const revalidate = 120;

export async function generateMetadata({ params }) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary,
    openGraph: {
      title: article.title,
      description: article.summary,
      images: article.image ? [article.image] : ['/brand/logo.png'],
    },
  };
}

export default async function ArticlePage({ params }) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) notFound();

  return (
    <article className="article-page">
      <div className="article-hero">
        <div>
          <p className="hero-kicker">{article.source_name || article.source_domain}</p>
          <h1>{article.title}</h1>
          <p>{article.summary}</p>
          <div className="card-meta">
            <span className={`severity severity-${String(article.severity || 'info').toLowerCase()}`}>{article.severity}</span>
            <span>{article.published_at ? new Date(article.published_at).toLocaleString('en-IN') : 'Latest'}</span>
          </div>
          <ArticleActions article={article} />
        </div>
        <div className="article-image">
          {article.image ? (
            <Image src={article.image} alt="" fill sizes="(max-width: 900px) 100vw, 460px" priority />
          ) : (
            <Image src="/brand/logo-mark.png" alt="" width={140} height={140} priority />
          )}
        </div>
      </div>
      <div className="article-body">
        {String(article.body)
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((para) => (
            <p key={para}>{para}</p>
          ))}
      </div>
      <div className="tag-row">
        {(article.tags || []).map((tag) => (
          <a key={tag} href={`/search?q=${encodeURIComponent(tag)}`}>{tag}</a>
        ))}
      </div>
    </article>
  );
}
