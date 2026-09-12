import {
  SNAPSHOT,
  canonicalTeamName,
  createTeamStanding,
  isFinishedFixture,
  type CompetitionData,
  type Fixture,
  type TeamStanding,
} from '@/lib/superettan';
import {
  ADMINISTRATIVE_RESULT_OVERRIDES,
  findAdministrativeResultOverride,
} from '@/lib/administrative-result-overrides';
import { applyScheduleOverrides, findScheduleOverride } from '@/lib/schedule-overrides';

const API_BASE_URL = 'https://api.goal-api.com/v1';
const DEFAULT_LEAGUE_ID = 'cmr77dvit0057rx06s7xypict';
const PAGE_SIZE = 100;
const MATCHES_PER_ROUND = 8;
const SWEDISH_TIME_ZONE = 'Europe/Stockholm';

type GoalPagination = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type GoalEnvelope<T> = {
  success?: boolean;
  data?: T[];
  pagination?: Partial<GoalPagination>;
  message?: string;
};

type GoalStanding = {
  overallLeaguePosition: number | string;
  overallLeaguePlayed: number | string;
  overallLeagueW: number | string;
  overallLeagueD: number | string;
  overallLeagueL: number | string;
  overallLeagueGF: number | string;
  overallLeagueGA: number | string;
  overallLeaguePTS: number | string;
  teamName: string;
};

export type GoalFixture = {
  id?: string;
  apiId?: string;
  leagueId?: string;
  leagueName?: string;
  leagueYear?: number | string;
  matchDate?: string;
  matchTime?: string;
  kickoffUtc?: string;
  matchStatus?: string;
  matchRound?: number | string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamScore?: number | string | null;
  awayTeamScore?: number | string | null;
};

type RequestCounter = { count: number };

export class GoalApiError extends Error {
  constructor(message: string, readonly requestCount: number) {
    super(message);
    this.name = 'GoalApiError';
  }
}

function numberValue(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`GOAL API saknar ett giltigt värde för ${label}.`);
  return parsed;
}

function optionalScore(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  const score = Number(value);
  return Number.isFinite(score) ? score : undefined;
}

function extractRound(value: unknown) {
  const match = String(value ?? '').match(/\d+/);
  const round = match ? Number(match[0]) : 0;
  return round >= 1 && round <= 30 ? round : 0;
}

function fixtureKey(round: number, home: string, away: string) {
  return `${round}|${canonicalTeamName(home)}|${canonicalTeamName(away)}`;
}

function apiFixtureKey(fixture: GoalFixture) {
  return fixtureKey(
    extractRound(fixture.matchRound),
    canonicalTeamName(fixture.homeTeamName ?? ''),
    canonicalTeamName(fixture.awayTeamName ?? ''),
  );
}

const swedishKickoffFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: SWEDISH_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function swedishKickoffParts(kickoffUtc: string) {
  const timestamp = Date.parse(kickoffUtc);
  if (!Number.isFinite(timestamp)) return null;
  const parts = Object.fromEntries(
    swedishKickoffFormatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    kickoffAt: new Date(timestamp).toISOString(),
  };
}

function rawKickoffParts(fixture: GoalFixture) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fixture.matchDate ?? '')) return null;
  if (!/^\d{2}:\d{2}/.test(fixture.matchTime ?? '')) return null;
  return { date: fixture.matchDate!, time: fixture.matchTime!.slice(0, 5) };
}

function incomingFixtureQuality(fixture: GoalFixture) {
  const score = optionalScore(fixture.homeTeamScore) !== undefined && optionalScore(fixture.awayTeamScore) !== undefined ? 4 : 0;
  const finalStatus = isFinishedFixture({ status: fixture.matchStatus } as Fixture) ? 4 : 0;
  const kickoff = fixture.kickoffUtc && swedishKickoffParts(fixture.kickoffUtc) ? 2 : rawKickoffParts(fixture) ? 1 : 0;
  return score + finalStatus + kickoff;
}

export function deduplicateApiFixtures(fixtures: GoalFixture[]) {
  const matches = new Map<string, GoalFixture>();
  for (const fixture of fixtures) {
    const round = extractRound(fixture.matchRound);
    const home = canonicalTeamName(fixture.homeTeamName ?? '');
    const away = canonicalTeamName(fixture.awayTeamName ?? '');
    if (!round || !home || !away) continue;
    const key = fixtureKey(round, home, away);
    const existing = matches.get(key);
    if (!existing || incomingFixtureQuality(fixture) > incomingFixtureQuality(existing)) matches.set(key, fixture);
  }
  return [...matches.values()];
}

function applyFinishedResult(home: TeamStanding, away: TeamStanding, homeScore: number, awayScore: number) {
  home.played += 1;
  away.played += 1;
  home.goalsFor += homeScore;
  home.goalsAgainst += awayScore;
  away.goalsFor += awayScore;
  away.goalsAgainst += homeScore;

  if (homeScore > awayScore) {
    home.won += 1;
    away.lost += 1;
    home.points += 3;
  } else if (homeScore < awayScore) {
    away.won += 1;
    home.lost += 1;
    away.points += 3;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }
}

export function calculateStandingsFromFixtures(season: number, apiFixtures: GoalFixture[]) {
  const deduplicated = deduplicateApiFixtures(apiFixtures);
  const finishedFixtures = deduplicated.filter((fixture) =>
    isFinishedFixture({ status: fixture.matchStatus } as Fixture),
  );
  const table = new Map(SNAPSHOT.teams.map((team) => [
    team.name,
    createTeamStanding(team.name, team.shortName, 0, 0, 0, 0, 0, 0, 0),
  ]));
  const appliedOverrideIds = new Set<string>();
  let drawnMatches = 0;

  for (const fixture of finishedFixtures) {
    const round = extractRound(fixture.matchRound);
    const homeName = canonicalTeamName(fixture.homeTeamName ?? '');
    const awayName = canonicalTeamName(fixture.awayTeamName ?? '');
    const home = table.get(homeName);
    const away = table.get(awayName);
    if (!round || !home || !away || home === away) {
      throw new Error(`En färdig GOAL-match kunde inte kopplas till två olika Superettan-lag: ${homeName}–${awayName}.`);
    }

    const apiHomeScore = optionalScore(fixture.homeTeamScore);
    const apiAwayScore = optionalScore(fixture.awayTeamScore);
    if (apiHomeScore === undefined || apiAwayScore === undefined) {
      throw new Error(`GOAL-matchen ${homeName}–${awayName} i omgång ${round} saknar slutresultat.`);
    }

    const override = findAdministrativeResultOverride(season, round, homeName, awayName);
    const homeScore = override?.homeScore ?? apiHomeScore;
    const awayScore = override?.awayScore ?? apiAwayScore;
    if (override) appliedOverrideIds.add(override.id);
    if (homeScore === awayScore) drawnMatches += 1;
    applyFinishedResult(home, away, homeScore, awayScore);
  }

  const teams = [...table.values()];
  const totalPlayed = teams.reduce((sum, team) => sum + team.played, 0);
  const totalWon = teams.reduce((sum, team) => sum + team.won, 0);
  const totalDrawn = teams.reduce((sum, team) => sum + team.drawn, 0);
  const totalLost = teams.reduce((sum, team) => sum + team.lost, 0);
  const totalGoalsFor = teams.reduce((sum, team) => sum + team.goalsFor, 0);
  const totalGoalsAgainst = teams.reduce((sum, team) => sum + team.goalsAgainst, 0);
  const expectedOverrideIds = ADMINISTRATIVE_RESULT_OVERRIDES
    .filter((override) => override.season === season)
    .map((override) => override.id);

  const missingOverrideIds = expectedOverrideIds.filter((id) => !appliedOverrideIds.has(id));
  if (missingOverrideIds.length) {
    throw new Error(`Tabellkontrollen misslyckades: administrativa overrides kunde inte kopplas (${missingOverrideIds.join(', ')}).`);
  }

  if (totalPlayed !== finishedFixtures.length * 2) {
    throw new Error(`Tabellkontrollen misslyckades: ${totalPlayed} lagframträdanden för ${finishedFixtures.length} färdiga matcher.`);
  }
  if (totalWon !== totalLost || totalDrawn !== drawnMatches * 2 || totalGoalsFor !== totalGoalsAgainst) {
    throw new Error('Tabellkontrollen misslyckades: vinster/förluster, oavgjorda eller mål summerar inte symmetriskt.');
  }
  for (const team of teams) {
    if (team.played !== team.won + team.drawn + team.lost) {
      throw new Error(`Tabellkontrollen misslyckades för ${team.name}: M är inte lika med V + O + F.`);
    }
  }

  teams.sort((a, b) =>
    b.points - a.points
    || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
    || b.goalsFor - a.goalsFor
    || a.name.localeCompare(b.name, 'sv-SE'),
  );

  return {
    teams,
    finishedFixtureCount: finishedFixtures.length,
    appliedOverrideIds: [...appliedOverrideIds],
  };
}

function applyApiFixture(base: Fixture, incoming: GoalFixture): Fixture {
  const kickoff = incoming.kickoffUtc
    ? swedishKickoffParts(incoming.kickoffUtc) ?? rawKickoffParts(incoming)
    : rawKickoffParts(incoming);
  const status = incoming.matchStatus?.trim() || undefined;
  const homeScore = optionalScore(incoming.homeTeamScore);
  const awayScore = optionalScore(incoming.awayTeamScore);
  const hasFinalScore = isFinishedFixture({ status } as Fixture) && homeScore !== undefined && awayScore !== undefined;

  return {
    ...base,
    ...(kickoff ?? {}),
    ...(status ? { status } : {}),
    ...(hasFinalScore ? { homeScore, awayScore } : {}),
    ...(incoming.apiId ? { apiId: String(incoming.apiId) } : {}),
  };
}

function newFixtureFromApi(incoming: GoalFixture): Fixture | null {
  const round = extractRound(incoming.matchRound);
  const home = canonicalTeamName(incoming.homeTeamName ?? '');
  const away = canonicalTeamName(incoming.awayTeamName ?? '');
  const kickoff = incoming.kickoffUtc
    ? swedishKickoffParts(incoming.kickoffUtc) ?? rawKickoffParts(incoming)
    : rawKickoffParts(incoming);
  if (!round || !home || !away || !kickoff) return null;

  return applyApiFixture({
    id: `goal-${incoming.apiId ?? incoming.id ?? fixtureKey(round, home, away)}`,
    round,
    home,
    away,
    ...kickoff,
  }, incoming);
}

export function mergeGoalFixtures(existingFixtures: Fixture[], apiFixtures: GoalFixture[], season = SNAPSHOT.season) {
  const knownTeams = new Set(SNAPSHOT.teams.map((team) => team.name));
  const merged = new Map<string, Fixture>();

  // Snapshotens spelschema återställer alltid originalmatcherna om en äldre
  // sparad synkning någon gång har ersatt matchlistan med ett ofullständigt API-svar.
  for (const fixture of [...SNAPSHOT.fixtures, ...existingFixtures]) {
    const home = canonicalTeamName(fixture.home);
    const away = canonicalTeamName(fixture.away);
    if (!fixture.round || !knownTeams.has(home) || !knownTeams.has(away)) continue;
    merged.set(fixtureKey(fixture.round, home, away), { ...fixture, home, away });
  }

  for (const incoming of deduplicateApiFixtures(apiFixtures)) {
    const key = apiFixtureKey(incoming);
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, applyApiFixture(existing, incoming));
      continue;
    }

    const candidate = newFixtureFromApi(incoming);
    if (!candidate || !knownTeams.has(candidate.home) || !knownTeams.has(candidate.away)) continue;
    const roundSize = [...merged.values()].filter((fixture) => fixture.round === candidate.round).length;
    if (roundSize < MATCHES_PER_ROUND) merged.set(key, candidate);
  }

  return applyScheduleOverrides([...merged.values()], season);
}

function scheduleMismatchIds(season: number, apiFixtures: GoalFixture[]) {
  const mismatches = new Set<string>();
  for (const incoming of deduplicateApiFixtures(apiFixtures)) {
    const override = findScheduleOverride(
      season,
      extractRound(incoming.matchRound),
      incoming.homeTeamName ?? '',
      incoming.awayTeamName ?? '',
    );
    if (!override) continue;
    const kickoff = incoming.kickoffUtc
      ? swedishKickoffParts(incoming.kickoffUtc) ?? rawKickoffParts(incoming)
      : rawKickoffParts(incoming);
    if (kickoff && (kickoff.date !== override.date || kickoff.time !== override.time)) {
      mismatches.add(override.id);
    }
  }
  return [...mismatches];
}

function completedRound(fixtures: Fixture[]) {
  let lastCompletedRound = 0;
  for (let round = 1; round <= 30; round += 1) {
    const roundFixtures = fixtures.filter((fixture) => fixture.round === round);
    if (roundFixtures.length !== MATCHES_PER_ROUND || roundFixtures.some((fixture) => !isFinishedFixture(fixture))) break;
    lastCompletedRound = round;
  }
  return lastCompletedRound;
}

async function goalApiRequest<T>(path: string, apiKey: string, counter: RequestCounter) {
  counter.count += 1;
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as GoalEnvelope<T>;
    if (payload.success === false || !Array.isArray(payload.data)) {
      throw new Error(payload.message || 'oväntat svarsformat');
    }
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'okänt fel';
    throw new GoalApiError(`GOAL API: ${message}.`, counter.count);
  }
}

async function fetchAllFixtures(apiKey: string, leagueId: string, season: number, counter: RequestCounter) {
  const fixtures: GoalFixture[] = [];
  let offset = 0;

  for (let page = 0; page < 50; page += 1) {
    const query = new URLSearchParams({
      leagueId,
      from: `${season}-01-01`,
      to: `${season}-12-31`,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    const payload = await goalApiRequest<GoalFixture>(`/fixtures?${query}`, apiKey, counter);
    const pageFixtures = payload.data ?? [];
    fixtures.push(...pageFixtures);
    const pagination = payload.pagination;
    const limit = numberValue(pagination?.limit ?? PAGE_SIZE, 'pagination limit');
    const responseOffset = numberValue(pagination?.offset ?? offset, 'pagination offset');
    const total = numberValue(pagination?.total ?? fixtures.length, 'pagination total');
    const hasMore = pagination?.hasMore ?? responseOffset + pageFixtures.length < total;
    if (!hasMore) return fixtures;
    if (!pageFixtures.length || limit <= 0) throw new GoalApiError('GOAL API:s pagination fastnade.', counter.count);
    offset = responseOffset + limit;
  }

  throw new GoalApiError('GOAL API returnerade fler matchsidor än säkerhetsgränsen tillåter.', counter.count);
}

function compareWithGoalStandings(teams: TeamStanding[], standings: GoalStanding[] | null) {
  if (!standings || standings.length !== teams.length) return null;
  const rows = new Map(standings.map((row) => [canonicalTeamName(row.teamName), row]));
  return teams.filter((team) => {
    const row = rows.get(team.name);
    return !row
      || Number(row.overallLeaguePlayed) !== team.played
      || Number(row.overallLeagueW) !== team.won
      || Number(row.overallLeagueD) !== team.drawn
      || Number(row.overallLeagueL) !== team.lost
      || Number(row.overallLeagueGF) !== team.goalsFor
      || Number(row.overallLeagueGA) !== team.goalsAgainst
      || Number(row.overallLeaguePTS) !== team.points;
  }).map((team) => team.name);
}

export async function fetchGoalCompetitionData(baseData: CompetitionData): Promise<{
  data: CompetitionData;
  requestCount: number;
  diagnostics: {
    finishedFixtureCount: number;
    appliedOverrideIds: string[];
    scheduleMismatchIds: string[];
    standingsMismatchTeams: string[] | null;
  };
}> {
  const apiKey = process.env.GOAL_API_KEY;
  if (!apiKey) throw new GoalApiError('GOAL_API_KEY saknas.', 0);

  const leagueId = process.env.GOAL_API_LEAGUE_ID ?? DEFAULT_LEAGUE_ID;
  const season = numberValue(process.env.GOAL_API_SEASON ?? SNAPSHOT.season, 'säsong');
  const counter = { count: 0 };

  try {
    const [standingsPayload, rawFixtures] = await Promise.all([
      goalApiRequest<GoalStanding>(`/leagues/${encodeURIComponent(leagueId)}/standings`, apiKey, counter)
        .catch(() => null),
      fetchAllFixtures(apiKey, leagueId, season, counter),
    ]);

    const leagueFixtures = rawFixtures.filter((fixture) =>
      String(fixture.leagueId ?? '') === leagueId
      && Number(fixture.leagueYear) === season,
    );
    if (!leagueFixtures.length) throw new Error('GOAL API returnerade inga Superettan-matcher för säsongen.');

    const calculated = calculateStandingsFromFixtures(season, leagueFixtures);
    const fixtures = mergeGoalFixtures(baseData.fixtures, leagueFixtures, season);
    const mismatchedScheduleIds = scheduleMismatchIds(season, leagueFixtures);
    const standingsMismatchTeams = compareWithGoalStandings(
      calculated.teams,
      standingsPayload?.data ?? null,
    );
    return {
      requestCount: counter.count,
      diagnostics: {
        finishedFixtureCount: calculated.finishedFixtureCount,
        appliedOverrideIds: calculated.appliedOverrideIds,
        scheduleMismatchIds: mismatchedScheduleIds,
        standingsMismatchTeams,
      },
      data: {
        season,
        currentRound: completedRound(fixtures),
        updatedAt: new Date().toISOString(),
        source: 'live',
        teams: calculated.teams,
        fixtures,
      },
    };
  } catch (error) {
    if (error instanceof GoalApiError) throw error;
    const message = error instanceof Error ? error.message : 'Ett okänt fel uppstod.';
    throw new GoalApiError(message, counter.count);
  }
}
