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
  TrendingUp, Users, Heart, Target, Zap, Shield, Activity
} from "lucide-react";

type Scope = "all" | "season" | "match";
type SubTab = "team" | "individual" | "milestones" | "overall" | "captaincy" | "h2h" | "advanced" | "phase" | "chase" | "playerdeep" | "seasonbests" | "fanvote";

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
  const [tab, setTab] = useState<SubTab>("overall");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)} className="mt-2">
      <div className="overflow-x-auto pb-1">
        <TabsList className="bg-secondary/30 h-auto flex-nowrap min-w-max">
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

function RecordCard({ title, desc, emoji, entries }: { title: string; desc: string; emoji: string; entries: RowItem[] }) {
  return (
    <Card className="p-4 gradient-card border-border/60 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-2.5 mb-3">
        <span className="text-2xl leading-none">{emoji}</span>
        <div className="flex-1">
          <div className="font-display text-base leading-tight">{title}</div>
          <div className="text-[10px] text-muted-foreground italic mt-0.5">{desc}</div>
        </div>
      </div>
      <div className="space-y-1">
        {entries.length === 0 && <div className="text-xs text-muted-foreground italic py-3 text-center">No entries yet.</div>}
        {entries.map((r, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs py-1.5 px-2.5 rounded-md ${i === 0 ? "bg-primary/10 border border-primary/20" : "bg-secondary/20"}`}>
            <span className={`w-5 text-center font-bold shrink-0 ${i === 0 ? "text-primary" : i === 1 ? "text-muted-foreground" : i === 2 ? "text-amber-600/70" : "text-muted-foreground/50"}`}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold truncate" style={r.primaryColor ? { color: r.primaryColor } : undefined}>{r.primary}</span>
                {r.secondary && <span className="text-[10px] text-muted-foreground truncate" style={r.secondaryColor ? { color: r.secondaryColor } : undefined}>{r.secondary}</span>}
              </div>
              <div className="text-[10px] text-muted-foreground truncate mt-0.5">{r.detail}</div>
            </div>
            {r.season_number != null && <span className="text-[9px] text-muted-foreground shrink-0 bg-secondary/50 px-1 rounded">S{r.season_number}</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function teamRow(t: TeamEntry, league: League): RowItem {
  return { primary: t.team, primaryColor: teamColor(t.team, league.teams), secondary: t.vs ? `vs ${t.vs}` : "", detail: t.detail, season_number: t.season_number };
}
function indRow(e: IndEntry, league: League): RowItem {
  return { primary: e.name, secondary: e.team, secondaryColor: teamColor(e.team, league.teams), detail: e.detail, season_number: e.season_number };
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
              <th className="text-center px-2 py-2.5">PO</th>
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
        PO = Playoff Appearances · Hover Hi/Lo for context
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
