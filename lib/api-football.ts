import { SNAPSHOT, canonicalTeamName, createTeamStanding, type CompetitionData, type Fixture } from '@/lib/superettan';

const API_BASE_URL = 'https://v3.football.api-sports.io';
const COMPLETE_FIXTURE_STATUSES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD']);

type ApiEnvelope<T> = {
  errors?: Record<string, string> | string[];
  response?: T[];
};

type ApiStanding = {
  rank: number;
  team: { id: number; name: string };
  points: number;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
};

type ApiStandingsResponse = {
  league: {
    id: number;
    name: string;
    season: number;
    standings: ApiStanding[][];
  };
};

type ApiFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: { id: number; season: number; round: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
};

function numberValue(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`API-Football saknar ett giltigt värde för ${label}.`);
  return parsed;
}

function envelopeError<T>(payload: ApiEnvelope<T>) {
  if (Array.isArray(payload.errors) && payload.errors.length) return payload.errors.join(', ');
  if (payload.errors && !Array.isArray(payload.errors) && Object.keys(payload.errors).length) {
    return Object.values(payload.errors).join(', ');
  }
  return null;
}

async function apiFootballRequest<T>(path: string, apiKey: string): Promise<T[]> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-store',
    headers: { 'x-apisports-key': apiKey },
  });
  if (!response.ok) throw new Error(`API-Football svarade med HTTP ${response.status}.`);
  const payload = await response.json() as ApiEnvelope<T>;
  const apiError = envelopeError(payload);
  if (apiError) throw new Error(`API-Football: ${apiError}`);
  if (!Array.isArray(payload.response)) throw new Error('API-Football returnerade ett oväntat svar.');
  return payload.response;
}

function extractRound(label: string, fallback: number) {
  const match = label.match(/(\d+)(?!.*\d)/);
  return match ? Number(match[1]) : fallback;
}

function fixtureDateParts(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoDate)) {
    throw new Error('API-Football returnerade ett ogiltigt matchdatum.');
  }
  return { date: isoDate.slice(0, 10), time: isoDate.slice(11, 16) };
}

export async function fetchApiFootballCompetitionData(): Promise<{ data: CompetitionData; requestCount: number }> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) throw new Error('API_FOOTBALL_KEY saknas.');

  const leagueId = numberValue(process.env.API_FOOTBALL_LEAGUE_ID ?? '114', 'league-id');
  const season = numberValue(process.env.API_FOOTBALL_SEASON ?? SNAPSHOT.season, 'säsong');
  const query = `league=${leagueId}&season=${season}`;
  const [standingsResponses, fixtureResponses] = await Promise.all([
    apiFootballRequest<ApiStandingsResponse>(`/standings?${query}`, apiKey),
    apiFootballRequest<ApiFixture>(`/fixtures?${query}&timezone=Europe%2FStockholm`, apiKey),
  ]);

  const league = standingsResponses[0]?.league;
  const standings = league?.standings?.flat() ?? [];
  if (!league || league.id !== leagueId || league.season !== season || standings.length < 16) {
    throw new Error('API-Football returnerade ingen komplett Superettan-tabell.');
  }

  const teams = standings
    .sort((a, b) => a.rank - b.rank)
    .map((row) => {
      const name = canonicalTeamName(row.team.name);
      const shortName = SNAPSHOT.teams.find((entry) => entry.name === name)?.shortName ?? name;
      return createTeamStanding(
        name,
        shortName,
        numberValue(row.all.played, `${name} spelade matcher`),
        numberValue(row.all.win, `${name} vinster`),
        numberValue(row.all.draw, `${name} oavgjorda`),
        numberValue(row.all.lose, `${name} förluster`),
        numberValue(row.all.goals.for, `${name} gjorda mål`),
        numberValue(row.all.goals.against, `${name} insläppta mål`),
        numberValue(row.points, `${name} poäng`),
      );
    });

  const currentRound = Math.min(...teams.map((team) => team.played));
  const knownTeams = new Set(teams.map((team) => team.name));
  const fixtures: Fixture[] = fixtureResponses
    .filter((entry) => !COMPLETE_FIXTURE_STATUSES.has(entry.fixture.status.short))
    .map((entry, index) => {
      const home = canonicalTeamName(entry.teams.home.name);
      const away = canonicalTeamName(entry.teams.away.name);
      const { date, time } = fixtureDateParts(entry.fixture.date);
      return {
        id: String(entry.fixture.id || `api-${index}`),
        round: extractRound(entry.league.round, Math.min(30, currentRound + 1 + Math.floor(index / 8))),
        date,
        time,
        kickoffAt: entry.fixture.date,
        home,
        away,
      };
    })
    .filter((fixture) => knownTeams.has(fixture.home) && knownTeams.has(fixture.away))
    .sort((a, b) => (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? ''));

  return {
    requestCount: 2,
    data: {
      season,
      currentRound,
      updatedAt: new Date().toISOString(),
      source: 'live',
      teams,
      fixtures,
    },
  };
}
