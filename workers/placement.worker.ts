/// <reference lib="webworker" />

import loadHighs from 'highs';
import highsWasmUrl from 'highs/runtime';
import { calculateExactPlacementRanges } from '../lib/exact-placement';
import type { Fixture, TeamStanding } from '../lib/superettan';

type PlacementRequest = {
  teams: TeamStanding[];
  fixtures: Fixture[];
};

const highsPromise = loadHighs({
  locateFile: () => highsWasmUrl,
});

self.onmessage = async (event: MessageEvent<PlacementRequest>) => {
  const startedAt = performance.now();
  try {
    const highs = await highsPromise;
    const ranges = calculateExactPlacementRanges(highs, event.data.teams, event.data.fixtures);
    self.postMessage({ ranges, durationMs: Math.round(performance.now() - startedAt) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Okänt beräkningsfel' });
  }
};

