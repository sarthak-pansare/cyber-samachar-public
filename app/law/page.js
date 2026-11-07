import { getLawData } from '@/lib/content';

export const metadata = { title: 'Cyber Law' };
export const revalidate = 300;

export default async function LawPage() {
  const { acts, sections } = await getLawData();

  return (
    <section className="page-section">
      <div className="section-heading">
        <p>Plain-English Indian cyber-law map</p>
        <h1>Cyber Law</h1>
      </div>
      <div className="law-map">
        <div className="law-root">Cyber Law</div>
        <div className="law-columns">
          {acts.map((act) => (
            <div key={act.id} className="law-act">
              <h2>{act.short_name || act.name}</h2>
              <p>{act.name}</p>
              <div className="law-list">
                {sections
                  .filter((section) => section.act_id === act.id)
                  .map((section) => (
                    <a key={section.id} href={`/law/${section.id}`}>
                      <span>{section.section_number}</span>
                      <strong>{section.title}</strong>
                      <small>{section.plain_english}</small>
                    </a>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
