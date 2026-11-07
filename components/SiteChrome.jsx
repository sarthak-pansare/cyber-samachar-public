'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const navItems = [
  ['/', 'Feed'],
  ['/categories', 'Categories'],
  ['/archive', 'Archive'],
  ['/law', 'Cyber Law'],
  ['/cell', 'Cyber Cell'],
  ['/scam', 'Scam'],
];

export function SiteChrome({ ticker = [], children }) {
  const router = useRouter();
  const [theme, setTheme] = useState('dark');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('cs-theme') || 'dark';
    setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('cs-theme', theme);
  }, [theme]);

  const tickerItems = useMemo(() => (ticker.length ? ticker : []), [ticker]);

  function routeSearch(queryText) {
    const query = String(queryText || '').trim();
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
    setOpen(false);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    routeSearch(formData.get('q'));
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      routeSearch(event.currentTarget.value);
    }
  }

  return (
    <>
      <div className="ticker" aria-label="Breaking cybersecurity headlines">
        <div className="ticker-track">
          {tickerItems.map((item) => (
            <Link key={item.id} href={`/article/${item.id}`} className="ticker-item">
              <span>LIVE</span>
              {item.title || item.generated_headline}
            </Link>
          ))}
        </div>
      </div>

      <header className="nav">
        <Link className="brand" href="/">
          <Image src="/brand/logo-mark.png" alt="" width={36} height={36} priority />
          <span>CYBER <b>SAMACHAR</b></span>
          <small>BETA v1.1</small>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          {navItems.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>

        <form className="nav-search" action="/search" onSubmit={handleSearchSubmit}>
          <input
            name="q"
            placeholder="Search threats, scams, laws..."
            aria-label="Search Cyber Samachar"
            onKeyDown={handleSearchKeyDown}
          />
          <button className="nav-search-submit" type="submit">
            Search
          </button>
        </form>

        <button className="icon-btn" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <button className="menu-btn" type="button" onClick={() => setOpen(true)} aria-label="Open menu">
          Menu
        </button>
      </header>

      {open && (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <aside className="drawer" onClick={(event) => event.stopPropagation()}>
            <button className="drawer-close" type="button" onClick={() => setOpen(false)}>
              Close
            </button>
            {navItems.map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                {label}
              </Link>
            ))}
            <Link href="/auth" onClick={() => setOpen(false)}>Auth</Link>
            <Link href="/profile" onClick={() => setOpen(false)}>Profile</Link>
          </aside>
        </div>
      )}

      <main>{children}</main>

      <footer className="footer">
        <div>
          <Image src="/brand/logo-mark.png" alt="" width={42} height={42} />
          <p>Cyber Samachar is in beta. Public-interest cybersecurity journalism, citizen tools, and Indian cyber-law awareness.</p>
        </div>
        <div className="footer-links">
          <Link href="/">Feed</Link>
          <Link href="/law">Cyber Law</Link>
          <Link href="/about">About</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </>
  );
}
