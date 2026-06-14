import { useState } from "react";
import { teamColor } from "@/lib/teams";
import { teamLogo } from "@/lib/teamLogos";
import type { PointsRow } from "@/lib/standings";
import type { League } from "@/lib/league";
import { Crown, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";

interface QualInfo { status?: "Q" | "E" | "?" | ""; qualPct?: number; scenario?: string }

interface Props {
  table: PointsRow[];
  league: League;
  qual: Record<string, QualInfo>;
  playoffSpots?: number;
}

const FORM_CONFIG: Record<string, { bg: string; text: string; glow: string }> = {
  W: { bg: "rgba(52,211,153,0.18)", text: "#34d399", glow: "0 0 8px rgba(52,211,153,0.4)" },
  L: { bg: "rgba(248,113,113,0.18)", text: "#f87171", glow: "0 0 8px rgba(248,113,113,0.3)" },
  T: { bg: "rgba(251,191,36,0.18)", text: "#fbbf24", glow: "0 0 8px rgba(251,191,36,0.3)" },
};

const RANK_STYLE: Record<number, { icon?: JSX.Element; bg: string; text: string }> = {
  1: { bg: "rgba(255,215,0,0.12)", text: "#ffd700" },
  2: { bg: "rgba(192,192,192,0.12)", text: "#c0c0c0" },
  3: { bg: "rgba(205,127,50,0.12)", text: "#cd7f32" },
};

export function PointsTableCards({ table, league, qual, playoffSpots = 4 }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      {/* Playoff cut-line header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">Playoff zone</span>
        </div>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.2), transparent)" }} />
      </div>

      {/* Table rows */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>

        {/* Column headers */}
        <div className="grid items-center px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/25 border-b border-white/5"
          style={{ gridTemplateColumns: "2.5rem 1fr 3rem 2.5rem 2.5rem 4.5rem 5rem 5.5rem 5.5rem" }}>
          <div className="text-center">#</div>
          <div>Team</div>
          <div className="text-center">P</div>
          <div className="text-center text-emerald-400/50">W</div>
          <div className="text-center text-rose-400/50">L</div>
          <div className="text-center text-amber-400/60">PTS</div>
          <div className="text-center">NRR</div>
          <div className="text-center">Form</div>
          <div className="text-center">Chance</div>
        </div>

        {table.map((row, idx) => {
          const rank = idx + 1;
          const q = qual[row.team_id] ?? {};
          const color = teamColor(row.team_id, league.teams);
          const logo = teamLogo(row.team_id);
          const teamObj = league.teams.find(t => t.id === row.team_id);
          const inPlayoffs = rank <= playoffSpots;
          const qualified = q.status === "Q";
          const eliminated = q.status === "E";
          const nrrPos = row.nrr > 0;
          const isExpanded = expanded === row.team_id;
          const rankStyle = RANK_STYLE[rank];
          const isPlayoffBoundary = rank === playoffSpots;

          return (
            <div key={row.team_id}>
              <div
                className="group relative cursor-pointer transition-all duration-200"
                style={{
                  opacity: eliminated ? 0.55 : 1,
                  background: isExpanded
                    ? `linear-gradient(90deg, ${color}0d, transparent 60%)`
                    : "transparent",
                }}
                onClick={() => setExpanded(v => v === row.team_id ? null : row.team_id)}
              >
                {/* Left accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r transition-all duration-300"
                  style={{
                    background: qualified ? "#34d399" : eliminated ? "#f87171" : inPlayoffs ? color : "transparent",
                    opacity: isExpanded ? 1 : 0.5,
                  }} />

                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none rounded-sm"
                  style={{ background: `linear-gradient(90deg, ${color}08, transparent 50%)` }} />

                <div className="relative grid items-center px-4 py-3.5"
                  style={{ gridTemplateColumns: "2.5rem 1fr 3rem 2.5rem 2.5rem 4.5rem 5rem 5.5rem 5.5rem" }}>

                  {/* Rank */}
                  <div className="flex items-center justify-center">
                    {rank === 1 ? (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: rankStyle.bg }}>
                        <Crown className="w-3.5 h-3.5" style={{ color: rankStyle.text }} />
                      </div>
                    ) : rankStyle ? (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: rankStyle.bg, color: rankStyle.text }}>
                        {rank}
                      </div>
                    ) : (
                      <span className="text-sm font-mono text-white/30 w-7 text-center">{rank}</span>
                    )}
                  </div>

                  {/* Team */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img src={logo} alt={row.team_id} className="w-8 h-8 object-contain"
                        style={{ filter: eliminated ? "saturate(0)" : `drop-shadow(0 0 6px ${color}55)` }} />
                      {(qualified || eliminated) && (
                        <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[7px] font-bold flex items-center justify-center
                          ${qualified ? "bg-emerald-500 text-black" : "bg-rose-500 text-white"}`}>
                          {qualified ? "✓" : "✗"}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-base tracking-wider leading-none" style={{ color: eliminated ? "rgba(255,255,255,0.3)" : color }}>
                        {teamObj?.shortName ?? row.team_id}
                      </div>
                      {teamObj?.home && (
                        <div className="text-[9px] text-white/20 truncate mt-0.5 tracking-wide">{teamObj.home}</div>
                      )}
                    </div>
                  </div>

                  {/* Played */}
                  <div className="text-center font-mono text-sm text-white/40">{row.P}</div>

                  {/* Wins */}
                  <div className="text-center font-mono text-sm font-semibold text-emerald-400">{row.W}</div>

                  {/* Losses */}
                  <div className="text-center font-mono text-sm text-rose-400/80">{row.L}</div>

                  {/* Points — hero column */}
                  <div className="flex justify-center">
                    <div className="relative px-3 py-1 rounded-lg" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                      <span className="font-display text-xl font-black leading-none" style={{ color, textShadow: `0 0 20px ${color}66` }}>
                        {row.pts}
                      </span>
                    </div>
                  </div>

                  {/* NRR */}
                  <div className={`flex items-center justify-center gap-1 font-mono text-xs font-semibold
                    ${nrrPos ? "text-emerald-400" : row.nrr < 0 ? "text-rose-400" : "text-white/40"}`}>
                    {nrrPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3 opacity-60" />}
                    {row.nrr > 0 ? "+" : ""}{row.nrr.toFixed(3)}
                  </div>

                  {/* Form */}
                  <div className="flex items-center justify-center gap-0.5">
                    {row.form.slice(-5).map((f, i) => {
                      const fc = FORM_CONFIG[f];
                      return fc ? (
                        <span key={i} className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center"
                          style={{ background: fc.bg, color: fc.text, boxShadow: fc.glow }}>
                          {f}
                        </span>
                      ) : null;
                    })}
                    {row.form.length === 0 && <span className="text-[9px] text-white/15">—</span>}
                  </div>

                  {/* Playoff chance */}
                  <div className="flex flex-col items-center gap-1">
                    {q.qualPct !== undefined ? (
                      <>
                        <span className={`text-xs font-bold font-mono ${
                          q.qualPct >= 75 ? "text-emerald-400" :
                          q.qualPct <= 15 ? "text-rose-400" :
                          "text-amber-400"
                        }`}>{q.qualPct}%</span>
                        <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${q.qualPct}%`,
                              background: q.qualPct >= 75 ? "#34d399" : q.qualPct <= 15 ? "#f87171" : "#fbbf24",
                              boxShadow: q.qualPct >= 75 ? "0 0 6px rgba(52,211,153,0.5)" : "none",
                            }} />
                        </div>
                      </>
                    ) : (
                      <span className="text-[9px] text-white/15">—</span>
                    )}
                  </div>
                </div>

                {/* Expanded scenario */}
                {isExpanded && q.scenario && (
                  <div className="px-4 pb-3 ml-[2.5rem]">
                    <div className="text-[11px] text-white/50 leading-relaxed px-3 py-2.5 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      {q.scenario}
                    </div>
                  </div>
                )}

                {/* Expand indicator */}
                {q.scenario && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/15 group-hover:text-white/40 transition-colors">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                )}
              </div>

              {/* Playoff cut divider */}
              {isPlayoffBoundary && idx < table.length - 1 && (
                <div className="relative flex items-center gap-2 px-4 py-1.5 my-0.5">
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(248,113,113,0.25), rgba(248,113,113,0.06))" }} />
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-rose-400/50 whitespace-nowrap">Elimination zone</span>
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(248,113,113,0.06), transparent)" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-2 pt-2 text-[9px] text-white/25 uppercase tracking-widest">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />Qualified
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-400" />Eliminated
        </span>
        <span className="ml-auto italic normal-case tracking-normal text-white/15">Click a row to view scenario</span>
      </div>
    </div>
  );
}
