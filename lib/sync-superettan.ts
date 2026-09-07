import { fetchGoalCompetitionData, GoalApiError } from '@/lib/goal-api';
import {
  getCompetitionStore,
  loadCompetitionState,
  type StoredCompetitionState,
  type SyncTrigger,
} from '@/lib/competition-store';
import { isFinishedFixture, type Fixture } from '@/lib/superettan';

const MATCH_FINISH_GRACE_MS = 3 * 60 * 60 * 1000;
const SYNC_LOCK_SECONDS = 120;
const SWEDISH_TIME_ZONE = 'Europe/Stockholm';

const swedishDateTimeFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: SWEDISH_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export type SyncOutcome = {
  status: 'success' | 'error' | 'skipped' | 'busy';
  message: string;
  state: StoredCompetitionState;
};

function estimatedFinishTime(fixture: Fixture) {
  if (fixture.kickoffAt) {
    const timestamp = Date.parse(fixture.kickoffAt);
    if (Number.isFinite(timestamp)) return timestamp + MATCH_FINISH_GRACE_MS;
  }

  const match = `${fixture.date}T${fixture.time || '00:00'}:00`.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) return Number.POSITIVE_INFINITY;

  const desiredLocalTime = Date.UTC(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6]),
  );
  let utcGuess = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      swedishDateTimeFormatter.formatToParts(new Date(utcGuess)).map((part) => [part.type, part.value]),
    );
    const renderedLocalTime = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    utcGuess += desiredLocalTime - renderedLocalTime;
  }
  return utcGuess + MATCH_FINISH_GRACE_MS;
}

export function hasFixtureThatShouldBeFinished(state: StoredCompetitionState, now = new Date()) {
  if (!state.sync.lastSuccessAt) return true;
  return state.data.fixtures.some((fixture) => !isFinishedFixture(fixture) && estimatedFinishTime(fixture) <= now.getTime());
}

export async function syncSuperettan(trigger: SyncTrigger, force: boolean): Promise<SyncOutcome> {
  const competitionStore = getCompetitionStore();
  let state = await loadCompetitionState();
  const now = new Date().toISOString();

  if (!competitionStore.configured) {
    return { status: 'error', message: 'Ingen beständig datalagring är konfigurerad.', state };
  }

  if (!force && !hasFixtureThatShouldBeFinished(state, new Date(now))) {
    state = {
      ...state,
      sync: { ...state.sync, lastAutomaticCheckAt: now },
    };
    await competitionStore.save(state);
    return { status: 'skipped', message: 'Ingen match borde ha hunnit bli färdig sedan senaste synkningen.', state };
  }

  const lock = await competitionStore.acquireLock(SYNC_LOCK_SECONDS);
  if (!lock) return { status: 'busy', message: 'En annan synkning pågår redan.', state };

  try {
    try {
      const result = await fetchGoalCompetitionData(state.data);
      const comparisonMessage = result.diagnostics.standingsMismatchTeams === null
        ? 'standings-jämförelse saknas'
        : `${result.diagnostics.standingsMismatchTeams.length} avvikande standings-rader`;
      state = {
        version: 1,
        data: result.data,
        sync: {
          ...state.sync,
          lastAutomaticCheckAt: trigger === 'automatic' ? now : state.sync.lastAutomaticCheckAt,
          lastAttemptAt: now,
          lastSuccessAt: now,
          lastResult: 'success',
          lastTrigger: trigger,
          message: `Uppdateringen lyckades (${result.requestCount} API-anrop, ${result.diagnostics.finishedFixtureCount} slutresultat, ${result.diagnostics.appliedOverrideIds.length} administrativ override, ${comparisonMessage}).`,
          upstreamRequests: result.requestCount,
        },
      };
      await competitionStore.save(state);
      return { status: 'success', message: state.sync.message, state };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ett okänt fel uppstod.';
      state = {
        ...state,
        sync: {
          ...state.sync,
          lastAutomaticCheckAt: trigger === 'automatic' ? now : state.sync.lastAutomaticCheckAt,
          lastAttemptAt: now,
          lastResult: 'error',
          lastTrigger: trigger,
          message,
          upstreamRequests: error instanceof GoalApiError ? error.requestCount : 0,
        },
      };
      await competitionStore.save(state);
      return { status: 'error', message, state };
    }
  } finally {
    await lock.release();
  }
}
