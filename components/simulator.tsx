'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleHelp, RefreshCw, RotateCcw, Target, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { CompetitionData, Fixture, TeamStanding } from '@/lib/superettan';

type MatchResult = { home: number; away: number };
type Results = Record<string, MatchResult>;
type SimTeam = TeamStanding & { goalDifference: number; position: number; best: number; worst: number };

const weekday = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' });
const updated = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });

function outcome(result?: MatchResult) {
  if (!result) return null;
  return result.home > result.away ? '1' : result.home < result.away ? '2' : 'X';
}

function scoreFor(value: '1' | 'X' | '2'): MatchResult {
  return value === '1' ? { home: 1, away: 0 } : value === '2' ? { home: 0, away: 1 } : { home: 0, away: 0 };
}

function cloneTeam(team: TeamStanding): TeamStanding {
  return { ...team };
}

function applyResult(table: Map<string, TeamStanding>, fixture: Fixture, result: MatchResult) {
  const home = table.get(fixture.home);
  const away = table.get(fixture.away);
  if (!home || !away) return;
  home.played += 1;
  away.played += 1;
  home.goalsFor += result.home;
  home.goalsAgainst += result.away;
  away.goalsFor += result.away;
  away.goalsAgainst += result.home;
  if (result.home > result.away) {
    home.won += 1; away.lost += 1; home.points += 3;
  } else if (result.home < result.away) {
    away.won += 1; home.lost += 1; away.points += 3;
  } else {
    home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1;
  }
}

function sortedTeams(teams: TeamStanding[]) {
  return [...teams].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name, 'sv-SE'));
}

function calculateTable(data: CompetitionData, fixtures: Fixture[], results: Results): TeamStanding[] {
  const table = new Map(data.teams.map((team) => [team.name, cloneTeam(team)]));
  fixtures.forEach((fixture) => {
    const result = results[fixture.id];
    if (result) applyResult(table, fixture, result);
  });
  return sortedTeams([...table.values()]);
}

function pointRanges(table: TeamStanding[], fixtures: Fixture[], results: Results) {
  return new Map(table.map((team) => {
    const remaining = fixtures.filter((fixture) => !results[fixture.id] && (fixture.home === team.name || fixture.away === team.name)).length;
    return [team.name, { min: team.points, max: team.points + remaining * 3, remaining }];
  }));
}

function possiblePositions(table: TeamStanding[], fixtures: Fixture[], results: Results): SimTeam[] {
  const ranges = pointRanges(table, fixtures, results);
  return table.map((team, index) => {
    const own = ranges.get(team.name)!;
    const best = 1 + table.filter((other) => other.name !== team.name && ranges.get(other.name)!.min > own.max).length;
    const worst = 1 + table.filter((other) => {
      if (other.name === team.name) return false;
      const otherMax = ranges.get(other.name)!.max;
      return otherMax > own.min || (otherMax === own.min && (other.goalsFor - other.goalsAgainst) >= (team.goalsFor - team.goalsAgainst));
    }).length;
    return { ...team, goalDifference: team.goalsFor - team.goalsAgainst, position: index + 1, best, worst: Math.min(table.length, worst) };
  });
}

function securedLabel(teamName: string, topN: 2 | 4, data: CompetitionData, horizonRound: number, results: Results) {
  let hasRelevantGap = false;
  for (let round = data.currentRound + 1; round <= horizonRound; round += 1) {
    const throughRound = data.fixtures.filter((fixture) => fixture.round <= round);
    const knownTable = calculateTable(data, throughRound, results);
    const target = knownTable.find((team) => team.name === teamName)!;
    const missingThroughRound = throughRound.filter((fixture) => !results[fixture.id]);
    const future = data.fixtures.filter((fixture) => fixture.round > round);
    const futureCount = new Map<string, number>();
    [...missingThroughRound, ...future].forEach((fixture) => {
      futureCount.set(fixture.home, (futureCount.get(fixture.home) ?? 0) + 1);
      futureCount.set(fixture.away, (futureCount.get(fixture.away) ?? 0) + 1);
    });
    const targetFloor = target.points;
    const possibleRivals = knownTable.filter((rival) => rival.name !== teamName && rival.points + (futureCount.get(rival.name) ?? 0) * 3 >= targetFloor);
    const relevantMissing = missingThroughRound.filter((fixture) => fixture.home === teamName || fixture.away === teamName || possibleRivals.some((rival) => rival.name === fixture.home || rival.name === fixture.away));
    if (relevantMissing.length) hasRelevantGap = true;

    const guaranteedRivals = knownTable.filter((rival) => rival.name !== teamName && rival.points + (futureCount.get(rival.name) ?? 0) * 3 >= targetFloor).length;
    if (guaranteedRivals < topN) return `omg ${round}`;

    if (!relevantMissing.length) {
      const afterRoundFuture = data.fixtures.filter((fixture) => fixture.round > round);
      const afterCounts = new Map<string, number>();
      afterRoundFuture.forEach((fixture) => {
        afterCounts.set(fixture.home, (afterCounts.get(fixture.home) ?? 0) + 1);
        afterCounts.set(fixture.away, (afterCounts.get(fixture.away) ?? 0) + 1);
      });
      const challengers = knownTable.filter((rival) => rival.name !== teamName && rival.points + (afterCounts.get(rival.name) ?? 0) * 3 >= target.points).length;
      if (challengers < topN) return `omg ${round}`;
    }
  }
  return hasRelevantGap ? '?' : '–';
}

function zoneClass(position: number) {
  if (position <= 2) return 'before:bg-emerald-500';
  if (position <= 4) return 'before:bg-sky-500';
  if (position <= 12) return 'before:bg-transparent';
  if (position <= 14) return 'before:bg-amber-500';
  return 'before:bg-rose-500';
}

export function Simulator({ initialData }: { initialData: CompetitionData }) {
  const [data, setData] = useState(initialData);
  const [results, setResults] = useState<Results>({});
  const [focusTeam, setFocusTeam] = useState('IFK Norrköping');
  const [roundCount, setRoundCount] = useState(3);
  const [dimIrrelevant, setDimIrrelevant] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/superettan', { cache: 'no-store' });
      if (response.ok) {
        const nextData = await response.json() as CompetitionData;
        setData(nextData);
        if (!nextData.teams.some((team) => team.name === focusTeam)) setFocusTeam(nextData.teams[0]?.name ?? 'IFK Norrköping');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/superettan', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<CompetitionData> : null)
      .then((nextData) => { if (active && nextData) setData(nextData); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const lastRound = Math.max(...data.fixtures.map((fixture) => fixture.round), data.currentRound);
  const horizonRound = roundCount === 99 ? lastRound : Math.min(lastRound, data.currentRound + roundCount);
  const visibleFixtures = useMemo(() => data.fixtures.filter((fixture) => fixture.round > data.currentRound && fixture.round <= horizonRound), [data, horizonRound]);
  const baseWithSelections = useMemo(() => calculateTable(data, visibleFixtures, results), [data, visibleFixtures, results]);
  const table = useMemo(() => possiblePositions(baseWithSelections, visibleFixtures, results), [baseWithSelections, visibleFixtures, results]);
  const ranges = useMemo(() => pointRanges(baseWithSelections, visibleFixtures, results), [baseWithSelections, visibleFixtures, results]);
  const focusRange = ranges.get(focusTeam) ?? { min: 0, max: 0, remaining: 0 };
  const relevantTeams = useMemo(() => new Set(table.filter((team) => {
    const range = ranges.get(team.name)!;
    return team.name === focusTeam || (range.max >= focusRange.min && range.min <= focusRange.max);
  }).map((team) => team.name)), [table, ranges, focusTeam, focusRange.min, focusRange.max]);
  const rounds = [...new Set(visibleFixtures.map((fixture) => fixture.round))];
  const chosenCount = visibleFixtures.filter((fixture) => results[fixture.id]).length;

  const setQuickResult = (fixture: Fixture, value: '1' | 'X' | '2') => {
    setResults((current) => {
      if (outcome(current[fixture.id]) === value) {
        const next = { ...current }; delete next[fixture.id]; return next;
      }
      return { ...current, [fixture.id]: scoreFor(value) };
    });
  };

  const setExactScore = (fixture: Fixture, side: 'home' | 'away', rawValue: string) => {
    setResults((current) => {
      if (rawValue === '') { const next = { ...current }; delete next[fixture.id]; return next; }
      const score = Math.max(0, Math.min(30, Number(rawValue)));
      const existing = current[fixture.id] ?? { home: 0, away: 0 };
      return { ...current, [fixture.id]: { ...existing, [side]: Number.isFinite(score) ? score : 0 } };
    });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground">SE</div>
            <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Superettan {data.season}</p><h1 className="text-xl font-bold tracking-tight">Slutspurten</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex', data.source === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>
              <span className="mr-1.5">{data.source === 'live' ? '●' : '○'}</span>{data.source === 'live' ? 'API-data' : `Datakopia · omg ${data.currentRound}`}
            </span>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading} aria-label="Uppdatera data"><RefreshCw className={loading ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Uppdatera</span></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 lg:px-8 lg:py-5">
        <section className="mb-4 grid gap-4 rounded-2xl border bg-card p-4 shadow-sm lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="flex flex-wrap gap-3 sm:gap-5">
            <label className="grid min-w-[210px] flex-1 gap-1.5 text-xs font-bold text-muted-foreground sm:flex-none">
              Fokuslag
              <select value={focusTeam} onChange={(event) => setFocusTeam(event.target.value)} className="h-10 rounded-lg border bg-white px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring/30">
                {sortedTeams(data.teams).map((team) => <option key={team.id}>{team.name}</option>)}
              </select>
            </label>
            <label className="grid min-w-[190px] flex-1 gap-1.5 text-xs font-bold text-muted-foreground sm:flex-none">
              Simuleringshorisont
              <select value={roundCount} onChange={(event) => setRoundCount(Number(event.target.value))} className="h-10 rounded-lg border bg-white px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring/30">
                <option value={1}>Nästa omgång</option><option value={2}>Två omgångar</option><option value={3}>Tre omgångar</option><option value={99}>Alla återstående</option>
              </select>
            </label>
            <div className="flex min-w-[220px] flex-1 items-end sm:flex-none">
              <div className="flex h-10 w-full items-center justify-between gap-4 rounded-lg border bg-muted/40 px-3 text-sm font-medium"><span>Tona ned irrelevanta lag</span><Switch aria-label="Tona ned irrelevanta lag" checked={dimIrrelevant} onCheckedChange={setDimIrrelevant} /></div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 lg:justify-end">
            <div className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{chosenCount}/{visibleFixtures.length}</span> matcher valda<br /><span className="hidden sm:inline">Uppdaterad {updated.format(new Date(data.updatedAt))}</span></div>
            <Button variant="ghost" onClick={() => setResults({})} disabled={!Object.keys(results).length}><RotateCcw /> Återställ</Button>
          </div>
        </section>

        <div className="grid items-start gap-4 2xl:grid-cols-[minmax(500px,0.92fr)_minmax(780px,1.45fr)]">
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3.5 sm:px-5">
              <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><Target className="size-3.5" /> Matcher · omg {data.currentRound + 1}–{horizonRound}</div><h2 className="mt-0.5 font-bold">Välj 1/X/2 eller exakt resultat</h2></div>
              <span className="hidden text-xs text-muted-foreground sm:block">Valen räknas direkt</span>
            </div>
            <div className="max-h-[72vh] overflow-y-auto overscroll-contain">
              {rounds.map((round) => {
                const roundFixtures = visibleFixtures.filter((fixture) => fixture.round === round);
                const selected = roundFixtures.filter((fixture) => results[fixture.id]).length;
                return <section key={round}>
                  <div className="sticky top-0 z-10 flex items-center justify-between border-y bg-muted/95 px-4 py-2 text-xs font-bold backdrop-blur first:border-t-0 sm:px-5"><span>OMGÅNG {round}</span><span className="font-medium text-muted-foreground">{selected} av {roundFixtures.length} valda</span></div>
                  <div className="divide-y">
                    {roundFixtures.map((fixture) => {
                      const result = results[fixture.id];
                      const relevant = relevantTeams.has(fixture.home) || relevantTeams.has(fixture.away);
                      const focusMatch = fixture.home === focusTeam || fixture.away === focusTeam;
                      return <article key={fixture.id} className={cn('relative px-3 py-3 transition-opacity sm:px-4', focusMatch && 'bg-primary/[0.055]', dimIrrelevant && !relevant && 'opacity-35')}>
                        {focusMatch && <span className="absolute inset-y-0 left-0 w-1 bg-primary" />}
                        <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground"><span className="capitalize">{weekday.format(new Date(`${fixture.date}T12:00:00`))} · {fixture.time}</span><span>{focusMatch ? 'Fokusmatch' : relevant ? 'Kan påverka fokuslaget' : 'Saknar betydelse i spannet'}</span></div>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                          <span className={cn('truncate text-right text-sm font-semibold', fixture.home === focusTeam && 'text-primary')}>{fixture.home}</span>
                          <div className="flex items-center gap-1">
                            {(['1','X','2'] as const).map((value) => <Button key={value} size="sm" className="min-w-8" variant={outcome(result) === value ? 'default' : 'outline'} onClick={() => setQuickResult(fixture, value)} aria-label={`${fixture.home} mot ${fixture.away}: ${value}`}>{value}</Button>)}
                          </div>
                          <span className={cn('truncate text-sm font-semibold', fixture.away === focusTeam && 'text-primary')}>{fixture.away}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-center gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">Exakt</span>
                          <input aria-label={`${fixture.home} mål`} type="number" min="0" max="30" inputMode="numeric" value={result?.home ?? ''} onChange={(event) => setExactScore(fixture, 'home', event.target.value)} className="h-8 w-12 rounded-md border bg-white text-center text-sm font-bold outline-none focus:ring-2 focus:ring-ring/30" />
                          <span className="text-muted-foreground">–</span>
                          <input aria-label={`${fixture.away} mål`} type="number" min="0" max="30" inputMode="numeric" value={result?.away ?? ''} onChange={(event) => setExactScore(fixture, 'away', event.target.value)} className="h-8 w-12 rounded-md border bg-white text-center text-sm font-bold outline-none focus:ring-2 focus:ring-ring/30" />
                          {result && <Button size="icon-xs" variant="ghost" onClick={() => setResults((current) => { const next = { ...current }; delete next[fixture.id]; return next; })} aria-label="Rensa matchresultat"><X /></Button>}
                        </div>
                      </article>;
                    })}
                  </div>
                </section>;
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm 2xl:sticky 2xl:top-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
              <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Simulerad tabell</p><h2 className="font-bold">Läget efter dina val</h2></div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground"><span><i className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />Topp 2</span><span><i className="mr-1 inline-block size-2 rounded-full bg-sky-500" />Kval</span><span><i className="mr-1 inline-block size-2 rounded-full bg-rose-500" />Ned</span></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[790px] text-[13px]">
                <thead className="border-b bg-muted/70 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><tr><th className="w-9 px-2 py-3 text-center">#</th><th className="px-2 py-3 text-left">Lag</th><th className="px-2 py-3 text-center">M</th><th className="px-2 py-3 text-center">V</th><th className="px-2 py-3 text-center">O</th><th className="px-2 py-3 text-center">F</th><th className="px-2 py-3 text-center">Mål</th><th className="px-2 py-3 text-center">MS</th><th className="px-2 py-3 text-center">P</th><th className="bg-primary/[0.04] px-2 py-3 text-center">Bäst</th><th className="bg-primary/[0.04] px-2 py-3 text-center">Sämst</th><th className="px-2 py-3 text-left normal-case tracking-normal">Topp 2 / Topp 4</th></tr></thead>
                <tbody className="divide-y">
                  {table.map((team) => {
                    const relevant = relevantTeams.has(team.name);
                    const focused = team.name === focusTeam;
                    const top2 = securedLabel(team.name, 2, data, horizonRound, results);
                    const top4 = securedLabel(team.name, 4, data, horizonRound, results);
                    return <tr key={team.id} className={cn('relative transition-colors before:absolute before:inset-y-0 before:left-0 before:w-1 hover:bg-muted/35', zoneClass(team.position), focused && 'bg-primary/[0.08] font-semibold', dimIrrelevant && !relevant && 'opacity-35')}>
                      <td className="px-2 py-2.5 text-center font-bold">{team.position}</td><td className="max-w-44 px-2 py-2.5"><span className={cn('block truncate font-semibold', focused && 'text-primary')}>{team.name}</span></td><td className="px-2 py-2.5 text-center text-muted-foreground">{team.played}</td><td className="px-2 py-2.5 text-center text-muted-foreground">{team.won}</td><td className="px-2 py-2.5 text-center text-muted-foreground">{team.drawn}</td><td className="px-2 py-2.5 text-center text-muted-foreground">{team.lost}</td><td className="px-2 py-2.5 text-center text-muted-foreground">{team.goalsFor}–{team.goalsAgainst}</td><td className="px-2 py-2.5 text-center">{team.goalDifference > 0 ? '+' : ''}{team.goalDifference}</td><td className="px-2 py-2.5 text-center text-sm font-black">{team.points}</td><td className="bg-primary/[0.025] px-2 py-2.5 text-center font-bold">{team.best}</td><td className="bg-primary/[0.025] px-2 py-2.5 text-center font-bold">{team.worst}</td><td className="px-2 py-2.5 text-[11px] leading-4"><span className={top2 === '?' ? 'text-amber-700' : 'text-foreground'}>T2: {top2}</span><br /><span className={top4 === '?' ? 'text-amber-700' : 'text-muted-foreground'}>T4: {top4}</span></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-start gap-2 border-t bg-muted/35 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground"><CircleHelp className="mt-0.5 size-3.5 shrink-0" /><p><strong className="text-foreground">Bäst/sämst</strong> visar det poängmässiga placeringsspannet inom vald period. <strong className="text-foreground">?</strong> betyder att en matematiskt relevant match saknar resultat. Ett säkrat utfall visas ändå när det gäller oavsett den matchen.</p></div>
          </section>
        </div>
      </div>
    </main>
  );
}
