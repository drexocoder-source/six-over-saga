import type { MatchEngineState } from "@/lib/matchEngine";
import { winProb } from "@/lib/matchEngine";
import { teamLogo } from "@/lib/teamLogos";

interface Props { state: MatchEngineState; teamColorFn: (id: string) => string; }

export function WinProbBar({ state, teamColorFn }: Props) {
  const wp = winProb(state);
  const inn = state.currentInnings === 1 ? state.innings1 : state.innings2!;
  const batColor = teamColorFn(inn.battingTeam);
  const bowlColor = teamColorFn(inn.bowlingTeam);

  return (
    <div className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}>

      {/* Header */}
      <div className="text-[9px] uppercase tracking-[0.3em] text-white/25 text-center font-bold mb-3">
        Win Probability
      </div>

      {/* Team indicators */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <img src={teamLogo(inn.battingTeam)} alt={inn.battingTeam}
            className="w-7 h-7 object-contain" style={{ filter: `drop-shadow(0 0 4px ${batColor}55)` }} />
          <div>
            <div className="font-display text-sm tracking-wider" style={{ color: batColor }}>{inn.battingTeam}</div>
            <div className="text-[9px] text-white/30">Batting</div>
          </div>
        </div>

        {/* Percentage labels */}
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl font-black" style={{ color: batColor }}>{wp.batting}%</span>
          <span className="text-white/20 text-lg">·</span>
          <span className="font-display text-2xl font-black" style={{ color: bowlColor }}>{wp.bowling}%</span>
        </div>

        <div className="flex items-center gap-2 flex-row-reverse">
          <img src={teamLogo(inn.bowlingTeam)} alt={inn.bowlingTeam}
            className="w-7 h-7 object-contain opacity-70" style={{ filter: `drop-shadow(0 0 4px ${bowlColor}44)` }} />
          <div className="text-right">
            <div className="font-display text-sm tracking-wider" style={{ color: bowlColor + "99" }}>{inn.bowlingTeam}</div>
            <div className="text-[9px] text-white/25">Fielding</div>
          </div>
        </div>
      </div>

      {/* Probability bar */}
      <div className="h-3 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="transition-all duration-700 rounded-l-full"
          style={{ width: `${wp.batting}%`, background: `linear-gradient(90deg, ${batColor}cc, ${batColor})`, boxShadow: `4px 0 12px ${batColor}44` }} />
        <div className="transition-all duration-700 rounded-r-full"
          style={{ width: `${wp.bowling}%`, background: `linear-gradient(90deg, ${bowlColor}cc, ${bowlColor})` }} />
      </div>
    </div>
  );
}

export function OverTimeline({ state }: { state: MatchEngineState }) {
  const inn = state.currentInnings === 1 ? state.innings1 : state.innings2!;
  const byOver: Record<number, typeof inn.ballEvents> = {};
  inn.ballEvents.forEach(e => {
    byOver[e.over] = byOver[e.over] || [];
    byOver[e.over].push(e);
  });
  const overs = Object.keys(byOver).map(Number).sort((a,b) => a-b);

  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="text-[9px] uppercase tracking-[0.3em] text-white/25 mb-3 font-bold">Innings Timeline</div>
      <div className="space-y-2 max-h-40 overflow-auto">
        {overs.length === 0 && <div className="text-xs text-white/25 italic">No balls bowled yet.</div>}
        {overs.map(o => {
          const balls = byOver[o];
          const runs = balls.reduce((s,b) => s+b.runs, 0);
          const hasWicket = balls.some(b => b.isWicket);
          return (
            <div key={o} className="flex items-center gap-2.5">
              <span className="text-[9px] text-white/25 font-mono w-10 shrink-0 font-bold">Ov {o+1}</span>
              <div className="flex gap-1 flex-wrap flex-1">
                {balls.map((b,i) => (
                  <span key={i} className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ball-pop
                    ${b.isWicket ? "bg-rose-600/70 text-white shadow-[0_0_6px_rgba(239,68,68,0.5)]" :
                      b.isBoundary === 6 ? "bg-purple-600/70 text-white shadow-[0_0_6px_rgba(168,85,247,0.5)]" :
                      b.isBoundary === 4 ? "bg-emerald-600/70 text-white shadow-[0_0_6px_rgba(52,211,153,0.4)]" :
                      b.text === "WD" || b.text === "NB" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" :
                      b.text === "0" ? "bg-white/5 text-white/30 border border-white/10" :
                      "bg-white/10 text-white/70 border border-white/15"}`}>
                    {b.text}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-mono text-xs text-white/40 w-6 text-right">{runs}</span>
                {hasWicket && <span className="text-[9px] text-rose-400">W</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CapsRace({ state, teamColorFn }: { state: MatchEngineState; teamColorFn: (id:string)=>string }) {
  const innings = [state.innings1, state.innings2].filter(Boolean) as any[];
  const bats = innings.flatMap(inn => Object.values(inn.bat).map((b: any) => ({ ...b, team: inn.battingTeam })))
    .sort((a:any,b:any) => b.runs - a.runs).slice(0,3);
  const bowls = innings.flatMap(inn => Object.values(inn.bowl).map((b: any) => ({ ...b, team: inn.bowlingTeam })))
    .filter((b:any) => b.wickets > 0 || b.balls > 0)
    .sort((a:any,b:any) => b.wickets - a.wickets || a.runs - b.runs).slice(0,3);
  const maxRuns = bats[0]?.runs ?? 1;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Orange Cap */}
      <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(251,146,60,0.25)" }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🟠</span>
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-amber-400/80 font-bold">Orange Cap</div>
            <div className="text-[8px] text-white/25">This Match</div>
          </div>
        </div>
        <div className="space-y-2">
          {bats.length === 0 && <div className="text-xs text-white/25 italic">—</div>}
          {bats.map((b:any, i:number) => {
            const pct = maxRuns > 0 ? (b.runs / maxRuns) * 100 : 0;
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-white/25 w-3">{i+1}</span>
                  <span className="flex-1 truncate text-white/80 text-[11px]">{b.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-amber-400">{b.runs}</span>
                    <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: teamColorFn(b.team), boxShadow: `0 0 4px ${teamColorFn(b.team)}66` }} />
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: "linear-gradient(90deg, #fb923c, #fbbf24)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Purple Cap */}
      <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(167,139,250,0.25)" }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🟣</span>
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-purple-400/80 font-bold">Purple Cap</div>
            <div className="text-[8px] text-white/25">This Match</div>
          </div>
        </div>
        <div className="space-y-2">
          {bowls.length === 0 && <div className="text-xs text-white/25 italic">—</div>}
          {bowls.map((b:any, i:number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-white/25 w-3">{i+1}</span>
              <span className="flex-1 truncate text-white/80 text-[11px]">{b.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-purple-400">{b.wickets}/{b.runs}</span>
                <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: teamColorFn(b.team), boxShadow: `0 0 4px ${teamColorFn(b.team)}66` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
