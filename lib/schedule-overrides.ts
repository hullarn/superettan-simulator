import { canonicalTeamName, type Fixture } from '@/lib/superettan';

export type ScheduleOverride = {
  id: string;
  season: number;
  round: number;
  date: string;
  time: string;
  home: string;
  away: string;
};

/**
 * Manuellt publicerade avsparkstider för Superettan 2026, omgång 27–30.
 *
 * Datum och tid här är auktoritativa. GOAL API får fortfarande uppdatera
 * matchstatus, slutresultat och API-id för matcherna.
 */
export const SCHEDULE_OVERRIDES: ScheduleOverride[] = [
  { id: '2026-r27-ljungskile-brage', season: 2026, round: 27, date: '2026-10-17', time: '13:00', home: 'Ljungskile SK', away: 'IK Brage' },
  { id: '2026-r27-sandviken-ostersund', season: 2026, round: 27, date: '2026-10-17', time: '15:00', home: 'Sandvikens IF', away: 'Östersund' },
  { id: '2026-r27-falkenberg-landskrona', season: 2026, round: 27, date: '2026-10-17', time: '15:00', home: 'Falkenbergs FF', away: 'Landskrona BoIS' },
  { id: '2026-r27-oster-oddevold', season: 2026, round: 27, date: '2026-10-17', time: '17:00', home: 'Östers IF', away: 'IK Oddevold' },
  { id: '2026-r27-nordic-united-norrby', season: 2026, round: 27, date: '2026-10-18', time: '13:00', home: 'Nordic United FC', away: 'Norrby IF' },
  { id: '2026-r27-sundsvall-varnamo', season: 2026, round: 27, date: '2026-10-18', time: '15:00', home: 'GIF Sundsvall', away: 'IFK Värnamo' },
  { id: '2026-r27-varberg-helsingborg', season: 2026, round: 27, date: '2026-10-19', time: '19:05', home: 'Varbergs BoIS FC', away: 'Helsingborgs IF' },
  { id: '2026-r27-norrkoping-orebro', season: 2026, round: 27, date: '2026-10-20', time: '19:00', home: 'IFK Norrköping', away: 'Örebro SK' },
  { id: '2026-r28-oddevold-sundsvall', season: 2026, round: 28, date: '2026-10-23', time: '19:00', home: 'IK Oddevold', away: 'GIF Sundsvall' },
  { id: '2026-r28-varnamo-sandviken', season: 2026, round: 28, date: '2026-10-24', time: '13:00', home: 'IFK Värnamo', away: 'Sandvikens IF' },
  { id: '2026-r28-ostersund-nordic-united', season: 2026, round: 28, date: '2026-10-24', time: '13:00', home: 'Östersund', away: 'Nordic United FC' },
  { id: '2026-r28-brage-oster', season: 2026, round: 28, date: '2026-10-24', time: '17:00', home: 'IK Brage', away: 'Östers IF' },
  { id: '2026-r28-norrby-norrkoping', season: 2026, round: 28, date: '2026-10-25', time: '13:00', home: 'Norrby IF', away: 'IFK Norrköping' },
  { id: '2026-r28-helsingborg-ljungskile', season: 2026, round: 28, date: '2026-10-25', time: '15:00', home: 'Helsingborgs IF', away: 'Ljungskile SK' },
  { id: '2026-r28-orebro-falkenberg', season: 2026, round: 28, date: '2026-10-26', time: '19:05', home: 'Örebro SK', away: 'Falkenbergs FF' },
  { id: '2026-r28-landskrona-varberg', season: 2026, round: 28, date: '2026-10-27', time: '19:00', home: 'Landskrona BoIS', away: 'Varbergs BoIS FC' },
  { id: '2026-r29-oddevold-brage', season: 2026, round: 29, date: '2026-10-30', time: '19:00', home: 'IK Oddevold', away: 'IK Brage' },
  { id: '2026-r29-norrkoping-ostersund', season: 2026, round: 29, date: '2026-10-31', time: '13:00', home: 'IFK Norrköping', away: 'Östersund' },
  { id: '2026-r29-norrby-varnamo', season: 2026, round: 29, date: '2026-10-31', time: '15:00', home: 'Norrby IF', away: 'IFK Värnamo' },
  { id: '2026-r29-nordic-united-sundsvall', season: 2026, round: 29, date: '2026-10-31', time: '15:00', home: 'Nordic United FC', away: 'GIF Sundsvall' },
  { id: '2026-r29-falkenberg-sandviken', season: 2026, round: 29, date: '2026-10-31', time: '17:00', home: 'Falkenbergs FF', away: 'Sandvikens IF' },
  { id: '2026-r29-varberg-ljungskile', season: 2026, round: 29, date: '2026-11-01', time: '13:00', home: 'Varbergs BoIS FC', away: 'Ljungskile SK' },
  { id: '2026-r29-oster-helsingborg', season: 2026, round: 29, date: '2026-11-02', time: '19:00', home: 'Östers IF', away: 'Helsingborgs IF' },
  { id: '2026-r29-landskrona-orebro', season: 2026, round: 29, date: '2026-11-02', time: '19:00', home: 'Landskrona BoIS', away: 'Örebro SK' },
  { id: '2026-r30-helsingborg-falkenberg', season: 2026, round: 30, date: '2026-11-07', time: '15:00', home: 'Helsingborgs IF', away: 'Falkenbergs FF' },
  { id: '2026-r30-varnamo-norrkoping', season: 2026, round: 30, date: '2026-11-07', time: '15:00', home: 'IFK Värnamo', away: 'IFK Norrköping' },
  { id: '2026-r30-orebro-oster', season: 2026, round: 30, date: '2026-11-07', time: '15:00', home: 'Örebro SK', away: 'Östers IF' },
  { id: '2026-r30-ljungskile-landskrona', season: 2026, round: 30, date: '2026-11-07', time: '15:00', home: 'Ljungskile SK', away: 'Landskrona BoIS' },
  { id: '2026-r30-ostersund-oddevold', season: 2026, round: 30, date: '2026-11-07', time: '15:00', home: 'Östersund', away: 'IK Oddevold' },
  { id: '2026-r30-sundsvall-varberg', season: 2026, round: 30, date: '2026-11-07', time: '15:00', home: 'GIF Sundsvall', away: 'Varbergs BoIS FC' },
  { id: '2026-r30-sandviken-nordic-united', season: 2026, round: 30, date: '2026-11-07', time: '15:00', home: 'Sandvikens IF', away: 'Nordic United FC' },
  { id: '2026-r30-brage-norrby', season: 2026, round: 30, date: '2026-11-07', time: '15:00', home: 'IK Brage', away: 'Norrby IF' },
];

export function findScheduleOverride(season: number, round: number, home: string, away: string) {
  const canonicalHome = canonicalTeamName(home);
  const canonicalAway = canonicalTeamName(away);
  return SCHEDULE_OVERRIDES.find((override) =>
    override.season === season
    && override.round === round
    && canonicalTeamName(override.home) === canonicalHome
    && canonicalTeamName(override.away) === canonicalAway,
  );
}

export function applyScheduleOverrides(fixtures: Fixture[], season: number) {
  return fixtures.map((fixture) => {
    const override = findScheduleOverride(season, fixture.round, fixture.home, fixture.away);
    if (!override) return fixture;
    const { kickoffAt: _kickoffAt, ...fixtureWithoutApiKickoff } = fixture;
    return { ...fixtureWithoutApiKickoff, date: override.date, time: override.time };
  }).sort((a, b) =>
    a.round - b.round
    || `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
    || a.id.localeCompare(b.id),
  );
}
