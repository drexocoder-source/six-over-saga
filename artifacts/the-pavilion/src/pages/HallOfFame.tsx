import { useEffect, useMemo, useState } from "react";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import { teamLogo } from "@/lib/teamLogos";
import {
  loadAllDoneMatches, aggregate, type MatchRow,
} from "@/lib/recordsAgg";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Crown, Trophy, Star, Shield, Award, Flame, Zap, Target } from "lucide-react";

interface TrophyRow {
  id: string; season_number: number; award: string;
  team_id: string | null; player_id: string | null; player_name: string | null;
  value: number | null;
}

export default function HallOfFame() {
  const [league, setLeague] = useState<League | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [trophies, setTrophies] = useState<TrophyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const lg = await getOrCreateLeague();
      setLeague(lg);
      const [ms, tr] = await Promise.all([
        loadAllDoneMatches(lg.id),
        supabase.from("trophies").select("id, season_number, award, team_id, player_id, player_name, value").eq("league_id", lg.id),
      ]);
      setMatches(ms);
      setTrophies((tr.data ?? []) as TrophyRow[]);
      setLoading(false);
    })();
  }, []);

  const careerLeaders = useMemo(() => {
    if (!matches.length) return null;
    const agg = aggregate(matches);
    return {
      byRuns:   [...agg].sort((a, b) => b.runs - a.runs).slice(0, 12),
      byWkts:   [...agg].sort((a, b) => b.wickets - a.wickets).slice(0, 12),
      bySixes:  [...agg].sort((a, b) => b.sixes - a.sixes).slice(0, 12),
      byFifties:[...agg].sort((a, b) => (b.fifties + b.hundreds * 2) - (a.fifties + a.hundreds * 2)).slice(0, 12),
    };
  }, [matches]);

  const retiredJerseys = useMemo(() => {
    if (!matches.length || !league) return [];
    const agg = aggregate(matches);
    const byTeam = new Map<string, typeof agg>();
    for (const a of agg) {
      const list = byTeam.get(a.team) ?? [];
      list.push(a); byTeam.set(a.team, list);
    }
    return league.teams.map(t => {
      const list = byTeam.get(t.short ?? t.id) ?? byTeam.get(t.id) ?? [];
      if (!list.length) return null;
      const top = list.slice().sort((a, b) => (b.runs + b.wickets * 20) - (a.runs + a.wickets * 20))[0];
      const line = top.runs > top.wickets * 20
        ? `${top.runs.toLocaleString()} runs · ${top.fifties}×50 · ${top.hundreds}×100`
        : `${top.wickets} wickets · ${top.matches.size} matches`;
      return { team: t.short ?? t.id, fullName: t.fullName ?? t.id, player: top.name, line, color: teamColor(t.id, league.teams) };
    }).filter(Boolean) as NonNullable<ReturnType<typeof retiredJerseys>>;
  }, [matches, league]);

  const champions = useMemo(() => {
    const bySeason = new Map<number, TrophyRow>();
    for (const t of trophies.filter(t => /^(Champion|Title|Winner)$/i.test(t.award)))
      bySeason.set(t.season_number, t);
    for (const m of matches) {
      if ((m as any).stage === "final" && m.winner && !bySeason.has(m.season_number ?? 0))
        bySeason.set(m.season_number ?? 0, { id: `m-${m.id}`, season_number: m.season_number ?? 0, award: "Champion", team_id: m.winner, player_id: null, player_name: null, value: null });
    }
    return [...bySeason.values()].sort((a, b) => b.season_number - a.season_number);
  }, [trophies, matches]);

  const awardArchive = useMemo(() => {
    const bySeason = new Map<number, TrophyRow[]>();
    for (const t of trophies) {
      const list = bySeason.get(t.season_number) ?? [];
      list.push(t); bySeason.set(t.season_number, list);
    }
    return [...bySeason.entries()].sort((a, b) => b[0] - a[0]);
  }, [trophies]);

  // Title count per team
  const titleCount = useMemo(() => {
    const c: Record<string, number> = {};
    for (const ch of champions) if (ch.team_id) c[ch.team_id] = (c[ch.team_id] ?? 0) + 1;
    return c;
  }, [champions]);

  if (loading || !league) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Hero Plaque ── */}
      <div className="relative overflow-hidden rounded-2xl plaque py-14 md:py-20 text-center">
        {/* Gold shimmer lines */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent" />

        {/* Corner ornaments */}
        {[["top-2 left-2","top-right"], ["top-2 right-2","top-left"], ["bottom-2 left-2","bottom-right"], ["bottom-2 right-2","bottom-left"]].map(([pos, _]) => (
          <div key={pos} className={`absolute ${pos} w-5 h-5 border-primary/30`}
            style={{ borderWidth: "1px 0 0 1px", borderStyle: "solid", borderColor: "hsl(36 55% 55% / 0.4)" }} />
        ))}

        <Crown className="w-12 h-12 mx-auto text-primary mb-4 pulse-glow rounded-full glow-gold" style={{ filter: "drop-shadow(0 0 12px hsl(36 95% 55% / 0.5))" }} />
        <div className="kicker mb-2">ESTABLISHED · SEASON 1</div>
        <h1 className="font-display text-shimmer leading-none" style={{ fontSize: "clamp(3rem, 8vw, 6rem)" }}>
          Hall of Fame
        </h1>
        <p className="text-sm text-muted-foreground mt-4 max-w-xl mx-auto italic leading-relaxed px-6">
          The immortals of the league — engraved in brass, etched in record.<br />
          Champions, legends, retired jerseys.
        </p>

        {/* Stats strip */}
        {(champions.length > 0 || matches.length > 0) && (
          <div className="flex justify-center gap-8 mt-8 text-center">
            {champions.length > 0 && (
              <div>
                <div className="font-display text-4xl text-primary">{champions.length}</div>
                <div className="kicker text-white/40">Seasons</div>
              </div>
            )}
            {matches.length > 0 && (
              <div>
                <div className="font-display text-4xl text-primary">{matches.length}</div>
                <div className="kicker text-white/40">Matches</div>
              </div>
            )}
            {retiredJerseys.length > 0 && (
              <div>
                <div className="font-display text-4xl text-primary">{retiredJerseys.length}</div>
                <div className="kicker text-white/40">Icons</div>
              </div>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="legends">
        <TabsList className="bg-secondary/40 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="legends" className="gap-1.5"><Star className="w-3.5 h-3.5"/>Legends</TabsTrigger>
          <TabsTrigger value="champions" className="gap-1.5"><Trophy className="w-3.5 h-3.5"/>Champions</TabsTrigger>
          <TabsTrigger value="jerseys" className="gap-1.5"><Shield className="w-3.5 h-3.5"/>Retired Jerseys</TabsTrigger>
          <TabsTrigger value="awards" className="gap-1.5"><Award className="w-3.5 h-3.5"/>Award Archive</TabsTrigger>
        </TabsList>

        {/* ── LEGENDS ── */}
        <TabsContent value="legends" className="mt-5">
          {!careerLeaders ? <Empty/> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <LegendCard
                title="Run Machines" icon={<Flame className="w-4 h-4"/>} color="hsl(142 55% 48%)"
                entries={careerLeaders.byRuns.map(a => ({
                  name: a.name, team: a.team,
                  value: a.runs.toLocaleString(),
                  sub: `${a.matches.size} mat · ${a.fifties}×50 · ${a.hundreds}×100`,
                }))} league={league}/>
              <LegendCard
                title="Wicket Takers" icon={<Target className="w-4 h-4"/>} color="hsl(270 60% 60%)"
                entries={careerLeaders.byWkts.map(a => ({
                  name: a.name, team: a.team,
                  value: String(a.wickets),
                  sub: `${a.matches.size} mat · econ ${a.bowlBalls ? ((a.bowlRuns/a.bowlBalls)*6).toFixed(2) : "—"}`,
                }))} league={league}/>
              <LegendCard
                title="Six Hitters" icon={<Zap className="w-4 h-4"/>} color="hsl(270 60% 60%)"
                entries={careerLeaders.bySixes.map(a => ({
                  name: a.name, team: a.team,
                  value: String(a.sixes),
                  sub: `${a.runs.toLocaleString()} runs · SR ${a.balls ? ((a.runs/a.balls)*100).toFixed(1) : "—"}`,
                }))} league={league}/>
              <LegendCard
                title="Milestone Men" icon={<Crown className="w-4 h-4"/>} color="hsl(42 95% 58%)"
                entries={careerLeaders.byFifties.map(a => ({
                  name: a.name, team: a.team,
                  value: String(a.fifties + a.hundreds),
                  sub: `${a.fifties}×50 + ${a.hundreds}×100`,
                }))} league={league}/>
            </div>
          )}
        </TabsContent>

        {/* ── CHAMPIONS ── */}
        <TabsContent value="champions" className="mt-5">
          {champions.length === 0 ? <Empty msg="No champions crowned yet. Finish a season Final to record one."/> : (
            <>
              {/* Dynasty leaders */}
              {Object.keys(titleCount).length > 0 && (
                <div className="mb-6 p-5 rounded-xl plaque">
                  <div className="kicker mb-3">Dynasty Leaderboard</div>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(titleCount).sort((a,b) => b[1]-a[1]).map(([team, count]) => (
                      <div key={team} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{
                        background: `${teamColor(team, league.teams)}15`,
                        border: `1px solid ${teamColor(team, league.teams)}33`,
                      }}>
                        <img src={teamLogo(team)} alt={team} className="w-6 h-6 object-contain opacity-80" />
                        <span className="font-display text-lg" style={{ color: teamColor(team, league.teams) }}>{team}</span>
                        <div className="flex gap-0.5 ml-1">
                          {Array.from({ length: count }).map((_, i) => <Trophy key={i} className="w-3.5 h-3.5" style={{ color: teamColor(team, league.teams) }}/>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {champions.map((t, idx) => {
                  const tc = teamColor(t.team_id ?? "", league.teams);
                  return (
                    <div key={t.id}
                      className="relative overflow-hidden rounded-xl card-lift"
                      style={{
                        background: `linear-gradient(145deg, color-mix(in srgb, ${tc} 14%, #0d0d0d) 0%, #0a0a0a 80%)`,
                        border: `1px solid ${tc}44`,
                        boxShadow: idx === 0 ? `0 0 30px -8px ${tc}66` : `0 0 15px -8px ${tc}33`,
                      }}>
                      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${tc}, transparent)` }} />
                      <div className="p-6 text-center">
                        <div className="kicker mb-3 text-white/40">SEASON {t.season_number}</div>
                        <img src={teamLogo(t.team_id ?? "")} alt={t.team_id ?? ""} className="w-14 h-14 mx-auto object-contain mb-3" style={{ filter: `drop-shadow(0 0 8px ${tc}66)` }} />
                        <div className="font-display text-3xl" style={{ color: tc, textShadow: `0 0 20px ${tc}66` }}>
                          {t.team_id}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-white/25 mt-1">Champions</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── RETIRED JERSEYS ── */}
        <TabsContent value="jerseys" className="mt-5">
          {retiredJerseys.length === 0 ? <Empty msg="Build careers first. Jerseys retire once a team has a clear all-time great."/> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {retiredJerseys.map((j: any) => (
                <div key={j.team} className="relative overflow-hidden rounded-xl plaque card-lift p-0">
                  {/* Jersey-style top section */}
                  <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${j.color}, ${j.color}44, transparent)` }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="kicker mb-0.5" style={{ color: j.color }}>{j.team}</div>
                        <div className="text-[10px] text-white/30 truncate">{j.fullName}</div>
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded"
                        style={{ background: `${j.color}18`, color: j.color, border: `1px solid ${j.color}33` }}>
                        RETIRED
                      </div>
                    </div>

                    {/* Jersey number placeholder */}
                    <div className="text-center my-4">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl font-display text-4xl"
                        style={{ background: `${j.color}15`, color: j.color, border: `2px solid ${j.color}33` }}>
                        {j.player.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase()}
                      </div>
                    </div>

                    <div className="font-display text-2xl text-center leading-tight text-white/90 mb-1">{j.player}</div>
                    <div className="rule mt-3 mb-3 opacity-50"/>
                    <div className="text-xs text-white/40 text-center">{j.line}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── AWARD ARCHIVE ── */}
        <TabsContent value="awards" className="mt-5">
          {awardArchive.length === 0 ? <Empty msg="No award records yet. Awards write here after each season's ceremony."/> : (
            <div className="space-y-5">
              {awardArchive.map(([season, list]) => (
                <div key={season} className="glass-card rounded-xl p-5">
                  <div className="flex items-baseline justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-primary" />
                      <div className="font-display text-2xl">Season {season}</div>
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">{list.length} awards</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {list.map(t => (
                      <div key={t.id} className="flex items-center gap-2.5 text-xs rounded-lg px-3 py-2.5"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <Award className="w-3.5 h-3.5 text-primary shrink-0"/>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate text-white/80">{t.award}</div>
                          <div className="text-[10px] text-white/35 truncate">
                            {t.player_name ?? t.team_id ?? "—"}{t.value != null && ` · ${t.value}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ msg }: { msg?: string }) {
  return (
    <div className="plaque rounded-xl p-14 text-center">
      <Crown className="w-12 h-12 mx-auto text-primary/20 mb-4"/>
      <div className="font-display text-3xl text-foreground/50">Awaiting Inductees</div>
      <p className="text-xs text-muted-foreground mt-2 italic max-w-xs mx-auto">{msg ?? "Play more matches to populate the Hall."}</p>
    </div>
  );
}

interface LegendEntry { name: string; team: string; value: string; sub: string; }
function LegendCard({ title, icon, color, entries, league }: { title: string; icon: React.ReactNode; color: string; entries: LegendEntry[]; league: League }) {
  const MEDALS = ["🥇", "🥈", "🥉"];
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "linear-gradient(160deg, hsl(36 20% 11%), hsl(30 8% 8%))", border: "1px solid hsl(36 30% 22%)" }}>
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-white/6"
        style={{ background: `${color}0d` }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}22`, color }}>{icon}</div>
        <div className="font-display text-xl tracking-wider" style={{ color }}>{title}</div>
      </div>
      <div className="divide-y divide-white/5">
        {entries.length === 0 && <div className="text-xs text-muted-foreground italic text-center py-6">—</div>}
        {entries.map((e, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/3 ${i < 3 ? "bg-white/[0.025]" : ""}`}>
            <span className="w-7 text-center text-sm shrink-0">
              {MEDALS[i] ?? <span className="text-xs text-white/25 font-mono">{i + 1}</span>}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-white/90 truncate">{e.name}</div>
              <div className="text-[10px] text-white/30 truncate">{e.sub}</div>
            </div>
            <Badge variant="outline" className="text-[9px] shrink-0 border-current"
              style={{ borderColor: teamColor(e.team, league.teams) + "66", color: teamColor(e.team, league.teams) }}>
              {e.team}
            </Badge>
            <div className="font-display text-xl font-bold shrink-0 w-14 text-right" style={{ color }}>{e.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
