import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

register('./typescript-alias-loader.mjs', import.meta.url);

const { calculateStandingsFromFixtures } = await import('../lib/goal-api.ts');

const FILLER_TEAMS = [
  'IFK Norrköping',
  'Falkenbergs FF',
  'Varbergs BoIS FC',
  'Östersund',
  'Nordic United FC',
  'Östers IF',
  'Landskrona BoIS',
  'Helsingborgs IF',
  'Norrby IF',
  'Örebro SK',
  'IFK Värnamo',
  'GIF Sundsvall',
];

const roundWithoutMissingFixture = [
  1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26,
];

function brageScore(index) {
  if (index < 6) return [2, 0];
  if (index < 14) return [1, 1];
  if (index < 21) return [2, 3];
  if (index < 24) return [1, 4];
  return [1, 3];
}

function oddevoldScore(index) {
  if (index < 9) return [2, 0];
  if (index < 18) return [1, 1];
  if (index < 23) return [1, 3];
  if (index === 23) return [2, 3];
  return [2, 4];
}

function goalFixtures({ includeBrageOddevold }) {
  const fixtures = [];
  const fixtureKeys = new Set();
  const addFixture = (fixture) => {
    const key = `${fixture.matchRound}|${fixture.homeTeamName}|${fixture.awayTeamName}`;
    assert.equal(fixtureKeys.has(key), false);
    fixtureKeys.add(key);
    fixtures.push(fixture);
  };

  for (const [index, round] of roundWithoutMissingFixture.entries()) {
    const [brageHomeScore, brageAwayScore] = brageScore(index);
    addFixture({
      matchRound: round,
      homeTeamName: 'IK Brage',
      awayTeamName: 'IFK Norrköping',
      homeTeamScore: brageHomeScore,
      awayTeamScore: brageAwayScore,
      matchStatus: 'FINISHED',
    });

    const [oddevoldHomeScore, oddevoldAwayScore] = oddevoldScore(index);
    addFixture({
      matchRound: round,
      homeTeamName: 'IK Oddevold',
      awayTeamName: 'Falkenbergs FF',
      homeTeamScore: oddevoldHomeScore,
      awayTeamScore: oddevoldAwayScore,
      matchStatus: 'FINISHED',
    });
  }

  addFixture({
    matchRound: 16,
    homeTeamName: 'Ljungskile SK',
    awayTeamName: 'Sandvikens IF',
    homeTeamScore: 2,
    awayTeamScore: 1,
    matchStatus: 'FINISHED',
  });

  if (includeBrageOddevold) {
    addFixture({
      matchRound: 2,
      homeTeamName: 'IK Brage',
      awayTeamName: 'IK Oddevold',
      homeTeamScore: 3,
      awayTeamScore: 4,
      matchStatus: 'FINISHED',
    });
  }

  const expectedApiFixtureCount = includeBrageOddevold ? 240 : 239;
  const expectedApiFinishedCount = includeBrageOddevold ? 208 : 207;
  for (let round = 1; round <= 30; round += 1) {
    for (const homeTeamName of FILLER_TEAMS) {
      for (const awayTeamName of FILLER_TEAMS) {
        if (
          homeTeamName === awayTeamName ||
          fixtures.length >= expectedApiFinishedCount
        ) {
          continue;
        }
        addFixture({
          matchRound: round,
          homeTeamName,
          awayTeamName,
          homeTeamScore: 0,
          awayTeamScore: 0,
          matchStatus: 'FINISHED',
        });
      }
    }
  }

  for (let round = 1; round <= 30; round += 1) {
    for (const homeTeamName of FILLER_TEAMS) {
      for (const awayTeamName of FILLER_TEAMS) {
        if (
          homeTeamName === awayTeamName ||
          fixtures.length >= expectedApiFixtureCount
        ) {
          continue;
        }
        const key = `${round}|${homeTeamName}|${awayTeamName}`;
        if (fixtureKeys.has(key)) continue;
        addFixture({
          matchRound: round,
          homeTeamName,
          awayTeamName,
          matchStatus: 'SCHEDULED',
        });
      }
    }
  }
  return fixtures;
}

function team(result, name) {
  return result.teams.find((row) => row.name === name);
}

test('uses Brage–Oddevold 3–4 as a fallback when GOAL returns 239 fixtures', () => {
  const fixtures = goalFixtures({ includeBrageOddevold: false });
  assert.equal(fixtures.length, 239);

  const result = calculateStandingsFromFixtures(2026, fixtures);

  assert.deepEqual(team(result, 'IK Brage'), {
    id: 'ik-brage',
    name: 'IK Brage',
    shortName: 'Brage',
    played: 26,
    won: 6,
    drawn: 8,
    lost: 12,
    goalsFor: 41,
    goalsAgainst: 48,
    points: 26,
  });
  assert.deepEqual(team(result, 'IK Oddevold'), {
    id: 'ik-oddevold',
    name: 'IK Oddevold',
    shortName: 'Oddevold',
    played: 26,
    won: 10,
    drawn: 9,
    lost: 7,
    goalsFor: 40,
    goalsAgainst: 34,
    points: 39,
  });
  assert.equal(result.finishedFixtureCount, 208);

  assert.deepEqual(team(result, 'Ljungskile SK'), {
    id: 'ljungskile-sk',
    name: 'Ljungskile SK',
    shortName: 'Ljungskile',
    played: 1,
    won: 0,
    drawn: 0,
    lost: 1,
    goalsFor: 0,
    goalsAgainst: 3,
    points: 0,
  });
  assert.deepEqual(team(result, 'Sandvikens IF'), {
    id: 'sandvikens-if',
    name: 'Sandvikens IF',
    shortName: 'Sandviken',
    played: 1,
    won: 1,
    drawn: 0,
    lost: 0,
    goalsFor: 3,
    goalsAgainst: 0,
    points: 3,
  });
  assert.deepEqual(result.appliedOverrideIds, [
    'superettan-2026-r16-ljungskile-sandviken',
  ]);
});

test('does not duplicate Brage–Oddevold when GOAL returns the fixture', () => {
  const fixtures = goalFixtures({ includeBrageOddevold: true });
  assert.equal(fixtures.length, 240);

  const result = calculateStandingsFromFixtures(2026, fixtures);

  assert.equal(team(result, 'IK Brage').played, 26);
  assert.equal(team(result, 'IK Oddevold').played, 26);
  assert.equal(result.finishedFixtureCount, 208);
});
