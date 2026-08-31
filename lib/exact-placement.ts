import type { Fixture, TeamStanding } from '@/lib/superettan';

export type PlacementRange = { best: number; worst: number };
export type PlacementRanges = Record<string, PlacementRange>;

export type PlacementSolver = {
  solve: (problem: string, options?: { output_flag?: boolean; presolve?: 'off' | 'choose' | 'on' }) => {
    Status: string;
    ObjectiveValue: number;
  };
};

type ScoreWeights = {
  goalDifference: number;
  goalsFor: number;
  points: number;
  namePreference: Map<string, number>;
};

type MatchVariables = {
  homeWin: string;
  awayWin: string;
  fixture: Fixture;
};

type TheoreticalMatchVariables = MatchVariables & {
  homeMargin: string;
  awayMargin: string;
};

type LinearTerm = { coefficient: number; variable: string };

function buildWeights(teams: TeamStanding[], fixtures: Fixture[]): ScoreWeights {
  const remainingByTeam = new Map<string, number>();
  fixtures.forEach((fixture) => {
    remainingByTeam.set(fixture.home, (remainingByTeam.get(fixture.home) ?? 0) + 1);
    remainingByTeam.set(fixture.away, (remainingByTeam.get(fixture.away) ?? 0) + 1);
  });

  const maxGoalsFor = Math.max(...teams.map((team) => team.goalsFor + (remainingByTeam.get(team.name) ?? 0)), 1);
  const maxAbsoluteGoalDifference = Math.max(...teams.map((team) => Math.abs(team.goalsFor - team.goalsAgainst) + (remainingByTeam.get(team.name) ?? 0)), 1);
  const nameBase = teams.length + 1;
  const goalsForBase = maxGoalsFor + 1;
  const goalDifferenceBase = maxAbsoluteGoalDifference * 2 + 1;
  const sortedNames = teams.map((team) => team.name).sort((a, b) => a.localeCompare(b, 'sv-SE'));

  return {
    goalsFor: nameBase,
    goalDifference: goalsForBase * nameBase,
    points: goalDifferenceBase * goalsForBase * nameBase,
    namePreference: new Map(sortedNames.map((name, index) => [name, teams.length - index])),
  };
}

function baseScore(team: TeamStanding, weights: ScoreWeights) {
  return team.points * weights.points
    + (team.goalsFor - team.goalsAgainst) * weights.goalDifference
    + team.goalsFor * weights.goalsFor
    + (weights.namePreference.get(team.name) ?? 0);
}

function outcomeDelta(teamName: string, match: MatchVariables, outcome: 'homeWin' | 'awayWin', weights: ScoreWeights) {
  const isHome = match.fixture.home === teamName;
  const isAway = match.fixture.away === teamName;
  if (!isHome && !isAway) return 0;

  const winDelta = 2 * weights.points + weights.goalDifference + weights.goalsFor;
  const lossDelta = -weights.points - weights.goalDifference;
  if (outcome === 'homeWin') return isHome ? winDelta : lossDelta;
  return isAway ? winDelta : lossDelta;
}

function formatExpression(terms: LinearTerm[]) {
  const nonZeroTerms = terms.filter((term) => term.coefficient !== 0);
  if (!nonZeroTerms.length) return '0';
  return nonZeroTerms.map((term, index) => {
    const sign = term.coefficient < 0 ? '-' : '+';
    const prefix = index === 0 && sign === '+' ? '' : `${sign} `;
    return `${prefix}${Math.abs(term.coefficient)} ${term.variable}`;
  }).join(' ');
}

function buildProblem(teams: TeamStanding[], fixtures: Fixture[], targetName: string, direction: 'min' | 'max') {
  const weights = buildWeights(teams, fixtures);
  const matchVariables: MatchVariables[] = fixtures.map((fixture, index) => ({
    fixture,
    homeWin: `m${index}h`,
    awayWin: `m${index}a`,
  }));
  const binaryVariables = matchVariables.flatMap((match) => [match.homeWin, match.awayWin]);

  const drawBase = weights.points;
  const teamScores = new Map(teams.map((team) => {
    const remaining = fixtures.filter((fixture) => fixture.home === team.name || fixture.away === team.name).length;
    return [team.name, baseScore(team, weights) + remaining * drawBase];
  }));

  const minScores = teams.map((team) => {
    const variableDelta = matchVariables.reduce((sum, match) => {
      return sum + Math.min(0, outcomeDelta(team.name, match, 'homeWin', weights), outcomeDelta(team.name, match, 'awayWin', weights));
    }, 0);
    return (teamScores.get(team.name) ?? 0) + variableDelta;
  });
  const maxScores = teams.map((team) => {
    const variableDelta = matchVariables.reduce((sum, match) => {
      return sum + Math.max(0, outcomeDelta(team.name, match, 'homeWin', weights), outcomeDelta(team.name, match, 'awayWin', weights));
    }, 0);
    return (teamScores.get(team.name) ?? 0) + variableDelta;
  });
  const bigM = Math.max(...maxScores) - Math.min(...minScores) + 1;

  const constraints = matchVariables.map((match, index) => {
    return ` match${index}: ${match.homeWin} + ${match.awayWin} <= 1`;
  });
  const aboveVariables: string[] = [];

  teams.filter((team) => team.name !== targetName).forEach((rival, rivalIndex) => {
    const aboveName = `above${rivalIndex}`;
    aboveVariables.push(aboveName);
    binaryVariables.push(aboveName);
    const baseDifference = (teamScores.get(rival.name) ?? 0) - (teamScores.get(targetName) ?? 0);
    const terms: LinearTerm[] = [{ coefficient: -bigM, variable: aboveName }];

    matchVariables.forEach((match) => {
      const homeDifference = outcomeDelta(rival.name, match, 'homeWin', weights) - outcomeDelta(targetName, match, 'homeWin', weights);
      const awayDifference = outcomeDelta(rival.name, match, 'awayWin', weights) - outcomeDelta(targetName, match, 'awayWin', weights);
      if (homeDifference) terms.push({ coefficient: homeDifference, variable: match.homeWin });
      if (awayDifference) terms.push({ coefficient: awayDifference, variable: match.awayWin });
    });

    const expression = formatExpression(terms);
    constraints.push(` cmp${rivalIndex}lo: ${expression} >= ${1 - bigM - baseDifference}`);
    constraints.push(` cmp${rivalIndex}hi: ${expression} <= ${-baseDifference}`);
  });

  return `${direction === 'min' ? 'Minimize' : 'Maximize'}
 rank: ${aboveVariables.join(' + ')}
Subject To
${constraints.join('\n')}
Binaries
 ${binaryVariables.join(' ')}
End`;
}

function theoreticalPointDelta(
  teamName: string,
  match: MatchVariables,
  outcome: 'homeWin' | 'awayWin',
  pointsWeight: number,
) {
  const isHome = match.fixture.home === teamName;
  const isAway = match.fixture.away === teamName;
  if (!isHome && !isAway) return 0;

  if (outcome === 'homeWin') return isHome ? 2 * pointsWeight : -pointsWeight;
  return isAway ? 2 * pointsWeight : -pointsWeight;
}

function theoreticalMarginDelta(
  teamName: string,
  match: TheoreticalMatchVariables,
  outcome: 'homeWin' | 'awayWin',
  goalDifferenceWeight: number,
) {
  const isHome = match.fixture.home === teamName;
  const isAway = match.fixture.away === teamName;
  if (!isHome && !isAway) return 0;

  if (outcome === 'homeWin') return isHome ? goalDifferenceWeight : -goalDifferenceWeight;
  return isAway ? goalDifferenceWeight : -goalDifferenceWeight;
}

function currentTieBreakOrder(a: TeamStanding, b: TeamStanding) {
  return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
    || b.goalsFor - a.goalsFor
    || a.name.localeCompare(b.name, 'sv-SE');
}

function buildTheoreticalProblem(teams: TeamStanding[], fixtures: Fixture[], targetName: string, direction: 'min' | 'max') {
  const remainingByTeam = new Map<string, number>();
  fixtures.forEach((fixture) => {
    remainingByTeam.set(fixture.home, (remainingByTeam.get(fixture.home) ?? 0) + 1);
    remainingByTeam.set(fixture.away, (remainingByTeam.get(fixture.away) ?? 0) + 1);
  });

  const currentGoalDifferences = teams.map((team) => team.goalsFor - team.goalsAgainst);
  const widestCurrentGap = Math.max(...currentGoalDifferences) - Math.min(...currentGoalDifferences);
  const marginCap = Math.max(1, widestCurrentGap + fixtures.length + 1);
  const maxAbsoluteFinalGoalDifference = Math.max(...teams.map((team) => (
    Math.abs(team.goalsFor - team.goalsAgainst) + (remainingByTeam.get(team.name) ?? 0) * marginCap
  )), 1);
  const goalDifferenceWeight = 3;
  const pointsWeight = maxAbsoluteFinalGoalDifference * 2 * goalDifferenceWeight + 3;
  const target = teams.find((team) => team.name === targetName);
  if (!target) throw new Error(`Saknar tabellrad för ${targetName}`);

  const matchVariables: TheoreticalMatchVariables[] = fixtures.map((fixture, index) => ({
    fixture,
    homeWin: `tm${index}h`,
    awayWin: `tm${index}a`,
    homeMargin: `tm${index}hg`,
    awayMargin: `tm${index}ag`,
  }));
  const binaryVariables = matchVariables.flatMap((match) => [match.homeWin, match.awayWin]);
  const generalVariables = matchVariables.flatMap((match) => [match.homeMargin, match.awayMargin]);

  const tieOffset = (team: TeamStanding) => {
    if (team.name === targetName) return 1;
    const canStillChangeTieBreak = Boolean((remainingByTeam.get(team.name) ?? 0) || (remainingByTeam.get(targetName) ?? 0));
    if (canStillChangeTieBreak) return direction === 'min' ? 0 : 2;
    return currentTieBreakOrder(team, target) < 0 ? 2 : 0;
  };
  const teamScores = new Map(teams.map((team) => [
    team.name,
    team.points * pointsWeight
      + (team.goalsFor - team.goalsAgainst) * goalDifferenceWeight
      + tieOffset(team)
      + (remainingByTeam.get(team.name) ?? 0) * pointsWeight,
  ]));

  const scoreBound = Math.max(...teams.map((team) => Math.abs(teamScores.get(team.name) ?? 0)))
    + fixtures.length * (2 * pointsWeight + marginCap * goalDifferenceWeight);
  const bigM = 2 * scoreBound + 1;
  const constraints = matchVariables.flatMap((match, index) => [
    ` tmatch${index}: ${match.homeWin} + ${match.awayWin} <= 1`,
    ` tmatch${index}hlo: ${match.homeMargin} - ${match.homeWin} >= 0`,
    ` tmatch${index}hhi: ${match.homeMargin} - ${marginCap} ${match.homeWin} <= 0`,
    ` tmatch${index}alo: ${match.awayMargin} - ${match.awayWin} >= 0`,
    ` tmatch${index}ahi: ${match.awayMargin} - ${marginCap} ${match.awayWin} <= 0`,
  ]);
  const aboveVariables: string[] = [];

  teams.filter((team) => team.name !== targetName).forEach((rival, rivalIndex) => {
    const aboveName = `tabove${rivalIndex}`;
    aboveVariables.push(aboveName);
    binaryVariables.push(aboveName);
    const baseDifference = (teamScores.get(rival.name) ?? 0) - (teamScores.get(targetName) ?? 0);
    const terms: LinearTerm[] = [{ coefficient: -bigM, variable: aboveName }];

    matchVariables.forEach((match) => {
      const homePointDifference = theoreticalPointDelta(rival.name, match, 'homeWin', pointsWeight)
        - theoreticalPointDelta(targetName, match, 'homeWin', pointsWeight);
      const awayPointDifference = theoreticalPointDelta(rival.name, match, 'awayWin', pointsWeight)
        - theoreticalPointDelta(targetName, match, 'awayWin', pointsWeight);
      const homeMarginDifference = theoreticalMarginDelta(rival.name, match, 'homeWin', goalDifferenceWeight)
        - theoreticalMarginDelta(targetName, match, 'homeWin', goalDifferenceWeight);
      const awayMarginDifference = theoreticalMarginDelta(rival.name, match, 'awayWin', goalDifferenceWeight)
        - theoreticalMarginDelta(targetName, match, 'awayWin', goalDifferenceWeight);
      if (homePointDifference) terms.push({ coefficient: homePointDifference, variable: match.homeWin });
      if (awayPointDifference) terms.push({ coefficient: awayPointDifference, variable: match.awayWin });
      if (homeMarginDifference) terms.push({ coefficient: homeMarginDifference, variable: match.homeMargin });
      if (awayMarginDifference) terms.push({ coefficient: awayMarginDifference, variable: match.awayMargin });
    });

    const expression = formatExpression(terms);
    constraints.push(` tcmp${rivalIndex}lo: ${expression} >= ${1 - bigM - baseDifference}`);
    constraints.push(` tcmp${rivalIndex}hi: ${expression} <= ${-baseDifference}`);
  });

  return `${direction === 'min' ? 'Minimize' : 'Maximize'}
 rank: ${aboveVariables.join(' + ')}
Subject To
${constraints.join('\n')}
Binaries
 ${binaryVariables.join(' ')}
Generals
 ${generalVariables.join(' ')}
End`;
}

function solveRank(
  highs: PlacementSolver,
  teams: TeamStanding[],
  fixtures: Fixture[],
  targetName: string,
  direction: 'min' | 'max',
  problemBuilder = buildProblem,
) {
  const solution = highs.solve(problemBuilder(teams, fixtures, targetName, direction), { output_flag: false, presolve: 'on' });
  if (solution.Status !== 'Optimal' || !Number.isFinite(solution.ObjectiveValue)) throw new Error(`Kunde inte lösa placeringsspannet för ${targetName}`);
  return Math.max(1, Math.min(teams.length, Math.round(solution.ObjectiveValue) + 1));
}

export function calculateExactPlacementRanges(highs: PlacementSolver, teams: TeamStanding[], fixtures: Fixture[]): PlacementRanges {
  if (!fixtures.length) {
    return Object.fromEntries(teams.map((team, index) => [team.name, { best: index + 1, worst: index + 1 }]));
  }

  return Object.fromEntries(teams.map((team) => {
    const fixedBest = solveRank(highs, teams, fixtures, team.name, 'min');
    const fixedWorst = solveRank(highs, teams, fixtures, team.name, 'max');
    const theoreticalBest = solveRank(highs, teams, fixtures, team.name, 'min', buildTheoreticalProblem);
    const theoreticalWorst = solveRank(highs, teams, fixtures, team.name, 'max', buildTheoreticalProblem);

    return [team.name, {
      best: Math.min(fixedBest, theoreticalBest),
      worst: Math.max(fixedWorst, theoreticalWorst),
    }];
  }));
}
