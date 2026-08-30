'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleHelp, RotateCcw, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CompetitionData, Fixture, TeamStanding } from '@/lib/superettan';

type MatchResult = { home: number; away: number };
type Results = Record<string, MatchResult>;
type SimTeam = TeamStanding & { goalDifference: number; position: number; best: number; worst: number };

const weekday = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' });

function outcome(result?: MatchResult) {
  if (!result) return null;
  return result.home > result.away ? '1' : result.home < result.away ? '2' : 'X';
}

function scoreFor(value: '1' | 'X' | '2'): MatchResult {
  return value === '1' ? { home: 1, away: 0 } : value === '2' ? { home: 0, away: 1 } : { home: 1, away: 1 };
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

function zoneBorderClass(position: number) {
  if (position <= 2) return 'border-l-4 border-l-emerald-500';
  if (position <= 4) return 'border-l-4 border-l-sky-500';
  if (position <= 12) return 'border-l-4 border-l-transparent';
  if (position <= 14) return 'border-l-4 border-l-amber-500';
  return 'border-l-4 border-l-rose-500';
}

export function Simulator({ initialData }: { initialData: CompetitionData }) {
  const [data, setData] = useState(initialData);
  const [results, setResults] = useState<Results>({});
  const [focusTeam, setFocusTeam] = useState('');
  const [flashState, setFlashState] = useState({ teams: new Set<string>(), version: 0 });
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/superettan', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<CompetitionData> : null)
      .then((nextData) => { if (active && nextData) setData(nextData); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const lastRound = Math.max(...data.fixtures.map((fixture) => fixture.round), data.currentRound);
  const horizonRound = lastRound;
  const visibleFixtures = useMemo(() => data.fixtures.filter((fixture) => fixture.round > data.currentRound), [data]);
  const baseWithSelections = useMemo(() => calculateTable(data, visibleFixtures, results), [data, visibleFixtures, results]);
  const table = useMemo(() => possiblePositions(baseWithSelections, visibleFixtures, results), [baseWithSelections, visibleFixtures, results]);
  const ranges = useMemo(() => pointRanges(baseWithSelections, visibleFixtures, results), [baseWithSelections, visibleFixtures, results]);
  const focusRange = focusTeam ? ranges.get(focusTeam) : undefined;
  const relevantTeams = useMemo(() => new Set(table.filter((team) => {
    if (!focusTeam || !focusRange) return false;
    const range = ranges.get(team.name)!;
    return team.name === focusTeam || (range.max >= focusRange.min && range.min <= focusRange.max);
  }).map((team) => team.name)), [table, ranges, focusTeam, focusRange]);
  const rounds = [...new Set(visibleFixtures.map((fixture) => fixture.round))];
  const chosenCount = visibleFixtures.filter((fixture) => results[fixture.id]).length;
  const isFinalTable = visibleFixtures.every((fixture) => Boolean(results[fixture.id]));

  const flashFixtureTeams = (fixture: Fixture) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashState((current) => ({ teams: new Set([fixture.home, fixture.away]), version: current.version + 1 }));
    flashTimer.current = setTimeout(() => {
      setFlashState((current) => ({ ...current, teams: new Set() }));
    }, 650);
  };

  const setQuickResult = (fixture: Fixture, value: '1' | 'X' | '2') => {
    setResults((current) => {
      if (outcome(current[fixture.id]) === value) {
        const next = { ...current }; delete next[fixture.id]; return next;
      }
      return { ...current, [fixture.id]: scoreFor(value) };
    });
    flashFixtureTeams(fixture);
  };

  const setExactScore = (fixture: Fixture, side: 'home' | 'away', rawValue: string) => {
    setResults((current) => {
      if (rawValue === '') { const next = { ...current }; delete next[fixture.id]; return next; }
      const score = Math.max(0, Math.min(30, Number(rawValue)));
      const existing = current[fixture.id] ?? { home: 0, away: 0 };
      return { ...current, [fixture.id]: { ...existing, [side]: Number.isFinite(score) ? score : 0 } };
    });
    flashFixtureTeams(fixture);
  };

  return (
    <main className="min-h-screen bg-background text-foreground lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
      <header className="shrink-0 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-2 px-3 py-1.5 lg:flex-nowrap lg:px-4">
          <div className="mr-2 flex shrink-0 items-center gap-2">
            <div className="grid size-7 place-items-center rounded-md bg-primary text-[10px] font-black text-primary-foreground">SE</div>
            <div className="flex items-baseline gap-2"><h1 className="text-sm font-bold tracking-tight">Slutspurten</h1><p className="hidden text-[9px] font-bold uppercase tracking-[0.16em] text-primary sm:block">Superettan {data.season}</p></div>
          </div>
          <label className="flex min-w-0 flex-1 items-center gap-2 text-[11px] font-bold text-muted-foreground lg:max-w-[310px]">
            <span className="shrink-0">Fokuslag</span>
            <select value={focusTeam} onChange={(event) => setFocusTeam(event.target.value)} className="h-8 min-w-0 flex-1 rounded-md border bg-white px-2 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring/30">
              <option value="">Inget fokuslag</option>
              {sortedTeams(data.teams).map((team) => <option key={team.id} value={team.name}>{team.name}</option>)}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={cn('hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex', data.source === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>
              <span className="mr-1.5">{data.source === 'live' ? '●' : '○'}</span>{data.source === 'live' ? 'API-data' : `Datakopia · omg ${data.currentRound}`}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-3 py-2 sm:px-4 lg:min-h-0 lg:px-4 lg:py-2">
        <div className="grid min-h-0 flex-1 items-start gap-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-stretch">
          <section className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-100 shadow-sm lg:order-2 lg:flex lg:min-h-0 lg:flex-col">
            <div className="flex items-center justify-between border-b border-slate-300 bg-slate-200/70 px-3 py-2">
              <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><Target className="size-3.5" /> Matcher · omg {data.currentRound + 1}–{horizonRound}</div><h2 className="mt-0.5 font-bold">Välj 1/X/2 eller exakt resultat</h2></div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span><strong className="text-foreground">{chosenCount}/{visibleFixtures.length}</strong> matcher valda</span><Button variant="ghost" size="sm" onClick={() => setResults({})} disabled={!Object.keys(results).length}><RotateCcw /> Återställ</Button></div>
            </div>
            <div className="max-h-[72vh] overflow-y-auto overscroll-contain lg:min-h-0 lg:flex-1 lg:max-h-none">
              {rounds.map((round) => {
                const roundFixtures = visibleFixtures.filter((fixture) => fixture.round === round);
                const selected = roundFixtures.filter((fixture) => results[fixture.id]).length;
                return <section key={round}>
                  <div className="sticky top-0 z-10 flex items-center justify-between border-y border-slate-300 bg-slate-300/90 px-3 py-1 text-[10px] font-bold backdrop-blur first:border-t-0"><span>OMGÅNG {round}</span><span className="font-medium text-muted-foreground">{selected} av {roundFixtures.length} valda</span></div>
                  <div className="divide-y divide-slate-300">
                    {roundFixtures.map((fixture) => {
                      const result = results[fixture.id];
                      const relevant = Boolean(focusTeam) && (relevantTeams.has(fixture.home) || relevantTeams.has(fixture.away));
                      const focusMatch = Boolean(focusTeam) && (fixture.home === focusTeam || fixture.away === focusTeam);
                      return <article key={fixture.id} className={cn('relative px-2.5 py-1.5', focusMatch && 'bg-primary/[0.09]')}>
                        {focusMatch && <span className="absolute inset-y-0 left-0 w-1 bg-primary" />}
                        <div className="lg:grid lg:grid-cols-[100px_minmax(0,1fr)_auto_88px] lg:items-center lg:gap-1.5">
                          <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground lg:mb-0"><span className="capitalize">{weekday.format(new Date(`${fixture.date}T12:00:00`))} · <span className="font-medium">{fixture.time}</span></span>{focusTeam && <span className="lg:hidden">{focusMatch ? 'Fokusmatch' : relevant ? 'Kan påverka fokuslaget' : 'Saknar betydelse i spannet'}</span>}</div>
                          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
                            <span className={cn('truncate text-right text-xs font-semibold xl:text-[13px]', fixture.home === focusTeam && 'text-primary')}>{fixture.home}</span>
                            <span className="text-[10px] text-muted-foreground">–</span>
                            <span className={cn('truncate text-xs font-semibold xl:text-[13px]', fixture.away === focusTeam && 'text-primary')}>{fixture.away}</span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-center gap-1 lg:mt-0">
                            {(['1','X','2'] as const).map((value) => <Button key={value} size="sm" className="h-7 min-w-7 px-2" variant={outcome(result) === value ? 'default' : 'outline'} onClick={() => setQuickResult(fixture, value)} aria-label={`${fixture.home} mot ${fixture.away}: ${value}`}>{value}</Button>)}
                          </div>
                          <div className="mt-1.5 flex items-center justify-center gap-1.5 lg:mt-0">
                          <span className="text-[10px] font-medium text-muted-foreground lg:hidden">Exakt</span>
                          <input aria-label={`${fixture.home} mål`} type="number" min="0" max="30" inputMode="numeric" value={result?.home ?? ''} onChange={(event) => setExactScore(fixture, 'home', event.target.value)} className="h-6 w-9 rounded-md border bg-white text-center text-xs font-bold outline-none focus:ring-2 focus:ring-ring/30" />
                          <span className="text-muted-foreground">–</span>
                          <input aria-label={`${fixture.away} mål`} type="number" min="0" max="30" inputMode="numeric" value={result?.away ?? ''} onChange={(event) => setExactScore(fixture, 'away', event.target.value)} className="h-6 w-9 rounded-md border bg-white text-center text-xs font-bold outline-none focus:ring-2 focus:ring-ring/30" />
                          </div>
                        </div>
                      </article>;
                    })}
                  </div>
                </section>;
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm lg:order-1 lg:flex lg:min-h-0 lg:flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
              <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Simulerad tabell</p><h2 className="font-bold">Läget efter dina val</h2></div>
              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[10px] text-muted-foreground"><span><i className="mr-1 inline-block h-0.5 w-3 bg-emerald-500 align-middle" />Direktuppflyttning</span><span><i className="mr-1 inline-block h-0.5 w-3 bg-sky-500 align-middle" />Kval till Allsvenskan</span><span><i className="mr-1 inline-block h-0.5 w-3 bg-amber-500 align-middle" />Kval till Superettan</span><span><i className="mr-1 inline-block h-0.5 w-3 bg-rose-500 align-middle" />Nedflyttning</span></div>
            </div>
            <div className="overflow-x-auto lg:flex-1">
              <table className="w-full min-w-[610px] text-[12px] 2xl:text-[13px]">
                <thead className="border-b bg-muted/70 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><tr><th className="w-8 px-2 py-2 text-center">#</th><th className="px-2 py-2 text-left">Lag</th><th className="px-2 py-2 text-center">M</th><th className="px-2 py-2 text-center">V</th><th className="px-2 py-2 text-center">O</th><th className="px-2 py-2 text-center">F</th><th className="px-2 py-2 text-center">Mål</th><th className="px-2 py-2 text-center">MS</th><th className="px-2 py-2 text-center">P</th><th className="bg-primary/[0.04] px-2 py-2 text-center">Möjlig placering</th></tr></thead>
                <tbody className="divide-y">
                  {table.map((team) => {
                    const focused = Boolean(focusTeam) && team.name === focusTeam;
                    const flashing = flashState.teams.has(team.name);
                    return <tr key={team.id} className={cn('transition-colors hover:bg-muted/35', focused && 'bg-primary/[0.08] font-semibold', flashing && (flashState.version % 2 === 0 ? 'table-row-flash-a' : 'table-row-flash-b'), team.position === 3 && 'border-t-2 border-t-emerald-500/70', team.position === 5 && 'border-t-2 border-t-sky-500/70', team.position === 13 && 'border-t-2 border-t-amber-500/70', team.position === 15 && 'border-t-2 border-t-rose-500/70')}>
                      <td className={cn('px-2 py-1.5 text-center font-bold', zoneBorderClass(team.position))}>{team.position}</td><td className="max-w-44 px-2 py-1.5"><span className={cn('flex min-w-0 items-center gap-1.5 font-semibold', focused && 'text-primary')}><span className="truncate">{team.name}</span>{team.worst <= 2 && <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-label="Topp 2 säkrat" />}</span></td><td className="px-2 py-1.5 text-center text-muted-foreground">{team.played}</td><td className="px-2 py-1.5 text-center text-muted-foreground">{team.won}</td><td className="px-2 py-1.5 text-center text-muted-foreground">{team.drawn}</td><td className="px-2 py-1.5 text-center text-muted-foreground">{team.lost}</td><td className="px-2 py-1.5 text-center text-muted-foreground">{team.goalsFor}–{team.goalsAgainst}</td><td className="px-2 py-1.5 text-center">{team.goalDifference > 0 ? '+' : ''}{team.goalDifference}</td><td className="px-2 py-1.5 text-center text-sm font-black">{team.points}</td><td className="bg-primary/[0.025] px-2 py-1.5 text-center font-bold tabular-nums">{isFinalTable ? team.position : `${team.best}–${team.worst}`}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-start gap-2 border-t bg-muted/35 px-3 py-2 text-[10px] leading-snug text-muted-foreground"><CircleHelp className="mt-0.5 size-3 shrink-0" /><p><strong className="text-foreground">Möjlig placering</strong> visar lagets placeringsspann över alla återstående matcher. <CheckCircle2 className="mx-0.5 inline size-3 text-emerald-600" /> betyder att topp 2 är säkrat.</p></div>
          </section>
        </div>
      </div>
    </main>
  );
}
