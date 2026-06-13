import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Star, Zap, TrendingUp, Target, Award, ArrowRight } from "lucide-react";
import type { League } from "@/lib/league";
import { teamColor } from "@/lib/teams";

interface HighlightProps {
  engine: any;
  match: { team_a: string; team_b: string; winner?: string; result_text?: string };
  potmName: string;
  league: League;
  onContinue?: () => void;
}

function getTopPlayers(inn: any, teamId: string) {
  if (!inn) return { topBat: null, topBowl: null };
  const bats = Object.values(inn.bat as Record<string, any>).sort((a: any, b: any) => b.runs - a.runs);
  const bowls = Object.values(inn.bowl as Record<string, any>).sort((a: any, b: any) => b.wickets - a.wickets || a.runs - b.runs);
  return {
    topBat: bats[0] ?? null,
    topBowl: bowls.find((b: any) => b.wickets > 0) ?? bowls[0] ?? null,
  };
}

function getKeyMoments(i1: any, i2: any): string[] {
  const moments: string[] = [];
  if (!i1 || !i2) return moments;

  const allBats = [
    ...Object.values(i1.bat as Record<string, any>),
    ...Object.values(i2.bat as Record<string, any>),
  ] as any[];

  const centurion = allBats.find((b: any) => b.runs >= 100);
  if (centurion) moments.push(`💯 ${centurion.name} scored a century (${centurion.runs})`);

  const halfCentury = allBats.find((b: any) => b.runs >= 50 && b.runs < 100);
  if (halfCentury) moments.push(`5️⃣0️⃣ ${halfCentury.name} hit a half-century (${halfCentury.runs})`);

  const allBowls = [
    ...Object.values(i1.bowl as Record<string, any>),
    ...Object.values(i2.bowl as Record<string, any>),
  ] as any[];

  const fiveFor = allBowls.find((b: any) => b.wickets >= 5);
  if (fiveFor) moments.push(`🔥 ${fiveFor.name} took ${fiveFor.wickets}/${fiveFor.runs}!`);

  const total1 = i1.runs ?? 0;
  const total2 = i2.runs ?? 0;
  if (total1 >= 200 || total2 >= 200) moments.push(`🚀 200+ total scored in this match!`);

  const margin = Math.abs(total1 - total2);
  if (margin <= 3 && i2.done) moments.push(`😮 Nail-biter! Won by just ${margin} run${margin === 1 ? "" : "s"}`);

  const allSixes = allBats.reduce((s: number, b: any) => s + (b.sixes ?? 0), 0);
  if (allSixes >= 15) moments.push(`💥 ${allSixes} sixes hit in total!`);

  return moments.slice(0, 4);
}

export function MatchHighlights({ engine, match, potmName, league, onContinue }: HighlightProps) {
  const i1 = engine?.innings1;
  const i2 = engine?.innings2;
  if (!i1 || !i2) return null;

  const inn1 = getTopPlayers(i1, match.team_a);
  const inn2 = getTopPlayers(i2, match.team_b);
  const moments = getKeyMoments(i1, i2);
  const winnerColor = match.winner ? teamColor(match.winner, league.teams) : "hsl(var(--primary))";

  const teamA_sr = (bat: any) => bat?.balls > 0 ? `SR ${((bat.runs / bat.balls) * 100).toFixed(1)}` : "";
  const bowl_line = (bowl: any) => bowl ? `${bowl.wickets}/${bowl.runs} (${Math.floor((bowl.balls ?? 0)/6)}.${(bowl.balls ?? 0)%6} ov)` : "—";

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Match result banner */}
      <Card className="p-5 gradient-card border-primary/40 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)),transparent_70%)]"/>
        <div className="relative">
          <div className="text-[10px] tracking-[0.4em] text-primary/70 mb-1 uppercase">Match Result</div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="font-display text-3xl tracking-wider" style={{ color: winnerColor }}>
              {match.winner ?? "No Result"}
            </div>
            {match.winner && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Winners</Badge>}
          </div>
          {match.result_text && (
            <div className="text-sm text-muted-foreground mt-1">{match.result_text}</div>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-lg" style={{ color: teamColor(match.team_a, league.teams) }}>{match.team_a}</span>
              <span className="text-muted-foreground text-xs">{i1.runs}/{i1.wickets}</span>
            </div>
            <span className="text-muted-foreground text-xs">vs</span>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-lg" style={{ color: teamColor(match.team_b, league.teams) }}>{match.team_b}</span>
              <span className="text-muted-foreground text-xs">{i2.runs}/{i2.wickets}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* POTM + top performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Player of the Match */}
        {potmName && (
          <Card className="p-4 gradient-card border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-amber-400"/>
              <div className="text-[10px] uppercase tracking-widest text-amber-400">Player of the Match</div>
            </div>
            <div className="font-display text-2xl text-amber-300">{potmName}</div>
          </Card>
        )}

        {/* Innings 1 top bat */}
        {inn1.topBat && (
          <Card className="p-4 gradient-card border-border/60">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-primary"/> Top Bat — <span style={{ color: teamColor(match.team_a, league.teams) }}>{match.team_a}</span>
            </div>
            <div className="font-display text-xl">{inn1.topBat.name}</div>
            <div className="text-primary font-mono text-lg font-bold">{inn1.topBat.runs}<span className="text-xs text-muted-foreground ml-1">({inn1.topBat.balls}b)</span></div>
            <div className="text-xs text-muted-foreground mt-0.5">{inn1.topBat.sixes}×6 · {inn1.topBat.fours}×4 · {teamA_sr(inn1.topBat)}</div>
          </Card>
        )}

        {/* Innings 2 top bat */}
        {inn2.topBat && (
          <Card className="p-4 gradient-card border-border/60">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-primary"/> Top Bat — <span style={{ color: teamColor(match.team_b, league.teams) }}>{match.team_b}</span>
            </div>
            <div className="font-display text-xl">{inn2.topBat.name}</div>
            <div className="text-primary font-mono text-lg font-bold">{inn2.topBat.runs}<span className="text-xs text-muted-foreground ml-1">({inn2.topBat.balls}b)</span></div>
            <div className="text-xs text-muted-foreground mt-0.5">{inn2.topBat.sixes}×6 · {inn2.topBat.fours}×4 · {teamA_sr(inn2.topBat)}</div>
          </Card>
        )}

        {/* Top bowler Inn1 */}
        {inn1.topBowl && inn1.topBowl.wickets > 0 && (
          <Card className="p-4 gradient-card border-border/60">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
              <Target className="w-3 h-3 text-red-400"/> Best Bowl — <span style={{ color: teamColor(match.team_b, league.teams) }}>{match.team_b}</span>
            </div>
            <div className="font-display text-xl">{inn1.topBowl.name}</div>
            <div className="text-red-400 font-mono text-lg font-bold">{bowl_line(inn1.topBowl)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Economy {inn1.topBowl.balls ? ((inn1.topBowl.runs / inn1.topBowl.balls) * 6).toFixed(2) : "—"}</div>
          </Card>
        )}

        {inn2.topBowl && inn2.topBowl.wickets > 0 && (
          <Card className="p-4 gradient-card border-border/60">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
              <Target className="w-3 h-3 text-red-400"/> Best Bowl — <span style={{ color: teamColor(match.team_a, league.teams) }}>{match.team_a}</span>
            </div>
            <div className="font-display text-xl">{inn2.topBowl.name}</div>
            <div className="text-red-400 font-mono text-lg font-bold">{bowl_line(inn2.topBowl)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Economy {inn2.topBowl.balls ? ((inn2.topBowl.runs / inn2.topBowl.balls) * 6).toFixed(2) : "—"}</div>
          </Card>
        )}
      </div>

      {/* Key moments */}
      {moments.length > 0 && (
        <Card className="p-4 gradient-card border-border/60">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-primary"/> Key Moments
          </div>
          <div className="space-y-2">
            {moments.map((m, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm p-2 rounded-lg bg-secondary/20">
                <span className="flex-1">{m}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {onContinue && (
        <Button onClick={onContinue} className="gradient-primary text-primary-foreground gap-2 w-full sm:w-auto">
          Continue <ArrowRight className="w-4 h-4"/>
        </Button>
      )}
    </div>
  );
}
