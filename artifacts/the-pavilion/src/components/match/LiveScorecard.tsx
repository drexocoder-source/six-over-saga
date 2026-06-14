import type { InningsState, MatchEngineState } from "@/lib/matchEngine";
import { ballsToOvers, runRate, reqRR } from "@/lib/matchEngine";
import { teamLogo } from "@/lib/teamLogos";

interface Props {
  state: MatchEngineState;
  teamColorFn: (id: string) => string;
}

function currentOverBalls(inn: InningsState) {
  const events = inn.ballEvents;
  if (!events.length) return [];
  const lastOver = events[events.length - 1].over;
  return events.filter(e => e.over === lastOver);
}

function BallDot({ e }: { e: InningsState["ballEvents"][0] }) {
  let bg = "bg-white/10 text-white/40 border border-white/15";
  let label = e.runs === 0 ? "•" : String(e.runs);
  if (e.isWicket) { bg = "bg-rose-600/80 text-white border border-rose-400/60 shadow-[0_0_8px_rgba(239,68,68,0.5)]"; label = "W"; }
  else if (e.isBoundary === 6) { bg = "bg-purple-600/80 text-white border border-purple-400/60 shadow-[0_0_8px_rgba(168,85,247,0.5)]"; label = "6"; }
  else if (e.isBoundary === 4) { bg = "bg-emerald-600/80 text-white border border-emerald-400/60 shadow-[0_0_8px_rgba(52,211,153,0.5)]"; label = "4"; }
  else if (e.runs > 0) { bg = "bg-white/15 text-white/80 border border-white/20"; }
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ball-pop ${bg}`}>
      {label}
    </div>
  );
}

function RateChip({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}>
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
    <div className="rounded-2xl p-4 relative overflow-hidden transition-all duration-300"
      style={{
        background: on
          ? `linear-gradient(145deg, color-mix(in srgb, ${color} 12%, #080810) 0%, #080810 70%)`
          : "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        border: `1px solid ${on ? color + "50" : "rgba(255,255,255,0.08)"}`,
        boxShadow: on ? `0 0 24px -6px ${color}44, inset 0 1px 0 ${color}22` : "none",
      }}>
      {on && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />}

      <div className="flex items-start justify-between mb-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/25">{label}</div>
        {on && (
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
            ON STRIKE
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
          <div className="text-[9px] text-white/25 mb-0.5">SR</div>
          <div className="font-mono font-bold text-sm text-white/70">{sr}</div>
        </div>
      </div>

      <div className="flex gap-4 mt-2.5 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="text-[9px] text-white/25">4s</span>
          <span className="font-bold text-emerald-400">{b.fours}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[9px] text-white/25">6s</span>
          <span className="font-bold text-purple-400">{b.sixes}</span>
        </span>
      </div>
    </div>
  );
}

function BowlerCard({ b, color }: { b: any; color: string }) {
  if (!b) return null;
  const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(2) : "—";
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(145deg, color-mix(in srgb, ${color} 10%, #080810) 0%, #080810 70%)`,
        border: `1px solid ${color}40`,
        boxShadow: `0 0 20px -8px ${color}40, inset 0 1px 0 ${color}18`,
      }}>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}90, transparent)` }} />

      <div className="flex items-start justify-between mb-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/25">BOWLING</div>
        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
          BOWLING NOW
        </div>
      </div>

      <div className="font-display text-xl tracking-wider text-white/90 truncate mb-2">{b.name}</div>

      <div className="flex items-end gap-2">
        <div>
          <span className="font-display text-4xl leading-none" style={{ color }}>{b.wickets}</span>
          <span className="text-white/40 text-xl">/{b.runs}</span>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[9px] text-white/25 mb-0.5">ECON</div>
          <div className="font-mono font-bold text-sm" style={{ color }}>{econ}</div>
        </div>
      </div>

      <div className="mt-2.5 text-[10px] text-white/25 font-mono tracking-wider">
        {ballsToOvers(b.balls)} overs bowled
      </div>
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
  const battingColor = teamColorFn(inn.battingTeam);
  const bowlingColor = teamColorFn(inn.bowlingTeam);
  const overBalls = currentOverBalls(inn);
  const overNum = overBalls.length ? overBalls[0].over : Math.floor(inn.legalBalls / 6);

  const chasePct = state.target && inn.runs >= 0
    ? Math.min(100, Math.round((inn.runs / state.target) * 100)) : null;

  const inn1 = state.innings1;
  const showInnings1Score = state.currentInnings === 2 && inn1;

  return (
    <div className="space-y-3">
      {/* ── Premium TV Broadcast Header ── */}
      <div className="rounded-2xl overflow-hidden relative"
        style={{
          background: `linear-gradient(160deg, color-mix(in srgb, ${battingColor} 10%, #06060f) 0%, #06060f 55%, color-mix(in srgb, ${bowlingColor} 6%, #06060f) 100%)`,
          border: `1px solid rgba(255,255,255,0.07)`,
          boxShadow: `0 0 60px -20px ${battingColor}40, inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}>

        {/* Animated gradient top strip */}
        <div className="h-1 w-full" style={{
          background: `linear-gradient(90deg, ${battingColor}, ${battingColor}88, ${bowlingColor}44, transparent)`,
        }} />

        {/* ── VS Team Header ── */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">

            {/* Batting team */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img src={teamLogo(inn.battingTeam)} alt={inn.battingTeam}
                  className="w-14 h-14 object-contain transition-transform duration-300 hover:scale-105"
                  style={{ filter: `drop-shadow(0 0 10px ${battingColor}60)` }} />
                <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
                  style={{ background: battingColor, color: "#000" }}>BAT</div>
              </div>
              <div>
                <div className="font-display text-2xl md:text-3xl tracking-widest leading-none" style={{ color: battingColor, textShadow: `0 0 30px ${battingColor}55` }}>
                  {inn.battingTeam}
                </div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-white/30 mt-0.5">BATTING • INN {state.currentInnings}</div>
              </div>
            </div>

            {/* Center: match info + score */}
            <div className="flex flex-col items-center gap-1 mx-3">
              <div className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-bold">
                {state.currentInnings === 1 ? "1ST INNINGS" : "2ND INNINGS"}
              </div>
              {showInnings1Score && (
                <div className="text-xs font-mono text-white/40 tracking-wider">
                  {inn1.battingTeam} <span className="text-white/60 font-bold">{inn1.runs}/{inn1.wickets}</span>
                </div>
              )}
              {state.target && (
                <div className="px-3 py-1 rounded-lg text-[11px] font-black tracking-wider mt-1"
                  style={{ background: `${battingColor}22`, color: battingColor, border: `1px solid ${battingColor}44` }}>
                  TARGET {state.target}
                </div>
              )}
            </div>

            {/* Bowling team */}
            <div className="flex items-center gap-3 flex-row-reverse min-w-0">
              <div className="relative shrink-0">
                <img src={teamLogo(inn.bowlingTeam)} alt={inn.bowlingTeam}
                  className="w-14 h-14 object-contain opacity-70"
                  style={{ filter: `drop-shadow(0 0 6px ${bowlingColor}40)` }} />
                <div className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
                  style={{ background: bowlingColor + "cc", color: "#000" }}>BOWL</div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl md:text-3xl tracking-widest leading-none" style={{ color: bowlingColor + "99" }}>
                  {inn.bowlingTeam}
                </div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-white/20 mt-0.5">FIELDING</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Score Block ── */}
        <div className="px-5 pb-4">
          <div className="flex items-end gap-6 flex-wrap">
            {/* Giant score */}
            <div>
              <div className="font-display leading-none scoreboard-tick" key={`${inn.runs}-${inn.wickets}`}
                style={{ fontSize: "clamp(3.5rem, 8vw, 5rem)", color: battingColor, textShadow: `0 0 50px ${battingColor}55` }}>
                {inn.runs}<span className="text-white/30" style={{ fontSize: "55%" }}>/{inn.wickets}</span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="text-xs text-white/35 font-mono tracking-wider">
                  {ballsToOvers(inn.legalBalls)} / {state.oversPerInnings} ov
                </div>
                {inn.extras.total > 0 && (
                  <div className="text-[10px] text-white/25 font-mono">
                    Extras: {inn.extras.total} (wd {inn.extras.wides}, nb {inn.extras.nb})
                  </div>
                )}
              </div>
            </div>

            {/* Rate cards */}
            <div className="ml-auto flex gap-2 flex-wrap">
              <RateChip label="CRR" value={rr.toFixed(2)} color="text-white/80" />
              {rrr !== null && rrr > 0 && rrr < 36 && (
                <>
                  <RateChip label="RRR" value={rrr.toFixed(2)}
                    color={rrr > 14 ? "text-rose-400" : rrr > 10 ? "text-amber-400" : "text-emerald-400"} />
                  <RateChip label="NEED" value={`${need ?? 0}`} sub={`${ballsLeft}b left`} color="text-white/70" />
                </>
              )}
            </div>
          </div>

          {/* Chase progress bar */}
          {chasePct !== null && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-[9px] text-white/30 uppercase tracking-widest">
                <span>Chase Progress</span>
                <span className="font-mono font-bold" style={{ color: battingColor }}>{chasePct}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${chasePct}%`, background: `linear-gradient(90deg, ${battingColor}bb, ${battingColor})`, boxShadow: `0 0 10px ${battingColor}55` }} />
              </div>
            </div>
          )}

          {/* Current over balls */}
          {overBalls.length > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/25 mr-1 font-bold">Ov {overNum + 1}</span>
              {overBalls.map((e, i) => <BallDot key={i} e={e} />)}
              {Array.from({ length: Math.max(0, 6 - overBalls.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="w-8 h-8 rounded-full border border-dashed border-white/08 opacity-30" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Batting + Bowling cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <BatterCard label="STRIKER" b={striker} color={battingColor} on />
        <BatterCard label="NON-STRIKER" b={nonStriker} color={battingColor} />
        <BowlerCard b={bowler} color={bowlingColor} />
      </div>
    </div>
  );
}
