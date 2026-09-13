type DeviceKind = 'mobile' | 'desktop';

type AnalyticsDay = {
  date: string;
  visits: number;
  unique: number;
  visitorHashes?: string[];
  devices: Record<DeviceKind, number>;
  sources: Record<string, number>;
};

type StoredAnalytics = {
  version: 2;
  days: Record<string, AnalyticsDay>;
};

type LegacyAnalyticsDay = Omit<AnalyticsDay, 'unique' | 'visitorHashes'> & { visitors: string[] };

type LegacyStoredAnalytics = {
  version: 1;
  days: Record<string, LegacyAnalyticsDay>;
};

export type AnalyticsRequestData = {
  forwardedFor: string | null;
  realIp: string | null;
  userAgent: string | null;
  mobileHint: string | null;
  referrer: string | null;
  host: string | null;
};

export type AnalyticsPageViewRequest = AnalyticsRequestData & {
  queryRsc: string | string[] | undefined;
  rsc: string | null;
  nextRouterPrefetch: string | null;
  nextRouterSegmentPrefetch: string | null;
  nextRouterStateTree: string | null;
  xMiddlewarePrefetch: string | null;
  xNextjsData: string | null;
  nextAction: string | null;
  purpose: string | null;
  secPurpose: string | null;
  accept: string | null;
  secFetchDest: string | null;
};

export type AnalyticsSummary = {
  configured: boolean;
  today: { visits: number; unique: number };
  last7Days: { visits: number; unique: number };
  last30Days: { visits: number; unique: number };
  devices: Record<DeviceKind, number>;
  sources: Array<{ source: string; visits: number }>;
  days: Array<{ date: string; visits: number; unique: number }>;
};

const MAX_RETAINED_DAYS = 35;
const LOCK_WAIT_MS = 5_000;
const AUTOMATED_USER_AGENT_MARKERS = [
  'slutspurtendeploymenthealth/',
  'github-actions',
  'github-hookshot',
  'googlebot',
  'googleother',
  'google-inspectiontool',
  'storebot-google',
  'adsbot-google',
  'mediapartners-google',
  'feedfetcher-google',
  'bingbot',
  'bingpreview',
  'adidxbot',
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'yandeximages',
  'yahoo! slurp',
  'sogou',
  'exabot',
  'qwantify',
  'applebot',
  'petalbot',
  'seznambot',
  'naverbot',
  'facebookexternalhit',
  'facebookbot',
  'facebot',
  'meta-externalagent',
  'meta-externalfetcher',
  'messengerbot',
  'twitterbot',
  'linkedinbot',
  'pinterestbot',
  'slackbot',
  'discordbot',
  'telegrambot',
  'whatsapp/',
  'skypeuripreview',
  'redditbot',
  'tumblr',
  'vkshare',
  'snapchat',
  'ahrefsbot',
  'semrushbot',
  'mj12bot',
  'dotbot',
  'blexbot',
  'dataforseobot',
  'bytespider',
  'ccbot',
  'gptbot',
  'chatgpt-user',
  'oai-searchbot',
  'claudebot',
  'claude-searchbot',
  'anthropic-ai',
  'perplexitybot',
  'fossickbot',
  'headlesschrome',
  'phantomjs',
  'puppeteer',
  'playwright',
  'selenium',
  'lighthouse',
  'pagespeed insights',
  'uptimerobot',
  'pingdom',
  'statuscake',
  'site24x7',
  'checkly',
  'better uptime',
  'datadogsynthetics',
  'newrelicpinger',
  'kube-probe',
  'healthcheck',
  'health-check',
  'curl/',
  'wget/',
  'python-requests/',
  'python-urllib/',
  'aiohttp/',
  'go-http-client/',
  'libwww-perl/',
] as const;
const GENERIC_AUTOMATION_USER_AGENT_MARKERS = [
  'bot',
  'crawler',
  'spider',
  'scraper',
  'scanner',
  'monitor',
  'preview',
  'fetcher',
  'probe',
  'checker',
  'validator',
  'indexer',
  'archiver',
  'headless',
  'synthetic',
  'uptime',
] as const;
const STOCKHOLM_DATE = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function absoluteFilePath(filePath: string) {
  return filePath.startsWith('/') ? filePath : `${process.cwd()}/${filePath.replace(/^\.\//, '')}`;
}

function parentDirectory(filePath: string) {
  const separator = filePath.lastIndexOf('/');
  return separator > 0 ? filePath.slice(0, separator) : '.';
}

function analyticsConfiguration() {
  const secret = process.env.ANALYTICS_SECRET;
  const configuredPath = process.env.ANALYTICS_FILE_PATH;
  const filePath = configuredPath
    ? absoluteFilePath(configuredPath)
    : process.env.NODE_ENV !== 'production'
      ? absoluteFilePath('.data/analytics.json')
      : null;

  return secret && filePath ? { secret, filePath } : null;
}

function stockholmDateKey(date = new Date()) {
  const parts = Object.fromEntries(STOCKHOLM_DATE.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function recentDateKeys(today: string, count: number) {
  const [year, month, day] = today.split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day, 12));
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(cursor);
    date.setUTCDate(cursor.getUTCDate() - offset);
    return date.toISOString().slice(0, 10);
  });
}

function isNonNegativeInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isAnalyticsDay(value: unknown): value is AnalyticsDay {
  if (!value || typeof value !== 'object') return false;
  const day = value as Partial<AnalyticsDay>;
  return typeof day.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(day.date)
    && isNonNegativeInteger(day.visits)
    && isNonNegativeInteger(day.unique)
    && (day.visitorHashes === undefined
      || (Array.isArray(day.visitorHashes) && day.visitorHashes.every((visitor) => typeof visitor === 'string')))
    && Boolean(day.devices)
    && isNonNegativeInteger(day.devices?.mobile)
    && isNonNegativeInteger(day.devices?.desktop)
    && Boolean(day.sources)
    && Object.entries(day.sources ?? {}).every(([source, visits]) => source.length > 0 && isNonNegativeInteger(visits));
}

function isStoredAnalytics(value: unknown): value is StoredAnalytics {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<StoredAnalytics>;
  return state.version === 2
    && Boolean(state.days)
    && Object.entries(state.days ?? {}).every(([date, day]) => date === (day as AnalyticsDay)?.date && isAnalyticsDay(day));
}

function isLegacyAnalyticsDay(value: unknown): value is LegacyAnalyticsDay {
  if (!value || typeof value !== 'object') return false;
  const day = value as Partial<LegacyAnalyticsDay>;
  return typeof day.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(day.date)
    && isNonNegativeInteger(day.visits)
    && Array.isArray(day.visitors)
    && day.visitors.every((visitor) => typeof visitor === 'string')
    && Boolean(day.devices)
    && isNonNegativeInteger(day.devices?.mobile)
    && isNonNegativeInteger(day.devices?.desktop)
    && Boolean(day.sources)
    && Object.entries(day.sources ?? {}).every(([source, visits]) => source.length > 0 && isNonNegativeInteger(visits));
}

function isLegacyStoredAnalytics(value: unknown): value is LegacyStoredAnalytics {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<LegacyStoredAnalytics>;
  return state.version === 1
    && Boolean(state.days)
    && Object.entries(state.days ?? {}).every(([date, day]) => date === (day as LegacyAnalyticsDay)?.date && isLegacyAnalyticsDay(day));
}

function migrateLegacyState(state: LegacyStoredAnalytics): StoredAnalytics {
  return {
    version: 2,
    days: Object.fromEntries(Object.entries(state.days).map(([date, day]) => [date, {
      date,
      visits: day.visits,
      unique: day.visitors.length,
      visitorHashes: [...day.visitors],
      devices: day.devices,
      sources: day.sources,
    }])),
  };
}

function emptyState(): StoredAnalytics {
  return { version: 2, days: {} };
}

async function loadState(filePath: string) {
  const fs = await import('fs/promises');
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
    if (isStoredAnalytics(parsed)) return parsed;
    if (isLegacyStoredAnalytics(parsed)) return migrateLegacyState(parsed);
    throw new Error('Statistikfilen har ett okänt format.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
    throw error;
  }
}

async function saveState(filePath: string, state: StoredAnalytics) {
  const fs = await import('fs/promises');
  await fs.mkdir(parentDirectory(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function acquireFileLock(filePath: string) {
  const fs = await import('fs/promises');
  const lockPath = `${filePath}.lock`;
  const recoveryPath = `${lockPath}.recovery`;
  const deadline = Date.now() + LOCK_WAIT_MS;
  await fs.mkdir(parentDirectory(lockPath), { recursive: true, mode: 0o700 });

  const recoverAbandonedLock = async () => {
    let recoveryHandle;
    try {
      recoveryHandle = await fs.open(recoveryPath, 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return;
      throw error;
    }

    try {
      const owner = Number((await fs.readFile(lockPath, 'utf8')).trim());
      if (!Number.isInteger(owner) || owner <= 0) return;
      try {
        process.kill(owner, 0);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ESRCH') await fs.unlink(lockPath).catch(() => undefined);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    } finally {
      await recoveryHandle.close();
      await fs.unlink(recoveryPath).catch(() => undefined);
    }
  };

  while (Date.now() < deadline) {
    try {
      const handle = await fs.open(lockPath, 'wx', 0o600);
      await handle.writeFile(`${process.pid}\n`, 'utf8');
      await handle.close();
      return async () => {
        await fs.unlink(lockPath).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error;
        });
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      await recoverAbandonedLock();
      await new Promise((resolve) => setTimeout(resolve, 10 + Math.floor(Math.random() * 30)));
    }
  }

  return null;
}

function normalizeIpv4(value: string) {
  const parts = value.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  return parts.map((part) => String(Number(part))).join('.');
}

function normalizeIpv6(value: string) {
  if (!value.includes(':') || value.includes('%')) return null;
  try {
    const hostname = new URL(`http://[${value}]/`).hostname;
    if (!hostname.startsWith('[') || !hostname.endsWith(']')) return null;
    const normalized = hostname.slice(1, -1).toLowerCase();
    const ipv4Mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
    if (!ipv4Mapped) return normalized;
    const high = Number.parseInt(ipv4Mapped[1], 16);
    const low = Number.parseInt(ipv4Mapped[2], 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  } catch {
    return null;
  }
}

function normalizeIpAddress(value: string) {
  let candidate = value.trim();
  if (candidate.startsWith('"') && candidate.endsWith('"')) candidate = candidate.slice(1, -1).trim();

  const bracketed = /^\[([^\]]+)](?::(\d{1,5}))?$/.exec(candidate);
  if (bracketed) {
    if (bracketed[2] && Number(bracketed[2]) > 65_535) return null;
    return normalizeIpv6(bracketed[1]);
  }

  const ipv4 = normalizeIpv4(candidate);
  if (ipv4) return ipv4;

  const ipv4WithPort = /^(.+):(\d{1,5})$/.exec(candidate);
  if (ipv4WithPort && Number(ipv4WithPort[2]) <= 65_535) {
    const normalized = normalizeIpv4(ipv4WithPort[1]);
    if (normalized) return normalized;
  }

  return normalizeIpv6(candidate);
}

export function normalizeClientIp(forwardedFor: string | null, realIp: string | null) {
  for (const candidate of forwardedFor?.split(',') ?? []) {
    const normalized = normalizeIpAddress(candidate);
    if (normalized) return normalized;
  }
  return realIp ? normalizeIpAddress(realIp) : null;
}

function deviceKind(request: AnalyticsRequestData): DeviceKind {
  if (request.mobileHint === '?1') return 'mobile';
  return /Android|iPad|iPhone|iPod|Mobile/i.test(request.userAgent ?? '') ? 'mobile' : 'desktop';
}

function hostname(value: string | null) {
  if (!value) return null;
  try {
    const candidate = value.includes('://') ? value : `http://${value}`;
    return new URL(candidate).hostname.toLowerCase().replace(/^(?:www|m)\./, '').slice(0, 253) || null;
  } catch {
    return null;
  }
}

function trafficSource(request: AnalyticsRequestData) {
  const source = hostname(request.referrer);
  const ownHost = hostname(request.host);
  if (!source || source === ownHost || (ownHost && source.endsWith(`.${ownHost}`))) return 'Direkt';
  return source;
}

async function visitorHash(secret: string, date: string, ipAddress: string | null) {
  if (!ipAddress) return null;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`slutspurten-analytics-v1\n${date}\n${ipAddress}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function pruneDays(state: StoredAnalytics, today: string) {
  const retained = new Set(recentDateKeys(today, MAX_RETAINED_DAYS));
  state.days = Object.fromEntries(Object.entries(state.days).filter(([date]) => retained.has(date)));
}

function removeCompletedDayHashes(state: StoredAnalytics, today: string) {
  for (const [date, day] of Object.entries(state.days)) {
    if (date !== today) delete day.visitorHashes;
  }
}

export function isAnalyticsConfigured() {
  return analyticsConfiguration() !== null;
}

export function isAutomatedUserAgent(userAgent: string | null) {
  const candidate = userAgent?.trim().toLowerCase();
  if (!candidate) return true;
  return AUTOMATED_USER_AGENT_MARKERS.some((marker) => candidate.includes(marker))
    || GENERIC_AUTOMATION_USER_AGENT_MARKERS.some((marker) => candidate.includes(marker));
}

function headerIsPresent(value: string | null) {
  return value !== null;
}

export function isAnalyticsPageView(request: AnalyticsPageViewRequest) {
  if (request.queryRsc !== undefined) return false;
  if ([
    request.rsc,
    request.nextRouterPrefetch,
    request.nextRouterSegmentPrefetch,
    request.nextRouterStateTree,
    request.xMiddlewarePrefetch,
    request.xNextjsData,
    request.nextAction,
  ].some(headerIsPresent)) return false;

  const purpose = `${request.purpose ?? ''} ${request.secPurpose ?? ''}`.toLowerCase();
  if (/(?:^|[\s,;])prefetch(?:$|[\s,;])/.test(purpose)) return false;
  if (request.accept?.toLowerCase().includes('text/x-component')) return false;

  const fetchDestination = request.secFetchDest?.trim().toLowerCase();
  return !fetchDestination || fetchDestination === 'document';
}

export async function recordAnalyticsPageView(request: AnalyticsPageViewRequest) {
  if (!isAnalyticsPageView(request)) return;
  if (isAutomatedUserAgent(request.userAgent)) return;

  let release: (() => Promise<void>) | null = null;

  try {
    const configuration = analyticsConfiguration();
    if (!configuration) return;
    release = await acquireFileLock(configuration.filePath);
    if (!release) return;

    const date = stockholmDateKey();
    const state = await loadState(configuration.filePath);
    removeCompletedDayHashes(state, date);
    const day = state.days[date] ?? {
      date,
      visits: 0,
      unique: 0,
      visitorHashes: [],
      devices: { mobile: 0, desktop: 0 },
      sources: {},
    };
    const device = deviceKind(request);
    const source = trafficSource(request);
    const visitor = await visitorHash(configuration.secret, date, normalizeClientIp(request.forwardedFor, request.realIp));

    day.visits += 1;
    day.devices[device] += 1;
    day.sources[source] = (day.sources[source] ?? 0) + 1;
    day.visitorHashes ??= [];
    if (visitor && !day.visitorHashes.includes(visitor)) {
      day.visitorHashes.push(visitor);
      day.unique += 1;
    }
    state.days[date] = day;
    pruneDays(state, date);
    await saveState(configuration.filePath, state);
  } catch {
    // Statistik är sekundär och får aldrig påverka sidans svar.
  } finally {
    await release?.().catch(() => undefined);
  }
}

export async function resetAnalyticsFile(filePath: string) {
  const absolutePath = absoluteFilePath(filePath);
  const release = await acquireFileLock(absolutePath);
  if (!release) throw new Error('Statistikfilen kunde inte låsas för nollställning.');

  try {
    await saveState(absolutePath, emptyState());
  } finally {
    await release();
  }
}

function periodTotals(state: StoredAnalytics, dates: string[]) {
  return dates.reduce((totals, date) => {
    const day = state.days[date];
    if (day) {
      totals.visits += day.visits;
      totals.unique += day.unique;
    }
    return totals;
  }, { visits: 0, unique: 0 });
}

function emptySummary(configured: boolean, today: string): AnalyticsSummary {
  return {
    configured,
    today: { visits: 0, unique: 0 },
    last7Days: { visits: 0, unique: 0 },
    last30Days: { visits: 0, unique: 0 },
    devices: { mobile: 0, desktop: 0 },
    sources: [],
    days: recentDateKeys(today, 30).map((date) => ({ date, visits: 0, unique: 0 })),
  };
}

export async function loadAnalyticsSummary(): Promise<AnalyticsSummary> {
  const configuration = analyticsConfiguration();
  const today = stockholmDateKey();
  if (!configuration) return emptySummary(false, today);

  try {
    const state = await loadState(configuration.filePath);
    const last30Dates = recentDateKeys(today, 30);
    const sources: Record<string, number> = {};
    const devices = { mobile: 0, desktop: 0 };

    for (const date of last30Dates) {
      const day = state.days[date];
      if (!day) continue;
      devices.mobile += day.devices.mobile;
      devices.desktop += day.devices.desktop;
      for (const [source, visits] of Object.entries(day.sources)) {
        sources[source] = (sources[source] ?? 0) + visits;
      }
    }

    return {
      configured: true,
      today: periodTotals(state, last30Dates.slice(0, 1)),
      last7Days: periodTotals(state, last30Dates.slice(0, 7)),
      last30Days: periodTotals(state, last30Dates),
      devices,
      sources: Object.entries(sources)
        .map(([source, visits]) => ({ source, visits }))
        .sort((left, right) => right.visits - left.visits || left.source.localeCompare(right.source, 'sv')),
      days: last30Dates.map((date) => ({
        date,
        visits: state.days[date]?.visits ?? 0,
        unique: state.days[date]?.unique ?? 0,
      })),
    };
  } catch {
    return emptySummary(true, today);
  }
}
