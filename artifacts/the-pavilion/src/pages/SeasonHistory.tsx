// Season History — drill-down by season showing standings, awards, top performers
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trophy, Crown, Calendar, Shirt, TrendingUp } from "lucide-react";
import { AWARD_META, type AwardKey } from "@/lib/awards";
import { JerseyCard } from "@/components/JerseyCard";

interface SeasonSummary {
  id: string; season_number: number; year: number; status: string;
  champion_team_id: string | null;
  auction_type?: string;
}

interface Trophy { award: string; player_name?: string; team_id?: string; value?: number; }

export default function SeasonHistory() {
  const [league, setLeague] = useState<League | null>(null);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [trophies, setTrophies] = useState<Record<number, Trophy[]>>({});
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeSeason, setActiveSeason] = useState<number | null>(null);
  const [seasonStats, setSeasonStats] = useState<any | null>(null);
  const [allTimeTeamStats, setAllTimeTeamStats] = useState<Record<string, Record<number, { W: number; L: number; P: number; runsFor: number; champion: boolean; runnerUp: boolean }>>>({});
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const tcolor = (id: string) => teamColor(id, league?.teams);

  useEffect(() => {
    (async () => {
      const lg = await getOrCreateLeague();
      setLeague(lg);
      const { data: s } = await supabase.from("seasons").select("*").eq("league_id", lg.id).order("season_number", { ascending: false });
      setSeasons((s ?? []) as any);
      if (s && s.length) {
        const { data: tr } = await supabase.from("trophies").select("*").eq("league_id", lg.id);
        const map: Record<number, Trophy[]> = {};
        (tr ?? []).forEach((t: any) => { (map[t.season_number] ??= []).push(t); });
        setTrophies(map);
        // match counts
        const counts: Record<string, number> = {};
        for (const sn of s) {
          const { count } = await supabase.from("matches").select("*", { count: "exact", head: true }).eq("season_id", sn.id).eq("status", "done");
          counts[sn.id] = count ?? 0;
        }
        setMatchCounts(counts);
        // Auto-select latest done season or the most recent
        const target = (s.find((x: any) => x.status === "done") ?? s[0]) as any;
        setActiveSeason(target.season_number);

        // Load all-time team stats across all seasons
        const { data: allMatches } = await supabase
          .from("matches").select("season_id, team_a, team_b, winner")
          .eq("league_id", lg.id).eq("status", "done");
        const seasonNumMap = new Map((s ?? []).map((sn: any) => [sn.id, sn.season_number]));
        const champions = new Set((tr ?? []).filter((t: any) => t.award === "champion").map((t: any) => `${t.season_number}:${t.team_id}`));
        const runnerUps = new Set((tr ?? []).filter((t: any) => t.award === "runnerup").map((t: any) => `${t.season_number}:${t.team_id}`));
        const atts: Record<string, Record<number, { W: number; L: number; P: number; runsFor: number; champion: boolean; runnerUp: boolean }>> = {};
        (allMatches ?? []).forEach((m: any) => {
          const sn = seasonNumMap.get(m.season_id); if (sn == null) return;
          [m.team_a, m.team_b].forEach(team => {
            const rec = (atts[team] ??= {})[sn] ??= { W: 0, L: 0, P: 0, runsFor: 0, champion: champions.has(`${sn}:${team}`), runnerUp: runnerUps.has(`${sn}:${team}`) };
            rec.P++;
            if (m.winner === team) rec.W++; else if (m.winner) rec.L++;
          });
        });
        setAllTimeTeamStats(atts);
        if (lg.teams?.length) setSelectedTeam(lg.teams[0].id);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (activeSeason == null || !league) return;
    (async () => {
      const sn = seasons.find(x => x.season_number === activeSeason);
      if (!sn) return;
      const { data: matches } = await supabase.from("matches").select("scorecard, winner, team_a, team_b, stage, match_number, result_text").eq("season_id", sn.id).eq("status", "done").order("match_number");
      const teamStats: Record<string, { P: number; W: number; L: number; runsFor: number; runsAg: number }> = {};
      const batMap = new Map<string, { name: string; team: string; runs: number; balls: number; sixes: number; fours: number }>();
      const bowlMap = new Map<string, { name: string; team: string; wkts: number; runs: number; balls: number }>();
      (matches ?? []).forEach((m: any) => {
        const sc = m.scorecard; if (!sc) return;
        const init = (id: string) => teamStats[id] ??= { P: 0, W: 0, L: 0, runsFor: 0, runsAg: 0 };
        const A = init(m.team_a); const B = init(m.team_b);
        A.P++; B.P++;
        if (m.winner === m.team_a) { A.W++; B.L++; } else if (m.winner === m.team_b) { B.W++; A.L++; }
        ["innings1", "innings2"].forEach(ik => {
          const inn = sc[ik]; if (!inn) return;
          const tid = inn.battingTeam;
          const opp = tid === m.team_a ? m.team_b : m.team_a;
          init(tid).runsFor += inn.runs; init(opp).runsAg += inn.runs;
          Object.values(inn.bat as Record<string, any>).forEach((b: any) => {
            const c = batMap.get(b.player_id) ?? { name: b.name, team: tid, runs: 0, balls: 0, sixes: 0, fours: 0 };
            c.runs += b.runs; c.balls += b.balls; c.sixes += b.sixes; c.fours += b.fours;
            batMap.set(b.player_id, c);
          });
          Object.values(inn.bowl as Record<string, any>).forEach((b: any) => {
            const c = bowlMap.get(b.player_id) ?? { name: b.name, team: inn.bowlingTeam, wkts: 0, runs: 0, balls: 0 };
            c.wkts += b.wickets; c.runs += b.runs; c.balls += b.balls;
            bowlMap.set(b.player_id, c);
          });
        });
      });
      setSeasonStats({
        teamStats,
        topBat: [...batMap.entries()].sort((a, b) => b[1].runs - a[1].runs).slice(0, 10),
        topBowl: [...bowlMap.entries()].sort((a, b) => b[1].wkts - a[1].wkts).slice(0, 10),
        matches: matches ?? [],
      });
    })();
  }, [activeSeason, league, seasons]);

  if (loading || !league) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs tracking-[0.3em] text-primary/80">SEASON ARCHIVE</div>
        <h1 className="font-display text-4xl tracking-wider">Season-by-Season History</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {seasons.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSeason(s.season_number)}
            className={`text-left p-3 rounded-lg border transition-all
              ${activeSeason === s.season_number ? "border-primary bg-primary/10 glow-primary" : "border-border/60 bg-secondary/20 hover:bg-secondary/40"}`}
          >
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />{s.year}
            </div>
            <div className="font-display text-2xl">S{s.season_number}</div>
            <div className="text-[10px] mt-1">
              {s.status === "done"
                ? <span className="text-primary flex items-center gap-1"><Crown className="w-3 h-3" />{s.champion_team_id ?? "—"}</span>
                : <Badge variant="outline" className="text-[9px]">{s.status}</Badge>}
            </div>
            {s.auction_type === "mega" && <Badge className="mt-1 text-[9px] bg-amber-500/20 text-amber-400">MEGA</Badge>}
          </button>
        ))}
      </div>

      {activeSeason != null && seasonStats && (
        <Tabs defaultValue="awards">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="awards">🏆 Awards</TabsTrigger>
            <TabsTrigger value="standings">📊 Standings</TabsTrigger>
            <TabsTrigger value="batting">🏏 Top Batters</TabsTrigger>
            <TabsTrigger value="bowling">🎯 Top Bowlers</TabsTrigger>
            <TabsTrigger value="jerseys"><Shirt className="w-3 h-3 mr-1"/>Jerseys</TabsTrigger>
            <TabsTrigger value="matches">⚔️ Matches</TabsTrigger>
            <TabsTrigger value="teamhistory">🏟️ Team History</TabsTrigger>
          </TabsList>

          <TabsContent value="awards" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(trophies[activeSeason] ?? []).map((t, i) => {
                const meta = AWARD_META[t.award as AwardKey] ?? { emoji: "🏅", title: t.award, subtitle: "" };
                return (
                  <Card key={i} className="p-4 gradient-card border-border/60 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1" style={{ background: t.team_id ? tcolor(t.team_id) : "hsl(var(--primary))" }} />
                    <div className="text-3xl">{meta.emoji}</div>
                    <div className="font-display text-lg tracking-wider mt-1">{meta.title}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{meta.subtitle}</div>
                    <div className="mt-2">
                      <div className="font-semibold" style={{ color: t.team_id ? tcolor(t.team_id) : undefined }}>
                        {t.player_name ?? t.team_id}
                      </div>
                      {t.value != null && <div className="text-xs text-muted-foreground">{t.value}</div>}
                    </div>
                  </Card>
                );
              })}
              {(trophies[activeSeason] ?? []).length === 0 && (
                <div className="col-span-full text-sm text-muted-foreground italic">No awards yet — finish the season final to crown winners.</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="standings" className="mt-4">
            <Card className="gradient-card border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
                  <tr><th className="text-left px-3 py-2">Team</th><th>P</th><th>W</th><th>L</th><th className="text-right px-3">Runs For</th><th className="text-right px-3">Runs Ag</th></tr>
                </thead>
                <tbody>
                  {Object.entries(seasonStats.teamStats).sort((a: any, b: any) => b[1].W - a[1].W).map(([id, s]: any) => (
                    <tr key={id} className="border-t border-border/30">
                      <td className="px-3 py-2 font-display tracking-wider" style={{ color: tcolor(id) }}>{id}</td>
                      <td className="text-center">{s.P}</td>
                      <td className="text-center text-primary font-semibold">{s.W}</td>
                      <td className="text-center text-destructive">{s.L}</td>
                      <td className="text-right px-3 font-mono">{s.runsFor}</td>
                      <td className="text-right px-3 font-mono">{s.runsAg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="batting" className="mt-4">
            <Card className="gradient-card border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
                  <tr><th className="text-left px-3 py-2">#</th><th className="text-left">Player</th><th>Team</th><th>Runs</th><th>Balls</th><th>SR</th><th>4s</th><th>6s</th></tr>
                </thead>
                <tbody>
                  {seasonStats.topBat.map(([id, b]: any, i: number) => (
                    <tr key={id} className="border-t border-border/30">
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="font-medium">{b.name}</td>
                      <td className="text-center font-display" style={{ color: tcolor(b.team) }}>{b.team}</td>
                      <td className="text-center font-mono text-primary font-bold">{b.runs}</td>
                      <td className="text-center font-mono">{b.balls}</td>
                      <td className="text-center font-mono">{b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : "—"}</td>
                      <td className="text-center">{b.fours}</td>
                      <td className="text-center">{b.sixes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="bowling" className="mt-4">
            <Card className="gradient-card border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
                  <tr><th className="text-left px-3 py-2">#</th><th className="text-left">Player</th><th>Team</th><th>Wkts</th><th>Runs</th><th>Balls</th><th>Econ</th></tr>
                </thead>
                <tbody>
                  {seasonStats.topBowl.map(([id, b]: any, i: number) => (
                    <tr key={id} className="border-t border-border/30">
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="font-medium">{b.name}</td>
                      <td className="text-center font-display" style={{ color: tcolor(b.team) }}>{b.team}</td>
                      <td className="text-center font-mono text-primary font-bold">{b.wkts}</td>
                      <td className="text-center font-mono">{b.runs}</td>
                      <td className="text-center font-mono">{b.balls}</td>
                      <td className="text-center font-mono">{b.balls ? ((b.runs / b.balls) * 6).toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="jerseys" className="mt-4">
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground italic flex items-center gap-2">
                <Shirt className="w-3 h-3"/>Each season auto-generates unique kit patterns for every franchise.
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {league.teams.map(team => (
                  <Card key={team.id} className="p-4 gradient-card border-border/60 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors group">
                    <JerseyCard
                      teamName={team.id}
                      primaryColor={team.primary}
                      secondaryColor="#ffffff"
                      seasonNumber={activeSeason ?? 1}
                      size="lg"
                      showLabel={false}
                    />
                    <div className="text-center">
                      <div className="font-display text-base leading-tight" style={{ color: team.primary }}>{team.shortName}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{team.fullName}</div>
                      <div className="text-[9px] text-primary/60 mt-0.5">Season {activeSeason} Kit</div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="matches" className="mt-4">
            <div className="space-y-1">
              {seasonStats.matches.map((m: any) => (
                <div key={m.match_number} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/40 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">M{m.match_number}{m.stage !== "league" && ` • ${m.stage.toUpperCase()}`}</span>
                    <span className="font-display" style={{ color: tcolor(m.team_a) }}>{m.team_a}</span>
                    <span className="text-muted-foreground">vs</span>
                    <span className="font-display" style={{ color: tcolor(m.team_b) }}>{m.team_b}</span>
                  </div>
                  <div className="text-xs flex items-center gap-2">
                    {m.winner && <Trophy className="w-3 h-3 text-primary" />}
                    <span className="text-muted-foreground">{m.result_text}</span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ====== TEAM HISTORY TAB ====== */}
          <TabsContent value="teamhistory" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Team:</span>
                {league && (
                  <div className="flex flex-wrap gap-2">
                    {league.teams.map(team => (
                      <button key={team.id} onClick={() => setSelectedTeam(team.id)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-display tracking-wider transition-all ${
                          selectedTeam === team.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 bg-secondary/20 hover:bg-secondary/40"
                        }`} style={selectedTeam === team.id ? { color: tcolor(team.id) } : {}}>
                        {team.shortName ?? team.id}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedTeam && (() => {
                const teamSeasons = allTimeTeamStats[selectedTeam] ?? {};
                const sortedSeasons = Object.entries(teamSeasons).sort((a, b) => +a[0] - +b[0]);
                const totalW = sortedSeasons.reduce((s, [, r]) => s + r.W, 0);
                const totalL = sortedSeasons.reduce((s, [, r]) => s + r.L, 0);
                const totalP = sortedSeasons.reduce((s, [, r]) => s + r.P, 0);
                const titles = sortedSeasons.filter(([, r]) => r.champion).length;
                const finals = sortedSeasons.filter(([, r]) => r.champion || r.runnerUp).length;
                const winPct = totalP > 0 ? ((totalW / totalP) * 100).toFixed(1) : "—";

                return (
                  <div className="space-y-4">
                    {/* Team summary bar */}
                    <Card className="p-5 gradient-card border-border/60 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg" style={{ background: tcolor(selectedTeam) }}/>
                      <div className="pl-3">
                        <div className="font-display text-2xl tracking-wider mb-3" style={{ color: tcolor(selectedTeam) }}>
                          {league?.teams.find(t => t.id === selectedTeam)?.fullName ?? selectedTeam}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center text-xs">
                          {[
                            { k: "Seasons", v: sortedSeasons.length },
                            { k: "Win %", v: `${winPct}%` },
                            { k: "W / L", v: `${totalW} / ${totalL}` },
                            { k: "Titles 🏆", v: titles },
                            { k: "Finals", v: finals },
                          ].map(({ k, v }) => (
                            <div key={k} className="bg-secondary/30 rounded p-2">
                              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
                              <div className="font-display text-xl mt-0.5">{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>

                    {/* Per-season table */}
                    {sortedSeasons.length === 0 ? (
                      <Card className="p-10 text-center gradient-card border-border/60 text-muted-foreground text-sm">No match data for this team yet.</Card>
                    ) : (
                      <Card className="gradient-card border-border/60 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
                            <tr>
                              <th className="text-left px-4 py-2">Season</th>
                              <th>P</th><th>W</th><th>L</th>
                              <th className="text-left px-3">Win %</th>
                              <th className="text-left px-3">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedSeasons.map(([sn, rec]) => {
                              const pct = rec.P > 0 ? ((rec.W / rec.P) * 100).toFixed(0) : 0;
                              const seasonObj = seasons.find(s => s.season_number === +sn);
                              return (
                                <tr key={sn} className={`border-t border-border/30 ${rec.champion ? "bg-primary/5" : ""}`}>
                                  <td className="px-4 py-2.5">
                                    <button onClick={() => setActiveSeason(+sn)}
                                      className="font-display tracking-wider hover:text-primary transition-colors">
                                      Season {sn}
                                    </button>
                                    {seasonObj?.year && <span className="ml-2 text-[10px] text-muted-foreground">{seasonObj.year}</span>}
                                  </td>
                                  <td className="text-center font-mono">{rec.P}</td>
                                  <td className="text-center font-mono text-primary font-semibold">{rec.W}</td>
                                  <td className="text-center font-mono text-destructive">{rec.L}</td>
                                  <td className="px-3">
                                    <div className="flex items-center gap-1.5">
                                      <div className="h-1.5 rounded-full bg-primary/20 w-16 overflow-hidden">
                                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }}/>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground">{pct}%</span>
                                    </div>
                                  </td>
                                  <td className="px-3">
                                    {rec.champion && <Badge className="text-[9px] bg-primary/20 text-primary border-primary/30">🏆 Champions</Badge>}
                                    {rec.runnerUp && !rec.champion && <Badge className="text-[9px] bg-secondary">🥈 Runners-up</Badge>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </Card>
                    )}

                    {/* Visual win-loss history bars */}
                    {sortedSeasons.length > 0 && (
                      <Card className="p-4 gradient-card border-border/60">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3"/> Win/Loss Per Season
                        </div>
                        <div className="flex items-end gap-2 h-20">
                          {sortedSeasons.map(([sn, rec]) => {
                            const pct = rec.P > 0 ? (rec.W / rec.P) : 0;
                            const barH = Math.round(pct * 64);
                            return (
                              <div key={sn} className="flex flex-col items-center gap-1 flex-1 min-w-0"
                                title={`S${sn}: ${rec.W}W/${rec.L}L`}>
                                <div className="relative w-full flex flex-col justify-end" style={{ height: 64 }}>
                                  <div className={`w-full rounded-t transition-all ${rec.champion ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))]" : "bg-primary/50"}`}
                                    style={{ height: Math.max(barH, 2) }}/>
                                </div>
                                <span className="text-[9px] text-muted-foreground">{sn}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-3">
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-primary inline-block"/>Champion season</span>
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-primary/50 inline-block"/>Regular season</span>
                        </div>
                      </Card>
                    )}
                  </div>
                );
              })()}
            </div>
          </TabsContent>

        </Tabs>
      )}
    </div>
  );
}
