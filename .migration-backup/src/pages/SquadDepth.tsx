import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor, teamFull } from "@/lib/teams";
import { analyzeSquad, type RoleBalance } from "@/lib/squadDepth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, Layers, ShieldCheck } from "lucide-react";

export default function SquadDepth() {
  const [league, setLeague] = useState<League | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const lg = await getOrCreateLeague(); setLeague(lg);
    const { data } = await supabase.from("seasons").select("*").eq("league_id", lg.id).order("season_number", { ascending: false });
    setSeasons(data ?? []); if (data?.length) setSeasonId(data[0].id);
    setLoading(false);
  })(); }, []);

  useEffect(() => { (async () => {
    if (!seasonId) return;
    const { data } = await supabase.from("squads").select("*, players(*)").eq("season_id", seasonId);
    setRows(data ?? []);
  })(); }, [seasonId]);

  if (loading || !league) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;
  const teams = league.teams as any[];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-primary/80">ROSTER ANALYSIS</div>
          <h1 className="font-display text-4xl tracking-wider flex items-center gap-2"><Layers className="w-7 h-7 text-primary"/> Squad Depth</h1>
          <p className="text-sm text-muted-foreground mt-1">Role balance, marquee count and gaps that need plugging.</p>
        </div>
        {seasons.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {seasons.map(s => (
              <button key={s.id} onClick={() => setSeasonId(s.id)} className={`px-3 py-1.5 rounded text-xs tracking-widest ${seasonId === s.id ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-muted-foreground"}`}>
                S{s.season_number} · {s.year}
              </button>
            ))}
          </div>
        )}
      </div>

      {seasons.length === 0 ? (
        <Card className="p-12 text-center gradient-card border-border/60 text-muted-foreground">No season yet.</Card>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="bg-secondary/40">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="comparison">Compare</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map(t => {
              const players = rows.filter(r => r.team_id === t.id).map(r => r.players).filter(Boolean);
              const bal = analyzeSquad(players, t.id);
              return <SquadCard key={t.id} team={t} bal={bal} players={players}/>;
            })}
          </TabsContent>

          <TabsContent value="comparison" className="mt-4">
            <Card className="p-5 gradient-card border-border/60 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="text-left px-2 py-2">Team</th>
                    <th className="text-center">BAT</th><th className="text-center">BOWL</th>
                    <th className="text-center">AR</th><th className="text-center">WK</th>
                    <th className="text-center">★85+</th>
                    <th className="text-center">Avg ★</th>
                    <th className="text-center">Total</th>
                    <th className="text-center">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map(t => {
                    const players = rows.filter(r => r.team_id === t.id).map(r => r.players).filter(Boolean);
                    const bal = analyzeSquad(players, t.id);
                    const ok = bal.warnings.length === 0;
                    return (
                      <tr key={t.id} className="border-t border-border/30">
                        <td className="px-2 py-2 font-display" style={{color: t.primary}}>{t.id}</td>
                        <td className="text-center">{bal.bat}</td><td className="text-center">{bal.bowl}</td>
                        <td className="text-center">{bal.ar}</td><td className="text-center">{bal.wk}</td>
                        <td className="text-center text-primary">{bal.capRated}</td>
                        <td className="text-center">{bal.avgRating}</td>
                        <td className="text-center font-display">{bal.total}</td>
                        <td className="text-center">{ok ? <ShieldCheck className="w-4 h-4 text-[hsl(var(--boundary))] inline"/> : <span className="text-destructive text-xs">{bal.warnings.length} ⚠</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SquadCard({ team, bal, players }: { team: any; bal: RoleBalance; players: any[] }) {
  const segments = [
    { k: "BAT", v: bal.bat, color: "hsl(var(--boundary))" },
    { k: "BOWL", v: bal.bowl, color: "hsl(var(--six))" },
    { k: "AR", v: bal.ar, color: "hsl(var(--primary))" },
    { k: "WK", v: bal.wk, color: "hsl(var(--accent))" },
  ];
  const total = Math.max(1, segments.reduce((s, x) => s + x.v, 0));

  return (
    <Card className="p-5 gradient-card border-border/60 overflow-hidden relative">
      <div className="absolute inset-0 opacity-10" style={{background: `radial-gradient(circle at top right, ${team.primary}, transparent 60%)`}}/>
      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-2xl tracking-wider" style={{color: team.primary}}>{team.id}</div>
            <div className="text-xs text-muted-foreground">{teamFull(team.id)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg Rating</div>
            <div className="font-display text-2xl text-primary">{bal.avgRating}</div>
          </div>
        </div>

        {/* role bar */}
        <div className="mt-4 h-2 rounded-full bg-secondary/40 overflow-hidden flex">
          {segments.map(s => (
            <div key={s.k} style={{ width: `${(s.v / total) * 100}%`, background: s.color }} title={`${s.k}: ${s.v}`}/>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
          {segments.map(s => (
            <div key={s.k} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{background: s.color}}/>
              <span className="text-muted-foreground">{s.k}</span><span className="font-display">{s.v}</span>
            </div>
          ))}
          <Badge variant="outline" className="ml-auto text-[10px]">{bal.total} total</Badge>
          <Badge variant="outline" className="text-[10px] text-primary border-primary/40">★85+ × {bal.capRated}</Badge>
        </div>

        {/* warnings */}
        {bal.warnings.length > 0 ? (
          <div className="mt-3 space-y-1">
            {bal.warnings.map((w, i) => (
              <div key={i} className="text-[11px] flex items-center gap-1.5 text-destructive/90">
                <AlertTriangle className="w-3 h-3"/>{w}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-[11px] flex items-center gap-1.5 text-[hsl(var(--boundary))]">
            <ShieldCheck className="w-3 h-3"/> Squad balance is healthy.
          </div>
        )}

        {/* top 3 by rating */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {players.sort((a,b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 3).map(p => (
            <div key={p.id} className="bg-secondary/30 rounded p-2 text-center">
              <div className="text-xs truncate font-medium">{p.name}</div>
              <div className="text-[10px] text-muted-foreground">{p.role}</div>
              <div className="text-primary font-display text-sm">★{p.rating}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
