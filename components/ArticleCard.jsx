import Image from 'next/image';
import Link from 'next/link';
import { BookmarkButton } from './BookmarkButton';

export function ArticleCard({ article }) {
  return (
    <article className="news-card">
      <Link href={`/article/${article.id}`} className="card-media" aria-label={article.title}>
        {article.image ? (
          <Image src={article.image} alt="" fill sizes="(max-width: 720px) 100vw, 360px" />
        ) : (
          <Image className="watermark" src="/brand/logo-mark.png" alt="" width={92} height={92} />
        )}
      </Link>
      <div className="card-body">
        <div className="card-meta">
          <span className={`severity severity-${String(article.severity || 'info').toLowerCase()}`}>
            {article.severity || 'info'}
          </span>
          <span>{article.source_name || article.source_domain || 'Cyber Samachar'}</span>
        </div>
        <h2>
          <Link href={`/article/${article.id}`}>{article.title}</Link>
        </h2>
        <p>{article.summary}</p>
        <div className="tag-row">
          {(article.categories || []).slice(0, 3).map((tag) => (
            <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`}>
              {tag}
            </Link>
          ))}
          <BookmarkButton articleId={article.id} compact />
        </div>
      </div>
    </article>
  );
}
