'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { PlacementRanges } from '@/lib/exact-placement';
import { displayTeamName, isFinishedFixture, type CompetitionData, type Fixture, type TeamStanding } from '@/lib/superettan';

type MatchResult = { home: number; away: number };
type Results = Record<string, MatchResult>;
type SimTeam = TeamStanding & { goalDifference: number; position: number; best: number; worst: number };
type MobilePanel = 'matches' | 'table';

const MOBILE_TEAM_NAMES: Record<string, string> = {
  'IFK Norrköping': 'Norrköping',
  'Falkenbergs FF': 'Falkenberg',
  'Östersund': 'Östersund',
  'Varbergs BoIS FC': 'Varberg',
  'IK Oddevold': 'Oddevold',
  'Nordic United FC': 'Nordic U',
  'Landskrona BoIS': 'Landskrona',
  'Sandvikens IF': 'Sandviken',
  'Östers IF': 'Öster',
  'Helsingborgs IF': 'Helsingborg',
  'IFK Värnamo': 'Värnamo',
  'Ljungskile SK': 'Ljungskile',
  'Norrby IF': 'Norrby',
  'Örebro SK': 'Örebro',
  'IK Brage': 'Brage',
  'GIF Sundsvall': 'Sundsvall',
};

function ResponsiveTeamName({ name }: { name: string }) {
  return <>
    <span className="desktop-team-name">{displayTeamName(name)}</span>
    <span className="mobile-team-name">{MOBILE_TEAM_NAMES[name] ?? displayTeamName(name)}</span>
  </>;
}

const weekday = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' });
const updatedDay = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', timeZone: 'Europe/Stockholm' });
function formatFixtureDate(date: string) {
  const formatted = weekday.format(new Date(`${date}T12:00:00`)).replaceAll('.', '');
  return formatted.charAt(0).toLocaleUpperCase('sv-SE') + formatted.slice(1);
}

function formatCompactFixtureDate(date: string) {
  const [, month, day] = date.split('-').map(Number);
  return `${day}/${month}`;
}

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

function placementLabel(team: SimTeam, isFinalTable: boolean) {
  if (isFinalTable || team.best === team.worst) return String(isFinalTable ? team.position : team.best);
  return `${team.best}–${team.worst}`;
}

export function Simulator({ initialData }: { initialData: CompetitionData }) {
  const data = initialData;
  const lastUpdated = updatedDay.format(new Date(data.updatedAt)).replaceAll('.', '');
  const [results, setResults] = useState<Results>({});
  const [focusTeams, setFocusTeams] = useState<Set<string>>(() => new Set());
  const [flashState, setFlashState] = useState({ teams: new Set<string>(), version: 0 });
  const [exactRanges, setExactRanges] = useState<PlacementRanges | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<'calculating' | 'ready' | 'error'>('calculating');
  const [hasMoreMatchesBelow, setHasMoreMatchesBelow] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('matches');
  const [expandedScoreFixtures, setExpandedScoreFixtures] = useState<Set<string>>(() => new Set());
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchesScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const upcomingFixtures = useMemo(
    () => data.fixtures.filter((fixture) => fixture.round > data.currentRound && !isFinishedFixture(fixture)),
    [data],
  );
  const focusTeamOptions = useMemo(() => sortedTeams(data.teams), [data.teams]);
  const visibleFixtures = useMemo(
    () => focusTeams.size === 0
      ? upcomingFixtures
      : upcomingFixtures.filter((fixture) => focusTeams.has(fixture.home) || focusTeams.has(fixture.away)),
    [focusTeams, upcomingFixtures],
  );
  const remainingFixtures = useMemo(() => upcomingFixtures.filter((fixture) => !results[fixture.id]), [upcomingFixtures, results]);
  const baseWithSelections = useMemo(() => calculateTable(data, upcomingFixtures, results), [data, upcomingFixtures, results]);
  const approximateTable = useMemo(() => possiblePositions(baseWithSelections, upcomingFixtures, results), [baseWithSelections, upcomingFixtures, results]);
  const table = useMemo(() => approximateTable.map((team) => {
    const range = exactRanges?.[team.name];
    return range ? { ...team, ...range } : team;
  }), [approximateTable, exactRanges]);
  const rounds = [...new Set(visibleFixtures.map((fixture) => fixture.round))];
  const chosenCount = upcomingFixtures.filter((fixture) => results[fixture.id]).length;
  const allVisibleScoresExpanded = visibleFixtures.length > 0 && visibleFixtures.every((fixture) => expandedScoreFixtures.has(fixture.id));
  const isFinalTable = upcomingFixtures.every((fixture) => Boolean(results[fixture.id]));
  const selectedFocusTeam = focusTeams.size === 1 ? [...focusTeams][0] : null;
  const focusLabel = focusTeams.size === 0
    ? 'Välj fokuslag'
    : selectedFocusTeam
      ? displayTeamName(selectedFocusTeam)
      : `${focusTeams.size} lag valda`;
  const mobileFocusLabel = selectedFocusTeam
    ? MOBILE_TEAM_NAMES[selectedFocusTeam] ?? displayTeamName(selectedFocusTeam)
    : focusLabel;

  useEffect(() => {
    const scrollArea = matchesScrollRef.current;
    if (!scrollArea) return;

    const updateFade = () => {
      const hasOverflowBelow = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight > 1;
      setHasMoreMatchesBelow((current) => current === hasOverflowBelow ? current : hasOverflowBelow);
    };

    updateFade();
    scrollArea.addEventListener('scroll', updateFade, { passive: true });
    const resizeObserver = new ResizeObserver(updateFade);
    resizeObserver.observe(scrollArea);
    window.addEventListener('resize', updateFade);

    return () => {
      scrollArea.removeEventListener('scroll', updateFade);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateFade);
    };
  }, [visibleFixtures]);

  useEffect(() => {
    let worker: Worker | null = null;
    const timer = window.setTimeout(() => {
      worker = new Worker(new URL('../workers/placement.worker.ts', import.meta.url));
      worker.onmessage = (event: MessageEvent<{ ranges?: PlacementRanges; durationMs?: number; error?: string }>) => {
        if (event.data.ranges) {
          setExactRanges(event.data.ranges);
          setAnalysisStatus('ready');
        } else {
          setAnalysisStatus('error');
        }
        worker?.terminate();
      };
      worker.onerror = () => setAnalysisStatus('error');
      worker.postMessage({ teams: baseWithSelections, fixtures: remainingFixtures });
    }, 80);

    return () => {
      window.clearTimeout(timer);
      worker?.terminate();
    };
  }, [baseWithSelections, remainingFixtures]);

  const markAnalysisPending = () => {
    setAnalysisStatus('calculating');
    setExactRanges(null);
  };

  const resetSimulation = () => {
    markAnalysisPending();
    setResults({});
  };

  const toggleFixtureScore = (fixtureId: string) => {
    setExpandedScoreFixtures((current) => {
      const next = new Set(current);
      if (next.has(fixtureId)) next.delete(fixtureId);
      else next.add(fixtureId);
      return next;
    });
  };

  const toggleAllVisibleScores = () => {
    setExpandedScoreFixtures((current) => {
      const next = new Set(current);
      const shouldCollapse = visibleFixtures.length > 0 && visibleFixtures.every((fixture) => current.has(fixture.id));
      visibleFixtures.forEach((fixture) => {
        if (shouldCollapse) next.delete(fixture.id);
        else next.add(fixture.id);
      });
      return next;
    });
  };

  const toggleFocusTeam = (teamName: string, checked: boolean) => {
    setFocusTeams((current) => {
      const next = new Set(current);
      if (checked) next.add(teamName);
      else next.delete(teamName);
      return next;
    });
  };

  const flashFixtureTeams = (fixture: Fixture) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashState((current) => ({ teams: new Set([fixture.home, fixture.away]), version: current.version + 1 }));
    flashTimer.current = setTimeout(() => {
      setFlashState((current) => ({ ...current, teams: new Set() }));
    }, 650);
  };

  const setQuickResult = (fixture: Fixture, value: '1' | 'X' | '2') => {
    markAnalysisPending();
    setResults((current) => {
      if (outcome(current[fixture.id]) === value) {
        const next = { ...current }; delete next[fixture.id]; return next;
      }
      return { ...current, [fixture.id]: scoreFor(value) };
    });
    flashFixtureTeams(fixture);
  };

  const setExactScore = (fixture: Fixture, side: 'home' | 'away', rawValue: string) => {
    markAnalysisPending();
    setResults((current) => {
      if (rawValue === '') { const next = { ...current }; delete next[fixture.id]; return next; }
      const score = Math.max(0, Math.min(30, Number(rawValue)));
      const existing = current[fixture.id] ?? { home: 0, away: 0 };
      return { ...current, [fixture.id]: { ...existing, [side]: Number.isFinite(score) ? score : 0 } };
    });
    flashFixtureTeams(fixture);
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <h1 className="brand-title">Slutspurten</h1>
          <span className="brand-season">Superettan {data.season}</span>
        </div>
        <div className="header-tools">
          <span className="data-source">Uppdaterad {lastUpdated} {data.source === 'live' ? '(API)' : '(datakopia)'}</span>
          <DropdownMenu>
            <DropdownMenuTrigger className="focus-select" aria-label={`Välj fokuslag. ${focusLabel}`}>
              <span className="focus-select-label">
                <span className="desktop-team-name">{focusLabel}</span>
                <span className="mobile-team-name">{mobileFocusLabel}</span>
              </span>
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="focus-select-content" align="end" sideOffset={6}>
              {focusTeamOptions.map((team, index) => (
                <DropdownMenuCheckboxItem
                  className="focus-select-item"
                  key={team.id}
                  checked={focusTeams.has(team.name)}
                  closeOnClick={false}
                  onCheckedChange={(checked) => toggleFocusTeam(team.name, checked)}
                >
                  <span className="focus-team-position">{index + 1}.</span>{' '}<ResponsiveTeamName name={team.name} />
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <nav className="mobile-panel-tabs" aria-label="Välj innehållspanel">
        <div role="tablist" aria-label="Tabell och matcher">
          <button
            type="button"
            role="tab"
            className={cn('mobile-panel-tab', mobilePanel === 'matches' && 'is-active')}
            aria-selected={mobilePanel === 'matches'}
            aria-controls="matches-panel"
            onClick={() => setMobilePanel('matches')}
          >
            Matcher
          </button>
          <button
            type="button"
            role="tab"
            className={cn('mobile-panel-tab', mobilePanel === 'table' && 'is-active')}
            aria-selected={mobilePanel === 'table'}
            aria-controls="table-panel"
            onClick={() => setMobilePanel('table')}
          >
            Tabell
          </button>
        </div>
      </nav>

      <div className="workspace">
        <section
          id="table-panel"
          className={cn('workspace-panel table-panel', mobilePanel !== 'table' && 'mobile-panel-inactive')}
          aria-labelledby="table-title"
        >
          <div className="panel-header">
            <h2 id="table-title" className="panel-title">Tabell</h2>
          </div>

          <div className="table-scroll">
            <table className="standings-table">
              <thead>
                <tr>
                  <th>#</th><th className="team-column">Lag</th><th>M</th><th>V</th><th>O</th><th>F</th><th>Mål</th><th>MS</th><th>P</th><th>Möjlig<br />placering</th>
                </tr>
              </thead>
              <tbody>
                {table.map((team) => {
                  const flashing = flashState.teams.has(team.name);
                  const zoneDivider = team.position === 3 || team.position === 5 || team.position === 13 || team.position === 15;
                  return <tr key={team.id} className={cn(zoneDivider && 'zone-divider', flashing && (flashState.version % 2 === 0 ? 'table-row-flash-a' : 'table-row-flash-b'))}>
                    <td>{team.position}</td>
                    <td className="team-cell"><span className="flex min-w-0 items-center gap-1.5"><span className="truncate"><ResponsiveTeamName name={team.name} /></span>{analysisStatus === 'ready' && team.worst <= 2 && <CheckCircle2 className="secured-icon" aria-label="Topp 2 säkrat" />}</span></td>
                    <td>{team.played}</td><td>{team.won}</td><td>{team.drawn}</td><td>{team.lost}</td><td>{team.goalsFor}–{team.goalsAgainst}</td><td>{team.goalDifference > 0 ? '+' : ''}{team.goalDifference}</td><td className="points-cell">{team.points}</td><td className={cn('placement-cell', analysisStatus === 'calculating' && 'opacity-50')}>{placementLabel(team, isFinalTable)}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          <p className="table-note">Möjlig placering analyserar de återstående matchmötena med 1–0, 0–0 och 0–1 samt kontrollerar om poäng och målskillnad teoretiskt kan hämtas in.</p>
        </section>

        <section
          id="matches-panel"
          className={cn('workspace-panel matches-panel', mobilePanel !== 'matches' && 'mobile-panel-inactive')}
          aria-labelledby="matches-title"
        >
          <div className="panel-header">
            <h2 id="matches-title" className="panel-title">Matcher</h2>
            <Button variant="ghost" size="sm" className={cn('reset-button', chosenCount > 0 && 'is-visible')} onClick={resetSimulation} disabled={!Object.keys(results).length} aria-label={`Återställ ${chosenCount} valda matcher`}>
              Återställ <RotateCcw />
            </Button>
            <Button variant="ghost" size="sm" className="score-visibility-button" onClick={toggleAllVisibleScores}>
              {allVisibleScoresExpanded ? 'Dölj mål' : 'Visa mål'}
            </Button>
          </div>

          <div ref={matchesScrollRef} className={cn('matches-scroll', hasMoreMatchesBelow && 'has-bottom-fade')}>
            {rounds.map((round) => {
              const roundFixtures = visibleFixtures.filter((fixture) => fixture.round === round);
              const selected = roundFixtures.filter((fixture) => results[fixture.id]).length;
              return <section key={round} className="round-block" aria-labelledby={`round-${round}`}>
                <div className="round-heading">
                  <span id={`round-${round}`} className="round-label">Omgång {round}</span>
                  <span className="round-count">{selected}/{roundFixtures.length} valda</span>
                </div>
                <div className="fixture-list">
                  {roundFixtures.map((fixture) => {
                    const result = results[fixture.id];
                    const scoreExpanded = expandedScoreFixtures.has(fixture.id);
                    return <article key={fixture.id} className={cn('fixture-row', scoreExpanded && 'is-score-expanded')}>
                      <button
                        type="button"
                        className="fixture-row-toggle-surface"
                        aria-expanded={scoreExpanded}
                        aria-label={`${scoreExpanded ? 'Dölj' : 'Visa'} mål för ${displayTeamName(fixture.home)} mot ${displayTeamName(fixture.away)}`}
                        onClick={() => toggleFixtureScore(fixture.id)}
                      />
                      <div className="fixture-date">
                        <span className="fixture-date-full">{formatFixtureDate(fixture.date)} · {fixture.time}</span>
                        <span className="fixture-date-compact">{formatCompactFixtureDate(fixture.date)}</span>
                      </div>
                      <div className="fixture-teams">
                        <span className="fixture-team-home"><ResponsiveTeamName name={fixture.home} /></span>
                        <span className="fixture-separator">–</span>
                        <span className="fixture-team-away"><ResponsiveTeamName name={fixture.away} /></span>
                      </div>
                      <div className="outcome-buttons">
                        {(['1', 'X', '2'] as const).map((value) => <Button key={value} size="sm" variant="outline" className={cn('outcome-button', outcome(result) === value && 'is-selected')} onClick={() => setQuickResult(fixture, value)} aria-label={`${displayTeamName(fixture.home)} mot ${displayTeamName(fixture.away)}: ${value}`}>{value}</Button>)}
                      </div>
                      <div className="score-inputs">
                        <input aria-label={`${displayTeamName(fixture.home)} mål`} type="number" min="0" max="30" inputMode="numeric" value={result?.home ?? ''} onChange={(event) => setExactScore(fixture, 'home', event.target.value)} className="score-input" />
                        <span className="score-dash">–</span>
                        <input aria-label={`${displayTeamName(fixture.away)} mål`} type="number" min="0" max="30" inputMode="numeric" value={result?.away ?? ''} onChange={(event) => setExactScore(fixture, 'away', event.target.value)} className="score-input" />
                      </div>
                      <button
                        type="button"
                        className="fixture-score-toggle"
                        aria-expanded={scoreExpanded}
                        aria-label={`${scoreExpanded ? 'Dölj' : 'Visa'} mål för ${displayTeamName(fixture.home)} mot ${displayTeamName(fixture.away)}`}
                        onClick={() => toggleFixtureScore(fixture.id)}
                      >
                        <ChevronRight aria-hidden="true" />
                      </button>
                    </article>;
                  })}
                </div>
              </section>;
            })}
          </div>
        </section>
      </div>

    </main>
  );
}
