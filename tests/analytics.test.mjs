import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  isAutomatedUserAgent,
  loadAnalyticsSummary,
  normalizeClientIp,
  recordAnalyticsPageView,
  resetAnalyticsFile,
} from '../lib/analytics-store.ts';

const normalPageView = {
  queryRsc: undefined,
  rsc: null,
  nextRouterPrefetch: null,
  nextRouterSegmentPrefetch: null,
  nextRouterStateTree: null,
  xMiddlewarePrefetch: null,
  xNextjsData: null,
  nextAction: null,
  purpose: null,
  secPurpose: null,
  accept: 'text/html,application/xhtml+xml',
  secFetchDest: 'document',
  forwardedFor: '203.0.113.10',
  realIp: null,
  userAgent: 'Mozilla/5.0 TestBrowser/1.0',
  mobileHint: '?0',
  referrer: null,
  host: 'slutspurten.se',
};

test('only a real document load is counted when Next.js also makes internal requests', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'slutspurten-analytics-test-'),
  );
  const filePath = join(directory, 'analytics.json');
  const previousPath = process.env.ANALYTICS_FILE_PATH;
  const previousSecret = process.env.ANALYTICS_SECRET;
  process.env.ANALYTICS_FILE_PATH = filePath;
  process.env.ANALYTICS_SECRET = 'test-only-secret';

  try {
    await recordAnalyticsPageView(normalPageView);
    await recordAnalyticsPageView({ ...normalPageView, queryRsc: '17qrm' });
    await recordAnalyticsPageView({
      ...normalPageView,
      rsc: '1',
      accept: 'text/x-component',
    });
    await recordAnalyticsPageView({
      ...normalPageView,
      nextRouterPrefetch: '1',
    });
    await recordAnalyticsPageView({
      ...normalPageView,
      nextRouterSegmentPrefetch: '/admin',
    });
    await recordAnalyticsPageView({
      ...normalPageView,
      nextRouterStateTree: '%5B%22%22%5D',
    });
    await recordAnalyticsPageView({
      ...normalPageView,
      xMiddlewarePrefetch: '1',
    });
    await recordAnalyticsPageView({ ...normalPageView, xNextjsData: '1' });
    await recordAnalyticsPageView({
      ...normalPageView,
      nextAction: 'action-id',
    });
    await recordAnalyticsPageView({ ...normalPageView, purpose: 'prefetch' });
    await recordAnalyticsPageView({
      ...normalPageView,
      secPurpose: 'prefetch;prerender',
    });
    await recordAnalyticsPageView({ ...normalPageView, secFetchDest: 'empty' });
    await recordAnalyticsPageView({
      ...normalPageView,
      userAgent: 'Mozilla/5.0 (compatible; FossickBot/1.0)',
    });

    const summary = await loadAnalyticsSummary();
    assert.deepEqual(summary.today, { visits: 1, unique: 1 });

    const stored = await readFile(filePath, 'utf8');
    assert.doesNotMatch(stored, /203\.0\.113\.10|TestBrowser|FossickBot/);

    await resetAnalyticsFile(filePath);
    assert.deepEqual((await loadAnalyticsSummary()).today, {
      visits: 0,
      unique: 0,
    });
  } finally {
    if (previousPath === undefined) delete process.env.ANALYTICS_FILE_PATH;
    else process.env.ANALYTICS_FILE_PATH = previousPath;
    if (previousSecret === undefined) delete process.env.ANALYTICS_SECRET;
    else process.env.ANALYTICS_SECRET = previousSecret;
    await rm(directory, { recursive: true, force: true });
  }
});

test('generic automation user agents are filtered case-insensitively', () => {
  for (const marker of [
    'BOT',
    'Crawler',
    'Spider',
    'Scraper',
    'Scanner',
    'Monitor',
    'Preview',
    'Fetcher',
    'Probe',
  ]) {
    assert.equal(
      isAutomatedUserAgent(`Mozilla/5.0 Example${marker}/1.0`),
      true,
      marker,
    );
  }
  assert.equal(
    isAutomatedUserAgent('Mozilla/5.0 (compatible; FossickBot/1.0)'),
    true,
  );
  assert.equal(isAutomatedUserAgent(normalPageView.userAgent), false);
});

test('client IP uses the first valid forwarded address and normalizes it', () => {
  assert.equal(
    normalizeClientIp(
      'unknown, 203.000.113.007:443, 198.51.100.2',
      '192.0.2.1',
    ),
    '203.0.113.7',
  );
  assert.equal(
    normalizeClientIp('[2001:0db8:0:0:0:0:0:1]:443', null),
    '2001:db8::1',
  );
  assert.equal(normalizeClientIp('::ffff:192.0.2.1', null), '192.0.2.1');
  assert.equal(
    normalizeClientIp('unknown, invalid', '198.051.100.009'),
    '198.51.100.9',
  );
  assert.equal(normalizeClientIp('unknown, 999.1.1.1', 'invalid'), null);
});
