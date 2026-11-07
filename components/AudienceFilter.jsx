'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const audiences = [
  { id: 'all', label: 'All readers', copy: 'Balanced citizen + professional coverage' },
  { id: 'general', label: 'General', copy: 'Plain-language cyber awareness' },
  { id: 'professional', label: 'Professional', copy: 'Technical intelligence and response context' },
];

export function AudienceFilter({ current = 'all' }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState(current || 'all');

  useEffect(() => {
    const saved = window.localStorage.getItem('csAudience');
    if (!searchParams.get('audience') && saved && saved !== selected) {
      const next = new URLSearchParams(searchParams);
      if (saved === 'all') next.delete('audience');
      else next.set('audience', saved);
      router.replace(`${pathname}?${next.toString()}`.replace(/\?$/, ''));
      setSelected(saved);
    }
  }, [pathname, router, searchParams, selected]);

  function choose(id) {
    const next = new URLSearchParams(searchParams);
    if (id === 'all') next.delete('audience');
    else next.set('audience', id);
    window.localStorage.setItem('csAudience', id);
    setSelected(id);
    router.push(`${pathname}?${next.toString()}`.replace(/\?$/, ''));
  }

  return (
    <div className="audience-filter" aria-label="Choose your feed">
      {audiences.map((audience) => (
        <button
          key={audience.id}
          type="button"
          className={selected === audience.id ? 'active' : ''}
          onClick={() => choose(audience.id)}
        >
          <span>{audience.label}</span>
          <small>{audience.copy}</small>
        </button>
      ))}
    </div>
  );
}
