// Retention page — for mini-auctions, pick which players from previous season to keep.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import { seasonCycleFor, retentionCost } from "@/lib/seasonCycle";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Shield, Trophy, ArrowRight, X, Sparkles } from "lucide-react";
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
      // Mega still allows retentions from S2 onward (IPL style)
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

  /** AI Retain — picks the best squad to retain for every team based on rating, role scarcity,
   *  cycle limits (mega: 5 max + ≥1 uncapped), and remaining purse. Pure heuristic, no LLM. */
  function aiRetainAll() {
    if (!cycle) return;
    const next: Record<string, Set<string>> = {};
    const isMega = cycle.type === "mega";
    const SOFT_PURSE_FLOOR = 30; // keep at least this much for auction
    for (const tid of Object.keys(squads)) {
      const roster = (squads[tid] ?? []).slice();
      // Score: rating + role bonus (rare roles weigh more) + captaincy bonus
      const roleCounts: Record<string, number> = {};
      for (const s of roster) roleCounts[s.player.role] = (roleCounts[s.player.role] ?? 0) + 1;
      const scored = roster.map(s => {
        const rarity = 6 / Math.max(1, roleCounts[s.player.role]);
        const capBonus = s.is_captain ? 8 : s.is_vice_captain ? 3 : 0;
        return { s, score: (s.player.rating ?? 60) + rarity * 2 + capBonus };
      }).sort((a, b) => b.score - a.score);

      const picks = new Set<string>();
      const capped = scored.filter(x => (x.s.player.rating ?? 0) >= 75);
      const uncapped = scored.filter(x => (x.s.player.rating ?? 0) < 75);
      let cappedIdx = 0;
      let uncappedIdx = 0;
      const cap = isMega ? 5 : 99;

      // Mega rule: reserve 1 slot for uncapped if available
      const reserveUncapped = isMega && uncapped.length > 0;
      const cappedQuota = reserveUncapped ? cap - 1 : cap;

      // Calculate cost as we go (mirrors retentionLines logic)
      const calcCost = (cappedTaken: number, uncappedTaken: number) => {
        let sum = 0;
        for (let i = 0; i < cappedTaken; i++) sum += retentionCost(cycle, i + 1, false);
        sum += uncappedTaken * cycle.retention.uncappedCost;
        return sum;
      };

      // Greedily add capped players
      let cappedTaken = 0, uncappedTaken = 0;
      while (cappedTaken < cappedQuota && cappedIdx < capped.length) {
        const candidate = capped[cappedIdx++];
        const trial = calcCost(cappedTaken + 1, uncappedTaken);
        if (cycle.purse - trial < SOFT_PURSE_FLOOR) break;
        picks.add(candidate.s.player_id);
        cappedTaken++;
      }
      // Add uncapped(s)
      while (uncappedTaken < (cap - cappedTaken) && uncappedIdx < uncapped.length) {
        // For mini, only add an uncapped if the player is high-rated for their tier
        const candidate = uncapped[uncappedIdx++];
        if (!isMega && (candidate.s.player.rating ?? 0) < 68) break;
        const trial = calcCost(cappedTaken, uncappedTaken + 1);
        if (cycle.purse - trial < SOFT_PURSE_FLOOR) break;
        picks.add(candidate.s.player_id);
        uncappedTaken++;
        if (isMega && uncappedTaken >= 1 && cappedTaken + uncappedTaken >= cap) break;
      }
      next[tid] = picks;
    }
    setRetentions(next);
    toast.success(`🤖 AI retained players for ${Object.keys(next).length} teams`);
  }

  /** Returns ordered retention list for a team with computed bracket cost. */
  function retentionLines(teamId: string) {
    if (!cycle) return [] as { s: any; cost: number; uncapped: boolean }[];
    const set = retentions[teamId] ?? new Set();
    const picks = (squads[teamId] ?? []).filter(s => set.has(s.player_id));
    // Capped (rating ≥ 75) first, ordered by rating desc — cheapest premium first
    const capped = picks.filter(p => (p.player.rating ?? 0) >= 75).sort((a, b) => b.player.rating - a.player.rating);
    const unc = picks.filter(p => (p.player.rating ?? 0) < 75);
    const out: { s: any; cost: number; uncapped: boolean }[] = [];
    capped.forEach((s, i) => out.push({ s, cost: retentionCost(cycle, i + 1, false), uncapped: false }));
    unc.forEach((s) => out.push({ s, cost: cycle.retention.uncappedCost, uncapped: true }));
    return out;
  }

  const totalRetainedCost = (teamId: string) =>
    retentionLines(teamId).reduce((a, l) => a + l.cost, 0);

  async function confirmRetentions() {
    if (!season || !league || !cycle) return;
    const rows: any[] = [];
    for (const tid of Object.keys(retentions)) {
      const lines = retentionLines(tid);
      lines.forEach(({ s, cost }) => {
        rows.push({
          season_id: season.id, team_id: tid, player_id: s.player_id,
          price: cost, retained: true, retention_price: cost,
          is_captain: s.is_captain, is_vice_captain: s.is_vice_captain,
        });
      });
    }
    if (rows.length) {
      const { error } = await supabase.from("squads").insert(rows);
      if (error) { toast.error("Failed to save retentions"); return; }
    }
    await supabase.from("seasons").update({ auction_type: cycle.type, purse: cycle.purse }).eq("id", season.id);
    toast.success(`✅ Retained ${rows.length} players. Off to the auction!`);
    nav("/auction");
  }

  if (loading || !league || !season) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs tracking-[0.3em] text-primary/80">SEASON {season.season_number} • RETENTION WINDOW · {cycle?.type.toUpperCase()} AUCTION</div>
        <h1 className="font-display text-4xl tracking-wider">{cycle?.type === "mega" ? "Mega" : "Mini"} Auction Retentions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick up to <b className="text-primary">{cycle?.maxRetentions}</b> per team. Total purse: <b className="text-primary">₹{cycle?.purse}cr</b> · costs <b>deducted from auction purse</b> (IPL style).
        </p>
        {cycle && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2 text-[11px]">
            {cycle.retention.costs.map((c, i) => (
              <div key={i} className="px-2 py-1.5 rounded bg-secondary/40 border border-border/40">
                <span className="text-muted-foreground">Capped #{i + 1}</span>
                <div className="font-mono font-bold text-primary">₹{c}cr</div>
              </div>
            ))}
            <div className="px-2 py-1.5 rounded bg-secondary/40 border border-border/40">
              <span className="text-muted-foreground">Uncapped (&lt;75 ⭐)</span>
              <div className="font-mono font-bold text-primary">₹{cycle.retention.uncappedCost}cr</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(squads).map(([tid, sq]) => {
          const lines = retentionLines(tid);
          const retCount = lines.length;
          const retCost = lines.reduce((a, l) => a + l.cost, 0);
          const remainingPurse = (cycle?.purse ?? 50) - retCost;
          const costByPlayer = new Map(lines.map(l => [l.s.player_id, l]));
          return (
            <Card key={tid} className="p-4 gradient-card border-border/60 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: teamColor(tid, league.teams) }} />
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="font-display text-2xl tracking-wider" style={{ color: teamColor(tid, league.teams) }}>{tid}</div>
                <div className="text-xs">
                  <span className="text-muted-foreground">Retaining </span><b className="text-primary">{retCount}/{cycle?.maxRetentions}</b>
                  <span className="text-muted-foreground"> · Cost </span><b className="text-primary">₹{retCost.toFixed(1)}cr</b>
                  <span className="text-muted-foreground"> · Auction purse </span><b className={remainingPurse < 10 ? "text-destructive" : "text-primary"}>₹{remainingPurse.toFixed(1)}cr</b>
                </div>
              </div>
              <div className="space-y-1">
                {sq.map(s => {
                  const checked = retentions[tid]?.has(s.player_id);
                  const line = costByPlayer.get(s.player_id);
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
                      {checked && line ? (
                        <span className={`font-mono font-bold ${line.uncapped ? "text-emerald-400" : "text-amber-400"}`}>−₹{line.cost}cr</span>
                      ) : (
                        <span className="font-mono text-muted-foreground/60">~₹{Number(s.price).toFixed(1)}</span>
                      )}
                      {checked && <Trophy className="w-3 h-3 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between items-center flex-wrap gap-3">
        <Button variant="ghost" onClick={() => nav("/")}><X className="w-4 h-4 mr-1"/>Cancel</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={aiRetainAll} className="border-primary/40 text-primary hover:bg-primary/10">
            <Sparkles className="w-4 h-4 mr-2"/>AI Retain (auto-pick)
          </Button>
          <Button size="lg" onClick={confirmRetentions} className="gradient-primary text-primary-foreground">
            Lock Retentions & Open Auction <ArrowRight className="w-4 h-4 ml-2"/>
          </Button>
        </div>
      </div>
    </div>
  );
}
