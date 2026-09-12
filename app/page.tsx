import { headers } from 'next/headers';
import { after } from 'next/server';
import { Simulator } from '@/components/simulator';
import { isAnalyticsConfigured, recordAnalyticsVisit } from '@/lib/analytics-store';
import { loadCompetitionData } from '@/lib/competition-store';

export const dynamic = 'force-dynamic';

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
