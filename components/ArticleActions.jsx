'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookmarkButton } from './BookmarkButton';

const VIEW_KEY = 'csViewedArticles';

function readViewed() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(VIEW_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function ArticleActions({ article }) {
  const [status, setStatus] = useState('');
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/article/${article.id}`;
    return new URL(`/article/${article.id}`, window.location.origin).toString();
  }, [article.id]);

  useEffect(() => {
    const viewed = readViewed();
    if (viewed.has(article.id)) return;

    fetch(`/api/article/${article.id}/view`, { method: 'POST' }).catch(() => {});
    viewed.add(article.id);
    window.localStorage.setItem(VIEW_KEY, JSON.stringify([...viewed]));
  }, [article.id]);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setStatus('Link copied');
    window.setTimeout(() => setStatus(''), 1800);
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: article.title, text: article.summary, url: shareUrl });
      return;
    }
    await copyLink();
  }

  return (
    <div className="article-actions">
      <BookmarkButton articleId={article.id} />
      <button type="button" onClick={share}>Share</button>
      <button type="button" onClick={copyLink}>Copy link</button>
      {status && <span>{status}</span>}
    </div>
  );
}
