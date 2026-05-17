// Win probability bar + caps race + over timeline
import type { MatchEngineState } from "@/lib/matchEngine";
import { winProb } from "@/lib/matchEngine";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props { state: MatchEngineState; teamColorFn: (id: string) => string; }

export function WinProbBar({ state, teamColorFn }: Props) {
  const wp = winProb(state);
  const inn = state.currentInnings === 1 ? state.innings1 : state.innings2!;
  return (
    <Card className="p-3 gradient-card border-border/60">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-display tracking-wider" style={{ color: teamColorFn(inn.battingTeam) }}>
          {inn.battingTeam} {wp.batting}%
        </span>
        <span className="text-muted-foreground uppercase tracking-widest text-[10px]">Win Probability</span>
        <span className="font-display tracking-wider" style={{ color: teamColorFn(inn.bowlingTeam) }}>
          {wp.bowling}% {inn.bowlingTeam}
        </span>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex bg-secondary">
        <div className="transition-all duration-500" style={{ width: `${wp.batting}%`, background: teamColorFn(inn.battingTeam) }} />
        <div className="transition-all duration-500" style={{ width: `${wp.bowling}%`, background: teamColorFn(inn.bowlingTeam) }} />
      </div>
    </Card>
  );
}

export function OverTimeline({ state }: { state: MatchEngineState }) {
  const inn = state.currentInnings === 1 ? state.innings1 : state.innings2!;
  // Group by over
  const byOver: Record<number, typeof inn.ballEvents> = {};
  inn.ballEvents.forEach(e => {
    byOver[e.over] = byOver[e.over] || [];
    byOver[e.over].push(e);
  });
  const overs = Object.keys(byOver).map(Number).sort((a,b) => a-b);

  return (
    <Card className="p-3 gradient-card border-border/60">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">This Innings</div>
      <div className="space-y-1.5 max-h-32 overflow-auto">
        {overs.length === 0 && <div className="text-xs text-muted-foreground italic">No balls bowled yet.</div>}
        {overs.map(o => {
          const balls = byOver[o];
          const runs = balls.reduce((s,b) => s+b.runs, 0);
          return (
            <div key={o} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-10">Ov {o+1}</span>
              <div className="flex gap-1 flex-wrap flex-1">
                {balls.map((b,i) => (
                  <span key={i} className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ball-pop
                    ${b.isWicket ? "bg-[hsl(var(--wicket))] text-foreground" :
                      b.isBoundary === 6 ? "bg-[hsl(var(--six))] text-foreground" :
                      b.isBoundary === 4 ? "bg-[hsl(var(--boundary))] text-background" :
                      b.text === "WD" || b.text === "NB" ? "bg-[hsl(var(--extra))]/30 text-[hsl(var(--extra))] border border-[hsl(var(--extra))]/50" :
                      b.text === "0" ? "bg-secondary text-muted-foreground" :
                      "bg-secondary text-foreground"}`}>
                    {b.text}
                  </span>
                ))}
              </div>
              <span className="font-mono text-xs text-muted-foreground w-8 text-right">{runs}r</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function CapsRace({ state, teamColorFn }: { state: MatchEngineState; teamColorFn: (id:string)=>string }) {
  // Combine batters & bowlers across innings
  const innings = [state.innings1, state.innings2].filter(Boolean) as any[];
  const bats = innings.flatMap(inn => Object.values(inn.bat).map((b: any) => ({ ...b, team: inn.battingTeam })))
    .sort((a:any,b:any) => b.runs - a.runs).slice(0,3);
  const bowls = innings.flatMap(inn => Object.values(inn.bowl).map((b: any) => ({ ...b, team: inn.bowlingTeam })))
    .filter((b:any) => b.wickets > 0 || b.balls > 0)
    .sort((a:any,b:any) => b.wickets - a.wickets || a.runs - b.runs).slice(0,3);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="p-3 gradient-card border-primary/40">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-lg">🟠</span>
          <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">Orange Cap (this match)</span>
        </div>
        <div className="space-y-1">
          {bats.length === 0 && <div className="text-xs text-muted-foreground italic">—</div>}
          {bats.map((b:any, i:number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-muted-foreground w-4">{i+1}</span>
              <span className="flex-1 truncate">{b.name}</span>
              <span className="font-mono font-bold">{b.runs}</span>
              <Badge variant="outline" className="text-[9px] py-0 h-4" style={{ color: teamColorFn(b.team), borderColor: teamColorFn(b.team) }}>{b.team}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-3 gradient-card border-[hsl(var(--six))]/40">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-lg">🟣</span>
          <span className="text-[10px] uppercase tracking-widest font-semibold" style={{color:"hsl(var(--six))"}}>Purple Cap (this match)</span>
        </div>
        <div className="space-y-1">
          {bowls.length === 0 && <div className="text-xs text-muted-foreground italic">—</div>}
          {bowls.map((b:any, i:number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-muted-foreground w-4">{i+1}</span>
              <span className="flex-1 truncate">{b.name}</span>
              <span className="font-mono font-bold">{b.wickets}/{b.runs}</span>
              <Badge variant="outline" className="text-[9px] py-0 h-4" style={{ color: teamColorFn(b.team), borderColor: teamColorFn(b.team) }}>{b.team}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
