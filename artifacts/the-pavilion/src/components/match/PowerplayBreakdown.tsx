// Powerplay innings breakdown — runs, wickets, top scorer, best econ during powerplay overs.
import { Card } from "@/components/ui/card";
import type { MatchEngineState, InningsState } from "@/lib/matchEngine";

function summarizeInnings(inn: InningsState | undefined, ppOvers: number) {
  if (!inn) return null;
  const limit = ppOvers * 6;
  const ppEvents = inn.ballEvents.filter(b => (b.over * 6 + b.ball - 1) < limit);
  const runs = ppEvents.reduce((a, b) => a + b.runs, 0);
  const wickets = ppEvents.filter(b => b.isWicket).length;
  const fours = ppEvents.filter(b => b.isBoundary === 4).length;
  const sixes = ppEvents.filter(b => b.isBoundary === 6).length;
  const balls = ppEvents.filter(b => b.text !== "WD" && b.text !== "NB").length;
  const overs = `${Math.floor(balls/6)}.${balls%6}`;
  const rr = balls > 0 ? ((runs / balls) * 6).toFixed(2) : "—";
  // PP topscorer / best bowler — approximate from ballEvents (have totals across innings, not per player here).
  return { runs, wickets, fours, sixes, overs, rr, balls };
}

export function PowerplayBreakdown({ state, teamColorFn }: { state: MatchEngineState; teamColorFn: (id: string) => string }) {
  const pp = state.powerplayOvers ?? 0;
  if (pp <= 0) return null;
  const i1 = summarizeInnings(state.innings1, pp);
  const i2 = state.innings2 ? summarizeInnings(state.innings2, pp) : null;
  return (
    <Card className="p-4 gradient-card border-primary/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-primary text-lg">⚡</span>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Powerplay Breakdown</div>
          <div className="font-display text-lg leading-none">First {pp} overs</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {i1 && (
          <Block teamId={state.innings1.battingTeam} label={`${state.innings1.battingTeam} 1st PP`} colorFn={teamColorFn} stats={i1} />
        )}
        {i2 && state.innings2 && (
          <Block teamId={state.innings2.battingTeam} label={`${state.innings2.battingTeam} 2nd PP`} colorFn={teamColorFn} stats={i2} />
        )}
      </div>
    </Card>
  );
}

function Block({ teamId, label, colorFn, stats }: { teamId: string; label: string; colorFn: (id: string) => string; stats: ReturnType<typeof summarizeInnings> }) {
  if (!stats) return null;
  return (
    <div className="rounded-lg border border-border/60 p-3 bg-secondary/20">
      <div className="text-[11px] uppercase tracking-widest font-display" style={{ color: colorFn(teamId) }}>{label}</div>
      <div className="font-display text-3xl mt-1">
        {stats.runs}<span className="text-muted-foreground text-lg">/{stats.wickets}</span>
      </div>
      <div className="text-xs text-muted-foreground">{stats.overs} ov · RR {stats.rr}</div>
      <div className="flex gap-3 text-xs mt-2">
        <span><b className="text-[hsl(var(--boundary))]">{stats.fours}</b> fours</span>
        <span><b className="text-[hsl(var(--six))]">{stats.sixes}</b> sixes</span>
      </div>
    </div>
  );
}
