import { useEffect, useMemo, useState } from "react";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import {
  loadAllDoneMatches, topBatScores, topBest, bestBowlingFigures,
  teamHighestTotals, teamLowestTotals, teamBestPowerplay, teamMostBoundaries,
  fastestMilestone, bestStrikeRateInnings, bestEconomySpell, mostDotsInnings, bestBattingAverage,
  mostBoundariesInnings, bestBowlingAverage, mostMaidens,
  biggestWinMargin, closestFinishes, highestSuccessfulChases, lowestDefendedTotals,
  milestones, computeTeamOverall, computeCaptaincy, computeH2H, computeAdvanced,
  computePhaseStats, computeChaseSuccessRate, computeTossStats, computeCollapseStats,
  computePlayerDeepStats, computeSeasonBests,
  careerRunsClub, careerWicketsClub, careerSixesClub, careerFoursLeaders, mostHalfCenturies,
  computeWinStreaks, fastestToCareerRuns, mostNotOuts, mostRunsInAMatch,
  captainMostMatches, computeAwardWins,
  type MatchRow, type IndEntry, type TeamEntry, type Milestone,
  type TeamOverallRow, type CaptaincyRow, type H2HCell, type AdvancedRow,
} from "@/lib/recordsAgg";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Loader2, Trophy, Medal, Award, Sparkles, Info, Crown, Swords, BarChart3,
  TrendingUp, Users, Heart, Target, Zap, Shield, Activity, ListOrdered
} from "lucide-react";
import { teamLogo } from "@/lib/teamLogos";

type Scope = "all" | "season" | "match";
type SubTab = "mega" | "team" | "individual" | "milestones" | "overall" | "captaincy" | "h2h" | "advanced" | "phase" | "chase" | "playerdeep" | "seasonbests" | "fanvote" | "honours" | "leaderboard";

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

  if (loading || !league) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="border-b border-border/40 pb-4">
        <div className="text-[10px] tracking-[0.35em] text-primary/70 mb-0.5">RECORD VAULT</div>
        <h1 className="font-display text-4xl md:text-5xl tracking-wider text-foreground">Records & Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Slice by All-Time, Season, or Match — then explore Team, Individual, Analytics, and more.</p>
      </div>

      {matches.length === 0 ? (
        <Card className="p-14 text-center gradient-card border-border/60">
          <Award className="w-12 h-12 mx-auto text-primary/30 mb-3" />
          <div className="font-display text-2xl text-foreground/70">No records yet</div>
          <p className="text-muted-foreground text-sm mt-1">Complete a match to start building your Record Vault.</p>
        </Card>
      ) : (
        <>
          <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
            <TabsList className="bg-secondary/40">
              <TabsTrigger value="all">All-Time</TabsTrigger>
              <TabsTrigger value="season">By Season</TabsTrigger>
              <TabsTrigger value="match">Per Match</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <ScopeNote text="Aggregated across every match played in this league."/>
              <SubTabs matches={filtered} league={league} allMatches={matches}/>
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
              <ScopeNote text="Records from the selected season only."/>
              <SubTabs matches={filtered} league={league} allMatches={matches}/>
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
              <ScopeNote text="Records from this single match only."/>
              <SubTabs matches={filtered} league={league} allMatches={matches}/>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function ScopeNote({ text }: { text: string }) {
  return <div className="flex items-center gap-2 text-[11px] text-muted-foreground italic mb-3"><Info className="w-3 h-3 shrink-0"/>{text}</div>;
}

function SubTabs({ matches, league, allMatches }: { matches: MatchRow[]; league: League; allMatches: MatchRow[] }) {
  // HonoursView needs league.id — pass allMatches so it can query across all time
  const [tab, setTab] = useState<SubTab>("mega");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)} className="mt-2">
      <div className="overflow-x-auto pb-1">
        <TabsList className="bg-secondary/30 h-auto flex-nowrap min-w-max">
          <TabsTrigger value="leaderboard" className="text-xs"><ListOrdered className="w-3 h-3 mr-1"/>Leaderboard</TabsTrigger>
          <TabsTrigger value="honours" className="text-xs"><Trophy className="w-3 h-3 mr-1"/>Honours</TabsTrigger>
          <TabsTrigger value="mega" className="text-xs"><Sparkles className="w-3 h-3 mr-1"/>50+ Records</TabsTrigger>
          <TabsTrigger value="overall" className="text-xs"><Trophy className="w-3 h-3 mr-1"/>Teams Overall</TabsTrigger>
          <TabsTrigger value="team" className="text-xs"><Shield className="w-3 h-3 mr-1"/>Team Bests</TabsTrigger>
          <TabsTrigger value="individual" className="text-xs"><Medal className="w-3 h-3 mr-1"/>Individual</TabsTrigger>
          <TabsTrigger value="captaincy" className="text-xs"><Crown className="w-3 h-3 mr-1"/>Captaincy</TabsTrigger>
          <TabsTrigger value="h2h" className="text-xs"><Swords className="w-3 h-3 mr-1"/>Head-to-Head</TabsTrigger>
          <TabsTrigger value="phase" className="text-xs"><Activity className="w-3 h-3 mr-1"/>Phase Stats</TabsTrigger>
          <TabsTrigger value="chase" className="text-xs"><Target className="w-3 h-3 mr-1"/>Chase Lab</TabsTrigger>
          <TabsTrigger value="playerdeep" className="text-xs"><Zap className="w-3 h-3 mr-1"/>Player Deep</TabsTrigger>
          <TabsTrigger value="seasonbests" className="text-xs"><TrendingUp className="w-3 h-3 mr-1"/>Season Bests</TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs"><BarChart3 className="w-3 h-3 mr-1"/>Analytics</TabsTrigger>
          <TabsTrigger value="milestones" className="text-xs"><Sparkles className="w-3 h-3 mr-1"/>Milestones</TabsTrigger>
          <TabsTrigger value="fanvote" className="text-xs"><Heart className="w-3 h-3 mr-1"/>Fan Vote</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="leaderboard" className="mt-4"><LeaderboardView matches={matches} league={league}/></TabsContent>
      <TabsContent value="honours" className="mt-4"><HonoursView matches={matches} allMatches={allMatches} league={league}/></TabsContent>
      <TabsContent value="mega" className="mt-4"><MegaRecordsView matches={matches} league={league}/></TabsContent>
      <TabsContent value="overall" className="mt-4"><OverallTeamsView matches={matches} league={league}/></TabsContent>
      <TabsContent value="team" className="mt-4"><TeamView matches={matches} league={league}/></TabsContent>
      <TabsContent value="individual" className="mt-4"><IndividualView matches={matches} league={league}/></TabsContent>
      <TabsContent value="captaincy" className="mt-4"><CaptaincyView matches={matches} league={league}/></TabsContent>
      <TabsContent value="h2h" className="mt-4"><H2HView matches={matches} league={league}/></TabsContent>
      <TabsContent value="phase" className="mt-4"><PhaseView matches={matches} league={league}/></TabsContent>
      <TabsContent value="chase" className="mt-4"><ChaseView matches={matches} league={league}/></TabsContent>
      <TabsContent value="playerdeep" className="mt-4"><PlayerDeepView matches={matches} league={league}/></TabsContent>
      <TabsContent value="seasonbests" className="mt-4"><SeasonBestsView matches={allMatches} league={league}/></TabsContent>
      <TabsContent value="advanced" className="mt-4"><AdvancedView matches={matches} league={league}/></TabsContent>
      <TabsContent value="milestones" className="mt-4"><MilestonesView matches={matches} league={league}/></TabsContent>
      <TabsContent value="fanvote" className="mt-4"><FanVoteView matches={allMatches} league={league}/></TabsContent>
    </Tabs>
  );
}

// ---- Shared row card ----
interface RowItem { primary: string; primaryColor?: string; secondary?: string; secondaryColor?: string; detail: string; season_number?: number; }

const PODIUM_STYLES = [
  { medal: "🥈", height: 64, bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.25)", glow: "#94a3b8", label: "text-slate-300", value: "text-slate-200" },
  { medal: "🥇", height: 88, bg: "rgba(250,204,21,0.12)", border: "rgba(250,204,21,0.3)",  glow: "#facc15", label: "text-yellow-300", value: "text-yellow-200" },
  { medal: "🥉", height: 44, bg: "rgba(180,120,60,0.12)", border: "rgba(180,120,60,0.25)", glow: "#b47c3c", label: "text-amber-400", value: "text-amber-200" },
];

function PodiumRow({ entries }: { entries: RowItem[] }) {
  // Render in Olympic order: 2nd (left), 1st (centre, tallest), 3rd (right)
  const order = [1, 0, 2];
  return (
    <div className="flex items-end gap-1.5 px-3 pt-2 pb-0">
      {order.map(idx => {
        const entry = entries[idx];
        const s = PODIUM_STYLES[idx];
        if (!entry) return <div key={idx} className="flex-1" />;
        const valuePart = entry.detail?.split("·")[0]?.trim() ?? "";
        return (
          <div key={idx} className="flex flex-col items-center flex-1 gap-0">
            {/* Player card above podium */}
            <div className="text-center px-1 mb-1.5 w-full">
              <div className={`text-[11px] font-bold truncate leading-tight ${s.label}`}
                style={entry.primaryColor ? { color: entry.primaryColor } : undefined}>
                {entry.primary}
              </div>
              {entry.secondary && (
                <div className="text-[9px] text-muted-foreground/70 truncate"
                  style={entry.secondaryColor ? { color: entry.secondaryColor } : undefined}>
                  {entry.secondary}
                </div>
              )}
              <div className={`text-sm font-black font-mono ${s.value}`}>{valuePart}</div>
            </div>
            {/* Podium block */}
            <div className="w-full rounded-t-lg flex items-end justify-center pb-1.5 relative overflow-hidden"
              style={{
                height: s.height,
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderBottom: "none",
                boxShadow: `inset 0 1px 0 ${s.glow}22`,
              }}>
              <span className="text-lg">{s.medal}</span>
              {idx === 0 && <span className="absolute top-1 right-1 text-[8px] font-bold text-yellow-400 opacity-40">#1</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecordCard({ title, desc, emoji, entries }: { title: string; desc: string; emoji: string; entries: RowItem[] }) {
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  return (
    <Card className="overflow-hidden gradient-card border-border/60 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-2.5 px-4 pt-4 pb-1">
        <span className="text-2xl leading-none">{emoji}</span>
        <div className="flex-1">
          <div className="font-display text-base leading-tight">{title}</div>
          <div className="text-[10px] text-muted-foreground italic mt-0.5">{desc}</div>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="text-xs text-muted-foreground italic py-4 text-center">No entries yet.</div>
      ) : (
        <>
          <PodiumRow entries={top3} />
          {/* Horizontal separator line (the stage floor) */}
          <div className="mx-3 border-t border-border/40 mt-0 mb-2" />
          {/* Positions 4+ as compact list */}
          {rest.length > 0 && (
            <div className="space-y-0.5 px-3 pb-3">
              {rest.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-secondary/15">
                  <span className="w-5 text-center font-mono text-[10px] text-muted-foreground/50 shrink-0">{i + 4}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold truncate" style={r.primaryColor ? { color: r.primaryColor } : undefined}>{r.primary}</span>
                    {r.secondary && <span className="text-[10px] text-muted-foreground ml-1.5" style={r.secondaryColor ? { color: r.secondaryColor } : undefined}>{r.secondary}</span>}
                    <div className="text-[10px] text-muted-foreground truncate">{r.detail}</div>
                  </div>
                  {r.season_number != null && <span className="text-[9px] text-muted-foreground shrink-0 bg-secondary/50 px-1 rounded">S{r.season_number}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function teamRow(t: TeamEntry, league: League): RowItem {
  return { primary: t.team, primaryColor: teamColor(t.team, league.teams), secondary: t.vs ? `vs ${t.vs}` : "", detail: t.detail, season_number: t.season_number };
}
function indRow(e: IndEntry, league: League): RowItem {
  return { primary: e.name, secondary: e.team, secondaryColor: teamColor(e.team, league.teams), detail: e.detail, season_number: e.season_number };
}

function overallRow(r: TeamOverallRow, league: League, detail: string): RowItem {
  return { primary: r.team, primaryColor: teamColor(r.team, league.teams), detail };
}

function topOverall(rows: TeamOverallRow[], key: keyof TeamOverallRow, league: League, detail: (r: TeamOverallRow) => string, limit = 5) {
  return [...rows]
    .filter(r => Number(r[key]) > 0)
    .sort((a, b) => Number(b[key]) - Number(a[key]))
    .slice(0, limit)
    .map(r => overallRow(r, league, detail(r)));
}

function MegaRecordsView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const [group, setGroup] = useState<"team" | "bat" | "bowl" | "match" | "captain">("team");
  const [captains, setCaptains] = useState<CaptaincyRow[] | null>(null);
  const overall = useMemo(() => computeTeamOverall(matches, league.teams.map(t => t.id)), [matches, league]);
  const deep = useMemo(() => computePlayerDeepStats(matches, league.settings.powerplayOvers ?? 6), [matches, league]);
  const advanced = useMemo(() => computeAdvanced(matches, 20), [matches]);
  const toss = useMemo(() => computeTossStats(matches), [matches]);
  const collapses = useMemo(() => computeCollapseStats(matches, 10), [matches]);

  useEffect(() => { (async () => setCaptains(await computeCaptaincy(league.id, matches)))(); }, [league.id, matches]);

  const deepRows = (sorter: (a: any, b: any) => number, detail: (r: any) => string) => [...deep].sort(sorter).slice(0, 5).map(r => ({
    primary: r.name, secondary: r.team, secondaryColor: teamColor(r.team, league.teams), detail: detail(r),
  }));
  const advRows = (key: keyof AdvancedRow, detail: (r: AdvancedRow) => string) => [...advanced].sort((a, b) => Number(b[key]) - Number(a[key])).slice(0, 5).map(r => ({
    primary: r.name, secondary: r.team, secondaryColor: teamColor(r.team, league.teams), detail: detail(r),
  }));
  const capRows = (sorter: (a: CaptaincyRow, b: CaptaincyRow) => number, detail: (r: CaptaincyRow) => string) => [...(captains ?? [])].sort(sorter).slice(0, 5).map(r => ({
    primary: r.name, secondary: r.team, secondaryColor: teamColor(r.team, league.teams), detail: detail(r),
  }));

  const groups = {
    team: [
      <RecordCard key="tw" title="Most Team Wins" desc="Franchise wins across this scope." emoji="🏆" entries={topOverall(overall, "wins", league, r => `${r.wins} wins in ${r.matches} matches`)}/>,
      <RecordCard key="twp" title="Best Team Win%" desc="Win rate leaderboard." emoji="📈" entries={topOverall(overall, "winPct", league, r => `${r.winPct}% win rate`)}/>,
      <RecordCard key="tt" title="Most Tied Matches" desc="Teams involved in the most ties." emoji="🤝" entries={topOverall(overall, "ties", league, r => `${r.ties} tied match${r.ties === 1 ? "" : "es"}`)}/>,
      <RecordCard key="hs" title="Highest Scores" desc="Best franchise innings totals." emoji="🚀" entries={teamHighestTotals(matches, 5).map(t => teamRow(t, league))}/>,
      <RecordCard key="ls" title="Lowest Scores" desc="Smallest completed totals." emoji="🥶" entries={teamLowestTotals(matches, 5).map(t => teamRow(t, league))}/>,
      <RecordCard key="avg" title="Best Avg Score" desc="Highest average runs per innings." emoji="📊" entries={topOverall(overall, "avgScore", league, r => `${r.avgScore} runs per match`)}/>,
      <RecordCard key="fours" title="Most Team Fours" desc="Aggregate fours by team." emoji="4️⃣" entries={topOverall(overall, "totalFours", league, r => `${r.totalFours} fours`)}/>,
      <RecordCard key="sixes" title="Most Team Sixes" desc="Aggregate sixes by team." emoji="6️⃣" entries={topOverall(overall, "totalSixes", league, r => `${r.totalSixes} sixes`)}/>,
      <RecordCard key="twoh" title="Most 200+ Totals" desc="Frequency of monster totals." emoji="💥" entries={topOverall(overall, "total200s", league, r => `${r.total200s} totals of 200+`)}/>,
      <RecordCard key="onef" title="Most 150+ Totals" desc="Consistent high scoring." emoji="🔥" entries={topOverall(overall, "total150s", league, r => `${r.total150s} totals of 150+`)}/>,
      <RecordCard key="wk" title="Most Wickets Taken" desc="Team bowling wickets." emoji="🎯" entries={topOverall(overall, "totalWicketsTaken", league, r => `${r.totalWicketsTaken} wickets`)}/>,
      <RecordCard key="streak" title="Best Win Streak" desc="Longest winning run." emoji="⚡" entries={topOverall(overall, "bestStreak", league, r => `${r.bestStreak} wins in a row`)}/>,
      <RecordCard key="bad" title="Longest Losing Run" desc="Worst team slump." emoji="📉" entries={topOverall(overall, "worstStreak", league, r => `${r.worstStreak} losses in a row`)}/>,
      <RecordCard key="home" title="Best Home Win%" desc="Home dominance." emoji="🏟️" entries={topOverall(overall, "homeWinPct", league, r => `${r.homeWinPct}% at home`)}/>,
      <RecordCard key="away" title="Best Away Win%" desc="Road performance." emoji="✈️" entries={topOverall(overall, "awayWinPct", league, r => `${r.awayWinPct}% away`)}/>,
      <RecordCard key="po" title="Most Playoff Appearances" desc="Distinct seasons reaching playoffs." emoji="🎫" entries={topOverall(overall, "playoffApps", league, r => `${r.playoffApps} season${r.playoffApps === 1 ? "" : "s"} in playoffs`)}/>,
      <RecordCard key="finals" title="Most Finals" desc="Distinct seasons reaching the final." emoji="👑" entries={topOverall(overall, "finalsPlayed", league, r => `${r.finalsPlayed} final${r.finalsPlayed === 1 ? "" : "s"}`)}/>,
      <RecordCard key="titles" title="Most Titles" desc="Championship count." emoji="🏅" entries={topOverall(overall, "titles", league, r => `${r.titles} title${r.titles === 1 ? "" : "s"}`)}/>,
    ],
    bat: [
      <RecordCard key="score" title="Highest Individual Scores" desc="Top single innings." emoji="🏏" entries={topBatScores(matches, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="runs" title="Most Runs" desc="Aggregate run scorers." emoji="🍊" entries={topBest(matches, "runs", 5).map(e => indRow(e, league))}/>,
      <RecordCard key="avg3" title="Best Batting Avg" desc="Minimum 3 innings." emoji="📐" entries={bestBattingAverage(matches, 3, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="avg5" title="Elite Batting Avg" desc="Minimum 5 innings." emoji="🧮" entries={bestBattingAverage(matches, 5, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="sr10" title="Best Innings SR" desc="Minimum 10 balls." emoji="⚡" entries={bestStrikeRateInnings(matches, 10, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="sr20" title="Best Long-Knock SR" desc="Minimum 20 balls." emoji="🏎️" entries={bestStrikeRateInnings(matches, 20, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="f50" title="Fastest Fifties" desc="Fewest balls to 50." emoji="🚀" entries={fastestMilestone(matches, 50, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="f100" title="Fastest Hundreds" desc="Fewest balls to 100." emoji="💯" entries={fastestMilestone(matches, 100, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="six" title="Most Sixes" desc="Career six count." emoji="🛸" entries={topBest(matches, "sixes", 5).map(e => indRow(e, league))}/>,
      <RecordCard key="four" title="Most Fours" desc="Career four count." emoji="🎯" entries={topBest(matches, "fours", 5).map(e => indRow(e, league))}/>,
      <RecordCard key="bdinn" title="Most Boundaries In Innings" desc="4s + 6s in one knock." emoji="🎆" entries={mostBoundariesInnings(matches, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="fif" title="Most Fifties" desc="Half-century count." emoji="5️⃣0️⃣" entries={topBest(matches, "fifties", 5).map(e => indRow(e, league))}/>,
      <RecordCard key="hun" title="Most Hundreds" desc="Century count." emoji="💯" entries={topBest(matches, "hundreds", 5).map(e => indRow(e, league))}/>,
      <RecordCard key="chase" title="Best Chase Batters" desc="Most runs batting second." emoji="🏃" entries={deepRows((a, b) => b.chaseRuns - a.chaseRuns, r => `${r.chaseRuns} chase runs · SR ${r.chaseBalls ? ((r.chaseRuns / r.chaseBalls) * 100).toFixed(1) : "—"}`)}/>,
      <RecordCard key="death" title="Best Death Hitters" desc="Most death-over runs." emoji="🔚" entries={deepRows((a, b) => b.deathRuns - a.deathRuns, r => `${r.deathRuns} death runs`)}/>,
    ],
    bowl: [
      <RecordCard key="fig" title="Best Bowling Figures" desc="Wickets first, then runs." emoji="🔥" entries={bestBowlingFigures(matches, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="wk" title="Most Wickets" desc="Aggregate wicket-takers." emoji="💜" entries={topBest(matches, "wickets", 5).map(e => indRow(e, league))}/>,
      <RecordCard key="ba2" title="Best Bowling Avg" desc="Minimum 2 wickets." emoji="🩺" entries={bestBowlingAverage(matches, 2, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="ba4" title="Elite Bowling Avg" desc="Minimum 4 wickets." emoji="📉" entries={bestBowlingAverage(matches, 4, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="eco1" title="Best Economy Spell" desc="Minimum 1 over." emoji="🔒" entries={bestEconomySpell(matches, 1, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="eco2" title="Best Full Spell Economy" desc="Minimum 2 overs." emoji="🛡️" entries={bestEconomySpell(matches, 2, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="eco3" title="Best Long Spell Economy" desc="Minimum 3 overs." emoji="🧱" entries={bestEconomySpell(matches, 3, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="dots" title="Most Dots In Spell" desc="Single-innings dot-ball pressure." emoji="⏸️" entries={mostDotsInnings(matches, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="maidens" title="Most Maidens" desc="Aggregate maiden overs." emoji="🚫" entries={mostMaidens(matches, 5).map(e => indRow(e, league))}/>,
      <RecordCard key="wpa" title="Wickets Per Appearance" desc="Advanced wicket impact." emoji="🎳" entries={advRows("wpa", r => `${r.wpa} wickets/appearance`)}/>,
    ],
    match: [
      <RecordCard key="chase" title="Highest Successful Chases" desc="Biggest targets chased." emoji="🏃" entries={highestSuccessfulChases(matches, 5).map(t => teamRow(t, league))}/>,
      <RecordCard key="def" title="Lowest Defended Totals" desc="Smallest winning first-innings scores." emoji="🛡️" entries={lowestDefendedTotals(matches, 5).map(t => teamRow(t, league))}/>,
      <RecordCard key="big" title="Biggest Wins" desc="Largest run margins." emoji="💪" entries={biggestWinMargin(matches, 5).map(t => teamRow(t, league))}/>,
      <RecordCard key="close" title="Closest Finishes" desc="Smallest run margins." emoji="😬" entries={closestFinishes(matches, 5).map(t => teamRow(t, league))}/>,
      <RecordCard key="pp" title="Best Powerplays" desc="Most runs in powerplay." emoji="⚡" entries={teamBestPowerplay(matches, league.settings.powerplayOvers ?? 6, 5).map(t => teamRow(t, league))}/>,
      <RecordCard key="tb" title="Most Team Boundaries" desc="4s + 6s in a team innings." emoji="🎯" entries={teamMostBoundaries(matches, 5).map(t => teamRow(t, league))}/>,
      <RecordCard key="toss" title="Best Toss Impact" desc="Toss win to match win rate." emoji="🪙" entries={toss.slice(0, 5).map(t => ({ primary: t.team, primaryColor: teamColor(t.team, league.teams), detail: `${t.tossWinMatchWinPct}% · ${t.winAfterTossWin}/${t.tossWins} wins after toss` }))}/>,
      <RecordCard key="collapse" title="Worst Collapses" desc="Clusters of wickets in short windows." emoji="🌪️" entries={collapses.map(c => ({ primary: c.team, primaryColor: teamColor(c.team, league.teams), detail: c.collapseText, season_number: c.season_number }))}/>,
      <RecordCard key="impact" title="Highest Impact Players" desc="Composite advanced impact." emoji="🌟" entries={advRows("impact", r => `Impact ${r.impact}`)}/>,
      <RecordCard key="finish" title="Best Finishers" desc="Not-outs and scoring speed." emoji="🔚" entries={advRows("finisherIndex", r => `Finisher ${r.finisherIndex}`)}/>,
    ],
    captain: captains === null ? [] : [
      <RecordCard key="cm" title="Most Matches as Captain" desc="Leadership appearances." emoji="👑" entries={capRows((a, b) => b.matches - a.matches, r => `${r.matches} matches as captain`)}/>,
      <RecordCard key="cw" title="Most Captain Wins" desc="Wins while leading." emoji="🏆" entries={capRows((a, b) => b.wins - a.wins, r => `${r.wins} wins in ${r.matches} matches`)}/>,
      <RecordCard key="cwp" title="Best Captain Win%" desc="Minimum 2 captaincy matches." emoji="📈" entries={capRows((a, b) => b.winPct - a.winPct, r => `${r.winPct}% win rate`)}/>,
      <RecordCard key="ct" title="Most Captain Ties" desc="Tied matches as skipper." emoji="🤝" entries={capRows((a, b) => b.ties - a.ties, r => `${r.ties} ties`)}/>,
      <RecordCard key="cs" title="Best Captain Streak" desc="Longest winning run as skipper." emoji="⚡" entries={capRows((a, b) => b.bestStreak - a.bestStreak, r => `${r.bestStreak} wins in a row`)}/>,
      <RecordCard key="csea" title="Most Seasons as Captain" desc="Distinct seasons leading a team." emoji="📅" entries={capRows((a, b) => (b as any).seasonsCaptained - (a as any).seasonsCaptained, r => `${(r as any).seasonsCaptained} season${(r as any).seasonsCaptained === 1 ? "" : "s"} captained`)}/>,
      <RecordCard key="cpo" title="Most Playoff Seasons" desc="Distinct seasons leading team into playoffs." emoji="🎟️" entries={capRows((a, b) => (b as any).playoffSeasons - (a as any).playoffSeasons, r => `${(r as any).playoffSeasons} playoff season${(r as any).playoffSeasons === 1 ? "" : "s"}`)}/>,
      <RecordCard key="cf" title="Most Finals as Captain" desc="Distinct final appearances." emoji="🎫" entries={capRows((a, b) => b.finals - a.finals, r => `${r.finals} final${r.finals === 1 ? "" : "s"}`)}/>,
      <RecordCard key="cti" title="Captain Titles" desc="Championships as skipper." emoji="🏅" entries={capRows((a, b) => b.titles - a.titles, r => `${r.titles} title${r.titles === 1 ? "" : "s"}`)}/>,
    ],
  };

  const labels = [
    ["team", "Team", groups.team.length], ["bat", "Batting", groups.bat.length], ["bowl", "Bowling", groups.bowl.length],
    ["match", "Match", groups.match.length], ["captain", "Captaincy", captains === null ? 7 : groups.captain.length],
  ] as const;
  const total = groups.team.length + groups.bat.length + groups.bowl.length + groups.match.length + (captains === null ? 7 : groups.captain.length);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{total}+ live record boards</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {labels.map(([key, label, count]) => (
            <Button key={key} size="sm" variant={group === key ? "default" : "outline"} className="h-8 text-xs shrink-0" onClick={() => setGroup(key)}>
              {label} <span className="ml-1 opacity-70">{count}</span>
            </Button>
          ))}
        </div>
      </div>
      {group === "captain" && captains === null ? (
        <Card className="p-8 text-center gradient-card border-border/60"><Loader2 className="w-5 h-5 mx-auto animate-spin text-primary"/></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{groups[group]}</div>
      )}
    </div>
  );
}

// ---- TEAM BESTS ----
function TeamView({ matches, league }: { matches: MatchRow[]; league: League }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <RecordCard title="Highest Team Totals" desc="Largest single-innings scores." emoji="🏏" entries={teamHighestTotals(matches, 5).map(t => teamRow(t, league))}/>
      <RecordCard title="Lowest Team Totals" desc="Smallest completed innings." emoji="🥶" entries={teamLowestTotals(matches, 5).map(t => teamRow(t, league))}/>
      <RecordCard title="Best Powerplay" desc={`Most runs in PP overs.`} emoji="⚡" entries={teamBestPowerplay(matches, league.settings.powerplayOvers ?? 6, 5).map(t => teamRow(t, league))}/>
      <RecordCard title="Most Boundaries (Inn)" desc="Most 4s + 6s in one innings." emoji="🎯" entries={teamMostBoundaries(matches, 5).map(t => teamRow(t, league))}/>
      <RecordCard title="Biggest Win (Runs)" desc="Largest victory by runs." emoji="💪" entries={biggestWinMargin(matches, 5).map(t => teamRow(t, league))}/>
      <RecordCard title="Closest Finishes" desc="Smallest run margins." emoji="😬" entries={closestFinishes(matches, 5).map(t => teamRow(t, league))}/>
      <RecordCard title="Highest Chase" desc="Most runs chased successfully." emoji="🏃" entries={highestSuccessfulChases(matches, 5).map(t => teamRow(t, league))}/>
      <RecordCard title="Lowest Defended" desc="Smallest score that won batting first." emoji="🛡️" entries={lowestDefendedTotals(matches, 5).map(t => teamRow(t, league))}/>
    </div>
  );
}

// ---- INDIVIDUAL ----
function IndividualView({ matches, league }: { matches: MatchRow[]; league: League }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <RecordCard title="Highest Score (Inn)" desc="Best single-innings knock." emoji="🏏" entries={topBatScores(matches, 5).map(e => indRow(e, league))}/>
      <RecordCard title="Most Runs" desc="Aggregate runs." emoji="🔢" entries={topBest(matches, "runs", 5).map(e => indRow(e, league))}/>
      <RecordCard title="Best Batting Avg" desc="Min 3 innings." emoji="📐" entries={bestBattingAverage(matches, 3, 5).map(e => indRow(e, league))}/>
      <RecordCard title="Best Strike Rate" desc="Min 10 balls faced (per innings)." emoji="⚡" entries={bestStrikeRateInnings(matches, 10, 5).map(e => indRow(e, league))}/>
      <RecordCard title="Fastest Fifty" desc="Quickest 50 by balls faced." emoji="🚀" entries={fastestMilestone(matches, 50, 5).map(e => indRow(e, league))}/>
      <RecordCard title="Fastest Hundred" desc="Quickest 100 by balls faced." emoji="💯" entries={fastestMilestone(matches, 100, 5).map(e => indRow(e, league))}/>
      <RecordCard title="Most Sixes" desc="Total sixes hit." emoji="🚀" entries={topBest(matches, "sixes", 5).map(e => indRow(e, league))}/>
      <RecordCard title="Most Fours" desc="Total fours hit." emoji="4️⃣" entries={topBest(matches, "fours", 5).map(e => indRow(e, league))}/>
      <RecordCard title="Most 50s" desc="Half-centuries scored." emoji="5️⃣0️⃣" entries={topBest(matches, "fifties", 5).map(e => indRow(e, league))}/>
      <RecordCard title="Most 100s" desc="Centuries scored." emoji="💯" entries={topBest(matches, "hundreds", 5).map(e => indRow(e, league))}/>
      <RecordCard title="Best Bowling Figures" desc="Best wickets/runs (single innings)." emoji="🔥" entries={bestBowlingFigures(matches, 5).map(e => indRow(e, league))}/>
      <RecordCard title="Most Wickets" desc="Aggregate wickets taken." emoji="🎯" entries={topBest(matches, "wickets", 5).map(e => indRow(e, league))}/>
      <RecordCard title="Best Bowling Avg" desc="Career avg, min 4 wickets." emoji="🩺" entries={bestBowlingAverage(matches, 4, 5).map(e => indRow(e, league))}/>
      <RecordCard title="Best Economy Spell" desc="Min 2 overs in a single innings." emoji="🛡️" entries={bestEconomySpell(matches, 2, 5).map(e => indRow(e, league))}/>
      <RecordCard title="Most Maiden Overs" desc="Aggregate maidens bowled." emoji="🚫" entries={mostMaidens(matches, 5).map(e => indRow(e, league))}/>
      <RecordCard title="Most Dot Balls (Spell)" desc="Most dots in one innings." emoji="⏸️" entries={mostDotsInnings(matches, 5).map(e => indRow(e, league))}/>
      <RecordCard title="Most Boundaries (Inn)" desc="Most 4s + 6s in one knock." emoji="🎆" entries={mostBoundariesInnings(matches, 5).map(e => indRow(e, league))}/>
    </div>
  );
}

// ---- MILESTONES ----
function MilestonesView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const ms = milestones(matches);
  if (!ms.length) return <Card className="p-10 text-center gradient-card border-border/60 text-muted-foreground">No milestones reached yet.</Card>;
  return (
    <div className="space-y-2">
      {ms.map((m, i) => (
        <Card key={i} className="p-3.5 gradient-card border-border/60 flex items-center gap-3 hover:border-primary/30 transition-colors">
          <Sparkles className="w-4 h-4 text-primary shrink-0"/>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm">{m.label}</div>
            <div className="text-[11px] text-muted-foreground truncate">{m.detail}</div>
          </div>
          {m.team && <Badge variant="outline" className="text-[10px] shrink-0" style={{ color: teamColor(m.team, league.teams), borderColor: teamColor(m.team, league.teams) }}>{m.team}</Badge>}
          {m.season_number != null && <span className="text-[10px] text-muted-foreground shrink-0 bg-secondary/50 px-1.5 py-0.5 rounded">S{m.season_number}</span>}
        </Card>
      ))}
    </div>
  );
}

// ---- TEAMS OVERALL ----
function OverallTeamsView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const rows = computeTeamOverall(matches, league.teams.map(t => t.id));
  if (!rows.length) return <Card className="p-10 text-center text-muted-foreground gradient-card border-border/60">No data yet. Play some matches!</Card>;
  return (
    <Card className="gradient-card border-border/60 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/40">
            <tr>
              <th className="text-left px-3 py-2.5 sticky left-0 bg-secondary/40">Team</th>
              <th className="text-center px-2 py-2.5">M</th>
              <th className="text-center px-2 py-2.5 text-green-400">W</th>
              <th className="text-center px-2 py-2.5 text-red-400">L</th>
              <th className="text-center px-2 py-2.5">T</th>
              <th className="text-center px-2 py-2.5 font-bold text-primary">Win%</th>
              <th className="text-center px-2 py-2.5">AvgScore</th>
              <th className="text-center px-2 py-2.5">Hi</th>
              <th className="text-center px-2 py-2.5">Lo</th>
              <th className="text-center px-2 py-2.5">200+</th>
              <th className="text-center px-2 py-2.5">150+</th>
              <th className="text-center px-2 py-2.5">4s</th>
              <th className="text-center px-2 py-2.5 text-amber-400">6s</th>
              <th className="text-center px-2 py-2.5">Streak</th>
              <th className="text-center px-2 py-2.5">Home%</th>
              <th className="text-center px-2 py-2.5">Away%</th>
              <th className="text-center px-2 py-2.5" title="Distinct seasons that reached the playoffs">PO</th>
              <th className="text-center px-2 py-2.5">Finals</th>
              <th className="text-center px-2 py-2.5">🏆</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.team} className={`border-t border-border/30 hover:bg-secondary/20 transition-colors ${ri === 0 ? "bg-primary/5" : ""}`}>
                <td className="px-3 py-2 font-display text-sm sticky left-0 bg-background/80" style={{ color: teamColor(r.team, league.teams) }}>{r.team}</td>
                <td className="text-center px-2 py-2 font-mono">{r.matches}</td>
                <td className="text-center px-2 py-2 font-mono text-green-400 font-bold">{r.wins}</td>
                <td className="text-center px-2 py-2 font-mono text-red-400">{r.losses}</td>
                <td className="text-center px-2 py-2 font-mono text-muted-foreground">{r.ties}</td>
                <td className="text-center px-2 py-2 font-mono font-bold text-primary">{r.winPct}%</td>
                <td className="text-center px-2 py-2 font-mono">{r.avgScore}</td>
                <td className="text-center px-2 py-2 font-mono text-green-300" title={r.highestDetail}>{r.highestScore}</td>
                <td className="text-center px-2 py-2 font-mono text-red-300" title={r.lowestDetail}>{r.lowestScore || "—"}</td>
                <td className="text-center px-2 py-2 font-mono">{r.total200s}</td>
                <td className="text-center px-2 py-2 font-mono">{r.total150s}</td>
                <td className="text-center px-2 py-2 font-mono">{r.totalFours}</td>
                <td className="text-center px-2 py-2 font-mono text-amber-400 font-bold">{r.totalSixes}</td>
                <td className="text-center px-2 py-2 font-mono font-bold text-primary">{r.bestStreak > 0 ? `${r.bestStreak}W` : "—"}</td>
                <td className="text-center px-2 py-2 font-mono">{r.homeWinPct}%</td>
                <td className="text-center px-2 py-2 font-mono">{r.awayWinPct}%</td>
                <td className="text-center px-2 py-2 font-mono">{r.playoffApps}</td>
                <td className="text-center px-2 py-2 font-mono">{r.finalsPlayed}</td>
                <td className="text-center px-2 py-2 font-mono text-primary font-bold">{r.titles || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-[10px] text-muted-foreground italic border-t border-border/30">
        PO = Playoff Seasons (distinct seasons reaching playoffs) · Hover Hi/Lo for context
      </div>
    </Card>
  );
}

// ---- CAPTAINCY ----
function CaptaincyView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const [rows, setRows] = useState<CaptaincyRow[] | null>(null);
  useEffect(() => { (async () => setRows(await computeCaptaincy(league.id, matches)))(); }, [league.id, matches]);
  if (!rows) return <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin text-primary"/></div>;
  if (!rows.length) return (
    <Card className="p-10 text-center gradient-card border-border/60">
      <Crown className="w-10 h-10 mx-auto text-primary/30 mb-3"/>
      <div className="font-display text-lg text-foreground/70">No captaincy data yet</div>
      <p className="text-sm text-muted-foreground mt-1">Captains need at least 2 matches as skipper to appear here.</p>
    </Card>
  );
  return (
    <Card className="gradient-card border-border/60 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/40">
            <tr>
              <th className="text-left px-3 py-2.5">Captain</th>
              <th className="text-left px-2 py-2.5">Team</th>
              <th className="text-center px-2 py-2.5">M</th>
              <th className="text-center px-2 py-2.5 text-green-400">W</th>
              <th className="text-center px-2 py-2.5 text-red-400">L</th>
              <th className="text-center px-2 py-2.5">T</th>
              <th className="text-center px-2 py-2.5 font-bold text-primary">Win%</th>
              <th className="text-center px-2 py-2.5">Best Streak</th>
              <th className="text-center px-2 py-2.5">Finals</th>
              <th className="text-center px-2 py-2.5">🏆</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.player_id} className={`border-t border-border/30 hover:bg-secondary/20 transition-colors ${ri === 0 ? "bg-primary/5" : ""}`}>
                <td className="px-3 py-2 font-semibold flex items-center gap-1.5"><Crown className="w-3 h-3 text-primary"/>{r.name}</td>
                <td className="px-2 py-2 text-sm" style={{ color: teamColor(r.team, league.teams) }}>{r.team}</td>
                <td className="text-center px-2 py-2 font-mono">{r.matches}</td>
                <td className="text-center px-2 py-2 font-mono text-green-400 font-bold">{r.wins}</td>
                <td className="text-center px-2 py-2 font-mono text-red-400">{r.losses}</td>
                <td className="text-center px-2 py-2 font-mono">{r.ties}</td>
                <td className="text-center px-2 py-2 font-mono font-bold text-primary">{r.winPct}%</td>
                <td className="text-center px-2 py-2 font-mono">{r.bestStreak > 0 ? `${r.bestStreak}W` : "—"}</td>
                <td className="text-center px-2 py-2 font-mono">{r.finals}</td>
                <td className="text-center px-2 py-2 font-mono text-primary font-bold">{r.titles || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---- H2H ----
function H2HView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const cells = computeH2H(matches, league.teams.map(t => t.id));
  if (!cells.length) return <Card className="p-10 text-center text-muted-foreground gradient-card border-border/60">No head-to-head data yet.</Card>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {cells.map(c => {
        const aWin = c.played ? (c.aWins / c.played) * 100 : 0;
        const bWin = c.played ? (c.bWins / c.played) * 100 : 0;
        const tiePct = c.played ? (c.ties / c.played) * 100 : 0;
        return (
          <Card key={`${c.teamA}-${c.teamB}`} className="p-4 gradient-card border-border/60 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-lg leading-tight" style={{ color: teamColor(c.teamA, league.teams) }}>{c.teamA}</div>
              <div className="text-center">
                <div className="font-display text-xl font-bold">{c.aWins} – {c.bWins}</div>
                <div className="text-[10px] text-muted-foreground">{c.played} match{c.played === 1 ? "" : "es"}{c.ties > 0 ? ` · ${c.ties}T` : ""}</div>
              </div>
              <div className="font-display text-lg leading-tight text-right" style={{ color: teamColor(c.teamB, league.teams) }}>{c.teamB}</div>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-secondary/40 mb-2">
              <div className="h-full transition-all" style={{ width: `${aWin}%`, background: teamColor(c.teamA, league.teams) }}/>
              {c.ties > 0 && <div className="h-full bg-muted-foreground/40" style={{ width: `${tiePct}%` }}/>}
              <div className="h-full transition-all" style={{ width: `${bWin}%`, background: teamColor(c.teamB, league.teams) }}/>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Avg {c.aRunsAvg} runs</span>
              <span>Avg {c.bRunsAvg} runs</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---- PHASE STATS ----
function PhaseView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const phaseMap = useMemo(() => computePhaseStats(matches, league.settings.powerplayOvers ?? 6), [matches, league]);
  const rows = [...phaseMap.values()].sort((a, b) => b.totalMatches - a.totalMatches);

  const collapses = useMemo(() => computeCollapseStats(matches, 8), [matches]);
  const tossStats = useMemo(() => computeTossStats(matches), [matches]);

  if (!rows.length) return <Card className="p-10 text-center gradient-card border-border/60 text-muted-foreground">Need ball-by-ball data for phase analysis.</Card>;

  const econ = (runs: number, balls: number) => balls ? ((runs / balls) * 6).toFixed(1) : "—";
  const sr = (runs: number, balls: number) => balls ? ((runs / balls) * 100).toFixed(1) : "—";

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><Activity className="w-3 h-3"/>Phase-by-Phase Batting</div>
        <Card className="gradient-card border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left px-3 py-2.5 sticky left-0 bg-secondary/40">Team</th>
                  <th className="text-center px-2 py-2.5 border-l border-border/30" colSpan={3}>Powerplay</th>
                  <th className="text-center px-2 py-2.5 border-l border-border/30" colSpan={3}>Middle</th>
                  <th className="text-center px-2 py-2.5 border-l border-border/30" colSpan={3}>Death</th>
                </tr>
                <tr>
                  <th className="text-left px-3 py-2 sticky left-0 bg-secondary/40"></th>
                  <th className="text-center px-2 py-1 text-amber-400">Avg</th>
                  <th className="text-center px-2 py-1">SR</th>
                  <th className="text-center px-2 py-1 text-red-400">Wkts</th>
                  <th className="text-center px-2 py-1 border-l border-border/20 text-amber-400">Avg</th>
                  <th className="text-center px-2 py-1">SR</th>
                  <th className="text-center px-2 py-1 text-red-400">Wkts</th>
                  <th className="text-center px-2 py-1 border-l border-border/20 text-amber-400">Avg</th>
                  <th className="text-center px-2 py-1">SR</th>
                  <th className="text-center px-2 py-1 text-red-400">Wkts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={r.team} className={`border-t border-border/30 hover:bg-secondary/20 transition-colors ${ri === 0 ? "bg-primary/5" : ""}`}>
                    <td className="px-3 py-2 font-display sticky left-0 bg-background/80" style={{ color: teamColor(r.team, league.teams) }}>{r.team}</td>
                    <td className="text-center px-2 py-2 font-mono font-bold">{r.totalMatches ? (r.ppRuns / r.totalMatches).toFixed(1) : "—"}</td>
                    <td className="text-center px-2 py-2 font-mono">{sr(r.ppRuns, r.ppBalls)}</td>
                    <td className="text-center px-2 py-2 font-mono text-red-400">{r.totalMatches ? (r.ppWkts / r.totalMatches).toFixed(1) : "—"}</td>
                    <td className="text-center px-2 py-2 font-mono border-l border-border/20 font-bold">{r.totalMatches ? (r.midRuns / r.totalMatches).toFixed(1) : "—"}</td>
                    <td className="text-center px-2 py-2 font-mono">{sr(r.midRuns, r.midBalls)}</td>
                    <td className="text-center px-2 py-2 font-mono text-red-400">{r.totalMatches ? (r.midWkts / r.totalMatches).toFixed(1) : "—"}</td>
                    <td className="text-center px-2 py-2 font-mono border-l border-border/20 font-bold">{r.totalMatches ? (r.deathRuns / r.totalMatches).toFixed(1) : "—"}</td>
                    <td className="text-center px-2 py-2 font-mono">{sr(r.deathRuns, r.deathBalls)}</td>
                    <td className="text-center px-2 py-2 font-mono text-red-400">{r.totalMatches ? (r.deathWkts / r.totalMatches).toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><Zap className="w-3 h-3"/>Boundary % by Phase</div>
          <Card className="gradient-card border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/40">
                  <tr>
                    <th className="text-left px-3 py-2.5">Team</th>
                    <th className="text-center px-2 py-2.5">PP%</th>
                    <th className="text-center px-2 py-2.5">Mid%</th>
                    <th className="text-center px-2 py-2.5 text-primary">Death%</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.team} className="border-t border-border/30 hover:bg-secondary/20">
                      <td className="px-3 py-2 font-display text-sm" style={{ color: teamColor(r.team, league.teams) }}>{r.team}</td>
                      <td className="text-center px-2 py-2 font-mono">{r.ppBdryPct}%</td>
                      <td className="text-center px-2 py-2 font-mono">{r.midBdryPct}%</td>
                      <td className="text-center px-2 py-2 font-mono font-bold text-primary">{r.deathBdryPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><Target className="w-3 h-3"/>Toss Win → Match Win %</div>
          <Card className="gradient-card border-border/60 overflow-hidden">
            {tossStats.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No toss data available yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/40">
                    <tr>
                      <th className="text-left px-3 py-2.5">Team</th>
                      <th className="text-center px-2 py-2.5">Toss W</th>
                      <th className="text-center px-2 py-2.5">Won Toss → Won Match</th>
                      <th className="text-center px-2 py-2.5 font-bold text-primary">Toss Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tossStats.map(s => (
                      <tr key={s.team} className="border-t border-border/30 hover:bg-secondary/20">
                        <td className="px-3 py-2 font-display text-sm" style={{ color: teamColor(s.team, league.teams) }}>{s.team}</td>
                        <td className="text-center px-2 py-2 font-mono">{s.tossWins}</td>
                        <td className="text-center px-2 py-2 font-mono">{s.winAfterTossWin}/{s.tossWins}</td>
                        <td className="text-center px-2 py-2 font-mono font-bold text-primary">{s.tossWinMatchWinPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {collapses.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><TrendingUp className="w-3 h-3"/>Worst Batting Collapses</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {collapses.map((c, i) => (
              <Card key={i} className="p-3 gradient-card border-border/60 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-destructive">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-sm" style={{ color: teamColor(c.team, league.teams) }}>{c.team}</div>
                  <div className="text-[11px] text-muted-foreground">{c.collapseText}</div>
                </div>
                {c.season_number != null && <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded shrink-0">S{c.season_number}</span>}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- CHASE LAB ----
function ChaseView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const chaseRanges = useMemo(() => computeChaseSuccessRate(matches), [matches]);
  const chases = useMemo(() => highestSuccessfulChases(matches, 10), [matches]);
  const defends = useMemo(() => lowestDefendedTotals(matches, 10), [matches]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><Target className="w-3 h-3"/>Chase Success Rate by Target Range</div>
        {chaseRanges.length === 0 ? (
          <Card className="p-8 text-center gradient-card border-border/60 text-muted-foreground">No chase data yet.</Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {chaseRanges.map(r => (
              <Card key={r.range} className="p-4 gradient-card border-border/60 text-center hover:border-primary/30 transition-colors">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Target {r.range}</div>
                <div className={`font-display text-3xl font-bold ${r.winPct >= 60 ? "text-green-400" : r.winPct >= 40 ? "text-amber-400" : "text-red-400"}`}>{r.winPct}%</div>
                <div className="text-xs text-muted-foreground mt-1">{r.wins}/{r.attempts} won · avg {r.avgChase}</div>
                <div className="mt-2 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${r.winPct >= 60 ? "bg-green-400" : r.winPct >= 40 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${r.winPct}%` }}/>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RecordCard title="Highest Successful Chases" desc="Biggest targets chased down." emoji="🏃" entries={chases.map(t => teamRow(t, league))}/>
        <RecordCard title="Lowest Defended Totals" desc="Smallest scores that held." emoji="🛡️" entries={defends.map(t => teamRow(t, league))}/>
      </div>
    </div>
  );
}

// ---- PLAYER DEEP ANALYTICS ----
function PlayerDeepView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const rows = useMemo(() => computePlayerDeepStats(matches, league.settings.powerplayOvers ?? 6), [matches, league]);
  const [sort, setSort] = useState<"chaseSR" | "defSR" | "wickets" | "runs">("runs");

  if (!rows.length) return (
    <Card className="p-10 text-center gradient-card border-border/60">
      <Zap className="w-10 h-10 mx-auto text-primary/30 mb-3"/>
      <div className="font-display text-lg text-foreground/70">Need more match data</div>
      <p className="text-sm text-muted-foreground mt-1">Play more matches to unlock deep player analytics.</p>
    </Card>
  );

  const sorted = [...rows].sort((a, b) => {
    if (sort === "chaseSR") return (b.chaseBalls ? (b.chaseRuns / b.chaseBalls) * 100 : 0) - (a.chaseBalls ? (a.chaseRuns / a.chaseBalls) * 100 : 0);
    if (sort === "defSR") return (b.defBalls ? (b.defRuns / b.defBalls) * 100 : 0) - (a.defBalls ? (a.defRuns / a.defBalls) * 100 : 0);
    if (sort === "wickets") return b.wickets - a.wickets;
    return b.runs - a.runs;
  }).slice(0, 15);

  const fmtSR = (r: number, b: number) => b >= 10 ? ((r / b) * 100).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        {(["runs", "chaseSR", "defSR", "wickets"] as const).map(k => (
          <Button key={k} size="sm" variant={sort === k ? "default" : "outline"} className="text-xs h-7 px-2" onClick={() => setSort(k)}>
            {k === "runs" ? "Most Runs" : k === "chaseSR" ? "Chase SR" : k === "defSR" ? "Defence SR" : "Wickets"}
          </Button>
        ))}
      </div>

      <Card className="gradient-card border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left px-3 py-2.5">#</th>
                <th className="text-left px-3 py-2.5">Player</th>
                <th className="text-left px-2 py-2.5">Team</th>
                <th className="text-center px-2 py-2.5">Inn</th>
                <th className="text-center px-2 py-2.5 font-bold text-primary">Runs</th>
                <th className="text-center px-2 py-2.5">SR</th>
                <th className="text-center px-2 py-2.5 text-green-400">Chase Inn</th>
                <th className="text-center px-2 py-2.5 text-green-400">Chase SR</th>
                <th className="text-center px-2 py-2.5 text-amber-400">Def SR</th>
                <th className="text-center px-2 py-2.5 text-red-400">Wickets</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.player_id} className={`border-t border-border/30 hover:bg-secondary/20 transition-colors ${i === 0 ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold">{r.name}</td>
                  <td className="px-2 py-2 text-xs" style={{ color: teamColor(r.team, league.teams) }}>{r.team}</td>
                  <td className="text-center px-2 py-2 font-mono">{r.inn}</td>
                  <td className="text-center px-2 py-2 font-mono font-bold text-primary">{r.runs}</td>
                  <td className="text-center px-2 py-2 font-mono">{fmtSR(r.runs, r.balls)}</td>
                  <td className="text-center px-2 py-2 font-mono text-green-400">{r.chaseInn}</td>
                  <td className="text-center px-2 py-2 font-mono font-bold text-green-400">{fmtSR(r.chaseRuns, r.chaseBalls)}</td>
                  <td className="text-center px-2 py-2 font-mono text-amber-400">{fmtSR(r.defRuns, r.defBalls)}</td>
                  <td className="text-center px-2 py-2 font-mono text-red-400 font-bold">{r.wickets || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-[10px] text-muted-foreground italic border-t border-border/30">
          Chase SR = strike rate when batting 2nd · Def SR = strike rate when batting 1st · Min 20 balls or 3 wickets
        </div>
      </Card>
    </div>
  );
}

// ---- SEASON BESTS ----
function SeasonBestsView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const seasons = useMemo(() => computeSeasonBests(matches), [matches]);
  if (!seasons.length) return <Card className="p-10 text-center gradient-card border-border/60 text-muted-foreground">No seasons completed yet.</Card>;

  return (
    <div className="space-y-4">
      {seasons.map(s => (
        <Card key={s.season_number} className="gradient-card border-border/60 p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-primary"/>
            </div>
            <div className="font-display text-xl text-primary">Season {s.season_number}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <BestCell label="Runs King" name={s.runsLeader} value={`${s.runsVal} runs`} color="text-amber-400"/>
            <BestCell label="Wicket Taker" name={s.wicketsLeader} value={`${s.wicketsVal} wkts`} color="text-red-400"/>
            <BestCell label="Six Machine" name={s.sixesLeader} value={`${s.sixesVal} sixes`} color="text-primary"/>
            <BestCell label="Best SR" name={s.strikeRateLeader} value={`SR ${s.srVal}`} color="text-green-400"/>
            <BestCell label="Best Economy" name={s.econLeader} value={`Econ ${s.econVal}`} color="text-blue-400"/>
          </div>
        </Card>
      ))}
    </div>
  );
}

function BestCell({ label, name, value, color }: { label: string; name: string; value: string; color: string }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`font-display text-sm font-bold ${color} truncate`}>{name}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{value}</div>
    </div>
  );
}

// ---- ADVANCED ----
function AdvancedView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const rows = computeAdvanced(matches, 30);
  if (!rows.length) return (
    <Card className="p-10 text-center gradient-card border-border/60">
      <BarChart3 className="w-10 h-10 mx-auto text-primary/30 mb-3"/>
      <div className="font-display text-lg text-foreground/70">Need more data</div>
      <p className="text-sm text-muted-foreground mt-1">Analytics unlock after more matches are played (min 30 balls or 3 wickets).</p>
    </Card>
  );
  const top = (key: keyof AdvancedRow, label: string, emoji: string, fmt: (v: any) => string, desc: string) => {
    const sorted = [...rows].sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, 5);
    return <RecordCard key={String(key)} title={label} desc={desc} emoji={emoji} entries={sorted.map(r => ({
      primary: r.name, secondary: r.team, secondaryColor: teamColor(r.team, league.teams), detail: fmt(r[key]),
    }))}/>;
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {top("impact", "Match Influence Rating", "🌟", v => `Impact ${v}`, "Composite: runs, wickets, boundary %, SR.")}
      {top("boundaryPct", "Boundary Dependency", "🎯", v => `${v}% from 4s/6s`, "Share of runs from boundaries.")}
      {top("dotBallPct", "Dot Ball Pressure", "⏸️", v => `${v}% dots faced`, "Approx % of balls without a run.")}
      {top("finisherIndex", "Finisher Rating", "🔚", v => `Finisher ${v}`, "Not-outs × strike rate at the death.")}
      {top("anchorIndex", "Anchor Rating", "⚓", v => `Anchor ${v}`, "Balls/innings weighted by stable SR.")}
      {top("pressureSR", "Chase Strike Rate", "🔥", v => `Chase SR ${v}`, "SR in 2nd innings (chase situations).")}
      {top("wpa", "Wickets Per Appearance", "🎳", v => `${v} wkts/inn`, "Wicket-taker efficiency rating.")}
    </div>
  );
}

// ---- FAN VOTE ----
function FanVoteView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const [votes, setVotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("pavilion_fan_votes") ?? "{}"); } catch { return {}; }
  });

  const allPlayers = useMemo(() => {
    const m = new Map<string, { name: string; team: string }>();
    for (const match of matches) {
      for (const ik of ["innings1", "innings2"] as const) {
        const inn = match.scorecard?.[ik]; if (!inn) continue;
        Object.values(inn.bat as any).forEach((b: any) => { if (!m.has(b.player_id)) m.set(b.player_id, { name: b.name, team: inn.battingTeam }); });
      }
    }
    return [...m.entries()].map(([id, p]) => ({ id, ...p }));
  }, [matches]);

  const vote = (category: string, target: string) => {
    const nv = { ...votes, [category]: target };
    setVotes(nv);
    localStorage.setItem("pavilion_fan_votes", JSON.stringify(nv));
  };

  const categories = [
    { key: "mvp", label: "🏆 All-Time MVP", desc: "Best player in league history", scope: "player" },
    { key: "bestCaptain", label: "👑 Best Captain", desc: "Greatest leader of all time", scope: "player" },
    { key: "bestTeam", label: "🛡️ Greatest Team", desc: "Strongest franchise ever", scope: "team" },
    { key: "greatestBatter", label: "🏏 Greatest Batter", desc: "The best bat in the game", scope: "player" },
    { key: "greatestBowler", label: "🎳 Greatest Bowler", desc: "Most feared bowler ever", scope: "player" },
    { key: "bestRival", label: "⚔️ Best Rivalry", desc: "Most intense fixture", scope: "team" },
  ];

  const teams = league.teams.map(t => t.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Heart className="w-4 h-4 text-primary"/>
        <div className="font-display text-lg">Fan Votes</div>
        <span className="text-xs text-muted-foreground">— Your picks are saved locally</span>
      </div>
      {allPlayers.length === 0 && (
        <Card className="p-10 text-center gradient-card border-border/60 text-muted-foreground">
          Complete some matches to unlock Fan Voting.
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map(cat => (
          <Card key={cat.key} className="p-4 gradient-card border-border/60 hover:border-primary/30 transition-colors">
            <div className="font-display text-base mb-0.5">{cat.label}</div>
            <div className="text-[11px] text-muted-foreground mb-3">{cat.desc}</div>
            {votes[cat.key] ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-primary/20 border border-primary/40 rounded-lg px-3 py-2 text-sm font-semibold text-primary">{votes[cat.key]}</div>
                <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => vote(cat.key, "")}>Change</Button>
              </div>
            ) : (
              <Select onValueChange={(v) => vote(cat.key, v)}>
                <SelectTrigger className="w-full text-sm"><SelectValue placeholder="Cast your vote…"/></SelectTrigger>
                <SelectContent>
                  {cat.scope === "player" ? (
                    allPlayers.sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                      <SelectItem key={p.id} value={p.name}>
                        <span>{p.name}</span>
                        <span className="text-muted-foreground text-[10px] ml-1.5" style={{ color: teamColor(p.team, league.teams) }}>{p.team}</span>
                      </SelectItem>
                    ))
                  ) : (
                    teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD VIEW — Orange Cap, Purple Cap, SR kings, economy kings
// ─────────────────────────────────────────────────────────────────────────────
function LeaderboardView({ matches, league }: { matches: MatchRow[]; league: League }) {
  const batters = useMemo(() => topBest(matches, "runs", 10), [matches]);
  const bowlers = useMemo(() => topBest(matches, "wickets", 10), [matches]);
  const sixers  = useMemo(() => topBest(matches, "sixes", 10),   [matches]);

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ListOrdered className="w-10 h-10 text-muted-foreground/30" />
        <div className="font-display text-lg text-muted-foreground/60">No matches in this scope yet</div>
        <div className="text-xs text-muted-foreground/40">Play some matches to see the leaderboard.</div>
      </div>
    );
  }

  function LBSection({ title, emoji, color, cap, rows, valueSuffix }: {
    title: string; emoji: string; color: string; cap: string;
    rows: IndEntry[]; valueSuffix?: string;
  }) {
    const top = rows[0];
    return (
      <div className="rounded-2xl border border-border/60 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 60%)" }}>
        {/* Section header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40"
          style={{ background: `linear-gradient(90deg, ${color}18 0%, transparent 70%)` }}>
          <span className="text-3xl">{emoji}</span>
          <div>
            <div className="font-display text-lg tracking-wide">{title}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{cap}</div>
          </div>
          {top && (
            <div className="ml-auto flex items-center gap-3">
              <img src={teamLogo(top.team)} alt={top.team} className="w-8 h-8 object-contain opacity-70" />
              <div className="text-right">
                <div className="font-display text-2xl font-black" style={{ color }}>{top.value}{valueSuffix}</div>
                <div className="text-xs text-muted-foreground">{top.name}</div>
              </div>
            </div>
          )}
        </div>

        {/* Podium top 3 */}
        <div className="flex items-end gap-2 px-5 py-4">
          {[rows[1], rows[0], rows[2]].map((e, slot) => {
            if (!e) return <div key={slot} className="flex-1" />;
            const rank = slot === 1 ? 1 : slot === 0 ? 2 : 3;
            const podH = slot === 1 ? 80 : slot === 0 ? 56 : 40;
            const medal = slot === 1 ? "🥇" : slot === 0 ? "🥈" : "🥉";
            const glowC = slot === 1 ? "#facc15" : slot === 0 ? "#94a3b8" : "#b47c3c";
            const tc = teamColor(e.team, league.teams);
            return (
              <div key={slot} className="flex flex-col items-center flex-1 min-w-0">
                <img src={teamLogo(e.team)} alt={e.team} className="w-7 h-7 object-contain mb-1 opacity-80" />
                <div className="text-center w-full px-0.5 mb-1">
                  <div className="text-[11px] font-bold truncate" style={{ color: tc }}>{e.name}</div>
                  <div className="text-[9px] text-muted-foreground truncate">{e.team}</div>
                  <div className="font-black font-mono text-base" style={{ color }}>{e.value}{valueSuffix}</div>
                </div>
                <div className="w-full rounded-t-lg flex items-end justify-center pb-1 relative"
                  style={{ height: podH, background: `${glowC}18`, border: `1px solid ${glowC}30`, borderBottom: "none" }}>
                  <span className="text-base">{medal}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rest of list */}
        {rows.length > 3 && (
          <div className="border-t border-border/30">
            {rows.slice(3).map((e, i) => {
              const tc = teamColor(e.team, league.teams);
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-2 border-b border-border/20 last:border-0 hover:bg-secondary/10 transition-colors">
                  <span className="w-6 text-center text-xs text-muted-foreground/50 font-mono">{i + 4}</span>
                  <img src={teamLogo(e.team)} alt={e.team} className="w-6 h-6 object-contain opacity-60" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold" style={{ color: tc }}>{e.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{e.team}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-sm" style={{ color }}>{e.value}{valueSuffix}</div>
                    <div className="text-[9px] text-muted-foreground">{e.detail?.split("·").slice(1).join("·").trim()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
        <Info className="w-3 h-3 shrink-0" />
        Leaderboard for the selected scope — change scope above to filter by season or match.
      </div>
      <LBSection title="Orange Cap" emoji="🧡" color="hsl(30 95% 55%)" cap="Most Runs" rows={batters} />
      <LBSection title="Purple Cap" emoji="💜" color="hsl(270 70% 65%)" cap="Most Wickets" rows={bowlers} />
      <LBSection title="Six Machine" emoji="🚀" color="hsl(195 80% 55%)" cap="Most Sixes" rows={sixers} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HONOURS VIEW — Award wins, Career Clubs, Streaks, Fastest milestones
// ─────────────────────────────────────────────────────────────────────────────
function HonoursView({ matches, allMatches, league }: { matches: MatchRow[]; allMatches: MatchRow[]; league: League }) {
  const [awardWins, setAwardWins] = useState<Record<string, any[]>>({});
  const [loadingAwards, setLoadingAwards] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingAwards(true);
      const [orange, purple, mvp, boss, strike] = await Promise.all([
        computeAwardWins(league.id, "orange_cap"),
        computeAwardWins(league.id, "purple_cap"),
        computeAwardWins(league.id, "mvp"),
        computeAwardWins(league.id, "universe_boss"),
        computeAwardWins(league.id, "strike_lord"),
      ]);
      setAwardWins({ orange_cap: orange, purple_cap: purple, mvp, universe_boss: boss, strike_lord: strike });
      setLoadingAwards(false);
    })();
  }, [league.id]);

  const runs1000 = careerRunsClub(allMatches, 1000);
  const runs500  = careerRunsClub(allMatches, 500);
  const wkts50   = careerWicketsClub(allMatches, 50);
  const wkts25   = careerWicketsClub(allMatches, 25);
  const sixers50 = careerSixesClub(allMatches, 50);
  const sixers30 = careerSixesClub(allMatches, 30);
  const fifties  = mostHalfCenturies(allMatches, 10);
  const notOuts  = mostNotOuts(allMatches, 10);
  const foursL   = careerFoursLeaders(allMatches, 10);
  const streaks  = computeWinStreaks(allMatches);
  const fastest1000 = fastestToCareerRuns(allMatches, 1000, 10);
  const fastest500  = fastestToCareerRuns(allMatches, 500, 10);
  const highestRunMatch = mostRunsInAMatch(allMatches, 10);
  const captains = captainMostMatches(allMatches, 10);

  const toRowItem = (e: any, valFmt: (v: number) => string) => ({
    primary: e.name ?? e.player ?? e.team,
    secondary: e.team ? `(${e.team})` : undefined,
    secondaryColor: e.team ? teamColor(e.team, league.teams) : undefined,
    detail: e.detail ?? valFmt(e.value ?? e.count ?? 0),
  });

  const awardSections = [
    { key: "orange_cap", emoji: "🟠", title: "Most Orange Caps", desc: "Players who've won the Orange Cap (most runs in a season) most times" },
    { key: "purple_cap", emoji: "🟣", title: "Most Purple Caps", desc: "Players who've won the Purple Cap (most wickets in a season) most times" },
    { key: "mvp", emoji: "🏅", title: "Most MVP Awards", desc: "Players who've won the season MVP award most times" },
    { key: "universe_boss", emoji: "💥", title: "Most Universe Boss Titles", desc: "Players with most six-hitting crowns" },
    { key: "strike_lord", emoji: "⚡", title: "Most Strike Lord Awards", desc: "Players with best in-season strike rate — most wins" },
  ];

  return (
    <div className="space-y-8">
      {/* Award Winners */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-primary"/>
          <div className="font-display text-2xl tracking-wider">Award Honours Board</div>
        </div>
        {loadingAwards ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin"/>Loading award history…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {awardSections.map(sec => (
              <RecordCard key={sec.key} emoji={sec.emoji} title={sec.title} desc={sec.desc}
                entries={(awardWins[sec.key] ?? []).map(e => ({
                  primary: e.player,
                  detail: e.detail,
                }))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Career Clubs */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Medal className="w-5 h-5 text-primary"/>
          <div className="font-display text-2xl tracking-wider">Career Clubs & Milestones</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <RecordCard emoji="🏏" title="1000 Runs Club"
            desc="Players who've scored 1000+ career runs"
            entries={runs1000.map(e => toRowItem(e, v => `${v} runs`))}/>
          <RecordCard emoji="🥅" title="500 Runs Club"
            desc="Players who've crossed 500 career runs"
            entries={runs500.slice(0, 10).map(e => toRowItem(e, v => `${v} runs`))}/>
          <RecordCard emoji="🎳" title="50 Wickets Club"
            desc="Bowlers with 50+ career wickets"
            entries={wkts50.map(e => toRowItem(e, v => `${v} wickets`))}/>
          <RecordCard emoji="⚾" title="25 Wickets Club"
            desc="Bowlers with 25+ career wickets"
            entries={wkts25.slice(0, 10).map(e => toRowItem(e, v => `${v} wickets`))}/>
          <RecordCard emoji="💥" title="50 Sixes Club"
            desc="Batters with 50+ career sixes"
            entries={sixers50.map(e => toRowItem(e, v => `${v} sixes`))}/>
          <RecordCard emoji="🔥" title="30 Sixes Club"
            desc="Batters with 30+ career sixes"
            entries={sixers30.slice(0, 10).map(e => toRowItem(e, v => `${v} sixes`))}/>
          <RecordCard emoji="🟡" title="Most Half-Centuries"
            desc="Players with most 50+ scores (50s + 100s) in career"
            entries={fifties.map(e => toRowItem(e, v => `${v} 50+ scores`))}/>
          <RecordCard emoji="🏋️" title="Most Fours (Career)"
            desc="Batters who've hit the most fours ever"
            entries={foursL.map(e => toRowItem(e, v => `${v} fours`))}/>
          <RecordCard emoji="🛡️" title="Iron Guard — Most Not Outs"
            desc="Players who've finished not out the most times"
            entries={notOuts.map(e => toRowItem(e, v => `${v}× not out`))}/>
        </div>
      </div>

      {/* Speed Records */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-primary"/>
          <div className="font-display text-2xl tracking-wider">Fastest to Milestones</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RecordCard emoji="⚡" title="Fastest to 1000 Career Runs"
            desc="Fewest balls faced to reach 1000 career runs"
            entries={fastest1000.map(e => ({
              primary: e.name,
              secondary: `(${e.team})`,
              secondaryColor: teamColor(e.team, league.teams),
              detail: `${e.ballsFaced} balls faced · ${e.matchesPlayed} innings`,
            }))}/>
          <RecordCard emoji="🚀" title="Fastest to 500 Career Runs"
            desc="Fewest balls faced to reach 500 career runs"
            entries={fastest500.map(e => ({
              primary: e.name,
              secondary: `(${e.team})`,
              secondaryColor: teamColor(e.team, league.teams),
              detail: `${e.ballsFaced} balls faced · ${e.matchesPlayed} innings`,
            }))}/>
        </div>
      </div>

      {/* Win Streaks */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary"/>
          <div className="font-display text-2xl tracking-wider">Win & Loss Streaks</div>
        </div>
        {streaks.length === 0 ? (
          <Card className="p-10 text-center gradient-card border-border/60 text-muted-foreground text-sm">
            Play more matches to see streak records.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RecordCard emoji="🔥" title="Longest Win Streaks"
              desc="Teams with the most consecutive wins"
              entries={streaks.filter(s => s.type === "win").slice(0, 8).map((s, i) => ({
                primary: s.team,
                primaryColor: teamColor(s.team, league.teams),
                detail: `${s.streak} consecutive wins`,
              }))}/>
            <RecordCard emoji="💔" title="Longest Losing Streaks"
              desc="Teams with the most consecutive losses"
              entries={streaks.filter(s => s.type === "loss").slice(0, 8).map((s, i) => ({
                primary: s.team,
                primaryColor: teamColor(s.team, league.teams),
                detail: `${s.streak} consecutive losses`,
              }))}/>
          </div>
        )}
      </div>

      {/* Run Bonanza & Captain records */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary"/>
          <div className="font-display text-2xl tracking-wider">Match & Captaincy Records</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RecordCard emoji="🏟️" title="Highest-Scoring Matches"
            desc="Matches with the most combined runs ever"
            entries={highestRunMatch.map(e => ({
              primary: `${e.team} vs ${e.vs ?? ""}`,
              detail: e.detail ?? `${e.value} total runs`,
              season_number: e.season_number,
            }))}/>
          <RecordCard emoji="👑" title="Most Matches as Captain"
            desc="Players who've led their team the most times"
            entries={captains.map(c => ({
              primary: c.name,
              secondary: `(${c.team})`,
              secondaryColor: teamColor(c.team, league.teams),
              detail: `${c.matches} matches · ${c.wins}W · ${c.winPct}% win rate`,
            }))}/>
        </div>
      </div>
    </div>
  );
}
