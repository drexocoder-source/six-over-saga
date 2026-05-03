import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import { generateScheduleForSeason, computePointsTable, type PointsRow } from "@/lib/standings";
import { ensurePlayoffsScheduled, wirePlayoffDependencies, STAGE_LABEL, STAGE_SUBTITLE } from "@/lib/playoffs";
import { computeQualification } from "@/lib/qualification";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Trophy, CheckCircle2, Calendar } from "lucide-react";
import { toast } from "sonner";

interface Match {
  id: string; match_number: number; stage: string; team_a: string; team_b: string;
  status: string; winner: string | null; result_text: string | null;
  venue?: string | null; match_date?: string | null; home_team?: string | null;
  state?: any;
}

function liveScoreFromState(state: any): { line1: string; line2?: string } | null {
  if (!state) return null;
  const i1 = state.innings1, i2 = state.innings2;
  const fmt = (inn: any) => {
    if (!inn) return null;
    const ov = Math.floor((inn.legalBalls ?? 0) / 6);
    const bl = (inn.legalBalls ?? 0) % 6;
    return `${inn.battingTeam} ${inn.runs}/${inn.wickets} (${ov}.${bl})`;
  };
  const cur = state.currentInnings === 2 ? i2 : i1;
  const line1 = fmt(cur);
  if (!line1) return null;
  let line2: string | undefined;
  if (state.currentInnings === 2 && state.target) {
    const ballsLeft = (state.oversPerInnings ?? 20) * 6 - (i2?.legalBalls ?? 0);
    const need = state.target - (i2?.runs ?? 0);
    line2 = need > 0 ? `Need ${need} from ${ballsLeft}` : `Target ${state.target}`;
  } else if (state.currentInnings === 1) {
    line2 = `1st innings`;
  }
  return { line1, line2 };
}

export default function Schedule() {
  const nav = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<{ id: string; season_number: number; year: number; status: string } | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [table, setTable] = useState<PointsRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh(lg: League, s: any) {
    const { data: existing } = await supabase.from("matches").select("*").eq("season_id", s.id).order("match_number");
    if (!existing || existing.length === 0) {
      await generateScheduleForSeason(s.id, lg.teams.map(t => t.id), s.year);
      const { data: again } = await supabase.from("matches").select("*").eq("season_id", s.id).order("match_number");
      setMatches((again ?? []) as Match[]);
    } else {
      setMatches(existing as Match[]);
    }
    const tbl = await computePointsTable(s.id, lg.teams.map(t=>t.id), lg.settings.oversPerInnings);
    setTable(tbl);

    // If league done, schedule the IPL-style playoff bracket
    const leagueMatches = ((existing && existing.length) ? existing : (await supabase.from("matches").select("*").eq("season_id", s.id).order("match_number")).data ?? [])
      .filter((m: any) => m.stage === "league");
    const leagueDone = leagueMatches.length > 0 && leagueMatches.every((m: any) => m.status === "done");
    if (leagueDone && tbl.length >= 4) {
      await ensurePlayoffsScheduled(s.id, tbl);
      await wirePlayoffDependencies(s.id);
      const { data: fresh } = await supabase.from("matches").select("*").eq("season_id", s.id).order("match_number");
      setMatches((fresh ?? []) as Match[]);
    }
  }

  useEffect(() => {
    (async () => {
      const lg = await getOrCreateLeague();
      setLeague(lg);
      const { data: seasons } = await supabase.from("seasons").select("*").eq("league_id", lg.id).order("season_number",{ ascending:false }).limit(1);
      if (!seasons?.[0]) { toast.error("No active season"); nav("/"); return; }
      setSeason(seasons[0] as never);
      await refresh(lg, seasons[0]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll only the live matches every 3s for running score updates
  useEffect(() => {
    if (!season) return;
    const liveIds = matches.filter(m => m.status === "live").map(m => m.id);
    if (liveIds.length === 0) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from("matches").select("id, status, state, winner, result_text").in("id", liveIds);
      if (!data) return;
      setMatches(prev => prev.map(m => {
        const u = data.find(d => d.id === m.id);
        return u ? { ...m, ...u } as Match : m;
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [season, matches.map(m => m.status).join(",")]);

  function startMatch(matchId: string) {
    nav(`/match?id=${matchId}`);
  }

  if (loading || !league) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  const champion = season?.status === "done" ? table[0]?.team_id : null;
  const playoffMatches = matches.filter(m => ["qualifier1","eliminator","qualifier2","final"].includes(m.stage));
  const finalMatch = playoffMatches.find(m => m.stage === "final");
  const championTeam = season?.status === "done" && finalMatch?.winner ? finalMatch.winner : null;
  const matchesPerTeam = Math.max(0, (league.teams.length - 1) * 2);
  const qual = computeQualification(table, matchesPerTeam, 4);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-primary/80">SEASON {season?.season_number} • {season?.year}</div>
          <h1 className="font-display text-4xl tracking-wider">Fixtures & Standings</h1>
        </div>
        {championTeam && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground font-display text-xl">
              <Trophy className="w-6 h-6" /> Champions: {championTeam}
            </div>
            <Button onClick={() => nav(`/ceremony?season=${season?.id}`)} variant="outline" className="border-primary/50 text-primary">
              View Trophy Ceremony →
            </Button>
          </div>
        )}
      </div>

      {/* Points Table */}
      <Card className="gradient-card border-border/60 overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-border/60">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Points Table</div>
            <div className="font-display text-xl">Standings</div>
          </div>
          <Trophy className="w-5 h-5 text-primary" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-3 py-2 text-center">P</th>
                <th className="px-3 py-2 text-center">W</th>
                <th className="px-3 py-2 text-center">L</th>
                <th className="px-3 py-2 text-center">T</th>
                <th className="px-3 py-2 text-center font-bold text-primary">PTS</th>
                <th className="px-3 py-2 text-center">NRR</th>
                <th className="px-3 py-2 text-center">Form</th>
              </tr>
            </thead>
            <tbody>
              {table.map(r => {
                const q = qual[r.team_id];
                const badge = q?.status === "Q"
                  ? <span title={q.scenario} className="inline-flex w-7 h-6 items-center justify-center rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">Q</span>
                  : q?.status === "E"
                  ? <span title={q.scenario} className="inline-flex w-7 h-6 items-center justify-center rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">E</span>
                  : <span className={`inline-flex w-7 h-6 items-center justify-center rounded text-xs font-bold ${r.rank! <= 4 ? "bg-primary/30 text-primary" : "bg-secondary"}`}>{r.rank}</span>;
                return (
                <tr key={r.team_id} className={`border-t border-border/40 ${q?.status === "Q" ? "bg-emerald-500/5" : q?.status === "E" ? "bg-rose-500/5 opacity-70" : r.rank! <= 4 ? "bg-primary/5" : ""}`} title={q?.scenario}>
                  <td className="px-3 py-3">{badge}</td>
                  <td className="px-3 py-3 font-display text-lg" style={{ color: teamColor(r.team_id, league.teams) }}>{r.team_id}</td>
                  <td className="px-3 py-3 text-center font-mono">{r.P}</td>
                  <td className="px-3 py-3 text-center font-mono text-[hsl(var(--boundary))]">{r.W}</td>
                  <td className="px-3 py-3 text-center font-mono text-[hsl(var(--wicket))]">{r.L}</td>
                  <td className="px-3 py-3 text-center font-mono">{r.T}</td>
                  <td className="px-3 py-3 text-center font-mono font-bold text-primary text-lg">{r.pts}</td>
                  <td className={`px-3 py-3 text-center font-mono ${r.nrr > 0 ? "text-[hsl(var(--boundary))]" : r.nrr < 0 ? "text-[hsl(var(--wicket))]" : ""}`}>
                    {r.nrr > 0 ? "+" : ""}{r.nrr.toFixed(3)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-0.5 justify-center">
                      {r.form.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                      {r.form.map((f,i) => (
                        <span key={i} className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${f==="W"?"bg-[hsl(var(--boundary))] text-background":f==="L"?"bg-[hsl(var(--wicket))] text-foreground":"bg-secondary"}`}>{f}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Playoff bracket */}
      {playoffMatches.length > 0 && (
        <Card className="p-5 gradient-card border-primary/40 glow-primary">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs tracking-[0.3em] text-primary">PLAYOFF BRACKET</div>
              <div className="font-display text-2xl">Road to the Trophy</div>
            </div>
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {(["qualifier1","eliminator","qualifier2","final"] as const).map(stage => {
              const m = playoffMatches.find(x => x.stage === stage);
              if (!m) return (
                <div key={stage} className="p-4 rounded-lg border border-dashed border-border/50 bg-secondary/10">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{STAGE_LABEL[stage]}</div>
                  <div className="text-sm text-muted-foreground italic mt-2">Awaiting league result</div>
                </div>
              );
              const isFinal = stage === "final";
              const playable = m.status !== "done" && m.team_a !== "TBD" && m.team_b !== "TBD";
              return (
                <div key={stage} className={`p-4 rounded-lg border ${isFinal ? "border-primary/60 bg-primary/5" : "border-border/60 bg-secondary/20"} space-y-2 relative overflow-hidden`}>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-widest text-primary">{STAGE_LABEL[stage]}</div>
                    {m.status === "done" ? <Badge className="bg-[hsl(var(--boundary))]/20 text-[hsl(var(--boundary))]">Done</Badge>
                      : m.status === "live" ? <Badge className="bg-[hsl(var(--wicket))]/20 text-[hsl(var(--wicket))]">LIVE</Badge>
                      : <Badge variant="outline">Scheduled</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{STAGE_SUBTITLE[stage]}</div>
                  <div className="flex items-center justify-between font-display text-xl">
                    <span style={{ color: teamColor(m.team_a, league.teams) }} className={m.status === "done" && m.winner === m.team_a ? "" : m.status === "done" ? "opacity-50" : ""}>{m.team_a}</span>
                    <span className="text-muted-foreground text-xs">vs</span>
                    <span style={{ color: teamColor(m.team_b, league.teams) }} className={m.status === "done" && m.winner === m.team_b ? "" : m.status === "done" ? "opacity-50" : ""}>{m.team_b}</span>
                  </div>
                  {m.result_text && <div className="text-[11px] text-primary">{m.result_text}</div>}
                  {playable && (
                    <Button size="sm" onClick={() => startMatch(m.id)} className={`w-full ${isFinal ? "gradient-primary text-primary-foreground" : ""}`} variant={isFinal ? "default" : "outline"}>
                      <Play className="w-3 h-3 mr-1"/>{m.status === "live" ? "Resume" : isFinal ? "Play Final" : "Play"}
                    </Button>
                  )}
                  {m.venue && <div className="text-[10px] text-muted-foreground">📍 {m.venue}</div>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Fixtures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {matches.filter(m => m.stage === "league").map(m => {
          const dateStr = m.match_date ? new Date(m.match_date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : null;
          const timeStr = m.match_date ? new Date(m.match_date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : null;
          return (
          <Card key={m.id} className="p-4 gradient-card border-border/60 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3 h-3"/>Match {m.match_number}
                {dateStr && <span className="ml-1 text-foreground/80">· {dateStr}{timeStr && ` · ${timeStr}`}</span>}
              </div>
              {m.status === "done" ? (
                <Badge className="bg-[hsl(var(--boundary))]/20 text-[hsl(var(--boundary))]"><CheckCircle2 className="w-3 h-3 mr-1"/>Done</Badge>
              ) : m.status === "live" ? (
                <Badge className="bg-[hsl(var(--wicket))]/20 text-[hsl(var(--wicket))]">LIVE</Badge>
              ) : (
                <Badge variant="outline">Scheduled</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-display text-2xl" style={{ color: teamColor(m.team_a, league.teams) }}>{m.team_a}</div>
                  {m.home_team === m.team_a && <div className="text-[9px] uppercase tracking-widest text-primary">Home</div>}
                </div>
                <span className="text-muted-foreground text-xs">vs</span>
                <div>
                  <div className="font-display text-2xl" style={{ color: teamColor(m.team_b, league.teams) }}>{m.team_b}</div>
                  {m.home_team === m.team_b && <div className="text-[9px] uppercase tracking-widest text-primary">Home</div>}
                </div>
              </div>
              {m.status !== "done" ? (
                <Button size="sm" onClick={() => startMatch(m.id)} className="gradient-primary text-primary-foreground">
                  <Play className="w-3 h-3 mr-1"/>{m.status === "live" ? "Resume" : "Play"}
                </Button>
              ) : (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Winner</div>
                  <div className="font-bold" style={{ color: teamColor(m.winner ?? "", league.teams) }}>{m.winner ?? "Tie"}</div>
                </div>
              )}
            </div>
            {m.venue && <div className="text-[11px] text-muted-foreground mt-2">📍 {m.venue}</div>}
            {m.status === "live" && (() => {
              const ls = liveScoreFromState(m.state);
              return ls ? (
                <div className="mt-2 p-2 rounded bg-[hsl(var(--wicket))]/10 border border-[hsl(var(--wicket))]/30">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--wicket))] animate-pulse"/>
                    <span className="text-xs font-mono font-bold text-foreground">{ls.line1}</span>
                  </div>
                  {ls.line2 && <div className="text-[10px] text-muted-foreground mt-0.5 ml-3.5">{ls.line2}</div>}
                </div>
              ) : null;
            })()}
            {m.result_text && <div className="text-xs text-muted-foreground mt-1">{m.result_text}</div>}
          </Card>
        );})}
      </div>
    </div>
  );
}
