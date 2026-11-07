import './globals.css';
import { SiteChrome } from '@/components/SiteChrome';
import { EnvironmentBanner } from '@/components/EnvironmentBanner';
import { getTicker } from '@/lib/content';

export const metadata = {
  metadataBase: new URL('https://cybersamachar.ai'),
  title: {
    default: 'Cyber Samachar - India Cybersecurity Intelligence',
    template: '%s | Cyber Samachar',
  },
  description:
    'Cyber Samachar is an Indian cybersecurity intelligence and cyber awareness platform for citizens and professionals.',
  openGraph: {
    title: 'Cyber Samachar',
    description: 'India cyber awareness, cyber law, scam alerts, and cybersecurity intelligence.',
    siteName: 'Cyber Samachar',
    type: 'website',
  },
};

export default async function RootLayout({ children }) {
  const ticker = await getTicker();

  return (
    <html lang="en">
      <body>
        <SiteChrome ticker={ticker}>{children}</SiteChrome>
        <EnvironmentBanner />
      </body>
    </html>
  );
}
