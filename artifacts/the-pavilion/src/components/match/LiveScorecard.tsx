import type { InningsState, MatchEngineState } from "@/lib/matchEngine";
import { ballsToOvers, runRate, reqRR } from "@/lib/matchEngine";

interface Props {
  state: MatchEngineState;
  teamColorFn: (id: string) => string;
}

/** Returns up to the last 6 ball events of the current (or most recent) over */
function currentOverBalls(inn: InningsState) {
  const events = inn.ballEvents;
  if (!events.length) return [];
  const lastOver = events[events.length - 1].over;
  return events.filter(e => e.over === lastOver);
}

function BallDot({ e }: { e: InningsState["ballEvents"][0] }) {
  let bg = "bg-white/10 text-white/40 border-white/15";
  let label = e.runs === 0 ? "•" : String(e.runs);
  if (e.isWicket) { bg = "bg-rose-600 text-white border-rose-500"; label = "W"; }
  else if (e.isBoundary === 6) { bg = "bg-purple-600 text-white border-purple-500"; label = "6"; }
  else if (e.isBoundary === 4) { bg = "bg-emerald-600 text-white border-emerald-500"; label = "4"; }
  else if (e.runs > 0) { bg = "bg-white/20 text-white/80 border-white/25"; }
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ball-pop ${bg}`}>
      {label}
    </div>
  );
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
  const teamColor = teamColorFn(inn.battingTeam);
  const bowlerColor = teamColorFn(inn.bowlingTeam);
  const overBalls = currentOverBalls(inn);
  const overNum = overBalls.length ? overBalls[0].over : Math.floor(inn.legalBalls / 6);

  // Chase progress — percentage of target achieved
  const chasePct = state.target && inn.runs >= 0
    ? Math.min(100, Math.round((inn.runs / state.target) * 100)) : null;

  return (
    <div className="space-y-3">
      {/* ── TV Broadcast Scoreboard ── */}
      <div
        className="rounded-xl overflow-hidden relative tv-scanline"
        style={{
          background: `linear-gradient(145deg, color-mix(in srgb, ${teamColor} 12%, #07070f) 0%, #07070f 60%)`,
          border: `1px solid color-mix(in srgb, ${teamColor} 30%, transparent)`,
          boxShadow: `0 0 40px -10px ${teamColor}55, inset 0 1px 0 ${teamColor}22`,
        }}
      >
        {/* Top colour bar */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${teamColor}, color-mix(in srgb, ${teamColor} 30%, transparent))` }} />

        <div className="p-5 pb-4">
          {/* Teams row */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="font-display text-3xl tracking-widest" style={{ color: teamColor }}>
                {inn.battingTeam}
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/35 border border-white/15 px-2 py-0.5 rounded">
                INN {state.currentInnings}
              </div>
              {state.target && (
                <div className="text-[11px] font-bold px-2.5 py-1 rounded"
                  style={{ background: `${teamColor}22`, color: teamColor, border: `1px solid ${teamColor}44` }}>
                  TARGET {state.target}
                </div>
              )}
            </div>
            <div className="text-xs text-white/30">vs <span className="text-white/50">{inn.bowlingTeam}</span></div>
          </div>

          {/* Score + rate grid */}
          <div className="flex items-end gap-6 flex-wrap">
            {/* Giant score */}
            <div>
              <div className="font-display leading-none scoreboard-tick" key={`${inn.runs}-${inn.wickets}`}
                style={{ fontSize: "clamp(3.5rem, 8vw, 5rem)", color: teamColor, textShadow: `0 0 40px ${teamColor}66` }}>
                {inn.runs}<span className="text-white/30" style={{ fontSize: "55%" }}>/{inn.wickets}</span>
              </div>
              <div className="text-xs text-white/40 mt-1 font-mono tracking-wider">
                {ballsToOvers(inn.legalBalls)} / {state.oversPerInnings} ov
              </div>
            </div>

            {/* Rate cards */}
            <div className="ml-auto flex gap-3">
              <RateChip label="CRR" value={rr.toFixed(2)} color="text-white/80" />
              {rrr !== null && rrr > 0 && rrr < 36 && (
                <>
                  <RateChip label="RRR" value={rrr.toFixed(2)} color={rrr > 12 ? "text-rose-400" : rrr > 9 ? "text-amber-400" : "text-emerald-400"} />
                  <RateChip label="NEED" value={`${need ?? 0}`} sub={`${ballsLeft}b`} color="text-white/70" />
                </>
              )}
            </div>
          </div>

          {/* Chase progress bar */}
          {chasePct !== null && (
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-[10px] text-white/35 uppercase tracking-widest">
                <span>Chase Progress</span>
                <span className="font-mono font-bold" style={{ color: teamColor }}>{chasePct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden chase-meter-track">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${chasePct}%`, background: `linear-gradient(90deg, ${teamColor}cc, ${teamColor})` }} />
              </div>
            </div>
          )}

          {/* Current over balls */}
          {overBalls.length > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/30 mr-1">Ov {overNum + 1}</span>
              {overBalls.map((e, i) => <BallDot key={i} e={e} />)}
              {/* Empty placeholders */}
              {Array.from({ length: Math.max(0, 6 - overBalls.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="w-8 h-8 rounded-full border border-dashed border-white/10 opacity-40" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Batting + Bowling cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <BatterCard label="STRIKER" b={striker} color={teamColor} on />
        <BatterCard label="NON-STRIKER" b={nonStriker} color={teamColor} />
        <BowlerCard b={bowler} color={bowlerColor} />
      </div>
    </div>
  );
}

function RateChip({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <span className="text-[9px] uppercase tracking-[0.2em] text-white/30">{label}</span>
      <span className={`font-display text-2xl leading-none mt-0.5 ${color}`}>{value}</span>
      {sub && <span className="text-[9px] text-white/25 font-mono">{sub}</span>}
    </div>
  );
}

function BatterCard({ b, label, on, color }: { b: any; label: string; on?: boolean; color: string }) {
  if (!b) return null;
  const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "—";
  return (
    <div className={`rounded-xl p-4 relative overflow-hidden transition-all`}
      style={{
        background: on
          ? `linear-gradient(145deg, color-mix(in srgb, ${color} 10%, #0d0d0d) 0%, #0d0d0d 70%)`
          : "linear-gradient(145deg, #111, #0d0d0d)",
        border: `1px solid ${on ? color + "44" : "rgba(255,255,255,0.07)"}`,
        boxShadow: on ? `0 0 20px -6px ${color}44` : "none",
      }}>
      {on && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />}

      <div className="flex items-start justify-between mb-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">{label}</div>
        {on && (
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
            STRIKE
          </div>
        )}
      </div>

      <div className="font-display text-xl tracking-wider text-white/90 truncate mb-2">{b.name}</div>

      <div className="flex items-end gap-2">
        <div>
          <span className="font-display text-4xl leading-none text-white">{b.runs}</span>
          <span className="text-white/40 text-lg ml-1">({b.balls})</span>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] text-white/30">SR</div>
          <div className="font-mono font-bold text-sm text-white/70">{sr}</div>
        </div>
      </div>

      <div className="flex gap-4 mt-2.5 text-sm">
        <span className="flex items-center gap-1">
          <span className="text-[9px] text-white/25">4s</span>
          <span className="font-bold" style={{ color: "hsl(var(--boundary))" }}>{b.fours}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-[9px] text-white/25">6s</span>
          <span className="font-bold" style={{ color: "hsl(var(--six))" }}>{b.sixes}</span>
        </span>
      </div>
    </div>
  );
}

function BowlerCard({ b, color }: { b: any; color: string }) {
  if (!b) return null;
  const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(2) : "—";
  return (
    <div className="rounded-xl p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(145deg, color-mix(in srgb, ${color} 8%, #0d0d0d) 0%, #0d0d0d 70%)`,
        border: `1px solid ${color}33`,
        boxShadow: `0 0 20px -8px ${color}33`,
      }}>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}88, transparent)` }} />

      <div className="flex items-start justify-between mb-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">BOWLING</div>
        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
          NOW
        </div>
      </div>

      <div className="font-display text-xl tracking-wider text-white/90 truncate mb-2">{b.name}</div>

      <div className="flex items-end gap-2">
        <div>
          <span className="font-display text-4xl leading-none" style={{ color }}>{b.wickets}</span>
          <span className="text-white/40 text-xl">/{b.runs}</span>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] text-white/30">ECON</div>
          <div className="font-mono font-bold text-sm" style={{ color }}>{econ}</div>
        </div>
      </div>

      <div className="mt-2.5 text-[10px] text-white/30 font-mono">
        {ballsToOvers(b.balls)} overs bowled
      </div>
    </div>
  );
}
