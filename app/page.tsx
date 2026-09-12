import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { Simulator } from '@/components/simulator';
import { isAnalyticsConfigured, recordAnalyticsVisit } from '@/lib/analytics-store';
import { loadCompetitionData } from '@/lib/competition-store';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site-metadata';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    locale: 'sv_SE',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
  },
  twitter: {
    card: 'summary',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export default async function Home() {
  if (isAnalyticsConfigured()) {
    try {
      const requestHeaders = await headers();
      const requestData = {
        forwardedFor: requestHeaders.get('x-forwarded-for'),
        realIp: requestHeaders.get('x-real-ip') ?? requestHeaders.get('cf-connecting-ip'),
        userAgent: requestHeaders.get('user-agent'),
        mobileHint: requestHeaders.get('sec-ch-ua-mobile'),
        referrer: requestHeaders.get('referer'),
        host: requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'),
      };
      after(() => recordAnalyticsVisit(requestData));
    } catch {
      // Statistikfel får aldrig påverka simulatorn.
    }
  }

  return <Simulator initialData={await loadCompetitionData()} />;
}
