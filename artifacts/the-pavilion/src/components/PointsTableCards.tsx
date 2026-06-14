import { useState } from "react";
import { teamColor } from "@/lib/teams";
import { teamLogo } from "@/lib/teamLogos";
import type { PointsRow } from "@/lib/standings";
import type { League } from "@/lib/league";
import {
  Crown, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  LayoutGrid, List,
} from "lucide-react";

interface QualInfo { status?: "Q" | "E" | "?" | ""; qualPct?: number; scenario?: string }

interface Props {
  table: PointsRow[];
  league: League;
  qual: Record<string, QualInfo>;
  playoffSpots?: number;
}

const FORM_CONFIG: Record<string, { bg: string; text: string; glow: string }> = {
  W: { bg: "rgba(52,211,153,0.22)", text: "#34d399", glow: "0 0 8px rgba(52,211,153,0.45)" },
  L: { bg: "rgba(248,113,113,0.22)", text: "#f87171", glow: "0 0 8px rgba(248,113,113,0.35)" },
  T: { bg: "rgba(251,191,36,0.22)", text: "#fbbf24", glow: "0 0 8px rgba(251,191,36,0.35)" },
};

const RANK_MEDAL: Record<number, string> = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };

// ─── shared helpers ────────────────────────────────────────────────────────────
function FormPips({ form }: { form: string[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {form.slice(-5).map((f, i) => {
        const fc = FORM_CONFIG[f];
        return fc ? (
          <span key={i} className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center"
            style={{ background: fc.bg, color: fc.text, boxShadow: fc.glow }}>{f}</span>
        ) : null;
      })}
      {form.length === 0 && <span className="text-[9px] text-white/15 tracking-widest">— — —</span>}
    </div>
  );
}

function NRRBadge({ nrr }: { nrr: number }) {
  const pos = nrr > 0;
  const color = pos ? "#34d399" : nrr < 0 ? "#f87171" : "rgba(255,255,255,0.3)";
  return (
    <span className="flex items-center gap-1 font-mono text-xs font-semibold" style={{ color }}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3 opacity-60" />}
      {nrr > 0 ? "+" : ""}{nrr.toFixed(3)}
    </span>
  );
}

function QualChance({ q }: { q: QualInfo }) {
  if (q.qualPct === undefined) return <span className="text-[9px] text-white/15">—</span>;
  const color = q.qualPct >= 75 ? "#34d399" : q.qualPct <= 15 ? "#f87171" : "#fbbf24";
  return (
    <div className="flex flex-col items-center gap-1 min-w-[3rem]">
      <span className="text-xs font-bold font-mono" style={{ color }}>{q.qualPct}%</span>
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${q.qualPct}%`, background: color, boxShadow: q.qualPct >= 75 ? `0 0 6px ${color}80` : "none" }} />
      </div>
    </div>
  );
}

// ─── TABLE VIEW ────────────────────────────────────────────────────────────────
function TableView({ table, league, qual, playoffSpots }: Required<Props>) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      {/* Playoff zone label */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">Playoff zone</span>
        </div>
        <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.2), transparent)" }} />
      </div>

      <div className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>

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
          const isExpanded = expanded === row.team_id;
          const medalColor = RANK_MEDAL[rank];
          const isPlayoffBoundary = rank === playoffSpots;

          return (
            <div key={row.team_id}>
              <div className="group relative cursor-pointer transition-all duration-200"
                style={{
                  opacity: eliminated ? 0.5 : 1,
                  background: isExpanded ? `linear-gradient(90deg, ${color}0d, transparent 60%)` : "transparent",
                }}
                onClick={() => setExpanded(v => v === row.team_id ? null : row.team_id)}>

                {/* Left accent bar */}
                <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r transition-all duration-300"
                  style={{
                    background: qualified ? "#34d399" : eliminated ? "#f87171" : inPlayoffs ? color : "transparent",
                    opacity: isExpanded ? 1 : 0.5,
                  }} />

                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-sm"
                  style={{ background: `linear-gradient(90deg, ${color}08, transparent 50%)` }} />

                <div className="relative grid items-center px-4 py-3.5"
                  style={{ gridTemplateColumns: "2.5rem 1fr 3rem 2.5rem 2.5rem 4.5rem 5rem 5.5rem 5.5rem" }}>

                  {/* Rank */}
                  <div className="flex items-center justify-center">
                    {rank === 1 ? (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${RANK_MEDAL[1]}18` }}>
                        <Crown className="w-3.5 h-3.5" style={{ color: RANK_MEDAL[1] }} />
                      </div>
                    ) : medalColor ? (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm" style={{ background: `${medalColor}14`, color: medalColor }}>
                        {rank}
                      </div>
                    ) : (
                      <span className="text-sm font-mono text-white/25 w-7 text-center">{rank}</span>
                    )}
                  </div>

                  {/* Team */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img src={logo} alt={row.team_id} className="w-8 h-8 object-contain"
                        style={{ filter: eliminated ? "saturate(0)" : `drop-shadow(0 0 5px ${color}55)` }} />
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

                  {/* P */}
                  <div className="text-center font-mono text-sm text-white/40">{row.P}</div>

                  {/* W */}
                  <div className="text-center font-mono text-sm font-semibold text-emerald-400">{row.W}</div>

                  {/* L */}
                  <div className="text-center font-mono text-sm text-rose-400/80">{row.L}</div>

                  {/* Points */}
                  <div className="flex justify-center">
                    <div className="px-3 py-1 rounded-lg" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                      <span className="font-display text-xl font-black leading-none" style={{ color, textShadow: `0 0 20px ${color}66` }}>
                        {row.pts}
                      </span>
                    </div>
                  </div>

                  {/* NRR */}
                  <div className="flex justify-center"><NRRBadge nrr={row.nrr} /></div>

                  {/* Form */}
                  <div className="flex justify-center"><FormPips form={row.form} /></div>

                  {/* Chance */}
                  <div className="flex justify-center"><QualChance q={q} /></div>
                </div>

                {/* Scenario */}
                {isExpanded && q.scenario && (
                  <div className="px-4 pb-3 ml-10">
                    <div className="text-[11px] text-white/50 leading-relaxed px-3 py-2.5 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      {q.scenario}
                    </div>
                  </div>
                )}

                {q.scenario && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/15 group-hover:text-white/40 transition-colors">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                )}
              </div>

              {/* Elimination divider */}
              {isPlayoffBoundary && idx < table.length - 1 && (
                <div className="relative flex items-center gap-2 px-4 py-1.5">
                  <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(248,113,113,0.3), rgba(248,113,113,0.06))" }} />
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
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Qualified</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400" />Eliminated</span>
        <span className="ml-auto italic normal-case tracking-normal text-white/15">Click a row for scenario</span>
      </div>
    </div>
  );
}

// ─── CARD VIEW ─────────────────────────────────────────────────────────────────
function CardView({ table, league, qual, playoffSpots }: Required<Props>) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {table.map((row, idx) => {
        const rank = idx + 1;
        const q = qual[row.team_id] ?? {};
        const color = teamColor(row.team_id, league.teams);
        const logo = teamLogo(row.team_id);
        const teamObj = league.teams.find(t => t.id === row.team_id);
        const inPlayoffs = rank <= playoffSpots;
        const qualified = q.status === "Q";
        const eliminated = q.status === "E";
        const medalColor = RANK_MEDAL[rank];

        return (
          <div key={row.team_id} className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl"
            style={{
              background: `linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)`,
              border: `1px solid ${inPlayoffs ? color + "30" : "rgba(255,255,255,0.06)"}`,
              opacity: eliminated ? 0.55 : 1,
              boxShadow: inPlayoffs && !eliminated ? `0 0 24px ${color}14` : "none",
            }}>

            {/* Top gradient strip */}
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}44)` }} />

            {/* Rank badge */}
            <div className="absolute top-3 right-3">
              {rank === 1 ? (
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${RANK_MEDAL[1]}18`, border: `1px solid ${RANK_MEDAL[1]}44` }}>
                  <Crown className="w-4 h-4" style={{ color: RANK_MEDAL[1] }} />
                </div>
              ) : medalColor ? (
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: `${medalColor}14`, border: `1px solid ${medalColor}33`, color: medalColor }}>
                  {rank}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm text-white/25" style={{ background: "rgba(255,255,255,0.05)" }}>
                  {rank}
                </div>
              )}
            </div>

            {/* Qualified / Eliminated badge */}
            {(qualified || eliminated) && (
              <div className={`absolute top-3 left-3 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full
                ${qualified ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}>
                {qualified ? "✓ Qualified" : "✗ Eliminated"}
              </div>
            )}

            <div className="p-4 pt-5">
              {/* Team header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative shrink-0">
                  <img src={logo} alt={row.team_id} className="w-12 h-12 object-contain"
                    style={{ filter: eliminated ? "saturate(0)" : `drop-shadow(0 0 8px ${color}55)` }} />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-lg tracking-wider leading-none" style={{ color: eliminated ? "rgba(255,255,255,0.3)" : color }}>
                    {teamObj?.shortName ?? row.team_id}
                  </div>
                  {teamObj?.home && (
                    <div className="text-[10px] text-white/25 mt-1 truncate">{teamObj.home}</div>
                  )}
                </div>
              </div>

              {/* Points — hero */}
              <div className="flex items-end justify-between mb-4">
                <div>
                  <div className="text-[9px] text-white/25 uppercase tracking-[0.2em] mb-1">Points</div>
                  <div className="font-display text-4xl font-black leading-none" style={{ color, textShadow: `0 0 30px ${color}55` }}>
                    {row.pts}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-white/25 uppercase tracking-[0.2em] mb-1">Played</div>
                  <div className="font-display text-2xl text-white/60">{row.P}</div>
                </div>
              </div>

              {/* W / L / NRR row */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)" }}>
                  <div className="text-[8px] text-emerald-400/60 uppercase tracking-widest mb-0.5">W</div>
                  <div className="font-display text-lg font-bold text-emerald-400">{row.W}</div>
                </div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)" }}>
                  <div className="text-[8px] text-rose-400/60 uppercase tracking-widest mb-0.5">L</div>
                  <div className="font-display text-lg font-bold text-rose-400">{row.L}</div>
                </div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="text-[8px] text-white/25 uppercase tracking-widest mb-0.5">NRR</div>
                  <div className={`font-mono text-xs font-bold ${row.nrr > 0 ? "text-emerald-400" : row.nrr < 0 ? "text-rose-400" : "text-white/40"}`}>
                    {row.nrr > 0 ? "+" : ""}{row.nrr.toFixed(3)}
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="mb-3">
                <div className="text-[9px] text-white/20 uppercase tracking-[0.15em] mb-1.5">Form</div>
                <FormPips form={row.form} />
              </div>

              {/* Qual chance */}
              {q.qualPct !== undefined && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] text-white/25 uppercase tracking-[0.15em]">Playoff chance</span>
                    <span className={`text-xs font-bold font-mono ${q.qualPct >= 75 ? "text-emerald-400" : q.qualPct <= 15 ? "text-rose-400" : "text-amber-400"}`}>
                      {q.qualPct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${q.qualPct}%`,
                        background: q.qualPct >= 75 ? "#34d399" : q.qualPct <= 15 ? "#f87171" : "#fbbf24",
                        boxShadow: q.qualPct >= 75 ? "0 0 8px rgba(52,211,153,0.5)" : "none",
                      }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ROOT EXPORT ───────────────────────────────────────────────────────────────
export function PointsTableCards({ table, league, qual, playoffSpots = 4 }: Props) {
  const [mode, setMode] = useState<"table" | "cards">("table");

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">
          {table.length} franchises · {playoffSpots} playoff spots
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={() => setMode("table")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${mode === "table" ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/60"}`}>
            <List className="w-3.5 h-3.5" /> Table
          </button>
          <button
            onClick={() => setMode("cards")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${mode === "cards" ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/60"}`}>
            <LayoutGrid className="w-3.5 h-3.5" /> Cards
          </button>
        </div>
      </div>

      {mode === "table"
        ? <TableView table={table} league={league} qual={qual} playoffSpots={playoffSpots} />
        : <CardView table={table} league={league} qual={qual} playoffSpots={playoffSpots} />
      }
    </div>
  );
}
