import { useEffect, useMemo, useState } from "react";
import { getOrCreateLeague, type League } from "@/lib/league";
import { getH2H, type H2HSummary } from "@/lib/headToHead";
import { teamColor, teamFull } from "@/lib/teams";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Swords, Trophy, Flame, Target } from "lucide-react";

export default function HeadToHead() {
  const [league, setLeague] = useState<League | null>(null);
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const [data, setData] = useState<H2HSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { (async () => {
    const lg = await getOrCreateLeague();
    setLeague(lg);
    if (lg.teams.length >= 2) { setA(lg.teams[0].id); setB(lg.teams[1].id); }
  })(); }, []);

  useEffect(() => { (async () => {
    if (!league || !a || !b || a === b) return;
    setLoading(true);
    const d = await getH2H(league.id, a, b, league.settings.oversPerInnings);
    setData(d); setLoading(false);
  })(); }, [league, a, b]);

  const teams = league?.teams ?? [];
  const colorA = useMemo(() => teamColor(a, teams as any), [a, teams]);
  const colorB = useMemo(() => teamColor(b, teams as any), [b, teams]);

  if (!league) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs tracking-[0.3em] text-primary/80">RIVALRIES</div>
        <h1 className="font-display text-4xl tracking-wider flex items-center gap-2"><Swords className="w-7 h-7 text-primary"/> Head-to-Head</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick two franchises to see the all-time tale of the tape.</p>
      </div>

      <Card className="p-4 gradient-card border-border/60">
        <div className="grid grid-cols-2 gap-4 items-center">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Team A</div>
            <div className="flex flex-wrap gap-1.5">
              {teams.map((t: any) => (
                <button key={t.id} onClick={() => setA(t.id)} disabled={t.id === b}
                  className={`px-3 py-1.5 rounded text-xs tracking-widest disabled:opacity-30 ${a === t.id ? "text-primary-foreground" : "bg-secondary/40"}`}
                  style={a === t.id ? { background: t.primary } : {}}>{t.id}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Team B</div>
            <div className="flex flex-wrap gap-1.5">
              {teams.map((t: any) => (
                <button key={t.id} onClick={() => setB(t.id)} disabled={t.id === a}
                  className={`px-3 py-1.5 rounded text-xs tracking-widest disabled:opacity-30 ${b === t.id ? "text-primary-foreground" : "bg-secondary/40"}`}
                  style={b === t.id ? { background: t.primary } : {}}>{t.id}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin w-4 h-4"/> Loading…</div>}

      {!loading && data && data.played === 0 && (
        <Card className="p-12 text-center gradient-card border-border/60 text-muted-foreground">
          No completed matches between <b className="text-foreground mx-1">{a}</b> and <b className="text-foreground mx-1">{b}</b> yet. Play some matches first!
        </Card>
      )}

      {!loading && data && data.played > 0 && (
        <>
          {/* Headline tape */}
          <Card className="p-6 gradient-card border-border/60 overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 w-1/2" style={{ background: `linear-gradient(90deg, ${colorA}30, transparent)`}}/>
            <div className="absolute inset-y-0 right-0 w-1/2" style={{ background: `linear-gradient(-90deg, ${colorB}30, transparent)`}}/>
            <div className="relative grid grid-cols-3 items-center gap-4">
              <div className="text-center">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{teamFull(a, teams as any)}</div>
                <div className="font-display text-5xl mt-1" style={{color: colorA}}>{data.aWins}</div>
                <div className="text-xs text-muted-foreground">wins</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] tracking-widest text-muted-foreground">PLAYED</div>
                <div className="font-display text-3xl text-primary">{data.played}</div>
                {data.ties > 0 && <div className="text-[10px] text-muted-foreground mt-1">{data.ties} tie{data.ties===1?"":"s"}</div>}
              </div>
              <div className="text-center">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{teamFull(b, teams as any)}</div>
                <div className="font-display text-5xl mt-1" style={{color: colorB}}>{data.bWins}</div>
                <div className="text-xs text-muted-foreground">wins</div>
              </div>
            </div>
            {/* win bar */}
            <div className="mt-4 h-2 rounded-full bg-secondary/40 overflow-hidden flex">
              <div style={{ width: `${(data.aWins / Math.max(1, data.played)) * 100}%`, background: colorA }}/>
              <div style={{ width: `${(data.ties / Math.max(1, data.played)) * 100}%`, background: "hsl(var(--muted))" }}/>
              <div style={{ width: `${(data.bWins / Math.max(1, data.played)) * 100}%`, background: colorB }}/>
            </div>
          </Card>

          {/* Stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SideCard color={colorA} label={a} icon={<Trophy/>} stats={[
              { k: "Highest Total", v: data.highestA ? `${data.highestA.runs}/${data.highestA.wkts}` : "—", s: data.highestA?.season ? `S${data.highestA.season}` : "" },
              { k: "Top Run-scorer", v: data.topBatA?.name ?? "—", s: data.topBatA ? `${data.topBatA.runs} runs` : "" },
              { k: "Top Wicket-taker", v: data.topBowlA?.name ?? "—", s: data.topBowlA ? `${data.topBowlA.wkts} wkts` : "" },
              { k: "H2H NRR", v: data.nrrA.toFixed(3), s: data.nrrA >= 0 ? "📈" : "📉" },
            ]}/>
            <SideCard color={colorB} label={b} icon={<Target/>} stats={[
              { k: "Highest Total", v: data.highestB ? `${data.highestB.runs}/${data.highestB.wkts}` : "—", s: data.highestB?.season ? `S${data.highestB.season}` : "" },
              { k: "Top Run-scorer", v: data.topBatB?.name ?? "—", s: data.topBatB ? `${data.topBatB.runs} runs` : "" },
              { k: "Top Wicket-taker", v: data.topBowlB?.name ?? "—", s: data.topBowlB ? `${data.topBowlB.wkts} wkts` : "" },
              { k: "H2H NRR", v: data.nrrB.toFixed(3), s: data.nrrB >= 0 ? "📈" : "📉" },
            ]}/>
          </div>

          {/* Recent meetings */}
          <Card className="gradient-card border-border/60 overflow-hidden">
            <div className="p-4 border-b border-border/40 flex items-center gap-2">
              <Flame className="w-4 h-4 text-accent"/><div className="font-display tracking-wider">RECENT MEETINGS</div>
            </div>
            <div className="divide-y divide-border/30">
              {data.recent.map(r => (
                <div key={r.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px]">S{r.season}</Badge>
                    <span><span style={{color: teamColor(r.team_a, teams as any)}}>{r.team_a}</span> vs <span style={{color: teamColor(r.team_b, teams as any)}}>{r.team_b}</span></span>
                  </div>
                  <div className="text-xs text-muted-foreground text-right max-w-[60%] truncate">
                    {r.winner ? <><b className="text-foreground" style={{color: teamColor(r.winner, teams as any)}}>{r.winner}</b> won</> : "Tied"}
                    {r.result && <span className="ml-2 opacity-70">· {r.result}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function SideCard({ color, label, icon, stats }: { color: string; label: string; icon: any; stats: { k: string; v: string; s?: string }[] }) {
  return (
    <Card className="p-5 gradient-card border-border/60 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10" style={{background: `radial-gradient(circle at top right, ${color}, transparent 60%)`}}/>
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{background: color, color: "#0a0a0a"}}>{icon}</div>
          <div className="font-display text-xl tracking-wider" style={{color}}>{label}</div>
        </div>
        <div className="space-y-2">
          {stats.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-sm border-b border-border/20 pb-2 last:border-0">
              <span className="text-muted-foreground text-xs uppercase tracking-widest">{s.k}</span>
              <span className="font-medium text-right">{s.v} {s.s && <span className="text-[10px] text-muted-foreground ml-1">{s.s}</span>}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
