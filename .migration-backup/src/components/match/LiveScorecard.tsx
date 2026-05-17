import type { InningsState, MatchEngineState } from "@/lib/matchEngine";
import { ballsToOvers, runRate, reqRR } from "@/lib/matchEngine";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  state: MatchEngineState;
  teamColorFn: (id: string) => string;
}

export function LiveScorecard({ state, teamColorFn }: Props) {
  const inn = state.currentInnings === 1 ? state.innings1 : state.innings2!;
  const striker = inn.bat[inn.strikerId];
  const nonStriker = inn.bat[inn.nonStrikerId];
  const bowler = inn.bowl[inn.bowlerId];
  const rr = runRate(inn.runs, inn.legalBalls);
  const need = state.target ? state.target - inn.runs : null;
  const ballsLeft = state.oversPerInnings * 6 - inn.legalBalls;
  const rrr = state.target ? reqRR(state.target, inn.runs, inn.legalBalls, state.oversPerInnings) : null;

  return (
    <div className="space-y-3">
      {/* Big scoreboard */}
      <Card className="p-5 gradient-card border-border/60 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: teamColorFn(inn.battingTeam) }} />
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="font-display text-2xl tracking-wider" style={{ color: teamColorFn(inn.battingTeam) }}>
              {inn.battingTeam}
            </div>
            <Badge variant="outline" className="text-xs">Innings {state.currentInnings}</Badge>
            {state.target && <Badge className="bg-primary/20 text-primary">Target {state.target}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">vs {inn.bowlingTeam}</div>
        </div>

        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <div className="font-display text-6xl leading-none scoreboard-tick" key={`${inn.runs}-${inn.wickets}`}>
              {inn.runs}<span className="text-muted-foreground text-3xl">/{inn.wickets}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              ({ballsToOvers(inn.legalBalls)} / {state.oversPerInnings} ov)
            </div>
          </div>
          <div className="ml-auto grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <span className="text-muted-foreground">CRR</span>
            <span className="font-mono font-semibold text-right">{rr.toFixed(2)}</span>
            {rrr !== null && (
              <>
                <span className="text-muted-foreground">RRR</span>
                <span className="font-mono font-semibold text-right text-primary">{rrr > 36 || rrr < 0 ? "—" : rrr.toFixed(2)}</span>
                <span className="text-muted-foreground">Need</span>
                <span className="font-mono font-semibold text-right">{need} in {ballsLeft}b</span>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Batters & bowler row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <BatterCard label="Striker" b={striker} on />
        <BatterCard label="Non-striker" b={nonStriker} />
        <BowlerCard b={bowler} />
      </div>
    </div>
  );
}

function BatterCard({ b, label, on }: { b: any; label: string; on?: boolean }) {
  if (!b) return null;
  const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "—";
  return (
    <Card className={`p-3 gradient-card border-border/60 ${on ? "border-primary/40" : ""}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
        <span>{label}</span>{on && <span className="text-primary">● ON STRIKE</span>}
      </div>
      <div className="font-display text-xl truncate">{b.name}</div>
      <div className="flex items-end gap-2 mt-1">
        <span className="font-mono text-2xl font-bold">{b.runs}</span>
        <span className="font-mono text-sm text-muted-foreground">({b.balls})</span>
        <span className="ml-auto text-xs text-muted-foreground">SR {sr}</span>
      </div>
      <div className="flex gap-2 text-xs mt-1">
        <span className="text-[hsl(var(--boundary))]">4s: {b.fours}</span>
        <span className="text-[hsl(var(--six))]">6s: {b.sixes}</span>
      </div>
    </Card>
  );
}

function BowlerCard({ b }: { b: any }) {
  if (!b) return null;
  const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(2) : "—";
  return (
    <Card className="p-3 gradient-card border-[hsl(var(--mi))]/40">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
        <span>Bowler</span><span className="text-[hsl(var(--mi))]">● BOWLING</span>
      </div>
      <div className="font-display text-xl truncate">{b.name}</div>
      <div className="flex items-end gap-2 mt-1">
        <span className="font-mono text-2xl font-bold">{b.wickets}/{b.runs}</span>
        <span className="font-mono text-sm text-muted-foreground">({ballsToOvers(b.balls)})</span>
        <span className="ml-auto text-xs text-muted-foreground">Econ {econ}</span>
      </div>
    </Card>
  );
}
