import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Flame, Target, Shield, Trophy, Sparkles } from "lucide-react";

interface AggBat { player_id: string; name: string; team_id?: string; runs: number; balls: number; fours: number; sixes: number; outs: number; matches: Set<string>; hs: number; fifties: number; thirties: number; ducks: number; }
interface AggBowl { player_id: string; name: string; team_id?: string; runs: number; balls: number; wickets: number; matches: Set<string>; bbWkts: number; bbRuns: number; dots: number; threeFers: number; }
interface AggTeam { team_id: string; played: number; won: number; lost: number; for: number; against: number; sixes: number; fours: number; }

export default function Stats() {
  const [bat, setBat] = useState<AggBat[]>([]);
  const [bowl, setBowl] = useState<AggBowl[]>([]);
  const [teamAgg, setTeamAgg] = useState<AggTeam[]>([]);
  const [trophies, setTrophies] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBat, setSortBat] = useState<"runs"|"sr"|"sixes"|"hs"|"avg">("runs");
  const [sortBowl, setSortBowl] = useState<"wickets"|"econ"|"bb"|"dots">("wickets");

  useEffect(() => { (async () => {
    const lg = await getOrCreateLeague();
    setTeams(lg.teams);
    const [{ data: ss }, { data: tr }] = await Promise.all([
      supabase.from("seasons").select("*").eq("league_id", lg.id).order("season_number"),
      supabase.from("trophies").select("*").eq("league_id", lg.id).order("season_number", { ascending: false }),
    ]);
    setSeasons(ss ?? []);
    setTrophies(tr ?? []);
    const seasonIds = (ss ?? []).map(s => s.id);
    if (seasonIds.length === 0) { setLoading(false); return; }
    const { data: matches } = await supabase.from("matches").select("*").in("season_id", seasonIds).eq("status","done");
    const batMap = new Map<string, AggBat>();
    const bowlMap = new Map<string, AggBowl>();
    const teamMap = new Map<string, AggTeam>();
    (matches ?? []).forEach((m: any) => {
      const sc = m.scorecard; if (!sc) return;
      [m.team_a, m.team_b].forEach(tid => {
        const t = teamMap.get(tid) ?? { team_id: tid, played: 0, won: 0, lost: 0, for: 0, against: 0, sixes: 0, fours: 0 };
        t.played += 1;
        if (m.winner === tid) t.won += 1; else if (m.winner) t.lost += 1;
        teamMap.set(tid, t);
      });
      ["innings1","innings2"].forEach(ik => {
        const inn = sc[ik]; if (!inn) return;
        const battingT = teamMap.get(inn.battingTeam)!;
        const bowlingT = teamMap.get(inn.bowlingTeam)!;
        battingT.for += inn.runs; bowlingT.against += inn.runs;
        Object.values(inn.bat as Record<string, any>).forEach((b: any) => {
          const cur = batMap.get(b.player_id) ?? { player_id: b.player_id, name: b.name, team_id: inn.battingTeam, runs:0, balls:0, fours:0, sixes:0, outs:0, matches: new Set(), hs:0, fifties:0, thirties:0, ducks:0 };
          cur.runs += b.runs; cur.balls += b.balls; cur.fours += b.fours; cur.sixes += b.sixes;
          if (b.out) cur.outs += 1;
          cur.matches.add(m.id); cur.team_id = inn.battingTeam;
          if (b.runs > cur.hs) cur.hs = b.runs;
          if (b.runs >= 50) cur.fifties += 1;
          else if (b.runs >= 30) cur.thirties += 1;
          if (b.runs === 0 && b.out && b.balls > 0) cur.ducks += 1;
          batMap.set(b.player_id, cur);
          battingT.fours += b.fours; battingT.sixes += b.sixes;
        });
        Object.values(inn.bowl as Record<string, any>).forEach((b: any) => {
          const cur = bowlMap.get(b.player_id) ?? { player_id: b.player_id, name: b.name, team_id: inn.bowlingTeam, runs:0, balls:0, wickets:0, matches: new Set(), bbWkts:0, bbRuns:999, dots: b.dots ?? 0, threeFers: 0 };
          cur.runs += b.runs; cur.balls += b.balls; cur.wickets += b.wickets;
          cur.matches.add(m.id); cur.team_id = inn.bowlingTeam;
          if (b.wickets > cur.bbWkts || (b.wickets === cur.bbWkts && b.runs < cur.bbRuns)) { cur.bbWkts = b.wickets; cur.bbRuns = b.runs; }
          if (b.wickets >= 3) cur.threeFers += 1;
          bowlMap.set(b.player_id, cur);
        });
      });
    });
    setBat([...batMap.values()]);
    setBowl([...bowlMap.values()]);
    setTeamAgg([...teamMap.values()]);
    setLoading(false);
  })(); }, []);

  const sortedBat = useMemo(() => {
    return [...bat].sort((a,b) => {
      if (sortBat === "runs") return b.runs - a.runs;
      if (sortBat === "sr") return (b.balls?b.runs/b.balls:0) - (a.balls?a.runs/a.balls:0);
      if (sortBat === "sixes") return b.sixes - a.sixes;
      if (sortBat === "hs") return b.hs - a.hs;
      if (sortBat === "avg") return (b.outs?b.runs/b.outs:b.runs) - (a.outs?a.runs/a.outs:a.runs);
      return 0;
    });
  }, [bat, sortBat]);

  const sortedBowl = useMemo(() => {
    return [...bowl].sort((a,b) => {
      if (sortBowl === "wickets") return b.wickets - a.wickets || a.runs - b.runs;
      if (sortBowl === "econ") return (a.balls?a.runs/a.balls:99) - (b.balls?b.runs/b.balls:99);
      if (sortBowl === "bb") return (b.bbWkts*100 - b.bbRuns) - (a.bbWkts*100 - a.bbRuns);
      if (sortBowl === "dots") return (b.dots ?? 0) - (a.dots ?? 0);
      return 0;
    });
  }, [bowl, sortBowl]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  const orange = sortedBat[0]; const purple = [...bowl].sort((a,b) => b.wickets - a.wickets || a.runs - b.runs)[0];
  const sixKing = [...bat].sort((a,b) => b.sixes - a.sixes)[0];
  const totalMatches = teamAgg.reduce((s,t) => s + t.played, 0) / 2;
  const totalSixes = bat.reduce((s,b) => s + b.sixes, 0);
  const totalFours = bat.reduce((s,b) => s + b.fours, 0);
  const totalRuns = bat.reduce((s,b) => s + b.runs, 0);
  const totalWkts = bowl.reduce((s,b) => s + b.wickets, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-primary/80">ALL TIME · {seasons.length} SEASONS</div>
          <h1 className="font-display text-4xl tracking-wider">Statistics Vault</h1>
        </div>
      </div>

      {/* Hero metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <HeroStat icon={<Flame className="w-4 h-4"/>} label="Matches" value={totalMatches}/>
        <HeroStat icon={<Target className="w-4 h-4"/>} label="Total Runs" value={totalRuns}/>
        <HeroStat icon={<Shield className="w-4 h-4"/>} label="Wickets" value={totalWkts}/>
        <HeroStat icon={<Sparkles className="w-4 h-4"/>} label="Sixes" value={totalSixes} accent="six"/>
        <HeroStat icon={<Sparkles className="w-4 h-4"/>} label="Fours" value={totalFours} accent="boundary"/>
      </div>

      {/* Cap holders banner */}
      {(orange || purple) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {orange && <CapBanner kind="orange" name={orange.name} value={`${orange.runs} runs`} team={orange.team_id} teams={teams}/>}
          {purple && <CapBanner kind="purple" name={purple.name} value={`${purple.wickets} wkts`} team={purple.team_id} teams={teams}/>}
          {sixKing && sixKing.sixes > 0 && <CapBanner kind="six" name={sixKing.name} value={`${sixKing.sixes} sixes`} team={sixKing.team_id} teams={teams}/>}
        </div>
      )}

      <Tabs defaultValue="bat">
        <TabsList className="bg-secondary/40">
          <TabsTrigger value="bat">🏏 Batting</TabsTrigger>
          <TabsTrigger value="bowl">🎯 Bowling</TabsTrigger>
          <TabsTrigger value="teams">🛡️ Teams</TabsTrigger>
          <TabsTrigger value="trophies">🏆 Trophy Cabinet</TabsTrigger>
          <TabsTrigger value="milestones">✨ Milestones</TabsTrigger>
        </TabsList>

        {/* BATTING */}
        <TabsContent value="bat" className="mt-4">
          <Card className="gradient-card border-border/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between flex-wrap gap-2">
              <div className="font-display text-lg">🟠 Batting Leaderboard</div>
              <div className="flex gap-1">
                {(["runs","sr","sixes","hs","avg"] as const).map(s => (
                  <button key={s} onClick={() => setSortBat(s)} className={`text-[10px] px-2 py-1 rounded uppercase tracking-widest ${sortBat===s?"bg-primary text-primary-foreground":"bg-secondary/40 text-muted-foreground"}`}>{s}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
                  <tr>
                    <th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Player</th>
                    <th className="text-right px-2 py-2">M</th><th className="text-right px-2 py-2">R</th>
                    <th className="text-right px-2 py-2">HS</th><th className="text-right px-2 py-2">Avg</th>
                    <th className="text-right px-2 py-2">SR</th><th className="text-right px-2 py-2">4s</th>
                    <th className="text-right px-2 py-2">6s</th><th className="text-right px-2 py-2">50s</th>
                    <th className="text-right px-3 py-2">Ducks</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBat.slice(0,30).map((b,i) => (
                    <tr key={b.player_id} className="border-t border-border/30 hover:bg-secondary/20">
                      <td className="px-3 py-1.5 text-muted-foreground">{i+1}</td>
                      <td className="px-3 py-1.5">{b.name} <span className="text-[10px]" style={{color: teamColor(b.team_id ?? "", teams)}}>{b.team_id}</span></td>
                      <td className="text-right px-2 py-1.5 font-mono">{b.matches.size}</td>
                      <td className="text-right px-2 py-1.5 font-mono font-bold text-primary">{b.runs}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{b.hs}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{b.outs ? (b.runs/b.outs).toFixed(1) : b.runs.toFixed(1)}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : "—"}</td>
                      <td className="text-right px-2 py-1.5 font-mono text-[hsl(var(--boundary))]">{b.fours}</td>
                      <td className="text-right px-2 py-1.5 font-mono text-[hsl(var(--six))]">{b.sixes}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{b.fifties}</td>
                      <td className="text-right px-3 py-1.5 font-mono text-destructive/80">{b.ducks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* BOWLING */}
        <TabsContent value="bowl" className="mt-4">
          <Card className="gradient-card border-border/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between flex-wrap gap-2">
              <div className="font-display text-lg">🟣 Bowling Leaderboard</div>
              <div className="flex gap-1">
                {(["wickets","econ","bb","dots"] as const).map(s => (
                  <button key={s} onClick={() => setSortBowl(s)} className={`text-[10px] px-2 py-1 rounded uppercase tracking-widest ${sortBowl===s?"bg-primary text-primary-foreground":"bg-secondary/40 text-muted-foreground"}`}>{s}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
                  <tr>
                    <th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Bowler</th>
                    <th className="text-right px-2 py-2">M</th><th className="text-right px-2 py-2">W</th>
                    <th className="text-right px-2 py-2">R</th><th className="text-right px-2 py-2">Econ</th>
                    <th className="text-right px-2 py-2">Avg</th><th className="text-right px-2 py-2">BB</th>
                    <th className="text-right px-3 py-2">3W+</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBowl.slice(0,30).map((b,i) => (
                    <tr key={b.player_id} className="border-t border-border/30 hover:bg-secondary/20">
                      <td className="px-3 py-1.5 text-muted-foreground">{i+1}</td>
                      <td className="px-3 py-1.5">{b.name} <span className="text-[10px]" style={{color: teamColor(b.team_id ?? "", teams)}}>{b.team_id}</span></td>
                      <td className="text-right px-2 py-1.5 font-mono">{b.matches.size}</td>
                      <td className="text-right px-2 py-1.5 font-mono font-bold" style={{color:"hsl(var(--six))"}}>{b.wickets}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{b.runs}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{b.balls > 0 ? ((b.runs/b.balls)*6).toFixed(2) : "—"}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{b.wickets ? (b.runs/b.wickets).toFixed(1) : "—"}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{b.bbWkts ? `${b.bbWkts}/${b.bbRuns}` : "—"}</td>
                      <td className="text-right px-3 py-1.5 font-mono">{b.threeFers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TEAMS */}
        <TabsContent value="teams" className="mt-4">
          <Card className="gradient-card border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
                  <tr>
                    <th className="text-left px-3 py-2">Team</th>
                    <th className="text-right px-2 py-2">P</th><th className="text-right px-2 py-2">W</th><th className="text-right px-2 py-2">L</th>
                    <th className="text-right px-2 py-2">Win%</th>
                    <th className="text-right px-2 py-2">For</th><th className="text-right px-2 py-2">Against</th>
                    <th className="text-right px-2 py-2">4s</th><th className="text-right px-3 py-2">6s</th>
                  </tr>
                </thead>
                <tbody>
                  {[...teamAgg].sort((a,b) => b.won - a.won).map(t => (
                    <tr key={t.team_id} className="border-t border-border/30 hover:bg-secondary/20">
                      <td className="px-3 py-1.5 font-display tracking-wider" style={{color: teamColor(t.team_id, teams)}}>{t.team_id}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{t.played}</td>
                      <td className="text-right px-2 py-1.5 font-mono text-[hsl(var(--boundary))]">{t.won}</td>
                      <td className="text-right px-2 py-1.5 font-mono text-destructive/80">{t.lost}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{t.played ? ((t.won/t.played)*100).toFixed(0) : "—"}%</td>
                      <td className="text-right px-2 py-1.5 font-mono">{t.for}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{t.against}</td>
                      <td className="text-right px-2 py-1.5 font-mono text-[hsl(var(--boundary))]">{t.fours}</td>
                      <td className="text-right px-3 py-1.5 font-mono text-[hsl(var(--six))]">{t.sixes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TROPHIES */}
        <TabsContent value="trophies" className="mt-4 space-y-3">
          {trophies.length === 0 ? (
            <Card className="p-12 text-center gradient-card border-border/60 text-muted-foreground">
              <Trophy className="w-10 h-10 mx-auto mb-2 text-primary/60"/>
              No trophies awarded yet. Win a final to lift the cup.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {trophies.map(t => (
                <Card key={t.id} className="p-4 gradient-card border-border/60 flex items-center gap-3">
                  <div className="text-3xl">{t.award === "champion" ? "🏆" : t.award === "runnerup" ? "🥈" : t.award === "orange_cap" ? "🟠" : t.award === "purple_cap" ? "🟣" : "⭐"}</div>
                  <div className="flex-1">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Season {t.season_number} · {t.award.replace("_"," ")}</div>
                    <div className="font-display text-lg">{t.player_name ?? t.team_id}</div>
                    {t.value != null && <div className="text-xs text-primary">{t.value}</div>}
                  </div>
                  {t.team_id && <Badge variant="outline" style={{borderColor: teamColor(t.team_id, teams), color: teamColor(t.team_id, teams)}}>{t.team_id}</Badge>}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* MILESTONES */}
        <TabsContent value="milestones" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <MilestoneCard title="Players to score 50+" emoji="🔥" list={bat.filter(b => b.fifties > 0).sort((a,b)=>b.fifties-a.fifties).slice(0,8).map(b => `${b.name} — ${b.fifties}`)}/>
            <MilestoneCard title="Six-hitters club" emoji="💥" list={[...bat].filter(b=>b.sixes>0).sort((a,b)=>b.sixes-a.sixes).slice(0,8).map(b => `${b.name} — ${b.sixes}`)}/>
            <MilestoneCard title="3-wicket hauls" emoji="🎯" list={bowl.filter(b=>b.threeFers>0).sort((a,b)=>b.threeFers-a.threeFers).slice(0,8).map(b => `${b.name} — ${b.threeFers}`)}/>
            <MilestoneCard title="Most ducks (boo)" emoji="🦆" list={bat.filter(b=>b.ducks>0).sort((a,b)=>b.ducks-a.ducks).slice(0,8).map(b => `${b.name} — ${b.ducks}`)}/>
            <MilestoneCard title="Highest team totals" emoji="🛡️" list={[...teamAgg].sort((a,b)=>b.for-a.for).slice(0,8).map(t => `${t.team_id} — ${t.for} runs`)}/>
            <MilestoneCard title="Most matches won" emoji="🏅" list={[...teamAgg].sort((a,b)=>b.won-a.won).slice(0,8).map(t => `${t.team_id} — ${t.won} W`)}/>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HeroStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: any; accent?: string }) {
  return (
    <Card className="p-4 gradient-card border-border/60">
      <div className="flex items-center gap-2 text-muted-foreground text-[10px] uppercase tracking-widest">{icon}{label}</div>
      <div className={`font-display text-3xl mt-1 ${accent === "six" ? "text-[hsl(var(--six))]" : accent === "boundary" ? "text-[hsl(var(--boundary))]" : "text-primary"}`}>{value}</div>
    </Card>
  );
}

function CapBanner({ kind, name, value, team, teams }: any) {
  const colors = kind === "orange" ? "from-orange-500/30 to-amber-500/10" : kind === "purple" ? "from-purple-500/30 to-fuchsia-500/10" : "from-pink-500/30 to-rose-500/10";
  const emoji = kind === "orange" ? "🟠" : kind === "purple" ? "🟣" : "💥";
  const title = kind === "orange" ? "Orange Cap" : kind === "purple" ? "Purple Cap" : "Six Machine";
  return (
    <Card className={`p-4 border-border/60 bg-gradient-to-br ${colors}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{emoji} {title}</div>
          <div className="font-display text-2xl mt-1">{name}</div>
          <div className="text-xs text-primary">{value}</div>
        </div>
        {team && <Badge variant="outline" style={{borderColor: teamColor(team, teams), color: teamColor(team, teams)}}>{team}</Badge>}
      </div>
    </Card>
  );
}

function MilestoneCard({ title, emoji, list }: { title: string; emoji: string; list: string[] }) {
  return (
    <Card className="p-4 gradient-card border-border/60">
      <div className="flex items-center gap-2 mb-2"><span className="text-xl">{emoji}</span><div className="font-display">{title}</div></div>
      {list.length === 0 ? <div className="text-xs text-muted-foreground">No entries yet.</div> : (
        <ul className="space-y-1">{list.map((l,i) => <li key={i} className="text-xs flex justify-between border-b border-border/20 pb-1"><span>{l.split(" — ")[0]}</span><span className="font-mono text-primary">{l.split(" — ")[1]}</span></li>)}</ul>
      )}
    </Card>
  );
}
