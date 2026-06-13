import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { teamColor } from "@/lib/teams";
import type { PointsRow } from "@/lib/standings";
import type { League } from "@/lib/league";
import { Crown, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";

interface QualInfo { status?: "Q" | "E" | "?" | "" ; qualPct?: number; scenario?: string }

interface Props {
  table: PointsRow[];
  league: League;
  qual: Record<string, QualInfo>;
  playoffSpots?: number;
}

const RANK_GLOW: Record<number, string> = {
  1: "shadow-[0_0_36px_-6px_rgba(255,215,0,0.45)]",
  2: "shadow-[0_0_28px_-8px_rgba(192,192,192,0.35)]",
  3: "shadow-[0_0_22px_-8px_rgba(205,127,50,0.35)]",
};
const RANK_BADGE: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-slate-300",
  3: "text-amber-600",
};

const FORM_COLORS: Record<string, string> = {
  W: "bg-emerald-500 text-black",
  L: "bg-rose-500 text-white",
  T: "bg-yellow-500 text-black",
};

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
        <span className="text-[10px] text-muted-foreground ml-2">← swipe in card view</span>
      </div>

      {viewMode === "cards" ? (
        /* ── CARD VIEW ── */
        <div
          className="flex gap-3 overflow-x-auto pb-3 scroll-smooth"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {table.map((row, idx) => {
            const q = qual[row.team_id] ?? {};
            const rank = idx + 1;
            const color = teamColor(row.team_id, league.teams);
            const isExpanded = expanded === row.team_id;
            const inPlayoffs = rank <= playoffSpots;
            const qualified = q.status === "Q";
            const eliminated = q.status === "E";
            const teamObj = league.teams.find(t => t.id === row.team_id);
            const nrrPositive = row.nrr > 0;

            return (
              <div
                key={row.team_id}
                style={{ scrollSnapAlign: "start", flexShrink: 0, minWidth: 240 }}
                className={`relative rounded-2xl border transition-all cursor-pointer select-none overflow-hidden
                  ${qualified ? "border-emerald-500/60 bg-emerald-500/5" :
                    eliminated ? "border-rose-500/40 bg-rose-500/5 opacity-70" :
                    inPlayoffs ? "border-primary/40 bg-primary/5" : "border-border/50 bg-secondary/10"}
                  ${RANK_GLOW[rank] ?? ""}
                  hover:scale-[1.02] hover:border-primary/60
                `}
                onClick={() => toggle(row.team_id)}
              >
                {/* Color bar at top */}
                <div className="h-1.5 w-full rounded-t-2xl" style={{ background: color }}/>

                {/* Qual/elim badge top-right */}
                {(qualified || eliminated) && (
                  <div className={`absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${qualified ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-rose-500/20 text-rose-400 border border-rose-500/40"}`}>
                    {qualified ? "✓ Qualified" : "✗ Out"}
                  </div>
                )}

                <div className="p-4">
                  {/* Rank + team */}
                  <div className="flex items-start gap-2 mb-3">
                    <div className={`font-display text-5xl leading-none ${RANK_BADGE[rank] ?? "text-muted-foreground"} flex-shrink-0`}>
                      {rank === 1 ? <Crown className="w-9 h-9 fill-yellow-400 text-yellow-400"/> : rank}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <div className="font-display text-xl tracking-wider leading-tight" style={{ color }}>
                        {teamObj?.shortName ?? row.team_id}
                      </div>
                      {teamObj?.fullName && teamObj.fullName !== row.team_id && (
                        <div className="text-[10px] text-muted-foreground truncate">{teamObj.fullName}</div>
                      )}
                    </div>
                  </div>

                  {/* Points — hero stat */}
                  <div className="mb-3 text-center">
                    <div className="font-display text-5xl font-bold" style={{ color }}>{row.pts}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground -mt-0.5">Points</div>
                  </div>

                  {/* P / W / L grid */}
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {[
                      { k: "Played", v: row.P },
                      { k: "Won", v: row.W, hi: true },
                      { k: "Lost", v: row.L, neg: true },
                    ].map(({ k, v, hi, neg }) => (
                      <div key={k} className="bg-secondary/30 rounded-lg px-2 py-1.5 text-center">
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{k}</div>
                        <div className={`font-display text-lg ${hi ? "text-emerald-400" : neg ? "text-rose-400" : ""}`}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* NRR */}
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="text-muted-foreground">NRR</span>
                    <div className={`flex items-center gap-1 font-mono font-semibold ${nrrPositive ? "text-emerald-400" : row.nrr < 0 ? "text-rose-400" : "text-muted-foreground"}`}>
                      {nrrPositive ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                      {row.nrr > 0 ? "+" : ""}{row.nrr.toFixed(3)}
                    </div>
                  </div>

                  {/* Form dots */}
                  {row.form.length > 0 && (
                    <div className="flex items-center gap-1 mb-3">
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground mr-1">Form</span>
                      {row.form.map((f, i) => (
                        <span key={i} className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${FORM_COLORS[f] ?? "bg-secondary"}`}>{f}</span>
                      ))}
                    </div>
                  )}

                  {/* Qual % bar */}
                  {q.qualPct !== undefined && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Playoff chance</span>
                        <span className={`font-bold ${q.qualPct >= 75 ? "text-emerald-400" : q.qualPct <= 15 ? "text-rose-400" : "text-primary"}`}>
                          {q.qualPct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${q.qualPct >= 75 ? "bg-emerald-500" : q.qualPct <= 15 ? "bg-rose-500" : "bg-primary"}`}
                          style={{ width: `${q.qualPct}%` }}/>
                      </div>
                    </div>
                  )}

                  {/* Expand toggle */}
                  <button className="w-full mt-3 flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                    {isExpanded ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                    {isExpanded ? "Hide" : "Scenario"}
                  </button>

                  {/* Expansion: scenario */}
                  {isExpanded && q.scenario && (
                    <div className="mt-2 p-2.5 rounded-lg bg-secondary/40 text-[11px] text-muted-foreground leading-relaxed border border-border/40 animate-fade-in">
                      {q.scenario}
                    </div>
                  )}
                  {isExpanded && !q.scenario && (
                    <div className="mt-2 text-[11px] text-muted-foreground italic text-center">No qualification scenario computed yet.</div>
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
                  const inPlayoffs = rank <= playoffSpots;
                  const qualified = q.status === "Q";
                  const eliminated = q.status === "E";
                  return (
                    <tr key={row.team_id}
                      className={`border-t border-border/30 cursor-pointer hover:bg-secondary/20 transition-colors
                        ${qualified ? "bg-emerald-500/5" : eliminated ? "bg-rose-500/5 opacity-70" : inPlayoffs ? "bg-primary/5" : ""}`}
                      onClick={() => toggle(row.team_id)}
                      title={q.scenario}
                    >
                      <td className="px-3 py-2.5 text-center">
                        {rank === 1 ? <Crown className="w-4 h-4 text-yellow-400 mx-auto"/> :
                          qualified ? <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 rounded px-1.5 py-0.5">Q</span> :
                          eliminated ? <span className="text-[10px] font-bold text-rose-400 bg-rose-500/20 border border-rose-500/40 rounded px-1.5 py-0.5">E</span> :
                          <span className="text-muted-foreground text-sm">{rank}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-display text-base tracking-wider" style={{ color }}>{row.team_id}</div>
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
                            <div className={`h-full ${(q.qualPct ?? 0) >= 75 ? "bg-emerald-500" : (q.qualPct ?? 0) <= 15 ? "bg-rose-500" : "bg-primary"}`} style={{ width: `${q.qualPct ?? 0}%` }}/>
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
