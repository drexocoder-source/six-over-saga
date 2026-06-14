import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor, teamFull } from "@/lib/teams";
import { teamLogo } from "@/lib/teamLogos";
import { analyzeSquad, type RoleBalance } from "@/lib/squadDepth";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, Layers, ShieldCheck, Users, Star, TrendingUp } from "lucide-react";

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  bat:     { label: "Batters",        color: "hsl(142 55% 48%)", bg: "hsl(142 55% 48% / 0.12)" },
  bowl:    { label: "Bowlers",        color: "hsl(270 60% 60%)", bg: "hsl(270 60% 60% / 0.12)" },
  ar:      { label: "All-Rounders",   color: "hsl(36 95% 55%)",  bg: "hsl(36 95% 55% / 0.12)" },
  wk:      { label: "Wicket-Keepers", color: "hsl(200 80% 55%)", bg: "hsl(200 80% 55% / 0.12)" },
  overseas:{ label: "Overseas",       color: "hsl(330 70% 60%)", bg: "hsl(330 70% 60% / 0.12)" },
};

function DepthBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }} />
      </div>
      <span className="font-mono font-bold text-sm w-5 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className="w-3 h-3"
          fill={i <= rating ? "hsl(var(--primary))" : "none"}
          stroke={i <= rating ? "hsl(var(--primary))" : "rgba(255,255,255,0.15)"}
          strokeWidth={1.5} />
      ))}
    </div>
  );
}

export default function SquadDepth() {
  const [league, setLeague] = useState<League | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const lg = await getOrCreateLeague(); setLeague(lg);
    const { data } = await supabase.from("seasons").select("*").eq("league_id", lg.id).order("season_number", { ascending: false });
    const allSeasons = data ?? [];
    const best: Record<number, any> = {};
    allSeasons.forEach((season: any) => {
      const n = season.season_number;
      const existing = best[n];
      if (!existing) { best[n] = season; return; }
      const isDone = season.auction_status === "done";
      const existingDone = existing.auction_status === "done";
      if (isDone && !existingDone) { best[n] = season; return; }
      if (!isDone && existingDone) return;
      if (season.created_at > existing.created_at) best[n] = season;
    });
    const deduped = Object.values(best).sort((a: any, b: any) => b.season_number - a.season_number);
    setSeasons(deduped);
    if (deduped.length) setSeasonId(deduped[0].id);
    setLoading(false);
  })(); }, []);

  useEffect(() => { (async () => {
    if (!seasonId) return;
    const { data } = await supabase.from("squads").select("*, players(*)").eq("season_id", seasonId);
    setRows(data ?? []);
  })(); }, [seasonId]);

  const teamAnalyses = useMemo(() => {
    if (!league || !rows.length) return [];
    return league.teams.map(team => {
      const squad = rows.filter(r => r.team_id === team.id);
      const players = squad.map((s: any) => ({
        role: s.players?.role ?? "",
        rating: s.players?.rating ?? 60,
      }));
      const analysis = analyzeSquad(players, team.id);
      return { team, squad, analysis };
    }).filter(t => t.squad.length > 0);
  }, [league, rows]);

  if (loading || !league) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="animate-spin text-primary w-8 h-8"/>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="kicker mb-1">ROSTER ANALYSIS</div>
          <h1 className="font-display text-5xl tracking-wider flex items-center gap-3">
            <Layers className="w-8 h-8 text-primary"/>
            Squad Depth
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Role balance, marquee counts and tactical gaps.</p>
        </div>

        {/* Season picker */}
        {seasons.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {seasons.map(s => (
              <button key={s.id} onClick={() => setSeasonId(s.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-widest transition-all ${
                  seasonId === s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
                }`}>
                S{s.season_number}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {Object.entries(ROLE_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">{v.label}</span>
          </div>
        ))}
      </div>

      {/* Team analyses */}
      {teamAnalyses.length === 0 ? (
        <div className="text-center py-16 rounded-xl plaque">
          <Users className="w-12 h-12 mx-auto text-primary/20 mb-4" />
          <div className="font-display text-2xl text-foreground/40">No squad data</div>
          <p className="text-sm text-muted-foreground mt-2">Run the auction first to populate squads.</p>
        </div>
      ) : (
        <Tabs defaultValue={teamAnalyses[0]?.team.id}>
          <TabsList className="flex-wrap h-auto gap-1 p-1 bg-secondary/30">
            {teamAnalyses.map(({ team }) => (
              <TabsTrigger key={team.id} value={team.id} className="flex items-center gap-1.5 text-xs">
                <img src={teamLogo(team.id)} alt={team.id} className="w-4 h-4 object-contain opacity-80" />
                <span style={{ color: teamColor(team.id, league.teams) }}>{team.id}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {teamAnalyses.map(({ team, squad, analysis }) => {
            const tc = teamColor(team.id, league.teams);
            const logo = teamLogo(team.id);
            const rb: RoleBalance = analysis;
            const maxRole = Math.max(rb.bat, rb.bowl, rb.ar, rb.wk, 1);

            const captain = squad.find((s: any) => s.is_captain);
            const viceCaptain = squad.find((s: any) => s.is_vice_captain);
            const marquees = squad.filter((s: any) => (s.players?.rating ?? 0) >= 80);
            const overseas = squad.filter((s: any) => s.players?.is_overseas);
            const avgRating = squad.length ? Math.round(squad.reduce((acc: number, s: any) => acc + (s.players?.rating ?? 60), 0) / squad.length) : 0;

            return (
              <TabsContent key={team.id} value={team.id} className="mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* ── Team Overview Card ── */}
                  <div className="rounded-xl overflow-hidden"
                    style={{
                      background: `linear-gradient(160deg, color-mix(in srgb, ${tc} 12%, #0d0d0d) 0%, #09090b 75%)`,
                      border: `1px solid ${tc}33`,
                      boxShadow: `0 0 30px -10px ${tc}44`,
                    }}>
                    <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${tc}, transparent)` }} />
                    <div className="p-6">
                      <div className="flex items-center gap-4 mb-5">
                        <img src={logo} alt={team.id} className="w-14 h-14 object-contain"
                          style={{ filter: `drop-shadow(0 0 8px ${tc}66)` }} />
                        <div>
                          <div className="font-display text-2xl tracking-wider" style={{ color: tc }}>{team.id}</div>
                          <div className="text-[10px] text-white/30 leading-tight">{teamFull(team.id, league.teams)}</div>
                        </div>
                      </div>

                      {/* Key stats */}
                      <div className="space-y-3">
                        <StatRow label="Squad Size" value={squad.length.toString()} color={tc} />
                        <StatRow label="Avg Rating" value={String(avgRating)} color={tc} />
                        <StatRow label="Marquees (80+)" value={marquees.length.toString()} color={tc} />
                        <StatRow label="Overseas" value={`${overseas.length}/4`} color={tc} />
                      </div>

                      {/* Captain + Vice */}
                      {(captain || viceCaptain) && (
                        <div className="mt-4 space-y-2">
                          {captain && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                              style={{ background: `${tc}15`, border: `1px solid ${tc}33` }}>
                              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: tc }}>C</span>
                              <span className="text-white/80 truncate">{captain.players?.name ?? "—"}</span>
                            </div>
                          )}
                          {viceCaptain && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white/4 border border-white/8">
                              <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">VC</span>
                              <span className="text-white/60 truncate">{viceCaptain.players?.name ?? "—"}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Alerts */}
                      {analysis.warnings.length > 0 && (
                        <div className="mt-4 space-y-1.5">
                          {analysis.warnings.map((gap: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg"
                              style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span className="text-amber-300/80">{gap}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {analysis.warnings.length === 0 && (
                        <div className="mt-4 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                          style={{ background: "rgba(52, 211, 153, 0.1)", border: "1px solid rgba(52, 211, 153, 0.2)" }}>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-emerald-300/80">Balanced squad</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Role Balance ── */}
                  <div className="rounded-xl overflow-hidden glass-card">
                    <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="font-display text-lg tracking-wider">Role Balance</span>
                    </div>
                    <div className="p-5 space-y-5">
                      {[
                        { key: "bat",  val: rb.bat,  role: "bat" },
                        { key: "bowl", val: rb.bowl, role: "bowl" },
                        { key: "ar",   val: rb.ar,   role: "ar" },
                        { key: "wk",   val: rb.wk,   role: "wk" },
                      ].map(({ key, val, role }) => {
                        const rc = ROLE_CONFIG[role];
                        return (
                          <div key={key}>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: rc.color }}>{rc.label}</span>
                            </div>
                            <DepthBar value={val} max={maxRole > 5 ? maxRole : 5} color={rc.color} />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Marquee Players ── */}
                  <div className="rounded-xl overflow-hidden glass-card">
                    <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
                      <Star className="w-4 h-4 text-primary" />
                      <span className="font-display text-lg tracking-wider">Top Players</span>
                    </div>
                    <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                      {squad
                        .slice()
                        .sort((a: any, b: any) => (b.players?.rating ?? 0) - (a.players?.rating ?? 0))
                        .slice(0, 8)
                        .map((s: any, i: number) => {
                          const p = s.players;
                          const rating = p?.rating ?? 60;
                          const stars = Math.round((rating - 50) / 10);
                          return (
                            <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors">
                              <div className="w-7 text-center text-xs font-mono text-white/25">{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-white/90 truncate flex items-center gap-1.5">
                                  {p?.name ?? "—"}
                                  {s.is_captain && <span className="text-[9px] font-bold px-1 py-0 rounded" style={{ background: `${tc}33`, color: tc }}>C</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <StarRating rating={Math.min(5, Math.max(1, stars))} />
                                  <span className="text-[10px] text-white/25">{p?.role ?? ""}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono text-sm font-bold" style={{ color: rating >= 80 ? tc : "rgba(255,255,255,0.5)" }}>{rating}</div>
                                {p?.is_overseas && (
                                  <div className="text-[9px] text-white/30 mt-0.5">INTL</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/35 uppercase tracking-widest">{label}</span>
      <span className="font-display text-xl" style={{ color }}>{value}</span>
    </div>
  );
}
