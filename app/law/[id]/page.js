import { notFound } from 'next/navigation';
import { getLawSection } from '@/lib/content';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const section = await getLawSection(id);
  if (!section) return {};
  return { title: `${section.act?.short_name || 'Cyber Law'} ${section.section_number}` };
}

export default async function LawSectionPage({ params }) {
  const { id } = await params;
  const section = await getLawSection(id);
  if (!section) notFound();

  return (
    <section className="article-page legal-detail">
      <p className="hero-kicker">{section.act?.name || 'Cyber Law'}</p>
      <h1>{section.section_number}: {section.title}</h1>
      <p>{section.plain_english}</p>
      <div className="side-panel">
        <h2>Penalty / note</h2>
        <p>{section.penalty || 'Refer to the latest official act text and legal counsel for formal interpretation.'}</p>
      </div>
    </section>
  );
}
