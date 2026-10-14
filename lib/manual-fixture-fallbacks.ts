/**
 * Färdigspelade matcher som GOAL API helt saknar.
 *
 * En reservfixture används bara när samma säsong, omgång och lagpar inte
 * finns i GOAL-svaret. Om API:t senare börjar returnera matchen används den
 * ordinarie API-posten i stället.
 */
export type ManualFixtureFallback = {
  id: string;
  season: number;
  round: number;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  note: string;
};

export const MANUAL_FIXTURE_FALLBACKS: ManualFixtureFallback[] = [
  {
    id: 'superettan-2026-r2-brage-oddevold',
    season: 2026,
    round: 2,
    home: 'IK Brage',
    away: 'IK Oddevold',
    homeScore: 3,
    awayScore: 4,
    note: 'Spelad 2026-04-12. Matchen saknas helt i GOAL API.',
  },
];
