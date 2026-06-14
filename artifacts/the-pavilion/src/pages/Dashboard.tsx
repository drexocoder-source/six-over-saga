import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOrCreateLeague, type League } from "@/lib/league";
import { supabase } from "@/integrations/supabase/client";
import { teamColor } from "@/lib/teams";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, Gavel, Calendar, Play, Loader2, Sparkles,
  TrendingUp, Users, Zap, ChevronRight, BarChart3, Award, Shirt
} from "lucide-react";
import { toast } from "sonner";
import { JerseyCard } from "@/components/JerseyCard";
import { getStoredWonderkids, type Wonderkid } from "@/lib/wonderkids";

export default function Dashboard() {
  const nav = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [stats, setStats] = useState({ players: 0, seasons: 0, matches: 0 });
  const [loading, setLoading] = useState(true);
  const [startingSeason, setStartingseason] = useState(false);
  const [activeSeason, setActiveSeason] = useState<{ id: string; season_number: number; year: number; auction_status: string; status: string } | null>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [wonderkids, setWonderkids] = useState<Wonderkid[]>([]);

  useEffect(() => {
    (async () => {
      const lg = await getOrCreateLeague();
      setLeague(lg);
      const [{ count: pc }, { data: seasons }] = await Promise.all([
        supabase.from("players").select("*", { count: "exact", head: true }).eq("league_id", lg.id),
        supabase.from("seasons").select("*").eq("league_id", lg.id).order("season_number", { ascending: false }),
      ]);
      let mc = 0;
      if (seasons && seasons.length) {
        const ids = seasons.map(s => s.id);
        const [{ count }, { data: rm }] = await Promise.all([
          supabase.from("matches").select("*", { count: "exact", head: true }).in("season_id", ids),
          supabase.from("matches").select("team_a,team_b,winner,result_text,match_number,status,scorecard")
            .in("season_id", ids).eq("status", "done").order("match_number", { ascending: false }).limit(5),
        ]);
        mc = count ?? 0;
        setRecentMatches(rm ?? []);
        const ongoing = seasons.find(s => s.status !== "done") ?? seasons[0];
        setActiveSeason(ongoing as never);
      }
      setStats({ players: pc ?? 0, seasons: seasons?.length ?? 0, matches: mc });
      setWonderkids(getStoredWonderkids());
      setLoading(false);
    })();
  }, []);

  async function startNewSeason() {
    if (!league || startingSeason) return;
    // Guard: if there's already an active (non-done) season, go there instead of creating a duplicate
    if (activeSeason && activeSeason.status !== "done") {
      nav(activeSeason.auction_status !== "done" ? "/auction" : "/schedule");
      return;
    }
    setStartingseason(true);
    const nextNum = (activeSeason?.season_number ?? 0) + 1;
    const { data, error } = await supabase.from("seasons").insert({
      league_id: league.id,
      season_number: nextNum,
      year: 2007 + nextNum,
      auction_status: "pending",
      status: "auction",
    }).select().single();
    setStartingseason(false);
    if (error) {
      console.error("[startNewSeason] error:", error);
      toast.error(`Failed to start season: ${error.message}`);
      return;
    }
    if (data) nav("/auction");
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="animate-spin text-primary w-8 h-8"/>
    </div>
  );

  const currentSeasonNum = activeSeason?.season_number ?? 0;

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl">
      {/* Hero */}
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-transparent -z-10"/>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 p-6 rounded-2xl border border-border/40 bg-secondary/10 backdrop-blur-sm">
          <div>
            <div className="text-[10px] tracking-[0.4em] text-primary/70 mb-1 uppercase">Your League</div>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-wider text-foreground leading-none">{league?.name}</h1>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <Badge variant="outline" className="text-xs border-border/60">{league?.settings.oversPerInnings}-over T20</Badge>
              <Badge variant="outline" className="text-xs border-border/60">{league?.teams.length} Franchises</Badge>
              <Badge variant="outline" className="text-xs border-border/60">All-out at {league?.settings.allOutWickets}W</Badge>
              {activeSeason && activeSeason.status !== "done" && (
                <Badge className="text-xs bg-primary/20 text-primary border-primary/40">Season {activeSeason.season_number} Live</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {!activeSeason || activeSeason.status === "done" ? (
              <Button size="lg" onClick={startNewSeason} disabled={startingSeason} className="gradient-primary text-primary-foreground font-semibold pulse-glow gap-2">
                {startingSeason ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {startingSeason ? "Starting…" : `Start Season ${(activeSeason?.season_number ?? 0) + 1}`}
              </Button>
            ) : (
              <Button size="lg" onClick={() => nav(activeSeason.auction_status !== "done" ? "/auction" : "/schedule")} className="gradient-primary text-primary-foreground font-semibold gap-2">
                <Zap className="w-4 h-4"/>Continue Season {activeSeason.season_number}
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-xs" onClick={() => nav("/schedule")}>
              View Schedule <ChevronRight className="w-3 h-3 ml-1"/>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={<Trophy className="w-4 h-4"/>} label="Seasons" value={stats.seasons} accent="text-amber-400" onClick={() => nav("/history")}/>
        <StatTile icon={<Calendar className="w-4 h-4"/>} label="Matches Played" value={stats.matches} accent="text-blue-400" onClick={() => nav("/schedule")}/>
        <StatTile icon={<Users className="w-4 h-4"/>} label="Players in Pool" value={stats.players} accent="text-green-400" onClick={() => nav("/players")}/>
        <StatTile icon={<Play className="w-4 h-4"/>} label="Teams" value={league?.teams.length ?? 0} accent="text-primary" onClick={() => nav("/squads")}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Nav */}
        <div className="space-y-3 lg:col-span-2">
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Quick Access</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <Gavel className="w-5 h-5"/>, label: "Auction", desc: "AI bidding room", path: "/auction", color: "text-amber-400" },
              { icon: <Calendar className="w-5 h-5"/>, label: "Schedule", desc: "Fixtures & table", path: "/schedule", color: "text-blue-400" },
              { icon: <Play className="w-5 h-5"/>, label: "Live Match", desc: "Ball-by-ball sim", path: "/match", color: "text-green-400" },
              { icon: <BarChart3 className="w-5 h-5"/>, label: "Records", desc: "All-time stats", path: "/records", color: "text-primary" },
              { icon: <Award className="w-5 h-5"/>, label: "Ceremony", desc: "Season awards", path: "/ceremony", color: "text-purple-400" },
              { icon: <Shirt className="w-5 h-5"/>, label: "Jerseys", desc: "Season kits", path: "/history", color: "text-pink-400" },
              { icon: <TrendingUp className="w-5 h-5"/>, label: "Analytics", desc: "Deep stats", path: "/records", color: "text-cyan-400" },
              { icon: <Users className="w-5 h-5"/>, label: "Players", desc: "Career profiles", path: "/players", color: "text-orange-400" },
            ].map(item => (
              <button key={item.path + item.label} onClick={() => nav(item.path)}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/30 hover:border-primary/30 transition-all text-left group">
                <div className={`${item.color} opacity-80 group-hover:opacity-100 transition-opacity`}>{item.icon}</div>
                <div>
                  <div className="font-display text-sm tracking-wider leading-none">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right column: Wonderkids + Recent results + jerseys */}
        <div className="space-y-4">
          {/* 🌟 Hidden Wonderkids discovered this season */}
          {wonderkids.length > 0 && (
            <Card className="p-4 gradient-card border-amber-500/30 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.06), rgba(245,158,11,0.04))" }}>
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-transparent" />
              <div className="text-[10px] tracking-[0.3em] uppercase text-amber-400/80 mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Wonderkids Discovered — Season {wonderkids[0]?.discoveredSeason ?? "?"}
              </div>
              <div className="space-y-3">
                {wonderkids.map(wk => (
                  <div key={wk.id} className="flex items-start gap-3 p-2.5 rounded-xl" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-base">
                      ⭐
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-sm tracking-wider text-amber-300">{wk.name}</span>
                        <span className="text-[9px] text-muted-foreground">{wk.age}yo · {wk.nationality}</span>
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{wk.role} · {wk.trait}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] text-muted-foreground">Rating <span className="text-amber-400 font-bold">{wk.currentRating}</span></span>
                        <span className="text-white/15">·</span>
                        <span className="text-[9px] text-muted-foreground">Potential <span className="text-amber-300 font-black">{wk.potential}</span></span>
                        {/* Potential bar */}
                        <div className="flex-1 h-1 rounded-full overflow-hidden bg-white/05">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                            style={{ width: `${wk.potential}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="mt-2 text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors" onClick={() => nav("/auction")}>
                Find them in the auction →
              </button>
            </Card>
          )}

          {recentMatches.length > 0 && (
            <Card className="p-4 gradient-card border-border/60">
              <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
                <Trophy className="w-3 h-3 text-primary"/>Recent Results
              </div>
              <div className="space-y-2">
                {recentMatches.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/20 last:border-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-display text-sm shrink-0" style={{ color: league ? teamColor(m.team_a, league.teams) : undefined }}>{m.team_a}</span>
                      <span className="text-muted-foreground shrink-0">vs</span>
                      <span className="font-display text-sm shrink-0" style={{ color: league ? teamColor(m.team_b, league.teams) : undefined }}>{m.team_b}</span>
                    </div>
                    {m.winner && (
                      <Badge variant="outline" className="text-[9px] shrink-0 ml-2" style={{ color: league ? teamColor(m.winner, league.teams) : undefined, borderColor: league ? teamColor(m.winner, league.teams) : undefined }}>
                        {m.winner} W
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Mini jersey showcase */}
          <Card className="p-4 gradient-card border-border/60">
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
              <Shirt className="w-3 h-3 text-primary"/>Season {currentSeasonNum || 1} Kits
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {(league?.teams ?? []).slice(0, 6).map(team => (
                <JerseyCard
                  key={team.id}
                  teamName={team.id}
                  primaryColor={team.primary}
                  secondaryColor="#ffffff"
                  seasonNumber={currentSeasonNum || 1}
                  size="sm"
                />
              ))}
            </div>
            <button onClick={() => nav("/history")} className="mt-3 w-full text-[10px] text-muted-foreground hover:text-primary transition-colors text-center">
              View all kits in Season History →
            </button>
          </Card>
        </div>
      </div>

      {/* How it works - collapsible */}
      <Card className="p-5 gradient-card border-border/60">
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3 flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-primary"/>How it works
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { n: "1", title: "Auction", desc: "AI runs the bidding. Override any pick. Squads auto-fill.", icon: <Gavel className="w-4 h-4"/>},
            { n: "2", title: "Schedule", desc: "Round-robin double + final. Live points table with NRR.", icon: <Calendar className="w-4 h-4"/>},
            { n: "3", title: "Live Match", desc: "Ball-by-ball sim with powerplay, all-out rules.", icon: <Play className="w-4 h-4"/>},
            { n: "4", title: "Records", desc: "Firsts, bests, caps, and deep analytics across all seasons.", icon: <BarChart3 className="w-4 h-4"/>},
          ].map(step => (
            <div key={step.n} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{step.n}</span>
              </div>
              <div>
                <div className="font-display text-sm tracking-wider text-foreground flex items-center gap-1.5">{step.icon}{step.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatTile({ icon, label, value, accent, onClick }: { icon: React.ReactNode; label: string; value: number | string; accent: string; onClick?: () => void }) {
  return (
    <Card onClick={onClick} className={`p-4 gradient-card border-border/60 hover:border-primary/40 transition-all ${onClick ? "cursor-pointer hover:bg-secondary/30" : ""} group`}>
      <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-widest mb-2">
        <span>{label}</span>
        <span className={`${accent} opacity-70 group-hover:opacity-100 transition-opacity`}>{icon}</span>
      </div>
      <div className={`font-display text-4xl font-bold ${accent}`}>{value}</div>
    </Card>
  );
}
