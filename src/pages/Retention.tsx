// Retention page — for mini-auctions, pick which players from previous season to keep.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import { seasonCycleFor } from "@/lib/seasonCycle";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Shield, Trophy, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";

export default function Retention() {
  const nav = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<any | null>(null);
  const [prevSeason, setPrevSeason] = useState<any | null>(null);
  const [squads, setSquads] = useState<Record<string, any[]>>({});
  const [retentions, setRetentions] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);

  const cycle = useMemo(() => season ? seasonCycleFor(season.season_number) : null, [season]);

  useEffect(() => {
    (async () => {
      const lg = await getOrCreateLeague();
      setLeague(lg);
      const { data: seasons } = await supabase.from("seasons").select("*").eq("league_id", lg.id).order("season_number", { ascending: false }).limit(2);
      const cur = seasons?.[0]; const prev = seasons?.[1];
      if (!cur) { toast.error("No active season"); nav("/"); return; }
      setSeason(cur);
      setPrevSeason(prev);
      const cy = seasonCycleFor(cur.season_number);
      if (cy.type === "mega") {
        toast.info("Mega auction — no retentions, fresh start!");
        nav("/auction");
        return;
      }
      if (!prev) { toast.info("No previous season to retain from"); nav("/auction"); return; }
      // Load previous season's squads
      const { data: prevSquads } = await supabase
        .from("squads").select("*, players(id,name,role,rating,nationality,pfp_url)").eq("season_id", prev.id);
      const sq: Record<string, any[]> = {};
      (prevSquads ?? []).forEach((row: any) => {
        if (!row.players) return;
        const tid = row.team_id;
        sq[tid] ??= [];
        sq[tid].push({ ...row, player: row.players });
      });
      Object.keys(sq).forEach(k => sq[k].sort((a, b) => b.player.rating - a.player.rating));
      setSquads(sq);
      const init: Record<string, Set<string>> = {};
      Object.keys(sq).forEach(k => init[k] = new Set());
      setRetentions(init);
      setLoading(false);
    })();
  }, []);

  const toggle = (teamId: string, playerId: string) => {
    setRetentions(r => {
      const copy = { ...r };
      const set = new Set(copy[teamId] ?? []);
      if (set.has(playerId)) set.delete(playerId);
      else if (set.size < (cycle?.maxRetentions ?? 4)) set.add(playerId);
      else { toast.warning(`Max ${cycle?.maxRetentions} retentions per team`); return r; }
      copy[teamId] = set;
      return copy;
    });
  };

  const totalRetainedCost = (teamId: string) => {
    const set = retentions[teamId] ?? new Set();
    return (squads[teamId] ?? []).filter(s => set.has(s.player_id)).reduce((a, s) => a + Number(s.price), 0);
  };

  async function confirmRetentions() {
    if (!season || !league || !cycle) return;
    // Insert retained squads into the new season
    const rows: any[] = [];
    for (const tid of Object.keys(retentions)) {
      const set = retentions[tid];
      (squads[tid] ?? []).filter(s => set.has(s.player_id)).forEach(s => {
        rows.push({
          season_id: season.id, team_id: tid, player_id: s.player_id,
          price: Number(s.price), retained: true, retention_price: Number(s.price),
          is_captain: s.is_captain, is_vice_captain: s.is_vice_captain,
        });
      });
    }
    if (rows.length) {
      const { error } = await supabase.from("squads").insert(rows);
      if (error) { toast.error("Failed to save retentions"); return; }
    }
    await supabase.from("seasons").update({ auction_type: "mini", purse: cycle.purse }).eq("id", season.id);
    toast.success(`✅ Retained ${rows.length} players. Off to the auction!`);
    nav("/auction");
  }

  if (loading || !league || !season) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs tracking-[0.3em] text-primary/80">SEASON {season.season_number} • RETENTION WINDOW</div>
        <h1 className="font-display text-4xl tracking-wider">Mini Auction Retentions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick up to <b className="text-primary">{cycle?.maxRetentions}</b> players per team. Retained at original purchase price.
          Mini purse: <b className="text-primary">₹{cycle?.purse}cr</b> (minus retained costs).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(squads).map(([tid, sq]) => {
          const retCount = retentions[tid]?.size ?? 0;
          const retCost = totalRetainedCost(tid);
          const remainingPurse = (cycle?.purse ?? 50) - retCost;
          return (
            <Card key={tid} className="p-4 gradient-card border-border/60 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: teamColor(tid, league.teams) }} />
              <div className="flex items-center justify-between mb-3">
                <div className="font-display text-2xl tracking-wider" style={{ color: teamColor(tid, league.teams) }}>{tid}</div>
                <div className="text-xs">
                  <span className="text-muted-foreground">Retaining </span><b className="text-primary">{retCount}/{cycle?.maxRetentions}</b>
                  <span className="text-muted-foreground"> · Cost </span><b className="text-primary">₹{retCost.toFixed(1)}cr</b>
                  <span className="text-muted-foreground"> · Auction purse </span><b className={remainingPurse < 5 ? "text-destructive" : "text-primary"}>₹{remainingPurse.toFixed(1)}cr</b>
                </div>
              </div>
              <div className="space-y-1">
                {sq.map(s => {
                  const checked = retentions[tid]?.has(s.player_id);
                  return (
                    <button
                      key={s.player_id}
                      onClick={() => toggle(tid, s.player_id)}
                      className={`w-full flex items-center gap-2 text-xs py-2 px-3 rounded transition-all border
                        ${checked ? "bg-primary/15 border-primary glow-primary" : "bg-secondary/30 border-border/40 hover:bg-secondary/50"}`}
                    >
                      {s.is_captain && <Crown className="w-3 h-3 text-primary" />}
                      {s.is_vice_captain && <Shield className="w-3 h-3 text-accent" />}
                      <span className="flex-1 text-left truncate">{s.player.name}</span>
                      <Badge variant="outline" className="text-[9px]">{s.player.role}</Badge>
                      <span className="font-mono text-primary">⭐{s.player.rating}</span>
                      <span className="font-mono text-muted-foreground">₹{Number(s.price).toFixed(1)}</span>
                      {checked && <Trophy className="w-3 h-3 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={() => nav("/")}><X className="w-4 h-4 mr-1"/>Cancel</Button>
        <Button size="lg" onClick={confirmRetentions} className="gradient-primary text-primary-foreground">
          Lock Retentions & Open Auction <ArrowRight className="w-4 h-4 ml-2"/>
        </Button>
      </div>
    </div>
  );
}
