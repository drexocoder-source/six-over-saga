// Worm chart helper — builds cumulative run series for both innings.
export interface WormPoint { ball: number; over: number; runs: number; isWicket: boolean; team: string; }

export function buildWormSeries(innings: any[]): WormPoint[][] {
  return innings.filter(Boolean).map((inn: any) => {
    let cum = 0;
    return (inn.ballEvents as any[]).map((b, i) => {
      cum += b.runs;
      return { ball: i + 1, over: b.over + b.ball / 6, runs: cum, isWicket: b.isWicket, team: inn.battingTeam } as WormPoint;
    });
  });
}
