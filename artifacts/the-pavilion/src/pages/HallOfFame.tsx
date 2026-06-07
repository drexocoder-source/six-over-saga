import { useEffect, useMemo, useState } from "react";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import {
  loadAllDoneMatches, aggregate, type MatchRow,
} from "@/lib/recordsAgg";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Crown, Trophy, Star, Shield, Award, Flame } from "lucide-react";

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
    const byRuns = [...agg].sort((a, b) => b.runs - a.runs).slice(0, 12);
    const byWkts = [...agg].sort((a, b) => b.wickets - a.wickets).slice(0, 12);
    const bySixes = [...agg].sort((a, b) => b.sixes - a.sixes).slice(0, 12);
    const byFifties = [...agg].sort((a, b) => (b.fifties + b.hundreds * 2) - (a.fifties + a.hundreds * 2)).slice(0, 12);
    return { byRuns, byWkts, bySixes, byFifties };
  }, [matches]);

  // Retired jerseys — pick top-rated player from each team's all-time leader board
  const retiredJerseys = useMemo(() => {
    if (!matches.length || !league) return [];
    const agg = aggregate(matches);
    const byTeam = new Map<string, typeof agg>();
    for (const a of agg) {
      const list = byTeam.get(a.team) ?? [];
      list.push(a); byTeam.set(a.team, list);
    }
    const out: { team: string; player: string; line: string }[] = [];
    for (const t of league.teams) {
      const list = byTeam.get(t.short) ?? [];
      if (!list.length) continue;
      const top = list.slice().sort((a, b) => (b.runs + b.wickets * 20) - (a.runs + a.wickets * 20))[0];
      const line = top.runs > top.wickets * 20
        ? `${top.runs} runs · ${top.fifties}×50 · ${top.hundreds}×100`
        : `${top.wickets} wickets · ${top.matches.size} matches`;
      out.push({ team: t.short, player: top.name, line });
    }
    return out;
  }, [matches, league]);

  // Champions by season (from trophies "Champion" award, else fallback empty)
  const champions = useMemo(() => {
    const winners = trophies.filter(t => /^(Champion|Title|Winner)$/i.test(t.award));
    const bySeason = new Map<number, TrophyRow>();
    for (const t of winners) bySeason.set(t.season_number, t);
    return [...bySeason.values()].sort((a, b) => b.season_number - a.season_number);
  }, [trophies]);

  // Award archive
  const awardArchive = useMemo(() => {
    const bySeason = new Map<number, TrophyRow[]>();
    for (const t of trophies) {
      const list = bySeason.get(t.season_number) ?? [];
      list.push(t); bySeason.set(t.season_number, list);
    }
    return [...bySeason.entries()].sort((a, b) => b[0] - a[0]);
  }, [trophies]);

  if (loading || !league) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero plaque */}
      <div className="plaque rounded-md p-8 md:p-12 text-center relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <Crown className="w-10 h-10 mx-auto text-primary mb-3 pulse-glow rounded-full" />
        <div className="kicker mb-2">ESTABLISHED · S1</div>
        <h1 className="font-display text-5xl md:text-6xl text-shimmer leading-none">Hall of Fame</h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto italic">
          The immortals of the league — engraved in brass, etched in record. Champions, legends, retired jerseys.
        </p>
      </div>

      <Tabs defaultValue="legends">
        <TabsList className="bg-secondary/40">
          <TabsTrigger value="legends"><Star className="w-3.5 h-3.5 mr-1.5"/>Legends</TabsTrigger>
          <TabsTrigger value="champions"><Trophy className="w-3.5 h-3.5 mr-1.5"/>Champions</TabsTrigger>
          <TabsTrigger value="jerseys"><Shield className="w-3.5 h-3.5 mr-1.5"/>Retired Jerseys</TabsTrigger>
          <TabsTrigger value="awards"><Award className="w-3.5 h-3.5 mr-1.5"/>Award Archive</TabsTrigger>
        </TabsList>

        <TabsContent value="legends" className="mt-5">
          {!careerLeaders ? <Empty/> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <LegendCard title="Run Machines" icon={<Flame className="w-4 h-4"/>} entries={
                careerLeaders.byRuns.map(a => ({ name: a.name, team: a.team, value: `${a.runs}`, sub: `${a.matches.size} mat · ${a.fifties}×50 · ${a.hundreds}×100` }))
              } league={league}/>
              <LegendCard title="Wicket Takers" icon={<Shield className="w-4 h-4"/>} entries={
                careerLeaders.byWkts.map(a => ({ name: a.name, team: a.team, value: `${a.wickets}`, sub: `${a.matches.size} mat · econ ${a.bowlBalls ? ((a.bowlRuns/a.bowlBalls)*6).toFixed(2) : "—"}` }))
              } league={league}/>
              <LegendCard title="Six Hitters" icon={<Star className="w-4 h-4"/>} entries={
                careerLeaders.bySixes.map(a => ({ name: a.name, team: a.team, value: `${a.sixes}`, sub: `${a.runs} runs · SR ${a.balls ? ((a.runs/a.balls)*100).toFixed(1) : "—"}` }))
              } league={league}/>
              <LegendCard title="Milestone Men" icon={<Crown className="w-4 h-4"/>} entries={
                careerLeaders.byFifties.map(a => ({ name: a.name, team: a.team, value: `${a.fifties + a.hundreds}`, sub: `${a.fifties}×50 + ${a.hundreds}×100` }))
              } league={league}/>
            </div>
          )}
        </TabsContent>

        <TabsContent value="champions" className="mt-5">
          {champions.length === 0 ? <Empty msg="No champions crowned yet. Finish a season Final to record one."/> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {champions.map(t => (
                <Card key={t.id} className="plaque p-5 text-center hover:scale-[1.02] transition-transform">
                  <div className="kicker mb-2">SEASON {t.season_number}</div>
                  <Trophy className="w-8 h-8 mx-auto text-primary mb-2"/>
                  <div className="font-display text-3xl" style={{ color: teamColor(t.team_id ?? "", league.teams) }}>{t.team_id}</div>
                  <div className="text-[11px] text-muted-foreground italic mt-2">Champion</div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="jerseys" className="mt-5">
          {retiredJerseys.length === 0 ? <Empty msg="Build careers first. Jerseys retire once a team has a clear all-time great."/> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {retiredJerseys.map(j => (
                <Card key={j.team} className="plaque p-5 relative overflow-hidden">
                  <div className="absolute right-3 top-3 text-[10px] kicker opacity-60">RETIRED</div>
                  <div className="text-[10px] kicker mb-1">{j.team}</div>
                  <div className="font-display text-2xl leading-tight" style={{ color: teamColor(j.team, league.teams) }}>{j.player}</div>
                  <div className="rule mt-3 mb-3 opacity-50"/>
                  <div className="text-xs text-muted-foreground">{j.line}</div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="awards" className="mt-5">
          {awardArchive.length === 0 ? <Empty msg="No award records yet. Awards write here after each season's ceremony."/> : (
            <div className="space-y-5">
              {awardArchive.map(([season, list]) => (
                <Card key={season} className="glass-card p-5">
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="font-display text-2xl">Season {season}</div>
                    <span className="kicker">{list.length} awards</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {list.map(t => (
                      <div key={t.id} className="flex items-center gap-2 text-xs bg-secondary/30 rounded px-2.5 py-2">
                        <Award className="w-3.5 h-3.5 text-primary shrink-0"/>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{t.award}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {t.player_name ?? t.team_id ?? "—"}
                            {t.value != null && ` · ${t.value}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
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
    <Card className="glass-card p-12 text-center">
      <Crown className="w-10 h-10 mx-auto text-primary/30 mb-3"/>
      <div className="font-display text-2xl text-foreground/70">Awaiting Inductees</div>
      <p className="text-xs text-muted-foreground mt-2 italic">{msg ?? "Play more matches to populate the Hall."}</p>
    </Card>
  );
}

interface LegendEntry { name: string; team: string; value: string; sub: string; }
function LegendCard({ title, icon, entries, league }: { title: string; icon: React.ReactNode; entries: LegendEntry[]; league: League }) {
  return (
    <Card className="plaque p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary">{icon}</div>
        <div className="font-display text-xl">{title}</div>
      </div>
      <div className="space-y-1.5">
        {entries.length === 0 && <div className="text-xs text-muted-foreground italic text-center py-4">—</div>}
        {entries.map((e, i) => (
          <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded ${i < 3 ? "bg-primary/8 border border-primary/15" : "bg-secondary/20"}`}>
            <span className={`w-6 text-center text-xs font-bold shrink-0 ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
              {i === 0 ? "①" : i === 1 ? "②" : i === 2 ? "③" : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{e.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{e.sub}</div>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: teamColor(e.team, league.teams), color: teamColor(e.team, league.teams) }}>{e.team}</Badge>
            <div className="font-mono text-base font-bold text-primary shrink-0 w-12 text-right">{e.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
