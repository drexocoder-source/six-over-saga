// Extra in-match detail panels: partnership, last-5 overs, projected score, phase tracker.
import type { MatchEngineState } from "@/lib/matchEngine";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  state: MatchEngineState;
  teamColorFn: (id: string) => string;
}

export function InMatchDetails({ state, teamColorFn }: Props) {
  const inn = state.currentInnings === 1 ? state.innings1 : state.innings2!;
  const totalBalls = state.oversPerInnings * 6;
  const ballsBowled = inn.legalBalls;
  const ballsLeft = Math.max(0, totalBalls - ballsBowled);
  const crr = ballsBowled > 0 ? (inn.runs / ballsBowled) * 6 : 0;
  const projected = ballsBowled > 0 ? Math.round(crr * state.oversPerInnings) : 0;

  // Partnership: runs since last wicket fall in ballEvents
  const evs = inn.ballEvents;
  let pStart = 0;
  for (let i = evs.length - 1; i >= 0; i--) {
    if (evs[i].isWicket) { pStart = i + 1; break; }
  }
  const pship = evs.slice(pStart);
  const pRuns = pship.reduce((s, e) => s + e.runs, 0);
  const pBalls = pship.filter(e => e.text !== "WD" && e.text !== "NB").length;
  const striker = inn.bat[inn.strikerId];
  const nonStriker = inn.bat[inn.nonStrikerId];

  // Last 5 overs runs/wickets
  const overs: Record<number, { runs: number; wkts: number }> = {};
  evs.forEach(e => {
    overs[e.over] ??= { runs: 0, wkts: 0 };
    overs[e.over].runs += e.runs;
    if (e.isWicket) overs[e.over].wkts += 1;
  });
  const overKeys = Object.keys(overs).map(Number).sort((a, b) => b - a).slice(0, 5).reverse();
  const last5Runs = overKeys.reduce((s, k) => s + overs[k].runs, 0);
  const last5Wkts = overKeys.reduce((s, k) => s + overs[k].wkts, 0);

  // Phase
  const pp = state.powerplayOvers ?? 0;
  const oversBowled = ballsBowled / 6;
  const phase = oversBowled < pp ? "Powerplay" : oversBowled >= state.oversPerInnings - 4 ? "Death" : "Middle";
  const phaseColor = phase === "Powerplay" ? "text-primary" : phase === "Death" ? "text-[hsl(var(--wicket))]" : "text-muted-foreground";

  // Boundaries / dot %
  const totalLegal = inn.legalBalls;
  const dots = Object.values(inn.bowl as any).reduce((s: number, b: any) => s + (b.dots ?? 0), 0) as number;
  const boundaries = Object.values(inn.bat as any).reduce((s: number, b: any) => s + (b.fours ?? 0) + (b.sixes ?? 0), 0) as number;
  const dotPct = totalLegal > 0 ? Math.round((dots / totalLegal) * 100) : 0;
  const boundaryPct = totalLegal > 0 ? Math.round((boundaries / totalLegal) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="p-3 gradient-card border-border/60">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Partnership</div>
        <div className="font-display text-xl mt-1">{pRuns} <span className="text-sm text-muted-foreground">({pBalls})</span></div>
        <div className="text-[10px] text-muted-foreground truncate mt-0.5">
          {striker?.name?.split(" ").slice(-1)[0]} & {nonStriker?.name?.split(" ").slice(-1)[0]}
        </div>
      </Card>

      <Card className="p-3 gradient-card border-border/60">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Last 5 overs</div>
        <div className="font-display text-xl mt-1">{last5Runs}/{last5Wkts}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{overKeys.length} ov · {(last5Runs / Math.max(1, overKeys.length)).toFixed(1)} rpo</div>
      </Card>

      <Card className="p-3 gradient-card border-border/60">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {state.currentInnings === 1 ? "Projected" : "Need / Ball"}
        </div>
        {state.currentInnings === 1 ? (
          <>
            <div className="font-display text-xl mt-1 text-primary">{projected}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">@ {crr.toFixed(2)} rpo · {ballsLeft}b left</div>
          </>
        ) : (
          <>
            <div className="font-display text-xl mt-1 text-primary">
              {state.target ? Math.max(0, state.target - inn.runs) : 0}
              <span className="text-sm text-muted-foreground"> / {ballsLeft}b</span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {state.allOutWickets - inn.wickets} wkts in hand
            </div>
          </>
        )}
      </Card>

      <Card className="p-3 gradient-card border-border/60">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
          Phase <Badge variant="outline" className={`text-[9px] py-0 px-1.5 ${phaseColor}`}>{phase}</Badge>
        </div>
        <div className="text-xs mt-1 flex justify-between">
          <span className="text-muted-foreground">Dots</span>
          <span className="font-mono">{dotPct}%</span>
        </div>
        <div className="text-xs flex justify-between">
          <span className="text-muted-foreground">Bdries</span>
          <span className="font-mono text-[hsl(var(--boundary))]">{boundaryPct}%</span>
        </div>
      </Card>
    </div>
  );
}
