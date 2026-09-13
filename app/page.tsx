import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { Simulator } from '@/components/simulator';
import { isAnalyticsConfigured, recordAnalyticsPageView } from '@/lib/analytics-store';
import { loadCompetitionData } from '@/lib/competition-store';
import { SHARE_IMAGE_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site-metadata';

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
    images: [{
      url: SHARE_IMAGE_URL,
      width: 1200,
      height: 630,
      alt: `${SITE_NAME} – ${SITE_DESCRIPTION}`,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{
      url: SHARE_IMAGE_URL,
      alt: `${SITE_NAME} – ${SITE_DESCRIPTION}`,
    }],
  },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isAnalyticsConfigured()) {
    try {
      const query = await searchParams;
      const requestHeaders = await headers();
      const requestData = {
        queryRsc: query._rsc,
        rsc: requestHeaders.get('rsc'),
        nextRouterPrefetch: requestHeaders.get('next-router-prefetch'),
        nextRouterSegmentPrefetch: requestHeaders.get('next-router-segment-prefetch'),
        nextRouterStateTree: requestHeaders.get('next-router-state-tree'),
        xMiddlewarePrefetch: requestHeaders.get('x-middleware-prefetch'),
        xNextjsData: requestHeaders.get('x-nextjs-data'),
        nextAction: requestHeaders.get('next-action'),
        purpose: requestHeaders.get('purpose'),
        secPurpose: requestHeaders.get('sec-purpose'),
        accept: requestHeaders.get('accept'),
        secFetchDest: requestHeaders.get('sec-fetch-dest'),
        forwardedFor: requestHeaders.get('x-forwarded-for'),
        realIp: requestHeaders.get('x-real-ip') ?? requestHeaders.get('cf-connecting-ip'),
        userAgent: requestHeaders.get('user-agent'),
        mobileHint: requestHeaders.get('sec-ch-ua-mobile'),
        referrer: requestHeaders.get('referer'),
        host: requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'),
      };
      after(() => recordAnalyticsPageView(requestData));
    } catch {
      // Statistikfel får aldrig påverka simulatorn.
    }
  }

  return <Simulator initialData={await loadCompetitionData()} />;
}
