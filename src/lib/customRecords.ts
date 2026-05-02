// Evaluate user-defined custom records after each match
import { supabase } from "@/integrations/supabase/client";

export interface MatchCtx { league_id: string; season_number: number; match_id: string; }

interface InningsLike {
  battingTeam: string; bowlingTeam: string; runs: number; wickets: number;
  bat: Record<string, any>; bowl: Record<string, any>;
}

export async function evaluateCustomRecords(ctx: MatchCtx, sc: { innings1?: InningsLike; innings2?: InningsLike }) {
  const { data: defs } = await supabase
    .from("custom_records")
    .select("*")
    .eq("league_id", ctx.league_id);
  if (!defs || defs.length === 0) return;

  const { data: existing } = await supabase
    .from("records").select("*").eq("league_id", ctx.league_id);
  const ex = existing ?? [];

  const inserts: any[] = [];

  for (const def of defs) {
    const key = `custom_${def.id}`;
    const cur = ex.find((r: any) => r.record_key === key);
    const higher = def.higher_is_better;
    let bestVal: number | null = null;
    let bestName = ""; let bestPid: string | undefined; let bestTeam: string | undefined;

    const consider = (val: number, name: string, pid: string | undefined, team: string | undefined) => {
      if (def.threshold != null && ((higher && val < Number(def.threshold)) || (!higher && val > Number(def.threshold)))) return;
      if (bestVal == null || (higher ? val > bestVal : val < bestVal)) {
        bestVal = val; bestName = name; bestPid = pid; bestTeam = team;
      }
    };

    for (const ik of ["innings1","innings2"] as const) {
      const inn = sc[ik]; if (!inn) continue;
      if (def.scope === "batting") {
        Object.values(inn.bat).forEach((b: any) => {
          if (b.balls === 0) return;
          const v = def.metric === "runs" ? b.runs
                  : def.metric === "sixes" ? b.sixes
                  : def.metric === "fours" ? b.fours
                  : def.metric === "sr" ? (b.balls > 0 ? (b.runs/b.balls)*100 : 0)
                  : 0;
          consider(v, b.name, b.player_id, inn.battingTeam);
        });
      } else if (def.scope === "bowling") {
        Object.values(inn.bowl).forEach((b: any) => {
          if (b.balls === 0) return;
          const v = def.metric === "wickets" ? b.wickets
                  : def.metric === "econ" ? (b.runs/b.balls)*6
                  : 0;
          consider(v, b.name, b.player_id, inn.bowlingTeam);
        });
      } else if (def.scope === "team") {
        const v = def.metric === "total" ? inn.runs : def.metric === "wickets" ? inn.wickets : 0;
        consider(v, "", undefined, inn.battingTeam);
      }
    }

    if (bestVal == null) continue;
    const isBetter = !cur || (higher ? bestVal > Number(cur.value ?? -Infinity) : bestVal < Number(cur.value ?? Infinity));
    if (!isBetter) continue;
    if (cur) await supabase.from("records").delete().eq("id", cur.id);
    inserts.push({
      league_id: ctx.league_id, record_key: key,
      label: `${def.emoji ?? "🏆"} ${def.name} — ${bestName || bestTeam} (${bestVal.toFixed(bestVal % 1 === 0 ? 0 : 2)})`,
      value: bestVal, player_name: bestName || null, player_id: bestPid, team_id: bestTeam,
      season_number: ctx.season_number, match_id: ctx.match_id,
    });
  }

  if (inserts.length) await supabase.from("records").insert(inserts);
}
