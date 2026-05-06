import { useEffect, useMemo, useState } from "react";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import {
  loadAllDoneMatches, topBatScores, topBest, bestBowlingFigures,
  teamHighestTotals, teamLowestTotals, teamBestPowerplay, teamMostBoundaries,
  fastestMilestone, bestStrikeRateInnings, bestEconomySpell, mostDotsInnings, bestBattingAverage,
  mostBoundariesInnings, bestBowlingAverage, mostMaidens,
  biggestWinMargin, closestFinishes, highestSuccessfulChases, lowestDefendedTotals,
  milestones, type MatchRow, type IndEntry, type TeamEntry, type Milestone,
} from "@/lib/recordsAgg";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trophy, Medal, Award, Sparkles, Info } from "lucide-react";

type Scope = "all" | "season" | "match";
type SubTab = "team" | "individual" | "milestones";

export default function Records() {
  const [league, setLeague] = useState<League | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>("all");
  const [seasonNum, setSeasonNum] = useState<number | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const lg = await getOrCreateLeague();
      setLeague(lg);
      const ms = await loadAllDoneMatches(lg.id);
      setMatches(ms);
      const seasons = Array.from(new Set(ms.map(m => m.season_number ?? 0))).sort((a, b) => b - a);
      if (seasons.length) setSeasonNum(seasons[0]);
      if (ms.length) setMatchId(ms[ms.length - 1].id);
      setLoading(false);
    })();
  }, []);

  const seasons = useMemo(() => Array.from(new Set(matches.map(m => m.season_number ?? 0))).sort((a, b) => b - a), [matches]);

  const filtered = useMemo(() => {
    if (scope === "all") return matches;
    if (scope === "season" && seasonNum != null) return matches.filter(m => m.season_number === seasonNum);
    if (scope === "match" && matchId) return matches.filter(m => m.id === matchId);
    return [];
  }, [scope, matches, seasonNum, matchId]);

  if (loading || !league) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs tracking-[0.3em] text-primary/80">RECORD VAULT</div>
        <h1 className="font-display text-4xl tracking-wider">Records & Milestones</h1>
        <p className="text-sm text-muted-foreground mt-1">Slice records by All-Time, single Season, or a single Match — then drill into Team, Individual, or Milestones.</p>
      </div>

      {matches.length === 0 ? (
        <Card className="p-12 text-center gradient-card border-border/60">
          <Award className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <div className="font-display text-xl">No records yet</div>
          <p className="text-muted-foreground text-sm">Play a match to start setting records.</p>
        </Card>
      ) : (
        <>
          {/* Scope tabs */}
          <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <TabsList className="bg-secondary/40">
              <TabsTrigger value="all">All-Time</TabsTrigger>
              <TabsTrigger value="season">By Season</TabsTrigger>
              <TabsTrigger value="match">Per Match</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <ScopeNote text="Aggregates across every match ever played in this league."/>
              <SubTabs matches={filtered} league={league}/>
            </TabsContent>

            <TabsContent value="season" className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Season:</span>
                <Select value={String(seasonNum ?? "")} onValueChange={(v) => setSeasonNum(Number(v))}>
                  <SelectTrigger className="w-32"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {seasons.map(s => <SelectItem key={s} value={String(s)}>Season {s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">{filtered.length} matches</span>
              </div>
              <ScopeNote text="Records computed from matches in the selected season only."/>
              <SubTabs matches={filtered} league={league}/>
            </TabsContent>

            <TabsContent value="match" className="mt-4 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Match:</span>
                <Select value={matchId ?? ""} onValueChange={setMatchId}>
                  <SelectTrigger className="w-72"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {matches.slice().reverse().map(m => (
                      <SelectItem key={m.id} value={m.id}>S{m.season_number} · M{m.match_number}: {m.team_a} vs {m.team_b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ScopeNote text="Records and bests achieved in this single match."/>
              <SubTabs matches={filtered} league={league}/>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function ScopeNote({ text }: { text: string }) {
  return <div className="flex items-center gap-2 text-[11px] text-muted-foreground italic"><Info className="w-3 h-3"/>{text}</div>;
}

function SubTabs({ matches, league }: { matches: MatchRow[]; league: League }) {
  const [tab, setTab] = useState<SubTab>("team");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)} className="mt-3">
      <TabsList className="bg-secondary/30">
        <TabsTrigger value="team"><Trophy className="w-3 h-3 mr-1"/>Team</TabsTrigger>
        <TabsTrigger value="individual"><Medal className="w-3 h-3 mr-1"/>Individual</TabsTrigger>
        <TabsTrigger value="milestones"><Sparkles className="w-3 h-3 mr-1"/>Milestones</TabsTrigger>
      </TabsList>
      <TabsContent value="team" className="mt-4"><TeamView matches={matches} league={league}/></TabsContent>
      <TabsContent value="individual" className="mt-4"><IndividualView matches={matches} league={league}/></TabsContent>
      <TabsContent value="milestones" className="mt-4"><MilestonesView matches={matches} league={league}/></TabsContent>
    </Tabs>
  );
}

// ----------------- TEAM -----------------
function TeamView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const high = teamHighestTotals(matches, 5);
  const low = teamLowestTotals(matches, 5);
  const pp = teamBestPowerplay(matches, league.settings.powerplayOvers ?? 6, 5);
  const bdry = teamMostBoundaries(matches, 5);
  const big = biggestWinMargin(matches, 5);
  const close = closestFinishes(matches, 5);
  const chases = highestSuccessfulChases(matches, 5);
  const defends = lowestDefendedTotals(matches, 5);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RecordCard title="Highest Team Totals" desc="Largest single-innings totals." emoji="🛡️" entries={high.map(t => teamRow(t, league))}/>
      <RecordCard title="Lowest Team Totals" desc="Smallest completed innings totals." emoji="🥶" entries={low.map(t => teamRow(t, league))}/>
      <RecordCard title="Best Powerplay" desc={`Most runs in first ${league.settings.powerplayOvers ?? 6} overs.`} emoji="⚡" entries={pp.map(t => teamRow(t, league))}/>
      <RecordCard title="Most Boundaries (Innings)" desc="Most 4s + 6s combined in one innings." emoji="🎯" entries={bdry.map(t => teamRow(t, league))}/>
      <RecordCard title="Biggest Win (Runs)" desc="Largest victory by runs (batting first)." emoji="💪" entries={big.map(t => teamRow(t, league))}/>
      <RecordCard title="Closest Finishes" desc="Smallest run margins." emoji="😬" entries={close.map(t => teamRow(t, league))}/>
      <RecordCard title="Highest Successful Chase" desc="Most runs chased and won." emoji="🏃" entries={chases.map(t => teamRow(t, league))}/>
      <RecordCard title="Lowest Defended Total" desc="Smallest first-innings score that won." emoji="🛡️" entries={defends.map(t => teamRow(t, league))}/>
    </div>
  );
}
function teamRow(t: TeamEntry, league: League) {
  return {
    primary: t.team,
    primaryColor: teamColor(t.team, league.teams),
    secondary: t.vs ? `vs ${t.vs}` : "",
    detail: t.detail,
    season_number: t.season_number,
  };
}

// ----------------- INDIVIDUAL -----------------
function IndividualView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const hs = topBatScores(matches, 5);
  const runs = topBest(matches, "runs", 5);
  const wkts = topBest(matches, "wickets", 5);
  const sixes = topBest(matches, "sixes", 5);
  const fours = topBest(matches, "fours", 5);
  const fifties = topBest(matches, "fifties", 5);
  const hundreds = topBest(matches, "hundreds", 5);
  const bbi = bestBowlingFigures(matches, 5);
  const fastest50 = fastestMilestone(matches, 50, 5);
  const fastest100 = fastestMilestone(matches, 100, 5);
  const bestSR = bestStrikeRateInnings(matches, 10, 5);
  const bestEcon = bestEconomySpell(matches, 2, 5);
  const dots = mostDotsInnings(matches, 5);
  const avg = bestBattingAverage(matches, 3, 5);
  const bdInn = mostBoundariesInnings(matches, 5);
  const bowlAvg = bestBowlingAverage(matches, 4, 5);
  const maids = mostMaidens(matches, 5);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RecordCard title="Highest Individual Score" desc="Best single-innings batting performance." emoji="🏏" entries={hs.map(e => indRow(e, league))}/>
      <RecordCard title="Most Runs" desc="Aggregate runs in this scope." emoji="🔢" entries={runs.map(e => indRow(e, league))}/>
      <RecordCard title="Best Batting Average" desc="Min 3 innings." emoji="📐" entries={avg.map(e => indRow(e, league))}/>
      <RecordCard title="Best Strike Rate (Innings)" desc="Min 10 balls faced." emoji="⚡" entries={bestSR.map(e => indRow(e, league))}/>
      <RecordCard title="Fastest Fifty" desc="Quickest 50 by balls faced." emoji="🚀" entries={fastest50.map(e => indRow(e, league))}/>
      <RecordCard title="Fastest Hundred" desc="Quickest 100 by balls faced." emoji="💯" entries={fastest100.map(e => indRow(e, league))}/>
      <RecordCard title="Most Boundaries (Innings)" desc="Most 4s + 6s combined in one knock." emoji="🎆" entries={bdInn.map(e => indRow(e, league))}/>
      <RecordCard title="Most Wickets" desc="Aggregate wickets in this scope." emoji="🎯" entries={wkts.map(e => indRow(e, league))}/>
      <RecordCard title="Best Bowling Figures" desc="Best wickets/runs in a single innings." emoji="🔥" entries={bbi.map(e => indRow(e, league))}/>
      <RecordCard title="Best Bowling Average" desc="Career avg, min 4 wickets." emoji="🩺" entries={bowlAvg.map(e => indRow(e, league))}/>
      <RecordCard title="Best Economy Spell" desc="Min 2 overs in a single innings." emoji="🛡️" entries={bestEcon.map(e => indRow(e, league))}/>
      <RecordCard title="Most Maiden Overs" desc="Aggregate maidens bowled." emoji="🚫" entries={maids.map(e => indRow(e, league))}/>
      <RecordCard title="Most Dot Balls (Spell)" desc="Most dots bowled in one innings." emoji="⏸️" entries={dots.map(e => indRow(e, league))}/>
      <RecordCard title="Most 100s" desc="Centuries scored." emoji="💯" entries={hundreds.map(e => indRow(e, league))}/>
      <RecordCard title="Most 50s" desc="Fifty-plus scores (excludes hundreds)." emoji="5️⃣0️⃣" entries={fifties.map(e => indRow(e, league))}/>
      <RecordCard title="Most Sixes" desc="Aggregate 6s smashed." emoji="🚀" entries={sixes.map(e => indRow(e, league))}/>
      <RecordCard title="Most Fours" desc="Aggregate 4s." emoji="🏏" entries={fours.map(e => indRow(e, league))}/>
    </div>
  );
}
function indRow(e: IndEntry, league: League) {
  return {
    primary: e.name,
    primaryColor: undefined,
    secondary: e.team,
    secondaryColor: teamColor(e.team, league.teams),
    detail: e.detail,
    season_number: e.season_number,
  };
}

// ----------------- MILESTONES -----------------
function MilestonesView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const ms = milestones(matches);
  if (ms.length === 0) {
    return <Card className="p-8 text-center gradient-card border-border/60 text-muted-foreground">No milestones reached in this scope yet.</Card>;
  }
  return (
    <div className="space-y-2">
      {ms.map((m, i) => (
        <Card key={i} className="p-3 gradient-card border-border/60 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-primary shrink-0"/>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm">{m.label}</div>
            <div className="text-[11px] text-muted-foreground truncate">{m.detail}</div>
          </div>
          {m.team && (
            <Badge variant="outline" className="text-[10px]" style={{ color: teamColor(m.team, league.teams), borderColor: teamColor(m.team, league.teams) }}>{m.team}</Badge>
          )}
          {m.season_number != null && <span className="text-[10px] text-muted-foreground">S{m.season_number}</span>}
        </Card>
      ))}
    </div>
  );
}

// ----------------- shared row card -----------------
interface RowItem {
  primary: string;
  primaryColor?: string;
  secondary?: string;
  secondaryColor?: string;
  detail: string;
  season_number?: number;
}
function RecordCard({ title, desc, emoji, entries }: { title: string; desc: string; emoji: string; entries: RowItem[] }) {
  return (
    <Card className="p-4 gradient-card border-border/60">
      <div className="flex items-start gap-2 mb-1">
        <span className="text-2xl leading-none">{emoji}</span>
        <div className="flex-1">
          <div className="font-display text-base">{title}</div>
          <div className="text-[10px] text-muted-foreground italic">{desc}</div>
        </div>
      </div>
      <div className="space-y-1.5 mt-2">
        {entries.length === 0 && <div className="text-xs text-muted-foreground italic py-2">No entries.</div>}
        {entries.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded bg-secondary/30">
            <span className={`w-5 text-center font-bold ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium" style={r.primaryColor ? { color: r.primaryColor } : undefined}>{r.primary}</span>
                {r.secondary && (
                  <span className="text-[10px]" style={r.secondaryColor ? { color: r.secondaryColor } : undefined}>{r.secondary}</span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{r.detail}</div>
            </div>
            {r.season_number != null && <span className="text-[9px] text-muted-foreground">S{r.season_number}</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}
