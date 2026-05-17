// Records tracker — checks each completed match for milestones & inserts into `records`
import { supabase } from "@/integrations/supabase/client";

export interface RecordCtx {
  league_id: string;
  season_number: number;
  match_id: string;
}

interface Sc {
  innings1: any; innings2: any;
  team_a: string; team_b: string; winner: string | null;
}

export async function processRecords(ctx: RecordCtx, sc: Sc) {
  // Pull existing records for comparison
  const { data: existing } = await supabase
    .from("records").select("*").eq("league_id", ctx.league_id);
  const ex = existing ?? [];
  const find = (k: string) => ex.find(r => r.record_key === k);

  const inserts: any[] = [];
  const upsertBest = (key: string, label: string, value: number, player_name: string, player_id: string | undefined, team_id: string | undefined, higherIsBetter = true) => {
    const cur = find(key);
    if (!cur || (higherIsBetter ? value > Number(cur.value ?? 0) : value < Number(cur.value ?? Infinity))) {
      if (cur) {
        supabase.from("records").delete().eq("id", cur.id).then(() => {});
      }
      inserts.push({
        league_id: ctx.league_id, record_key: key, label,
        value, player_name, player_id, team_id,
        season_number: ctx.season_number, match_id: ctx.match_id,
      });
    }
  };
  const insertFirst = (key: string, label: string, player_name: string, team_id?: string, value?: number) => {
    if (!find(key)) {
      inserts.push({
        league_id: ctx.league_id, record_key: key, label,
        value, player_name, team_id, season_number: ctx.season_number, match_id: ctx.match_id,
      });
    }
  };

  for (const innKey of ["innings1","innings2"] as const) {
    const inn = sc[innKey];
    if (!inn) continue;
    // Bat records
    Object.values(inn.bat as Record<string, any>).forEach((b: any) => {
      if (b.balls === 0 && !b.out) return;
      // First duck
      if (b.out && b.runs === 0 && b.balls > 0) {
        insertFirst(`first_duck_p_${b.player_id}`, `First duck — ${b.name}`, b.name, inn.battingTeam, 0);
      }
      // Highest individual score
      upsertBest("highest_score", `Highest score — ${b.name} ${b.runs}*`, b.runs, b.name, b.player_id, inn.battingTeam, true);
      // Most 6s in an innings
      if (b.sixes > 0)
        upsertBest("most_sixes_innings", `Most 6s in an innings — ${b.name} (${b.sixes})`, b.sixes, b.name, b.player_id, inn.battingTeam, true);
      if (b.fours > 0)
        upsertBest("most_fours_innings", `Most 4s in an innings — ${b.name} (${b.fours})`, b.fours, b.name, b.player_id, inn.battingTeam, true);
      // Fastest 20+ (by SR)
      if (b.runs >= 15) {
        const sr = (b.runs / b.balls) * 100;
        upsertBest("best_strike_rate", `Best SR (15+) — ${b.name} ${sr.toFixed(0)}`, sr, b.name, b.player_id, inn.battingTeam, true);
      }
    });
    // Bowl records
    Object.values(inn.bowl as Record<string, any>).forEach((bw: any) => {
      if (bw.balls === 0) return;
      if (bw.wickets >= 1) {
        // Best figures: weight = wickets*100 - runs
        const score = bw.wickets * 100 - bw.runs;
        const cur = find("best_bowling");
        if (!cur || score > Number(cur.value ?? -999)) {
          if (cur) supabase.from("records").delete().eq("id", cur.id).then(() => {});
          inserts.push({
            league_id: ctx.league_id, record_key: "best_bowling",
            label: `Best bowling — ${bw.name} ${bw.wickets}/${bw.runs}`,
            value: score, player_name: bw.name, player_id: bw.player_id,
            team_id: inn.bowlingTeam, season_number: ctx.season_number, match_id: ctx.match_id,
          });
        }
      }
      // Best economy (min 1 over)
      if (bw.balls >= 6) {
        const econ = (bw.runs / bw.balls) * 6;
        const cur = find("best_economy");
        if (!cur || econ < Number(cur.value ?? 999)) {
          if (cur) supabase.from("records").delete().eq("id", cur.id).then(() => {});
          inserts.push({
            league_id: ctx.league_id, record_key: "best_economy",
            label: `Best economy — ${bw.name} ${econ.toFixed(2)}`,
            value: econ, player_name: bw.name, player_id: bw.player_id,
            team_id: inn.bowlingTeam, season_number: ctx.season_number, match_id: ctx.match_id,
          });
        }
      }
    });

    // Team total records
    upsertBest("highest_team_total", `Highest team total — ${inn.battingTeam} ${inn.runs}/${inn.wickets}`, inn.runs, "", undefined, inn.battingTeam, true);
    upsertBest("lowest_team_total", `Lowest team total — ${inn.battingTeam} ${inn.runs}/${inn.wickets}`, inn.runs, "", undefined, inn.battingTeam, false);
  }

  if (inserts.length) await supabase.from("records").insert(inserts);
}
