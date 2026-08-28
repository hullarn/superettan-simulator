export type TeamStanding = {
  id: string;
  name: string;
  shortName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

export type Fixture = {
  id: string;
  round: number;
  date: string;
  time: string;
  home: string;
  away: string;
};

export type CompetitionData = {
  season: number;
  currentRound: number;
  updatedAt: string;
  source: 'live' | 'snapshot';
  teams: TeamStanding[];
  fixtures: Fixture[];
};

const id = (name: string) => name.toLocaleLowerCase('sv-SE').replace(/[^a-zåäöé]+/g, '-').replace(/(^-|-$)/g, '');

const team = (
  name: string,
  shortName: string,
  played: number,
  won: number,
  drawn: number,
  lost: number,
  goalsFor: number,
  goalsAgainst: number,
  points: number,
): TeamStanding => ({ id: id(name), name, shortName, played, won, drawn, lost, goalsFor, goalsAgainst, points });

export const SNAPSHOT: CompetitionData = {
  season: 2026,
  currentRound: 20,
  updatedAt: '2026-08-26T02:01:00+02:00',
  source: 'snapshot',
  teams: [
    team('IFK Norrköping', 'Norrköping', 20, 14, 2, 4, 38, 12, 44),
    team('Falkenbergs FF', 'Falkenberg', 20, 10, 5, 5, 37, 29, 35),
    team('Varbergs BoIS FC', 'Varberg', 20, 10, 4, 6, 35, 26, 34),
    team('Östersund', 'Östersund', 20, 9, 7, 4, 29, 22, 34),
    team('Nordic United FC', 'Nordic United', 20, 8, 8, 4, 31, 27, 32),
    team('Östers IF', 'Öster', 20, 10, 2, 8, 31, 29, 32),
    team('Landskrona BoIS', 'Landskrona', 20, 8, 6, 6, 26, 21, 30),
    team('Sandvikens IF', 'Sandviken', 20, 8, 5, 7, 35, 28, 29),
    team('IK Oddevold', 'Oddevold', 20, 7, 8, 5, 33, 28, 29),
    team('Helsingborgs IF', 'Helsingborg', 20, 7, 4, 9, 33, 40, 25),
    team('Norrby IF', 'Norrby', 20, 4, 11, 5, 25, 27, 23),
    team('IK Brage', 'Brage', 20, 5, 6, 9, 34, 38, 21),
    team('Ljungskile SK', 'Ljungskile', 20, 5, 6, 9, 25, 29, 21),
    team('Örebro SK', 'Örebro', 20, 4, 7, 9, 20, 32, 19),
    team('IFK Värnamo', 'Värnamo', 20, 5, 4, 11, 24, 38, 19),
    team('GIF Sundsvall', 'Sundsvall', 20, 3, 1, 16, 14, 44, 10),
  ],
  fixtures: [
    ['21-1',21,'2026-08-29','13:00','Ljungskile SK','IFK Värnamo'],['21-2',21,'2026-08-29','13:00','Landskrona BoIS','Östersund'],['21-3',21,'2026-08-29','15:00','Falkenbergs FF','IK Brage'],['21-4',21,'2026-08-29','17:00','Nordic United FC','IFK Norrköping'],['21-5',21,'2026-08-30','15:00','Varbergs BoIS FC','IK Oddevold'],['21-6',21,'2026-08-30','17:00','Sandvikens IF','Östers IF'],['21-7',21,'2026-08-31','19:00','GIF Sundsvall','Norrby IF'],['21-8',21,'2026-09-01','19:00','Helsingborgs IF','Örebro SK'],
    ['22-1',22,'2026-09-04','19:00','IFK Norrköping','Ljungskile SK'],['22-2',22,'2026-09-04','19:00','Östers IF','Nordic United FC'],['22-3',22,'2026-09-05','13:00','IFK Värnamo','Varbergs BoIS FC'],['22-4',22,'2026-09-05','15:00','IK Oddevold','Falkenbergs FF'],['22-5',22,'2026-09-05','15:00','Norrby IF','Landskrona BoIS'],['22-6',22,'2026-09-05','17:00','Helsingborgs IF','Sandvikens IF'],['22-7',22,'2026-09-05','17:00','IK Brage','GIF Sundsvall'],['22-8',22,'2026-09-07','19:05','Örebro SK','Östersund'],
    ['23-1',23,'2026-09-09','19:00','Nordic United FC','IFK Värnamo'],['23-2',23,'2026-09-09','19:00','Landskrona BoIS','Helsingborgs IF'],['23-3',23,'2026-09-09','19:00','Ljungskile SK','Norrby IF'],['23-4',23,'2026-09-09','19:00','Sandvikens IF','IK Oddevold'],['23-5',23,'2026-09-10','19:00','Falkenbergs FF','Östers IF'],['23-6',23,'2026-09-10','19:00','Varbergs BoIS FC','IFK Norrköping'],['23-7',23,'2026-09-10','19:00','Östersund','IK Brage'],['23-8',23,'2026-09-10','19:00','GIF Sundsvall','Örebro SK'],
    ['24-1',24,'2026-09-13','15:00','IFK Norrköping','IK Oddevold'],['24-2',24,'2026-09-13','17:00','Ljungskile SK','Falkenbergs FF'],['24-3',24,'2026-09-14','19:00','Örebro SK','Nordic United FC'],['24-4',24,'2026-09-14','19:00','Norrby IF','Varbergs BoIS FC'],['24-5',24,'2026-09-14','19:05','Östersund','Helsingborgs IF'],['24-6',24,'2026-09-15','19:00','Landskrona BoIS','GIF Sundsvall'],['24-7',24,'2026-09-15','19:00','IFK Värnamo','Östers IF'],['24-8',24,'2026-09-15','19:00','IK Brage','Sandvikens IF'],
    ['25-1',25,'2026-09-18','19:00','Falkenbergs FF','Östersund'],['25-2',25,'2026-09-19','13:00','Östers IF','IFK Norrköping'],['25-3',25,'2026-09-19','13:00','Nordic United FC','Landskrona BoIS'],['25-4',25,'2026-09-19','15:00','Varbergs BoIS FC','IK Brage'],['25-5',25,'2026-09-19','15:00','IK Oddevold','IFK Värnamo'],['25-6',25,'2026-09-19','17:00','Sandvikens IF','Örebro SK'],['25-7',25,'2026-09-20','13:00','GIF Sundsvall','Ljungskile SK'],['25-8',25,'2026-09-20','15:00','Helsingborgs IF','Norrby IF'],
    ['26-1',26,'2026-10-10','13:00','Landskrona BoIS','Sandvikens IF'],['26-2',26,'2026-10-10','15:00','Östersund','Varbergs BoIS FC'],['26-3',26,'2026-10-10','17:00','Norrby IF','Östers IF'],['26-4',26,'2026-10-10','17:00','IK Oddevold','Nordic United FC'],['26-5',26,'2026-10-11','13:00','Örebro SK','Ljungskile SK'],['26-6',26,'2026-10-11','15:00','IFK Värnamo','Falkenbergs FF'],['26-7',26,'2026-10-11','17:00','IK Brage','Helsingborgs IF'],['26-8',26,'2026-10-13','19:00','IFK Norrköping','GIF Sundsvall'],
    ['27-1',27,'2026-10-18','15:00','Nordic United FC','Norrby IF'],['27-2',27,'2026-10-18','15:00','IFK Norrköping','Örebro SK'],['27-3',27,'2026-10-18','15:00','GIF Sundsvall','IFK Värnamo'],['27-4',27,'2026-10-18','15:00','Varbergs BoIS FC','Helsingborgs IF'],['27-5',27,'2026-10-18','15:00','Ljungskile SK','IK Brage'],['27-6',27,'2026-10-18','15:00','Falkenbergs FF','Landskrona BoIS'],['27-7',27,'2026-10-18','15:00','Östers IF','IK Oddevold'],['27-8',27,'2026-10-18','15:00','Sandvikens IF','Östersund'],
    ['28-1',28,'2026-10-25','15:00','Örebro SK','Falkenbergs FF'],['28-2',28,'2026-10-25','15:00','IK Brage','Östers IF'],['28-3',28,'2026-10-25','15:00','Norrby IF','IFK Norrköping'],['28-4',28,'2026-10-25','15:00','IFK Värnamo','Sandvikens IF'],['28-5',28,'2026-10-25','15:00','Helsingborgs IF','Ljungskile SK'],['28-6',28,'2026-10-25','15:00','IK Oddevold','GIF Sundsvall'],['28-7',28,'2026-10-25','15:00','Östersund','Nordic United FC'],['28-8',28,'2026-10-25','15:00','Landskrona BoIS','Varbergs BoIS FC'],
    ['29-1',29,'2026-11-01','15:00','Norrby IF','IFK Värnamo'],['29-2',29,'2026-11-01','15:00','Nordic United FC','GIF Sundsvall'],['29-3',29,'2026-11-01','15:00','Falkenbergs FF','Sandvikens IF'],['29-4',29,'2026-11-01','15:00','Varbergs BoIS FC','Ljungskile SK'],['29-5',29,'2026-11-01','15:00','Östers IF','Helsingborgs IF'],['29-6',29,'2026-11-01','15:00','Landskrona BoIS','Örebro SK'],['29-7',29,'2026-11-01','15:00','IFK Norrköping','Östersund'],['29-8',29,'2026-11-01','15:00','IK Oddevold','IK Brage'],
    ['30-1',30,'2026-11-07','15:00','Sandvikens IF','Nordic United FC'],['30-2',30,'2026-11-07','15:00','Ljungskile SK','Landskrona BoIS'],['30-3',30,'2026-11-07','15:00','Örebro SK','Östers IF'],['30-4',30,'2026-11-07','15:00','Östersund','IK Oddevold'],['30-5',30,'2026-11-07','15:00','IK Brage','Norrby IF'],['30-6',30,'2026-11-07','15:00','IFK Värnamo','IFK Norrköping'],['30-7',30,'2026-11-07','15:00','GIF Sundsvall','Varbergs BoIS FC'],['30-8',30,'2026-11-07','15:00','Helsingborgs IF','Falkenbergs FF'],
  ].map(([fixtureId, round, date, time, home, away]) => ({ id: fixtureId as string, round: round as number, date: date as string, time: time as string, home: home as string, away: away as string })),
};

const NAME_ALIASES: Record<string, string> = {
  'ifk norrkoping': 'IFK Norrköping', 'ifk norrköping fk': 'IFK Norrköping', 'ifk norrkoping fk': 'IFK Norrköping',
  'falkenbergs ff': 'Falkenbergs FF', 'varbergs bois fc': 'Varbergs BoIS FC', 'ostersunds fk': 'Östersund', 'östersunds fk': 'Östersund',
  'united nordic': 'Nordic United FC', 'nordic united fc': 'Nordic United FC', 'osters if': 'Östers IF', 'östers if': 'Östers IF',
  'landskrona bois': 'Landskrona BoIS', 'sandviken': 'Sandvikens IF', 'sandvikens if': 'Sandvikens IF', 'oddevold': 'IK Oddevold', 'ik oddevold': 'IK Oddevold',
  'helsingborg': 'Helsingborgs IF', 'helsingborgs if': 'Helsingborgs IF', 'norrby if': 'Norrby IF', 'ik brage': 'IK Brage', 'ljungskile sk': 'Ljungskile SK',
  'orebro sk': 'Örebro SK', 'örebro sk': 'Örebro SK', 'ifk varnamo': 'IFK Värnamo', 'ifk värnamo': 'IFK Värnamo', 'gif sundsvall': 'GIF Sundsvall',
};

const canonicalName = (value: string) => NAME_ALIASES[value.trim().toLocaleLowerCase('sv-SE')] ?? value.trim();

export async function fetchCompetitionData(): Promise<CompetitionData> {
  const apiKey = process.env.APIFOOTBALL_API_KEY;
  if (!apiKey) return SNAPSHOT;

  const base = 'https://apiv3.apifootball.com/';
  const standingsUrl = `${base}?action=get_standings&league_id=305&APIkey=${encodeURIComponent(apiKey)}`;
  const fixturesUrl = `${base}?action=get_events&from=2026-01-01&to=2026-12-31&league_id=305&APIkey=${encodeURIComponent(apiKey)}`;
  const [standingsResponse, fixturesResponse] = await Promise.all([
    fetch(standingsUrl, { next: { revalidate: 900 } }),
    fetch(fixturesUrl, { next: { revalidate: 900 } }),
  ]);
  if (!standingsResponse.ok || !fixturesResponse.ok) return SNAPSHOT;

  const standings = await standingsResponse.json() as Record<string, string>[];
  const events = await fixturesResponse.json() as Record<string, string>[];
  if (!Array.isArray(standings) || !Array.isArray(events) || standings.length < 16) return SNAPSHOT;

  const teams = standings.map((row) => {
    const name = canonicalName(row.team_name);
    return team(name, SNAPSHOT.teams.find((entry) => entry.name === name)?.shortName ?? name, Number(row.overall_league_payed), Number(row.overall_league_W), Number(row.overall_league_D), Number(row.overall_league_L), Number(row.overall_league_GF), Number(row.overall_league_GA), Number(row.overall_league_PTS));
  });
  const played = Math.min(...teams.map((entry) => entry.played));
  const fixtures = events.filter((event) => !event.match_hometeam_score && event.match_status !== 'Finished').map((event, index) => ({
    id: event.match_id || `api-${index}`,
    round: Number((event.match_round || '').match(/\d+/)?.[0]) || Math.min(30, played + 1 + Math.floor(index / 8)),
    date: event.match_date,
    time: event.match_time?.slice(0, 5) || '',
    home: canonicalName(event.match_hometeam_name),
    away: canonicalName(event.match_awayteam_name),
  })).filter((fixture) => teams.some((entry) => entry.name === fixture.home) && teams.some((entry) => entry.name === fixture.away));

  return { season: 2026, currentRound: played, updatedAt: new Date().toISOString(), source: 'live', teams, fixtures: fixtures.length ? fixtures : SNAPSHOT.fixtures.filter((fixture) => fixture.round > played) };
}
