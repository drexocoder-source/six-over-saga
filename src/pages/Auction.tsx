import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { DEFAULT_TEAMS, teamColor } from "@/lib/teams";
import { teamLogo } from "@/lib/teamLogos";
import { runAIBidRound, autoFillSquads, type AuctionPlayer, type TeamPurseState } from "@/lib/auction";
import type { Role } from "@/lib/seedPlayers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Gavel, Star, Crown, Shield, CheckCircle2, SkipForward, Wand2, ArrowRight, Bot } from "lucide-react";

interface SquadEntry { id: string; player_id: string; name: string; role: Role; rating: number; price: number; is_captain: boolean; is_vice_captain: boolean; }

const ROLE_LABEL: Record<Role,string> = { BAT:"Batter", BOWL:"Bowler", AR:"All-rounder", WK:"Wicket-keeper" };
const ROLE_COLOR: Record<Role,string> = { BAT:"bg-boundary/20 text-[hsl(var(--boundary))]", BOWL:"bg-[hsl(var(--mi))]/20 text-[hsl(var(--mi))]", AR:"bg-primary/20 text-primary", WK:"bg-accent/20 text-accent" };

export default function Auction() {
  const nav = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<{ id: string; season_number: number; auction_status: string } | null>(null);
  const [pool, setPool] = useState<AuctionPlayer[]>([]);
  const [current, setCurrent] = useState<AuctionPlayer | null>(null);
  const [purses, setPurses] = useState<Record<string, number>>({});
  const [squads, setSquads] = useState<Record<string, SquadEntry[]>>({});
  const [bidResult, setBidResult] = useState<{ winner: string|null; price: number; log: {team:string;amount:number}[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);

  const teams = league?.teams ?? DEFAULT_TEAMS;
  const settings = league?.settings;

  // Load
  useEffect(() => {
    (async () => {
      const lg = await getOrCreateLeague();
      setLeague(lg);
      const { data: seasons } = await supabase.from("seasons").select("*").eq("league_id", lg.id).order("season_number",{ ascending:false }).limit(1);
      const s = seasons?.[0];
      if (!s) { toast.error("No active season. Start one from Dashboard."); nav("/"); return; }
      setSeason(s as never);

      const [{ data: players }, { data: existingSquads }] = await Promise.all([
        supabase.from("players").select("*").eq("league_id", lg.id),
        supabase.from("squads").select("*, players(name,role,rating)").eq("season_id", s.id),
      ]);

      const allPlayers: AuctionPlayer[] = (players ?? []).map((p: any) => ({
        id: p.id, name: p.name, role: p.role, base_price: Number(p.base_price), rating: p.rating, nationality: p.nationality,
      }));

      // Build initial purses & squads from any prior auction state
      const initPurse: Record<string,number> = {};
      const initSq: Record<string,SquadEntry[]> = {};
      lg.teams.forEach(t => { initPurse[t.id] = lg.settings.startingPurse; initSq[t.id] = []; });
      const usedIds = new Set<string>();
      (existingSquads ?? []).forEach((row: any) => {
        const ent: SquadEntry = {
          id: row.id, player_id: row.player_id, name: row.players?.name, role: row.players?.role,
          rating: row.players?.rating, price: Number(row.price), is_captain: row.is_captain, is_vice_captain: row.is_vice_captain,
        };
        initSq[row.team_id] = initSq[row.team_id] || [];
        initSq[row.team_id].push(ent);
        initPurse[row.team_id] -= Number(row.price);
        usedIds.add(row.player_id);
      });
      setPurses(initPurse);
      setSquads(initSq);

      const remaining = allPlayers.filter(p => !usedIds.has(p.id));
      // Sort by rating descending for marquee feel
      remaining.sort((a,b) => b.rating - a.rating);
      setPool(remaining);
      setCurrent(s.auction_status === "done" ? null : remaining[0] ?? null);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const purseStates: TeamPurseState[] = useMemo(() => {
    return teams.map(t => ({
      teamId: t.id,
      purse: purses[t.id] ?? 0,
      squad: (squads[t.id] ?? []).map(s => ({ player_id: s.player_id, price: s.price, role: s.role, rating: s.rating })),
    }));
  }, [teams, purses, squads]);

  const allFull = useMemo(() => {
    if (!settings) return false;
    return teams.every(t => (squads[t.id]?.length ?? 0) >= settings.squadMin);
  }, [teams, squads, settings]);

  async function runBid(forceTeam?: string) {
    if (!current || !settings || !season) return;
    setBidding(true);
    setBidResult(null);
    const override = forceTeam ? { teamId: forceTeam, maxBid: 999 } : undefined;
    const res = runAIBidRound(current, purseStates, settings.squadMax, override);
    // delay for drama
    await new Promise(r => setTimeout(r, 350));
    setBidResult({ winner: res.winner, price: res.finalPrice, log: res.bidLog });
    if (res.winner) {
      // Persist
      await supabase.from("squads").insert({
        season_id: season.id, team_id: res.winner, player_id: current.id, price: res.finalPrice,
      });
      setPurses(p => ({ ...p, [res.winner!]: +(p[res.winner!] - res.finalPrice).toFixed(2) }));
      setSquads(sq => ({
        ...sq,
        [res.winner!]: [...(sq[res.winner!] ?? []), {
          id: crypto.randomUUID(), player_id: current.id, name: current.name, role: current.role,
          rating: current.rating, price: res.finalPrice, is_captain: false, is_vice_captain: false,
        }],
      }));
      toast.success(`${current.name} → ${res.winner} for ₹${res.finalPrice}cr`);
    } else {
      toast.message(`${current.name} unsold`);
    }
    setBidding(false);
  }

  function nextPlayer() {
    setBidResult(null);
    setPool(p => {
      const rest = p.slice(1);
      setCurrent(rest[0] ?? null);
      return rest;
    });
  }

  async function autoFill() {
    if (!settings || !season) return;
    const states = purseStates.map(s => ({ ...s, squad: [...s.squad] }));
    const remaining = pool.slice(); // includes current
    const assigns = autoFillSquads(states, remaining, settings.squadMin, settings.squadMax);
    if (!assigns.length) { toast.info("No auto-fills needed"); return; }
    // persist
    const rows = assigns.map(a => ({ season_id: season.id, team_id: a.teamId, player_id: a.player.id, price: a.price }));
    await supabase.from("squads").insert(rows);
    // update local
    const newSquads = { ...squads };
    const newPurse = { ...purses };
    assigns.forEach(a => {
      newSquads[a.teamId] = [...(newSquads[a.teamId] ?? []), {
        id: crypto.randomUUID(), player_id: a.player.id, name: a.player.name, role: a.player.role,
        rating: a.player.rating, price: a.price, is_captain: false, is_vice_captain: false,
      }];
      newPurse[a.teamId] = +(newPurse[a.teamId] - a.price).toFixed(2);
    });
    setSquads(newSquads);
    setPurses(newPurse);
    const usedIds = new Set(assigns.map(a => a.player.id));
    setPool(p => p.filter(x => !usedIds.has(x.id)));
    setCurrent(null);
    toast.success(`Auto-assigned ${assigns.length} player${assigns.length>1?"s":""}`);
  }

  async function simulateFullAuction() {
    if (!settings || !season || !current) return;
    setBidding(true);
    toast.message("🤖 Running full auction simulation…");

    // Local mutable copies — we'll batch persist at the end.
    const localPurses: Record<string, number> = { ...purses };
    const localSquads: Record<string, SquadEntry[]> = {};
    Object.keys(squads).forEach(k => { localSquads[k] = [...squads[k]]; });

    const queue: AuctionPlayer[] = [current, ...pool.slice(1)];
    const sold: { season_id: string; team_id: string; player_id: string; price: number }[] = [];
    const unsold: AuctionPlayer[] = [];

    for (const player of queue) {
      const states: TeamPurseState[] = teams.map(t => ({
        teamId: t.id,
        purse: localPurses[t.id] ?? 0,
        squad: (localSquads[t.id] ?? []).map(s => ({ player_id: s.player_id, price: s.price, role: s.role, rating: s.rating })),
      }));
      const res = runAIBidRound(player, states, settings.squadMax);
      if (res.winner && (localSquads[res.winner]?.length ?? 0) < settings.squadMax) {
        sold.push({ season_id: season.id, team_id: res.winner, player_id: player.id, price: res.finalPrice });
        localPurses[res.winner] = +(localPurses[res.winner] - res.finalPrice).toFixed(2);
        localSquads[res.winner].push({
          id: crypto.randomUUID(), player_id: player.id, name: player.name, role: player.role,
          rating: player.rating, price: res.finalPrice, is_captain: false, is_vice_captain: false,
        });
      } else {
        unsold.push(player);
      }
    }

    // Auto-fill anyone still below squadMin from the unsold pile (and re-look at remaining)
    const states: TeamPurseState[] = teams.map(t => ({
      teamId: t.id,
      purse: localPurses[t.id] ?? 0,
      squad: (localSquads[t.id] ?? []).map(s => ({ player_id: s.player_id, price: s.price, role: s.role, rating: s.rating })),
    }));
    const fills = autoFillSquads(states, unsold, settings.squadMin, settings.squadMax);
    fills.forEach(a => {
      sold.push({ season_id: season.id, team_id: a.teamId, player_id: a.player.id, price: a.price });
      localPurses[a.teamId] = +(localPurses[a.teamId] - a.price).toFixed(2);
      localSquads[a.teamId].push({
        id: crypto.randomUUID(), player_id: a.player.id, name: a.player.name, role: a.player.role,
        rating: a.player.rating, price: a.price, is_captain: false, is_vice_captain: false,
      });
    });

    // Persist all squad rows in one shot
    if (sold.length) await supabase.from("squads").insert(sold);

    setSquads(localSquads);
    setPurses(localPurses);
    setPool([]);
    setCurrent(null);
    setBidResult(null);
    setBidding(false);
    toast.success(`✅ Auction complete — ${sold.length} players sold across ${teams.length} teams`);
  }

  async function finalizeAuction() {
    if (!season) return;
    // Auto-assign captain (highest rating) & VC (2nd highest) per team
    for (const t of teams) {
      const sq = (squads[t.id] ?? []).slice().sort((a,b) => b.rating - a.rating);
      if (sq[0]) await supabase.from("squads").update({ is_captain: true }).eq("id", sq[0].id);
      if (sq[1]) await supabase.from("squads").update({ is_vice_captain: true }).eq("id", sq[1].id);
    }
    await supabase.from("seasons").update({ auction_status: "done", status: "league" }).eq("id", season.id);
    toast.success("Auction complete! Generating schedule…");
    nav("/schedule");
  }

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-primary/80">SEASON {season?.season_number} • AUCTION</div>
          <h1 className="font-display text-4xl tracking-wider">The Bidding Room</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="default" size="sm" onClick={simulateFullAuction} disabled={bidding || !current} className="gradient-primary text-primary-foreground">
            <Bot className="w-4 h-4 mr-2" />{bidding ? "Simulating…" : "AI Full Auction"}
          </Button>
          <Button variant="outline" size="sm" onClick={autoFill} disabled={!current && pool.length===0}>
            <Wand2 className="w-4 h-4 mr-2" />Auto-fill remaining
          </Button>
          <Button size="sm" onClick={finalizeAuction} disabled={!allFull} className="gradient-primary text-primary-foreground">
            Finalize <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Purses */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {teams.map(t => {
          const sqLen = squads[t.id]?.length ?? 0;
          const purse = purses[t.id] ?? 0;
          const full = sqLen >= (settings?.squadMax ?? 9);
          const min = sqLen >= (settings?.squadMin ?? 6);
          return (
            <Card key={t.id} className="p-3 gradient-card border-border/60 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: teamColor(t.id, teams) }} />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img src={teamLogo(t.id)} alt={`${t.fullName} crest`} loading="lazy" className="w-10 h-10 object-contain flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-display text-2xl leading-none" style={{ color: teamColor(t.id, teams) }}>{t.shortName}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{t.fullName}</div>
                  </div>
                </div>
                {full && <Badge variant="secondary" className="text-[10px]">FULL</Badge>}
                {!full && min && <Badge className="text-[10px] bg-primary/20 text-primary">MIN MET</Badge>}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Purse</span>
                <span className="font-mono font-semibold">₹{purse.toFixed(1)}cr</span>
              </div>
              <Progress value={(purse/(settings?.startingPurse ?? 100))*100} className="h-1 mt-1" />
              <div className="mt-2 text-xs text-muted-foreground">{sqLen}/{settings?.squadMax} slots</div>
              <div className="mt-1 flex gap-1 text-[10px] flex-wrap">
                {(["BAT","BOWL","AR","WK"] as Role[]).map(r => {
                  const c = (squads[t.id] ?? []).filter(x => x.role === r).length;
                  return <span key={r} className={`px-1.5 py-0.5 rounded ${ROLE_COLOR[r]}`}>{r} {c}</span>;
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Current player & bidding */}
      {current ? (
        <Card className="p-6 gradient-card border-primary/30 glow-primary animate-scale-in">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1">
              <div className="text-xs tracking-[0.3em] text-primary/80 mb-1">ON THE BLOCK</div>
              <div className="font-display text-4xl md:text-5xl tracking-wide">{current.name}</div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={ROLE_COLOR[current.role]}>{ROLE_LABEL[current.role]}</Badge>
                <Badge variant="outline" className="border-primary/40 text-primary">
                  <Star className="w-3 h-3 mr-1" />Rating {current.rating}
                </Badge>
                <Badge variant="outline">{current.nationality ?? "IND"}</Badge>
                <Badge variant="outline">Base ₹{current.base_price}cr</Badge>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto">
              {!bidResult ? (
                <>
                  <Button onClick={() => runBid()} disabled={bidding} size="lg" className="gradient-primary text-primary-foreground">
                    <Gavel className="w-4 h-4 mr-2" />{bidding ? "Bidding…" : "Run AI Bid"}
                  </Button>
                  <div className="flex gap-1 flex-wrap">
                    {teams.map(t => (
                      <Button key={t.id} size="sm" variant="outline" disabled={bidding || (squads[t.id]?.length ?? 0) >= (settings?.squadMax ?? 9)}
                        onClick={() => runBid(t.id)} style={{ borderColor: teamColor(t.id, teams) }}>
                        Force {t.shortName}
                      </Button>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={nextPlayer}><SkipForward className="w-3 h-3 mr-1" />Skip</Button>
                </>
              ) : (
                <Button onClick={nextPlayer} size="lg" className="gradient-primary text-primary-foreground">
                  Next Player <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          {bidResult && (
            <div className="mt-5 pt-5 border-t border-border/60 animate-fade-in">
              {bidResult.winner ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8" style={{ color: teamColor(bidResult.winner, teams) }} />
                  <div>
                    <div className="text-sm text-muted-foreground">SOLD TO</div>
                    <div className="font-display text-3xl" style={{ color: teamColor(bidResult.winner, teams) }}>{bidResult.winner}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-sm text-muted-foreground">FOR</div>
                    <div className="font-mono font-bold text-2xl text-primary">₹{bidResult.price}cr</div>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">UNSOLD — no team interested.</div>
              )}
              {bidResult.log.length > 0 && (
                <div className="mt-3 text-xs text-muted-foreground flex gap-2 flex-wrap">
                  {bidResult.log.map((b, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-secondary">{b.team} ₹{b.amount}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-8 text-center gradient-card border-border/60">
          <div className="font-display text-2xl mb-2">Auction pool exhausted</div>
          <p className="text-muted-foreground text-sm mb-4">Use Auto-fill if any team is below squad minimum, then finalize.</p>
        </Card>
      )}

      {/* Squads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
        {teams.map(t => (
          <Card key={t.id} className="p-3 gradient-card border-border/60">
            <div className="flex items-center justify-between mb-2">
              <div className="font-display text-lg" style={{ color: teamColor(t.id, teams) }}>{t.shortName}</div>
              <span className="text-xs text-muted-foreground">{(squads[t.id]?.length ?? 0)} players</span>
            </div>
            <div className="space-y-1">
              {(squads[t.id] ?? []).map(s => (
                <div key={s.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-secondary/50">
                  {s.is_captain && <Crown className="w-3 h-3 text-primary" />}
                  {s.is_vice_captain && <Shield className="w-3 h-3 text-accent" />}
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className={`px-1.5 rounded text-[10px] ${ROLE_COLOR[s.role]}`}>{s.role}</span>
                  <span className="font-mono text-muted-foreground">₹{s.price}</span>
                </div>
              ))}
              {!(squads[t.id]?.length) && <div className="text-xs text-muted-foreground italic">No players yet</div>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
