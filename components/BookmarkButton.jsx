'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'csBookmarks';

function readBookmarks() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function BookmarkButton({ articleId, compact = false }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(readBookmarks().has(articleId));
  }, [articleId]);

  function toggle(event) {
    event.preventDefault();
    event.stopPropagation();
    const bookmarks = readBookmarks();
    if (bookmarks.has(articleId)) bookmarks.delete(articleId);
    else bookmarks.add(articleId);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...bookmarks]));
    setSaved(bookmarks.has(articleId));
  }

  return (
    <button className={`bookmark-btn ${saved ? 'active' : ''}`} type="button" onClick={toggle}>
      {compact ? (saved ? 'Saved' : 'Save') : saved ? 'Saved to read later' : 'Save for later'}
    </button>
  );
}
