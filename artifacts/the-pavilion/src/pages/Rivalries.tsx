import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import { teamLogo } from "@/lib/teamLogos";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Flame, Trophy, Swords } from "lucide-react";

interface TeamPairStats {
  pair: string;
  teamA: string;
  teamB: string;
  total: number;
  aWins: number;
  bWins: number;
  draws: number;
  // "rivalry intensity" = how frequent + how close
  intensity: number; // 0-100
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function computeIntensity(total: number, aWins: number, bWins: number): number {
  if (total === 0) return 0;
  const frequencyScore = Math.min(total / 14, 1) * 50; // up to 50 points from frequency
  const closer = Math.min(aWins, bWins) / Math.max(1, Math.max(aWins, bWins));
  const closenessScore = closer * 50; // up to 50 points from closeness
  return Math.round(frequencyScore + closenessScore);
}

function IntensityMeter({ pct, colorA, colorB }: { pct: number; colorA: string; colorB: string }) {
  const label = pct >= 80 ? "EPIC" : pct >= 60 ? "INTENSE" : pct >= 40 ? "GROWING" : pct >= 20 ? "MILD" : "NASCENT";
  const badgeColor = pct >= 80 ? "#ef4444" : pct >= 60 ? "#f97316" : pct >= 40 ? "#facc15" : "#60a5fa";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-white/30 uppercase tracking-widest">Rivalry Intensity</span>
        <span className="font-black" style={{ color: badgeColor }}>{label}</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct >= 60
              ? `linear-gradient(90deg, ${colorA}, ${colorB})`
              : `linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.5))`,
            boxShadow: pct >= 60 ? `0 0 8px ${colorA}55` : "none",
          }} />
      </div>
      <div className="flex justify-between text-[8px] text-white/20">
        <span>Nascent</span>
        <span>Legendary</span>
      </div>
    </div>
  );
}

function WinBar({ aWins, bWins, draws, colorA, colorB, teamA, teamB }:
  { aWins: number; bWins: number; draws: number; colorA: string; colorB: string; teamA: string; teamB: string }) {
  const total = aWins + bWins + draws;
  const aPct = total > 0 ? (aWins / total) * 100 : 50;
  const bPct = total > 0 ? (bWins / total) * 100 : 50;
  return (
    <div className="space-y-1">
      <div className="h-2 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full transition-all duration-700" style={{ width: `${aPct}%`, background: colorA + "cc" }} />
        {draws > 0 && <div className="h-full" style={{ width: `${(draws / total) * 100}%`, background: "rgba(255,255,255,0.1)" }} />}
        <div className="h-full transition-all duration-700" style={{ width: `${bPct}%`, background: colorB + "cc" }} />
      </div>
      <div className="flex justify-between text-[9px]">
        <span style={{ color: colorA }} className="font-bold">{teamA} {aWins}W</span>
        <span style={{ color: colorB }} className="font-bold">{teamB} {bWins}W</span>
      </div>
    </div>
  );
}

export default function Rivalries() {
  const [loading, setLoading] = useState(true);
  const [pairs, setPairs] = useState<TeamPairStats[]>([]);
  const [leagueTeams, setLeagueTeams] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "intense" | "top">("intense");

  useEffect(() => { (async () => {
    const lg = await getOrCreateLeague();
    setLeagueTeams(lg.teams ?? []);

    const { data: seasons } = await supabase.from("seasons").select("id").eq("league_id", lg.id);
    const seasonIds = (seasons ?? []).map(s => s.id);
    if (!seasonIds.length) { setLoading(false); return; }

    const { data: matches } = await supabase.from("matches")
      .select("team_a, team_b, winner, status")
      .in("season_id", seasonIds)
      .eq("status", "done");

    const pairMap = new Map<string, { teamA: string; teamB: string; total: number; aWins: number; bWins: number; draws: number }>();

    (matches ?? []).forEach((m: any) => {
      if (!m.team_a || !m.team_b) return;
      const key = pairKey(m.team_a, m.team_b);
      const [ta, tb] = [m.team_a, m.team_b].sort();
      const entry = pairMap.get(key) ?? { teamA: ta, teamB: tb, total: 0, aWins: 0, bWins: 0, draws: 0 };
      entry.total++;
      if (m.winner === ta) entry.aWins++;
      else if (m.winner === tb) entry.bWins++;
      else entry.draws++;
      pairMap.set(key, entry);
    });

    const result: TeamPairStats[] = Array.from(pairMap.entries()).map(([pair, v]) => ({
      pair,
      teamA: v.teamA,
      teamB: v.teamB,
      total: v.total,
      aWins: v.aWins,
      bWins: v.bWins,
      draws: v.draws,
      intensity: computeIntensity(v.total, v.aWins, v.bWins),
    }));

    result.sort((a, b) => b.intensity - a.intensity);
    setPairs(result);
    setLoading(false);
  })(); }, []);

  const filtered = useMemo(() => {
    if (filter === "intense") return pairs.filter(p => p.intensity >= 30);
    if (filter === "top") return pairs.slice(0, 5);
    return pairs;
  }, [pairs, filter]);

  const tcolor = (id: string) => teamColor(id, leagueTeams);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="animate-spin text-primary w-8 h-8" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-6"
        style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(249,115,22,0.06))", border: "1px solid rgba(239,68,68,0.2)" }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 flex items-center justify-center" style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
            <Flame className="w-7 h-7 text-rose-400" />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.4em] text-rose-400/70 font-bold mb-1">League Lore</div>
            <h1 className="font-display text-4xl tracking-wider text-foreground">Rivalries</h1>
            <p className="text-sm text-muted-foreground mt-1">The fiercer the history, the hotter the rivalry meter burns.</p>
          </div>
        </div>
      </div>

      {/* No data */}
      {pairs.length === 0 && (
        <Card className="p-16 text-center gradient-card border-border/60">
          <Swords className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <div className="text-muted-foreground">No match data yet. Play some matches to build your rivalry history!</div>
        </Card>
      )}

      {/* Filters */}
      {pairs.length > 0 && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {(["intense", "top", "all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
                }`}>
                {f === "intense" ? "🔥 Notable Rivalries" : f === "top" ? "🏆 Top 5" : "⚽ All Matchups"}
              </button>
            ))}
            <span className="text-[10px] text-muted-foreground ml-2">{filtered.length} pair{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {filtered.length === 0 && filter === "intense" && (
            <Card className="p-10 text-center gradient-card border-border/60 text-muted-foreground text-sm">
              <Swords className="w-8 h-8 mx-auto mb-3 opacity-30" />
              No intense rivalries yet — play more matches! Switch to "All Matchups" to see early data.
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(p => {
              const colorA = tcolor(p.teamA);
              const colorB = tcolor(p.teamB);
              const leader = p.aWins > p.bWins ? p.teamA : p.bWins > p.aWins ? p.teamB : null;
              return (
                <div key={p.pair} className="rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:scale-[1.01]"
                  style={{
                    background: `linear-gradient(160deg, color-mix(in srgb, ${colorA} 8%, #06060f), #06060f 50%, color-mix(in srgb, ${colorB} 6%, #06060f))`,
                    border: `1px solid ${p.intensity >= 60 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.07)"}`,
                    boxShadow: p.intensity >= 60 ? "0 0 40px -15px rgba(239,68,68,0.3)" : "none",
                  }}>
                  {p.intensity >= 60 && (
                    <div className="absolute top-0 left-0 right-0 h-0.5"
                      style={{ background: `linear-gradient(90deg, ${colorA}, ${colorB})` }} />
                  )}

                  {/* Teams row */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <img src={teamLogo(p.teamA)} alt={p.teamA} className="w-10 h-10 object-contain"
                        style={{ filter: `drop-shadow(0 0 6px ${colorA}55)` }} />
                      <div className="font-display text-xl tracking-wider" style={{ color: colorA }}>{p.teamA}</div>
                    </div>

                    <div className="flex-1 text-center">
                      <div className="text-[9px] text-white/20 uppercase tracking-widest">vs</div>
                      <div className="font-display text-xs text-white/40">{p.total} match{p.total !== 1 ? "es" : ""}</div>
                    </div>

                    <div className="flex items-center gap-2 flex-row-reverse">
                      <img src={teamLogo(p.teamB)} alt={p.teamB} className="w-10 h-10 object-contain"
                        style={{ filter: `drop-shadow(0 0 6px ${colorB}44)` }} />
                      <div className="font-display text-xl tracking-wider" style={{ color: colorB }}>{p.teamB}</div>
                    </div>
                  </div>

                  {/* Win bar */}
                  <div className="mb-4">
                    <WinBar aWins={p.aWins} bWins={p.bWins} draws={p.draws}
                      colorA={colorA} colorB={colorB} teamA={p.teamA} teamB={p.teamB} />
                  </div>

                  {/* Intensity meter */}
                  <IntensityMeter pct={p.intensity} colorA={colorA} colorB={colorB} />

                  {/* Leader badge */}
                  {leader && (
                    <div className="mt-3 flex items-center gap-1.5 text-[9px]" style={{ color: tcolor(leader) }}>
                      <Trophy className="w-3 h-3" />
                      <span className="font-bold uppercase tracking-wider">{leader} leads this rivalry</span>
                    </div>
                  )}
                  {!leader && p.total > 0 && (
                    <div className="mt-3 text-[9px] text-white/30 flex items-center gap-1.5">
                      <Swords className="w-3 h-3" />
                      <span>Dead level — {p.aWins === p.bWins ? `${p.aWins}W each` : "honours even"}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
