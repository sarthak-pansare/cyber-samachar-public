import { buildEnvironmentBannerHtml } from '@/lib/environment-policy';

export function EnvironmentBanner() {
  const html = buildEnvironmentBannerHtml();
  if (!html) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
