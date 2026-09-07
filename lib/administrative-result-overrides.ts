import { canonicalTeamName } from '@/lib/superettan';

export type AdministrativeResultOverride = {
  id: string;
  season: number;
  round: number;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  note: string;
};

/**
 * Officiella resultatändringar som inte finns representerade i GOAL API.
 *
 * Lägg nya poster här med säsong, omgång och kanoniska lagnamn. Matchningen
 * använder samma nyckel som den ordinarie importsynken: omgång + hemma/borta.
 */
export const ADMINISTRATIVE_RESULT_OVERRIDES: AdministrativeResultOverride[] = [
  {
    id: 'superettan-2026-r16-ljungskile-sandviken',
    season: 2026,
    round: 16,
    home: 'Ljungskile SK',
    away: 'Sandvikens IF',
    homeScore: 0,
    awayScore: 3,
    note: 'Spelresultat 2–1, ändrat till 0–3 genom administrativt beslut.',
  },
];

export function findAdministrativeResultOverride(season: number, round: number, home: string, away: string) {
  const canonicalHome = canonicalTeamName(home);
  const canonicalAway = canonicalTeamName(away);
  return ADMINISTRATIVE_RESULT_OVERRIDES.find((override) =>
    override.season === season
    && override.round === round
    && canonicalTeamName(override.home) === canonicalHome
    && canonicalTeamName(override.away) === canonicalAway,
  );
}
