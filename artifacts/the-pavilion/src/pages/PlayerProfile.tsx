import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { getPlayerCareer, type PlayerCareer } from "@/lib/playerCareer";
import { teamColor } from "@/lib/teams";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User, Trophy, Award, Star, Target, TrendingUp, TrendingDown, Minus, BarChart2, Flame } from "lucide-react";

interface SeasonLine {
  season_number: number;
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  bestScore: { runs: number; out: boolean; balls: number } | null;
  bowlInnings: number;
  wickets: number;
  bowlBalls: number;
  bowlRuns: number;
  bestBowling: { wickets: number; runs: number } | null;
}

async function getSeasonBreakdown(leagueId: string, playerId: string): Promise<SeasonLine[]> {
  const { data: seasons } = await supabase.from("seasons").select("id, season_number").eq("league_id", leagueId).order("season_number");
  const seasonMap = new Map((seasons ?? []).map(s => [s.id, s.season_number]));
  const { data: matches } = await supabase.from("matches").select("season_id, scorecard").in("season_id", (seasons ?? []).map(s => s.id)).eq("status","done");

  const lines = new Map<number, SeasonLine>();
  const matchesBySeason = new Map<number, Set<string>>();

  (matches ?? []).forEach((m: any) => {
    const sn = seasonMap.get(m.season_id); if (sn == null) return;
    const sc: any = m.scorecard; if (!sc) return;
    let found = false;
    (["innings1","innings2"] as const).forEach(ik => {
      const inn = sc[ik]; if (!inn) return;
      const bat = (inn.bat ?? {})[playerId];
      const bowl = (inn.bowl ?? {})[playerId];
      if (!bat && !bowl) return;
      found = true;
      let line = lines.get(sn);
      if (!line) {
        line = { season_number: sn, matches: 0, innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, bestScore: null, bowlInnings: 0, wickets: 0, bowlBalls: 0, bowlRuns: 0, bestBowling: null };
        lines.set(sn, line);
      }
      if (bat) {
        line.innings++;
        line.runs += bat.runs ?? 0;
        line.balls += bat.balls ?? 0;
        line.fours += bat.fours ?? 0;
        line.sixes += bat.sixes ?? 0;
        if ((bat.runs ?? 0) >= 50 && (bat.runs ?? 0) < 100) line.fifties++;
        if ((bat.runs ?? 0) >= 100) line.hundreds++;
        if (!line.bestScore || (bat.runs ?? 0) > line.bestScore.runs)
          line.bestScore = { runs: bat.runs ?? 0, out: !!bat.out, balls: bat.balls ?? 0 };
      }
      if (bowl) {
        line.bowlInnings++;
        line.wickets += bowl.wickets ?? 0;
        line.bowlBalls += bowl.balls ?? 0;
        line.bowlRuns += bowl.runs ?? 0;
        if (!line.bestBowling || (bowl.wickets ?? 0) > line.bestBowling.wickets || ((bowl.wickets ?? 0) === line.bestBowling.wickets && (bowl.runs ?? 0) < line.bestBowling.runs))
          line.bestBowling = { wickets: bowl.wickets ?? 0, runs: bowl.runs ?? 0 };
      }
    });
    if (found) {
      const s = matchesBySeason.get(sn) ?? new Set<string>();
      s.add(m.id ?? Math.random().toString());
      matchesBySeason.set(sn, s);
    }
  });
  lines.forEach((line, sn) => { line.matches = matchesBySeason.get(sn)?.size ?? 0; });
  return [...lines.values()].sort((a,b) => b.season_number - a.season_number);
}

async function getRecentForm(leagueId: string, playerId: string): Promise<Array<{
  match_number: number; season: number; team_a: string; team_b: string;
  runs?: number; balls?: number; sixes?: number; wickets?: number; wkRuns?: number; wkBalls?: number; won: boolean;
}>> {
  const { data: seasons } = await supabase.from("seasons").select("id, season_number").eq("league_id", leagueId);
  const seasonMap = new Map((seasons ?? []).map(s => [s.id, s.season_number]));
  const { data: matches } = await supabase.from("matches")
    .select("id, match_number, season_id, scorecard, winner, team_a, team_b")
    .in("season_id", (seasons ?? []).map(s => s.id))
    .eq("status","done")
    .order("match_number", { ascending: false })
    .limit(30);

  const form: ReturnType<typeof getRecentForm> extends Promise<infer T> ? T : never = [];
  for (const m of (matches ?? [])) {
    const sc: any = m.scorecard; if (!sc) continue;
    let appeared = false;
    let runs: number | undefined, balls: number | undefined, sixes: number | undefined;
    let wickets: number | undefined, wkRuns: number | undefined, wkBalls: number | undefined;
    let battingTeam = "";
    (["innings1","innings2"] as const).forEach(ik => {
      const inn = sc[ik]; if (!inn) return;
      const bat = (inn.bat ?? {})[playerId];
      const bowl = (inn.bowl ?? {})[playerId];
      if (bat) {
        appeared = true; battingTeam = inn.battingTeam;
        runs = (runs ?? 0) + (bat.runs ?? 0);
        balls = (balls ?? 0) + (bat.balls ?? 0);
        sixes = (sixes ?? 0) + (bat.sixes ?? 0);
      }
      if (bowl) {
        appeared = true;
        wickets = (wickets ?? 0) + (bowl.wickets ?? 0);
        wkRuns = (wkRuns ?? 0) + (bowl.runs ?? 0);
        wkBalls = (wkBalls ?? 0) + (bowl.balls ?? 0);
      }
    });
    if (!appeared) continue;
    const won = !!battingTeam && m.winner === battingTeam;
    form.push({ match_number: m.match_number ?? 0, season: seasonMap.get(m.season_id) ?? 0, team_a: m.team_a, team_b: m.team_b, runs, balls, sixes, wickets, wkRuns, wkBalls, won });
    if (form.length >= 10) break;
  }
  return form;
}

function formScore(f: Awaited<ReturnType<typeof getRecentForm>>[0]): { grade: "great" | "good" | "ok" | "poor"; label: string } {
  const batScore = f.runs !== undefined ? (f.runs >= 50 ? 100 : f.runs >= 30 ? 70 : f.runs >= 15 ? 45 : 15) : 0;
  const bowlScore = f.wickets !== undefined ? (f.wickets >= 3 ? 100 : f.wickets >= 2 ? 75 : f.wickets >= 1 ? 50 : 20) : 0;
  const score = Math.max(batScore, bowlScore);
  const grade = score >= 80 ? "great" : score >= 60 ? "good" : score >= 35 ? "ok" : "poor";
  const label = f.runs !== undefined && f.wickets !== undefined
    ? `${f.runs}(${f.balls ?? 0}b) & ${f.wickets}/${f.wkRuns ?? 0}`
    : f.runs !== undefined ? `${f.runs}(${f.balls ?? 0}b)` : `${f.wickets ?? 0}/${f.wkRuns ?? 0}`;
  return { grade, label };
}

export default function PlayerProfile() {
  const [league, setLeague] = useState<League | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [career, setCareer] = useState<PlayerCareer | null>(null);
  const [seasonLines, setSeasonLines] = useState<SeasonLine[]>([]);
  const [recentForm, setRecentForm] = useState<Awaited<ReturnType<typeof getRecentForm>>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { (async () => {
    const lg = await getOrCreateLeague(); setLeague(lg);
    const { data } = await supabase.from("players").select("*").eq("league_id", lg.id).order("rating", { ascending: false });
    setPlayers(data ?? []);
    if (data?.length) setSelectedId(data[0].id);
  })(); }, []);

  useEffect(() => { (async () => {
    if (!league || !selectedId) return;
    setLoading(true);
    const [c, sl, rf] = await Promise.all([
      getPlayerCareer(league.id, selectedId),
      getSeasonBreakdown(league.id, selectedId),
      getRecentForm(league.id, selectedId),
    ]);
    setCareer(c); setSeasonLines(sl); setRecentForm(rf);
    setLoading(false);
  })(); }, [league, selectedId]);

  const filtered = players.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
  const sr = career && career.balls > 0 ? ((career.runs / career.balls) * 100).toFixed(1) : "—";
  const avg = career && career.innings > 0 ? (career.runs / Math.max(1, career.innings)).toFixed(2) : "—";
  const econ = career && career.bowlBalls > 0 ? (career.bowlRuns / (career.bowlBalls / 6)).toFixed(2) : "—";
  const bowlAvg = career && career.wickets > 0 ? (career.bowlRuns / career.wickets).toFixed(2) : "—";

  const formSummary = useMemo(() => {
    if (!recentForm.length) return null;
    const scores = recentForm.map(f => formScore(f).grade);
    const greatGood = scores.filter(s => s === "great" || s === "good").length;
    if (greatGood >= 4) return { label: "In Form", color: "text-primary", icon: <Flame className="w-3.5 h-3.5 text-primary"/> };
    if (greatGood <= 1) return { label: "Out of Form", color: "text-destructive", icon: <TrendingDown className="w-3.5 h-3.5 text-destructive"/> };
    return { label: "Moderate Form", color: "text-amber-400", icon: <Minus className="w-3.5 h-3.5 text-amber-400"/> };
  }, [recentForm]);

  const selectedPlayer = players.find(p => p.id === selectedId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs tracking-[0.3em] text-primary/80">CAREER ARCHIVE</div>
        <h1 className="font-display text-4xl tracking-wider flex items-center gap-2">
          <User className="w-7 h-7 text-primary"/> Player Profile
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <Card className="p-3 gradient-card border-border/60 max-h-[680px] overflow-hidden flex flex-col">
          <Input placeholder="Search player…" value={filter} onChange={e => setFilter(e.target.value)} className="mb-2"/>
          <div className="overflow-y-auto -mr-2 pr-2 space-y-1">
            {filtered.map(p => (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-2.5 py-2 rounded-md text-sm transition-colors ${selectedId === p.id ? "bg-primary/15 text-primary" : "hover:bg-secondary/40"}`}>
                <div className="flex items-center gap-2.5">
                  {p.pfp_url && <img src={p.pfp_url} alt="" className="w-7 h-7 rounded-full bg-secondary border border-border/40 flex-shrink-0" loading="lazy"/>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{p.role}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{p.nationality} · ★{p.rating}</div>
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No matches.</div>}
          </div>
        </Card>

        <div className="space-y-4">
          {loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin w-4 h-4"/> Loading career…</div>}
          {career?.player && !loading && (
            <>
              {/* Player header card */}
              <Card className="p-5 gradient-card border-border/60 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)),transparent_60%)]"/>
                <div className="relative flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    {career.player.pfp_url && (
                      <img src={career.player.pfp_url} alt="" className="w-20 h-20 rounded-2xl border-2 border-primary/40 bg-secondary shadow-[var(--shadow-card)] flex-shrink-0"/>
                    )}
                    <div>
                      <div className="font-display text-3xl tracking-wider">{career.player.name}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <Badge variant="outline">{career.player.role}</Badge>
                        <span>{career.player.nationality}</span>
                        <span>· Rating ★{career.player.rating}</span>
                        {career.debutSeason && <Badge className="bg-primary/15 text-primary border-primary/30">Debut S{career.debutSeason}</Badge>}
                        {formSummary && (
                          <div className={`flex items-center gap-1 font-semibold ${formSummary.color}`}>
                            {formSummary.icon} {formSummary.label}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {career.teams.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Highlight label="Matches" value={career.matches} icon={<Target className="w-4 h-4"/>}/>
                <Highlight label="Best Score" value={career.bestScore ? `${career.bestScore.runs}${career.bestScore.out ? "" : "*"}` : "—"} sub={career.bestScore ? `(${career.bestScore.balls}b · S${career.bestScore.season})` : ""} icon={<Star className="w-4 h-4 text-primary"/>}/>
                <Highlight label="Best Bowling" value={career.bestBowling ? `${career.bestBowling.wickets}/${career.bestBowling.runs}` : "—"} sub={career.bestBowling ? `S${career.bestBowling.season}` : ""} icon={<Trophy className="w-4 h-4 text-accent"/>}/>
                <Highlight label="Awards" value={career.awards.length} icon={<Award className="w-4 h-4 text-primary"/>}/>
              </div>

              <Tabs defaultValue="career" className="w-full">
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value="career">📋 Career</TabsTrigger>
                  <TabsTrigger value="seasons">📅 By Season</TabsTrigger>
                  <TabsTrigger value="form">🔥 Form</TabsTrigger>
                  {career.awards.length > 0 && <TabsTrigger value="trophies">🏆 Trophies</TabsTrigger>}
                </TabsList>

                {/* --- Career tab --- */}
                <TabsContent value="career" className="space-y-3 mt-3">
                  <Card className="p-5 gradient-card border-border/60">
                    <div className="font-display tracking-wider text-sm mb-3 text-[hsl(var(--boundary))]">BATTING CAREER</div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center text-xs">
                      <Stat k="Innings" v={career.innings}/>
                      <Stat k="Runs" v={career.runs}/>
                      <Stat k="Avg" v={avg}/>
                      <Stat k="SR" v={sr}/>
                      <Stat k="50s / 100s" v={`${career.fifties} / ${career.hundreds}`}/>
                      <Stat k="4s / 6s" v={`${career.fours} / ${career.sixes}`}/>
                    </div>
                  </Card>
                  <Card className="p-5 gradient-card border-border/60">
                    <div className="font-display tracking-wider text-sm mb-3 text-[hsl(var(--six))]">BOWLING CAREER</div>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center text-xs">
                      <Stat k="Innings" v={career.bowlInnings}/>
                      <Stat k="Wickets" v={career.wickets}/>
                      <Stat k="Avg" v={bowlAvg}/>
                      <Stat k="Econ" v={econ}/>
                      <Stat k="3W Hauls" v={career.threeFers}/>
                      <Stat k="Runs Conceded" v={career.bowlRuns}/>
                    </div>
                  </Card>
                  {Object.keys(career.byTeam).length > 0 && (
                    <Card className="p-5 gradient-card border-border/60">
                      <div className="font-display tracking-wider text-sm mb-3 text-muted-foreground">BY TEAM</div>
                      <div className="space-y-2">
                        {Object.entries(career.byTeam).map(([team, s]) => (
                          <div key={team} className="flex items-center justify-between text-sm p-2 rounded-lg bg-secondary/20">
                            <span className="font-display tracking-wider" style={{ color: league ? teamColor(team, league.teams) : undefined }}>{team}</span>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{s.runs} runs</span>
                              <span>{s.wickets} wkts</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </TabsContent>

                {/* --- Season by Season tab --- */}
                <TabsContent value="seasons" className="mt-3">
                  {seasonLines.length === 0 ? (
                    <Card className="p-12 text-center gradient-card border-border/60 text-muted-foreground text-sm">No season data yet.</Card>
                  ) : (
                    <div className="space-y-3">
                      {seasonLines.map(sl => {
                        const bsr = sl.balls > 0 ? ((sl.runs / sl.balls) * 100).toFixed(1) : "—";
                        const bAvg = sl.innings > 0 ? (sl.runs / sl.innings).toFixed(1) : "—";
                        const bwlEcon = sl.bowlBalls > 0 ? ((sl.bowlRuns / sl.bowlBalls) * 6).toFixed(2) : "—";
                        const bwlAvg = sl.wickets > 0 ? (sl.bowlRuns / sl.wickets).toFixed(1) : "—";
                        return (
                          <Card key={sl.season_number} className="p-4 gradient-card border-border/60">
                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                              <div className="font-display text-xl tracking-wider">Season {sl.season_number}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{sl.matches} match{sl.matches !== 1 ? "es" : ""}</span>
                                {sl.hundreds > 0 && <Badge className="text-[9px] bg-primary/20 text-primary">{sl.hundreds}×100</Badge>}
                                {sl.fifties > 0 && <Badge className="text-[9px] bg-secondary">{sl.fifties}×50</Badge>}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {sl.innings > 0 && (
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Batting</div>
                                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                    <Stat k="Inn" v={sl.innings}/>
                                    <Stat k="Runs" v={sl.runs}/>
                                    <Stat k="Avg" v={bAvg}/>
                                    <Stat k="SR" v={bsr}/>
                                  </div>
                                  {sl.bestScore && (
                                    <div className="text-[10px] text-muted-foreground mt-1">
                                      Best: <span className="text-primary font-semibold">{sl.bestScore.runs}{sl.bestScore.out ? "" : "*"}</span> ({sl.bestScore.balls}b) · {sl.sixes}×6 · {sl.fours}×4
                                    </div>
                                  )}
                                </div>
                              )}
                              {sl.bowlInnings > 0 && (
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bowling</div>
                                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                    <Stat k="Inn" v={sl.bowlInnings}/>
                                    <Stat k="Wkts" v={sl.wickets}/>
                                    <Stat k="Avg" v={bwlAvg}/>
                                    <Stat k="Econ" v={bwlEcon}/>
                                  </div>
                                  {sl.bestBowling && (
                                    <div className="text-[10px] text-muted-foreground mt-1">
                                      Best: <span className="text-red-400 font-semibold">{sl.bestBowling.wickets}/{sl.bestBowling.runs}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* --- Form tab --- */}
                <TabsContent value="form" className="mt-3">
                  {recentForm.length === 0 ? (
                    <Card className="p-12 text-center gradient-card border-border/60 text-muted-foreground text-sm">No recent form data.</Card>
                  ) : (
                    <div className="space-y-3">
                      {/* Sparkline chart */}
                      <Card className="p-5 gradient-card border-border/60 overflow-hidden">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Form Trend — Last {recentForm.length} Appearances</div>
                        <div className="text-[9px] text-muted-foreground/60 mb-4">← oldest · most recent →</div>
                        {(() => {
                          const scores = [...recentForm].reverse().map(f => {
                            const s = formScore(f);
                            return s.grade === "great" ? 100 : s.grade === "good" ? 70 : s.grade === "ok" ? 40 : 15;
                          });
                          const W = 400, H = 80, pad = 16;
                          const n = scores.length;
                          const xStep = n > 1 ? (W - pad * 2) / (n - 1) : (W - pad * 2);
                          const points = scores.map((v, i) => ({
                            x: pad + i * xStep,
                            y: pad + (1 - v / 100) * (H - pad * 2),
                          }));
                          const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                          const areaD = `${lineD} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;
                          const colorMap: Record<string, string> = { great: "#a78bfa", good: "#34d399", ok: "#fbbf24", poor: "#f87171" };
                          const gradeMap = (v: number) => v >= 80 ? "great" : v >= 60 ? "good" : v >= 30 ? "ok" : "poor";
                          return (
                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }}>
                              <defs>
                                <linearGradient id="formGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
                                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              {/* Grid lines */}
                              {[100, 70, 40, 15].map(v => {
                                const y = pad + (1 - v / 100) * (H - pad * 2);
                                return <line key={v} x1={pad} y1={y} x2={W - pad} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />;
                              })}
                              {/* Area fill */}
                              <path d={areaD} fill="url(#formGrad)" />
                              {/* Line */}
                              <path d={lineD} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              {/* Points */}
                              {points.map((pt, i) => {
                                const v = scores[i];
                                const col = colorMap[gradeMap(v)];
                                return (
                                  <g key={i}>
                                    <circle cx={pt.x} cy={pt.y} r={5} fill={col} stroke="rgba(0,0,0,0.5)" strokeWidth={1.5} />
                                  </g>
                                );
                              })}
                            </svg>
                          );
                        })()}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-3 text-[9px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#a78bfa] inline-block"/>Outstanding</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#34d399] inline-block"/>Good</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#fbbf24] inline-block"/>Average</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f87171] inline-block"/>Poor</span>
                          </div>
                        </div>
                      </Card>

                      {/* Performance bars */}
                      <Card className="p-4 gradient-card border-border/60">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Match-by-Match Performance</div>
                        <div className="flex items-end gap-2 flex-wrap mb-4">
                          {recentForm.map((f, i) => {
                            const { grade } = formScore(f);
                            const heightMap = { great: "h-10", good: "h-7", ok: "h-4", poor: "h-2" };
                            const colors = { great: "bg-[#a78bfa] shadow-[0_0_8px_rgba(167,139,250,0.5)]", good: "bg-[#34d399]", ok: "bg-[#fbbf24]", poor: "bg-[#f87171]" };
                            return (
                              <div key={i} className="flex flex-col items-center gap-1" title={`S${f.season} M${f.match_number}: ${formScore(f).label}`}>
                                <div className={`w-4 rounded-t-sm transition-all cursor-default ${heightMap[grade]} ${colors[grade]}`}/>
                                <div className="text-[8px] text-muted-foreground/50 font-mono">{i + 1}</div>
                              </div>
                            );
                          })}
                          <div className="text-xs text-muted-foreground ml-2 self-end pb-4">← most recent</div>
                        </div>
                      </Card>

                      <div className="space-y-2">
                        {recentForm.map((f, i) => {
                          const { grade, label } = formScore(f);
                          const colors = { great: "border-primary/50 bg-primary/5", good: "border-green-500/40 bg-green-500/5", ok: "border-amber-400/40 bg-amber-400/5", poor: "border-destructive/40 bg-destructive/5" };
                          const dotColors = { great: "bg-primary", good: "bg-green-500", ok: "bg-amber-400", poor: "bg-destructive" };
                          return (
                            <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm ${colors[grade]}`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColors[grade]}`}/>
                                <div>
                                  <span className="text-[10px] text-muted-foreground">S{f.season} · M{f.match_number} · </span>
                                  <span className="font-display">{f.team_a} <span className="text-muted-foreground text-[10px]">vs</span> {f.team_b}</span>
                                </div>
                              </div>
                              <div className="font-mono text-sm font-semibold">{label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* --- Trophies tab --- */}
                {career.awards.length > 0 && (
                  <TabsContent value="trophies" className="mt-3">
                    <Card className="p-5 gradient-card border-border/60">
                      <div className="flex flex-wrap gap-2">
                        {career.awards.map((a, i) => (
                          <div key={i} className="px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-xs">
                            🏆 {a.award} <span className="text-muted-foreground ml-1">S{a.season}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </TabsContent>
                )}
              </Tabs>
            </>
          )}
          {!career && !loading && <Card className="p-12 text-center gradient-card border-border/60 text-muted-foreground">Pick a player to see their career.</Card>}
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: any }) {
  return <div className="bg-secondary/30 rounded p-2"><div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div><div className="font-display text-lg">{v}</div></div>;
}
function Highlight({ label, value, sub, icon }: { label: string; value: any; sub?: string; icon?: any }) {
  return (
    <Card className="p-4 gradient-card border-border/60">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>{icon}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}
