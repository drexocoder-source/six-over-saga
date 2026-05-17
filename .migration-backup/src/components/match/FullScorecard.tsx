import type { MatchEngineState } from "@/lib/matchEngine";
import { ballsToOvers } from "@/lib/matchEngine";
import { Card } from "@/components/ui/card";

interface Props { state: MatchEngineState; teamColorFn: (id: string) => string; }

export function FullScorecard({ state, teamColorFn }: Props) {
  const innings = [state.innings1, state.innings2].filter(Boolean) as NonNullable<typeof state.innings2>[];
  return (
    <div className="space-y-4">
      {innings.map((inn, idx) => (
        <Card key={idx} className="gradient-card border-border/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <div className="font-display text-lg" style={{ color: teamColorFn(inn.battingTeam) }}>
              {inn.battingTeam} Innings
            </div>
            <div className="font-mono text-sm">
              <span className="font-bold text-lg">{inn.runs}/{inn.wickets}</span>
              <span className="text-muted-foreground ml-2">({ballsToOvers(inn.legalBalls)} ov)</span>
            </div>
          </div>
          {/* Batting */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
                <tr>
                  <th className="text-left px-3 py-2">Batter</th>
                  <th className="text-right px-2 py-2">R</th>
                  <th className="text-right px-2 py-2">B</th>
                  <th className="text-right px-2 py-2">4s</th>
                  <th className="text-right px-2 py-2">6s</th>
                  <th className="text-right px-3 py-2">SR</th>
                </tr>
              </thead>
              <tbody>
                {inn.battingOrder.map(id => {
                  const b = inn.bat[id];
                  if (!b) return null;
                  const isStriker = id === inn.strikerId && !inn.done;
                  const isNS = id === inn.nonStrikerId && !inn.done;
                  const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "—";
                  return (
                    <tr key={id} className="border-t border-border/30">
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{b.name}</span>
                          {isStriker && <span className="text-[9px] text-primary">●</span>}
                          {isNS && <span className="text-[9px] text-muted-foreground">○</span>}
                        </div>
                        {b.out && <div className="text-[10px] text-muted-foreground">{b.outDesc}</div>}
                        {!b.out && b.balls > 0 && !isStriker && !isNS && <div className="text-[10px] text-muted-foreground">not out</div>}
                      </td>
                      <td className="text-right px-2 py-1.5 font-mono font-semibold">{b.runs}</td>
                      <td className="text-right px-2 py-1.5 font-mono text-muted-foreground">{b.balls}</td>
                      <td className="text-right px-2 py-1.5 font-mono text-[hsl(var(--boundary))]">{b.fours}</td>
                      <td className="text-right px-2 py-1.5 font-mono text-[hsl(var(--six))]">{b.sixes}</td>
                      <td className="text-right px-3 py-1.5 font-mono">{sr}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border/60 text-[11px]">
                <tr>
                  <td className="px-3 py-1.5 text-muted-foreground">Extras</td>
                  <td colSpan={5} className="px-3 py-1.5 text-right font-mono">{inn.extras.total} (wd {inn.extras.wides}, nb {inn.extras.nb})</td>
                </tr>
                <tr className="font-bold">
                  <td className="px-3 py-1.5">Total</td>
                  <td colSpan={5} className="px-3 py-1.5 text-right font-mono">{inn.runs}/{inn.wickets} ({ballsToOvers(inn.legalBalls)} ov)</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Bowling */}
          <div className="overflow-x-auto border-t border-border/60">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
                <tr>
                  <th className="text-left px-3 py-2">Bowler</th>
                  <th className="text-right px-2 py-2">O</th>
                  <th className="text-right px-2 py-2">R</th>
                  <th className="text-right px-2 py-2">W</th>
                  <th className="text-right px-2 py-2">WD</th>
                  <th className="text-right px-2 py-2">NB</th>
                  <th className="text-right px-3 py-2">Econ</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(inn.bowl).map((bw: any) => {
                  const econ = bw.balls > 0 ? ((bw.runs / bw.balls) * 6).toFixed(2) : "—";
                  return (
                    <tr key={bw.player_id} className="border-t border-border/30">
                      <td className="px-3 py-1.5 font-medium">{bw.name}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{ballsToOvers(bw.balls)}</td>
                      <td className="text-right px-2 py-1.5 font-mono">{bw.runs}</td>
                      <td className="text-right px-2 py-1.5 font-mono font-semibold text-[hsl(var(--wicket))]">{bw.wickets}</td>
                      <td className="text-right px-2 py-1.5 font-mono text-muted-foreground">{bw.wides}</td>
                      <td className="text-right px-2 py-1.5 font-mono text-muted-foreground">{bw.noBalls}</td>
                      <td className="text-right px-3 py-1.5 font-mono">{econ}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
