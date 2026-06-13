import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { teamColor } from "@/lib/teams";
import { teamLogo } from "@/lib/teamLogos";
import type { PointsRow } from "@/lib/standings";
import type { League } from "@/lib/league";
import { Crown, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";

interface QualInfo { status?: "Q" | "E" | "?" | ""; qualPct?: number; scenario?: string }

interface Props {
  table: PointsRow[];
  league: League;
  qual: Record<string, QualInfo>;
  playoffSpots?: number;
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

const FORM_COLORS: Record<string, string> = {
  W: "bg-emerald-500 text-black",
  L: "bg-rose-500 text-white",
  T: "bg-yellow-500 text-black",
};

function hexFromHsl(hsl: string): string {
  // Just return the raw hsl — we'll use it as CSS color directly
  return hsl;
}

export function PointsTableCards({ table, league, qual, playoffSpots = 4 }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const toggle = (id: string) => setExpanded(v => v === id ? null : id);

  return (
    <div className="space-y-3">
      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button onClick={() => setViewMode("cards")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${viewMode === "cards" ? "bg-primary/15 border-primary/50 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
          ⬛ Cards
        </button>
        <button onClick={() => setViewMode("table")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${viewMode === "table" ? "bg-primary/15 border-primary/50 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
          📋 Table
        </button>
        <span className="text-[10px] text-muted-foreground ml-2">← swipe</span>
      </div>

      {viewMode === "cards" ? (
        /* ── CARD VIEW ── */
        <div className="flex gap-3 overflow-x-auto pb-3 scroll-smooth"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>
          {table.map((row, idx) => {
            const q = qual[row.team_id] ?? {};
            const rank = idx + 1;
            const color = teamColor(row.team_id, league.teams);
            const logo = teamLogo(row.team_id);
            const isExpanded = expanded === row.team_id;
            const inPlayoffs = rank <= playoffSpots;
            const qualified = q.status === "Q";
            const eliminated = q.status === "E";
            const teamObj = league.teams.find(t => t.id === row.team_id);
            const nrrPositive = row.nrr > 0;

            return (
              <div key={row.team_id}
                className={`relative rounded-2xl border cursor-pointer select-none overflow-hidden transition-all duration-200
                  ${qualified ? "border-emerald-500/60" : eliminated ? "border-rose-500/30 opacity-75" : inPlayoffs ? "border-primary/40" : "border-white/10"}
                  hover:scale-[1.025] hover:shadow-xl active:scale-[0.98]`}
                style={{
                  scrollSnapAlign: "start", flexShrink: 0, minWidth: 230,
                  background: `linear-gradient(145deg, color-mix(in srgb, ${color} 18%, #0a0a0a) 0%, #0e0e0e 65%)`,
                  boxShadow: rank <= 3
                    ? `0 0 28px -8px ${color}66, inset 0 1px 0 ${color}44`
                    : `inset 0 1px 0 rgba(255,255,255,0.05)`,
                }}
                onClick={() => toggle(row.team_id)}
              >
                {/* Team logo — giant watermark background */}
                <img src={logo} alt=""
                  className="absolute pointer-events-none select-none"
                  style={{
                    right: -16, bottom: -12, width: 130, height: 130,
                    opacity: eliminated ? 0.04 : 0.12,
                    filter: "saturate(0.3) brightness(1.4)",
                    transform: "rotate(-5deg)",
                  }}
                />

                {/* Color stripe at top */}
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />

                {/* Qual badge */}
                {(qualified || eliminated) && (
                  <div className={`absolute top-2.5 right-2.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full backdrop-blur-sm
                    ${qualified ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}>
                    {qualified ? "✓ Q" : "✗ Out"}
                  </div>
                )}

                <div className="relative p-4 pt-3">
                  {/* Rank + team name row */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-2xl font-bold"
                      style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
                      {rank === 1 ? <Crown className="w-6 h-6" style={{ color }} /> : RANK_MEDALS[rank - 1] ?? <span className="text-base text-muted-foreground">{rank}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-2xl tracking-wide leading-none" style={{ color }}>
                        {teamObj?.shortName ?? row.team_id}
                      </div>
                      <div className="text-[10px] text-white/40 truncate mt-0.5">
                        {teamObj?.fullName && teamObj.fullName !== teamObj.shortName ? teamObj.fullName : teamObj?.home ?? ""}
                      </div>
                    </div>
                    {/* Logo in header */}
                    <img src={logo} alt="" className="w-9 h-9 object-contain opacity-80 shrink-0" />
                  </div>

                  {/* Points — hero */}
                  <div className="text-center mb-4">
                    <div className="font-display text-6xl font-black leading-none" style={{ color, textShadow: `0 0 30px ${color}88` }}>
                      {row.pts}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/35 mt-1">Points</div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {[
                      { k: "P", v: row.P, cls: "text-white/70" },
                      { k: "W", v: row.W, cls: "text-emerald-400 font-bold" },
                      { k: "L", v: row.L, cls: "text-rose-400" },
                    ].map(({ k, v, cls }) => (
                      <div key={k} className="rounded-lg px-2 py-2 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div className="text-[8px] uppercase tracking-widest text-white/30">{k}</div>
                        <div className={`font-display text-xl ${cls}`}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* NRR */}
                  <div className="flex items-center justify-between text-xs mb-3 px-0.5">
                    <span className="text-white/35 uppercase tracking-widest text-[9px]">NRR</span>
                    <div className={`flex items-center gap-1 font-mono font-bold text-sm ${nrrPositive ? "text-emerald-400" : row.nrr < 0 ? "text-rose-400" : "text-white/50"}`}>
                      {nrrPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {row.nrr > 0 ? "+" : ""}{row.nrr.toFixed(3)}
                    </div>
                  </div>

                  {/* Form */}
                  {row.form.length > 0 && (
                    <div className="flex items-center gap-1 mb-3">
                      <span className="text-[8px] uppercase tracking-widest text-white/30 mr-1">Form</span>
                      {row.form.map((f, i) => (
                        <span key={i} className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${FORM_COLORS[f] ?? "bg-secondary"}`}>{f}</span>
                      ))}
                    </div>
                  )}

                  {/* Qual % bar */}
                  {q.qualPct !== undefined && (
                    <div className="space-y-1 mb-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-white/35">Playoff chance</span>
                        <span className={`font-bold font-mono ${q.qualPct >= 75 ? "text-emerald-400" : q.qualPct <= 15 ? "text-rose-400" : "text-primary"}`}>
                          {q.qualPct}%
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div className={`h-full rounded-full transition-all ${q.qualPct >= 75 ? "bg-emerald-400" : q.qualPct <= 15 ? "bg-rose-500" : "bg-primary"}`}
                          style={{ width: `${q.qualPct}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Expand */}
                  <button className="w-full mt-2.5 flex items-center justify-center gap-1 text-[10px] text-white/25 hover:text-white/60 transition-colors">
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? "Hide" : "Scenario"}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 p-2.5 rounded-xl text-[11px] text-white/60 leading-relaxed border border-white/10"
                      style={{ background: "rgba(255,255,255,0.04)" }}>
                      {q.scenario ?? "No qualification scenario computed yet."}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="px-3 py-2 text-center w-9">#</th>
                  <th className="px-3 py-2 text-left">Team</th>
                  <th className="px-2 py-2 text-center">P</th>
                  <th className="px-2 py-2 text-center">W</th>
                  <th className="px-2 py-2 text-center">L</th>
                  <th className="px-2 py-2 text-center font-bold text-primary">Pts</th>
                  <th className="px-2 py-2 text-center">NRR</th>
                  <th className="px-2 py-2 text-center">Qual%</th>
                  <th className="px-3 py-2 text-center">Form</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row, idx) => {
                  const rank = idx + 1;
                  const q = qual[row.team_id] ?? {};
                  const color = teamColor(row.team_id, league.teams);
                  const logo = teamLogo(row.team_id);
                  const inPlayoffs = rank <= playoffSpots;
                  const qualified = q.status === "Q";
                  const eliminated = q.status === "E";
                  return (
                    <tr key={row.team_id}
                      className={`border-t border-border/30 cursor-pointer hover:bg-secondary/20 transition-colors relative
                        ${qualified ? "bg-emerald-500/5" : eliminated ? "bg-rose-500/5 opacity-70" : inPlayoffs ? "bg-primary/5" : ""}`}
                      onClick={() => toggle(row.team_id)}
                      title={q.scenario}
                    >
                      <td className="px-3 py-2.5 text-center">
                        {rank === 1 ? <Crown className="w-4 h-4 text-yellow-400 mx-auto" /> :
                          qualified ? <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 rounded px-1.5 py-0.5">Q</span> :
                          eliminated ? <span className="text-[10px] font-bold text-rose-400 bg-rose-500/20 border border-rose-500/40 rounded px-1.5 py-0.5">E</span> :
                          <span className="text-muted-foreground text-sm">{rank}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <img src={logo} alt={row.team_id} className="w-6 h-6 object-contain opacity-80" />
                          <div className="font-display text-base tracking-wider" style={{ color }}>{row.team_id}</div>
                        </div>
                        {expanded === row.team_id && q.scenario && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 max-w-xs">{q.scenario}</div>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs">{row.P}</td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs text-emerald-400 font-semibold">{row.W}</td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs text-rose-400">{row.L}</td>
                      <td className="px-2 py-2.5 text-center font-display text-lg font-bold text-primary">{row.pts}</td>
                      <td className={`px-2 py-2.5 text-center font-mono text-xs ${row.nrr > 0 ? "text-emerald-400" : row.nrr < 0 ? "text-rose-400" : ""}`}>
                        {row.nrr > 0 ? "+" : ""}{row.nrr.toFixed(3)}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-xs font-bold font-mono ${(q.qualPct ?? 0) >= 75 ? "text-emerald-400" : (q.qualPct ?? 0) <= 15 ? "text-rose-400" : "text-primary"}`}>{q.qualPct ?? 0}%</span>
                          <div className="w-10 h-1 rounded-full bg-secondary/60 overflow-hidden">
                            <div className={`h-full ${(q.qualPct ?? 0) >= 75 ? "bg-emerald-500" : (q.qualPct ?? 0) <= 15 ? "bg-rose-500" : "bg-primary"}`} style={{ width: `${q.qualPct ?? 0}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-0.5 justify-center">
                          {row.form.map((f, i) => (
                            <span key={i} className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${FORM_COLORS[f] ?? "bg-secondary"}`}>{f}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-border/40 flex flex-wrap gap-3 items-center text-[10px] text-muted-foreground bg-secondary/10">
            <span className="flex items-center gap-1.5"><span className="w-5 h-4 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-[9px]">Q</span>Qualified</span>
            <span className="flex items-center gap-1.5"><span className="w-5 h-4 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center font-bold text-[9px]">E</span>Eliminated</span>
            <span className="ml-auto italic">Click a row to view qualification scenario.</span>
          </div>
        </div>
      )}
    </div>
  );
}
