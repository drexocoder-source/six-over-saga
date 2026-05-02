import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOrCreateLeague, type League } from "@/lib/league";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Gavel, Calendar, Play, Loader2, Sparkles } from "lucide-react";

export default function Dashboard() {
  const nav = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [stats, setStats] = useState({ players: 0, seasons: 0, matches: 0 });
  const [loading, setLoading] = useState(true);
  const [activeSeason, setActiveSeason] = useState<{ id: string; season_number: number; year: number; auction_status: string; status: string } | null>(null);

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
        const { count } = await supabase.from("matches").select("*", { count: "exact", head: true }).in("season_id", ids);
        mc = count ?? 0;
        const ongoing = seasons.find(s => s.status !== "done") ?? seasons[0];
        setActiveSeason(ongoing as never);
      }
      setStats({ players: pc ?? 0, seasons: seasons?.length ?? 0, matches: mc });
      setLoading(false);
    })();
  }, []);

  async function startNewSeason() {
    if (!league) return;
    const nextNum = (activeSeason?.season_number ?? 0) + 1;
    const { data, error } = await supabase.from("seasons").insert({
      league_id: league.id,
      season_number: nextNum,
      year: 2007 + nextNum,
      auction_status: "pending",
      status: "auction",
    }).select().single();
    if (!error && data) nav("/auction");
  }

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs tracking-[0.3em] text-primary/80 mb-1">YOUR LEAGUE</div>
          <h1 className="font-display text-5xl md:text-6xl tracking-wider text-foreground">{league?.name}</h1>
          <p className="text-muted-foreground mt-1">{league?.settings.oversPerInnings}-over T20 cricket • {league?.teams.length} teams • all-out at {league?.settings.allOutWickets} wickets</p>
        </div>
        {!activeSeason || activeSeason.status === "done" ? (
          <Button size="lg" onClick={startNewSeason} className="gradient-primary text-primary-foreground font-semibold pulse-glow">
            <Sparkles className="w-4 h-4 mr-2" /> Start Season {(activeSeason?.season_number ?? 0) + 1}
          </Button>
        ) : (
          <Button size="lg" onClick={() => nav(activeSeason.auction_status !== "done" ? "/auction" : "/schedule")} className="gradient-primary text-primary-foreground font-semibold">
            Continue Season {activeSeason.season_number}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={<Trophy className="w-4 h-4" />} label="Seasons" value={stats.seasons} />
        <StatTile icon={<Calendar className="w-4 h-4" />} label="Matches" value={stats.matches} />
        <StatTile icon={<Gavel className="w-4 h-4" />} label="Players in Pool" value={stats.players} />
        <StatTile icon={<Play className="w-4 h-4" />} label="Teams" value={league?.teams.length ?? 0} />
      </div>

      <Card className="p-6 gradient-card border-border/60">
        <div className="text-sm uppercase tracking-widest text-muted-foreground mb-3">How it works</div>
        <ol className="space-y-2 text-sm leading-relaxed text-foreground/90 list-decimal list-inside">
          <li><b className="text-primary">Auction</b> — AI runs the bidding, you can override any pick. Squads auto-fill to meet role minimums.</li>
          <li><b className="text-primary">Schedule</b> — Round-robin double + final. Live points table with NRR.</li>
          <li><b className="text-primary">Live Match</b> — 20 overs per innings, 4-over powerplay, all-out at 10 wickets. Tap balls or run the AI sim.</li>
          <li><b className="text-primary">Records</b> — Firsts, bests, orange/purple caps tracked across seasons.</li>
        </ol>
      </Card>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="p-4 gradient-card border-border/60">
      <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-widest">
        <span>{label}</span>{icon}
      </div>
      <div className="font-display text-3xl mt-1 text-foreground">{value}</div>
    </Card>
  );
}
