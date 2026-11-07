import { getCyberCells } from '@/lib/content';

export const metadata = { title: 'Cyber Cell Finder' };
export const revalidate = 300;

export default async function CellPage({ searchParams }) {
  const params = await searchParams;
  const q = String(params?.q || '').toLowerCase();
  const cells = await getCyberCells();
  const filtered = q
    ? cells.filter((cell) => [cell.state, cell.city, cell.type].join(' ').toLowerCase().includes(q))
    : cells;

  return (
    <section className="page-section">
      <div className="section-heading">
        <p>Citizen tool</p>
        <h1>Cyber Cell Finder</h1>
      </div>
      <form className="search-page-form">
        <input name="q" defaultValue={params?.q || ''} placeholder="Search state or city" />
        <button>Find</button>
      </form>
      <div className="category-grid">
        {filtered.map((cell) => (
          <article key={cell.id} className="category-card">
            <span>{cell.state}</span>
            <strong>{cell.city}</strong>
            <small>{cell.address}</small>
            <a href={cell.portal_url} target="_blank" rel="noreferrer">Portal / {cell.hotline || '1930'}</a>
          </article>
        ))}
      </div>
    </section>
  );
}
