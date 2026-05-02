import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor, teamFull } from "@/lib/teams";
import { jerseyUrl } from "@/lib/jersey";
import { teamLogo } from "@/lib/teamLogos";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Crown, Star, Shield, HeartPulse, AlertTriangle } from "lucide-react";

interface SquadRow { id: string; team_id: string; price: number; is_captain: boolean; is_vice_captain: boolean; players: any; }

type InjuryStatus = "fit" | "injured" | "doubtful" | string;
function injuryMeta(status: InjuryStatus | null | undefined, matchesLeft: number) {
  const s = (status ?? "fit").toLowerCase();
  if (s === "fit" || !s) return { label: "Fit", tone: "text-emerald-400", border: "border-emerald-500/40", bg: "bg-emerald-500/10", available: true };
  if (s === "doubtful") return { label: matchesLeft > 0 ? `Doubtful · ${matchesLeft}m` : "Doubtful", tone: "text-amber-400", border: "border-amber-500/40", bg: "bg-amber-500/10", available: true };
  // injured / out / any other non-fit value
  return { label: matchesLeft > 0 ? `Injured · ${matchesLeft}m` : "Injured", tone: "text-rose-400", border: "border-rose-500/40", bg: "bg-rose-500/10", available: false };
}

export default function Squads() {
  const [league, setLeague] = useState<League | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonNum, setSeasonNum] = useState<number>(1);
  const [seasonId, setSeasonId] = useState<string>("");
  const [rows, setRows] = useState<SquadRow[]>([]);
  const [agg, setAgg] = useState<Record<string, { runs: number; wkts: number; matches: Set<string> }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const lg = await getOrCreateLeague();
    setLeague(lg);
    const { data: s } = await supabase.from("seasons").select("*").eq("league_id", lg.id).order("season_number", { ascending: false });
    setSeasons(s ?? []);
    if (s && s.length) { setSeasonId(s[0].id); setSeasonNum(s[0].season_number ?? 1); }
    setLoading(false);
  })(); }, []);

  useEffect(() => { (async () => {
    if (!seasonId || !league) return;
    const { data } = await supabase.from("squads").select("*, players(*)").eq("season_id", seasonId);
    setRows((data ?? []) as any);
    // aggregate player career stats from all done matches
    const { data: matches } = await supabase.from("matches").select("id, scorecard, status, season_id").eq("status","done");
    const a: Record<string, { runs: number; wkts: number; matches: Set<string> }> = {};
    (matches ?? []).forEach((m: any) => {
      const sc = m.scorecard; if (!sc) return;
      ["innings1","innings2"].forEach(ik => {
        const inn = sc[ik]; if (!inn) return;
        Object.values(inn.bat as Record<string, any>).forEach((b: any) => {
          const x = a[b.player_id] ??= { runs: 0, wkts: 0, matches: new Set() };
          x.runs += b.runs; x.matches.add(m.id);
        });
        Object.values(inn.bowl as Record<string, any>).forEach((b: any) => {
          const x = a[b.player_id] ??= { runs: 0, wkts: 0, matches: new Set() };
          x.wkts += b.wickets; x.matches.add(m.id);
        });
      });
    });
    setAgg(a);
  })(); }, [seasonId, league]);

  if (loading || !league) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  const teams = league.teams;
  const byTeam = (tid: string) => rows.filter(r => r.team_id === tid);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-primary/80">FRANCHISES</div>
          <h1 className="font-display text-4xl tracking-wider">Squad Vault</h1>
          <p className="text-sm text-muted-foreground mt-1">Roster, captains and career numbers per franchise.</p>
        </div>
        {seasons.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {seasons.map(s => (
              <button key={s.id} onClick={() => { setSeasonId(s.id); setSeasonNum(s.season_number ?? 1); }} className={`px-3 py-1.5 rounded text-xs tracking-widest ${seasonId === s.id ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-muted-foreground"}`}>
                S{s.season_number} · {s.year}
              </button>
            ))}
          </div>
        )}
      </div>

      {seasons.length === 0 ? (
        <Card className="p-12 text-center gradient-card border-border/60 text-muted-foreground">No season yet — start one from the Dashboard.</Card>
      ) : (
        <Tabs defaultValue={teams[0]?.id}>
          <TabsList className="bg-secondary/40 flex-wrap h-auto">
            {teams.map((t: any) => (
              <TabsTrigger key={t.id} value={t.id} className="data-[state=active]:text-primary-foreground" style={{
                ['--tw-ring-color' as any]: t.primary,
              }}>
                <span className="w-2 h-2 rounded-full mr-2" style={{background: t.primary}}/>{t.id}
              </TabsTrigger>
            ))}
          </TabsList>

          {teams.map((t: any) => {
            const squad = byTeam(t.id);
            const totalSpend = squad.reduce((s, r) => s + Number(r.price ?? 0), 0);
            return (
              <TabsContent key={t.id} value={t.id} className="mt-4 space-y-4">
                <Card className="p-5 gradient-card border-border/60 overflow-hidden relative">
                  <div className="absolute inset-0 opacity-10" style={{background: `radial-gradient(circle at top right, ${t.primary}, transparent 60%)`}}/>
                  <div className="relative flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-20 flex items-center justify-center bg-card rounded-md ring-1 ring-border p-2">
                        <img src={teamLogo(t.id)} alt={`${teamFull(t.id, teams)} crest`} className="w-full h-full object-contain" loading="lazy" />
                      </div>
                      <div>
                        <div className="font-display text-2xl tracking-wider" style={{color: t.primary}}>{t.id}</div>
                        <div className="text-xs text-muted-foreground">{teamFull(t.id, teams)}</div>
                        <div className="text-[10px] uppercase tracking-widest text-primary/80 mt-0.5">S{seasonNum} Kit</div>
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <Stat label="Squad" value={squad.length}/>
                      <Stat label="Captain" value={squad.find(r => r.is_captain)?.players?.name ?? "—"}/>
                      <Stat label="Spend" value={`₹${totalSpend.toFixed(1)}`}/>
                    </div>
                  </div>
                </Card>

                <Card className="gradient-card border-border/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
                        <tr>
                          <th className="text-left px-3 py-2">Player</th>
                          <th className="text-left px-2 py-2">Role</th>
                          <th className="text-right px-2 py-2">Rating</th>
                          <th className="text-right px-2 py-2">Price ₹Cr</th>
                          <th className="text-right px-2 py-2">Career M</th>
                          <th className="text-right px-2 py-2">Runs</th>
                          <th className="text-right px-3 py-2">Wkts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {squad.sort((a,b) => Number(b.price) - Number(a.price)).map(r => {
                          const p = r.players;
                          const a = agg[p?.id] ?? { runs: 0, wkts: 0, matches: new Set() };
                          return (
                            <tr key={r.id} className="border-t border-border/30 hover:bg-secondary/20">
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2.5">
                                  {p?.pfp_url && <img src={p.pfp_url} alt="" className="w-8 h-8 rounded-full bg-secondary border border-border/40 flex-shrink-0" loading="lazy"/>}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-medium truncate">{p?.name}</span>
                                      {r.is_captain && <Crown className="w-3 h-3 text-primary flex-shrink-0" />}
                                      {r.is_vice_captain && <Shield className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">{p?.nationality}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-2"><Badge variant="outline" className="text-[10px]">{p?.role}</Badge></td>
                              <td className="text-right px-2 py-2 font-mono"><span className="text-primary">{p?.rating}</span></td>
                              <td className="text-right px-2 py-2 font-mono">₹{Number(r.price).toFixed(1)}</td>
                              <td className="text-right px-2 py-2 font-mono text-muted-foreground">{a.matches.size}</td>
                              <td className="text-right px-2 py-2 font-mono text-[hsl(var(--boundary))]">{a.runs}</td>
                              <td className="text-right px-3 py-2 font-mono text-[hsl(var(--six))]">{a.wkts}</td>
                            </tr>
                          );
                        })}
                        {squad.length === 0 && (
                          <tr><td colSpan={7} className="text-center px-3 py-8 text-muted-foreground">No squad locked for this season yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-xl">{value}</div>
    </div>
  );
}
