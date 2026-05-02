// Career milestone records: fastest to 100, 500, 1000 runs / 10w, 50w, 100w (across seasons).
import { supabase } from "@/integrations/supabase/client";

export interface MilestoneCtx {
  league_id: string;
  season_number: number;
  match_id: string;
}

/** Aggregate every player's running totals across this league's matches and award the first to cross thresholds. */
export async function processMilestones(ctx: MilestoneCtx) {
  const RUN_THRESHOLDS = [100, 500, 1000];
  const WKT_THRESHOLDS = [10, 50, 100];

  // Pull all completed matches in this league in order
  const { data: seasons } = await supabase.from("seasons").select("id, season_number").eq("league_id", ctx.league_id);
  const seasonIds = (seasons ?? []).map(s => s.id);
  if (seasonIds.length === 0) return;
  const { data: matches } = await supabase
    .from("matches")
    .select("id, scorecard, season_id")
    .in("season_id", seasonIds)
    .eq("status", "done")
    .order("created_at", { ascending: true });

  const runTot = new Map<string, { name: string; team: string; total: number }>();
  const wktTot = new Map<string, { name: string; team: string; total: number }>();
  // Track which milestones have already been awarded (existing records)
  const { data: existing } = await supabase
    .from("records").select("record_key, player_id")
    .eq("league_id", ctx.league_id)
    .like("record_key", "milestone_%");
  const awarded = new Set((existing ?? []).map((r: any) => `${r.record_key}|${r.player_id}`));

  const newRecords: any[] = [];
  for (const m of matches ?? []) {
    const sc: any = (m as any).scorecard; if (!sc) continue;
    for (const ik of ["innings1","innings2"] as const) {
      const inn = sc[ik]; if (!inn) continue;
      Object.values(inn.bat as Record<string, any>).forEach((b: any) => {
        const cur = runTot.get(b.player_id) ?? { name: b.name, team: inn.battingTeam, total: 0 };
        const before = cur.total; cur.total += b.runs; runTot.set(b.player_id, cur);
        for (const t of RUN_THRESHOLDS) {
          if (before < t && cur.total >= t) {
            const key = `milestone_runs_${t}`;
            if (!awarded.has(`${key}|${b.player_id}`)) {
              awarded.add(`${key}|${b.player_id}`);
              newRecords.push({
                league_id: ctx.league_id,
                record_key: key,
                label: `🏏 First to ${t} career runs`,
                value: cur.total,
                player_id: b.player_id,
                player_name: cur.name,
                team_id: cur.team,
                season_number: ctx.season_number,
                match_id: ctx.match_id,
              });
            }
          }
        }
      });
      Object.values(inn.bowl as Record<string, any>).forEach((b: any) => {
        const cur = wktTot.get(b.player_id) ?? { name: b.name, team: inn.bowlingTeam, total: 0 };
        const before = cur.total; cur.total += b.wickets; wktTot.set(b.player_id, cur);
        for (const t of WKT_THRESHOLDS) {
          if (before < t && cur.total >= t) {
            const key = `milestone_wkts_${t}`;
            if (!awarded.has(`${key}|${b.player_id}`)) {
              awarded.add(`${key}|${b.player_id}`);
              newRecords.push({
                league_id: ctx.league_id,
                record_key: key,
                label: `🎯 First to ${t} career wickets`,
                value: cur.total,
                player_id: b.player_id,
                player_name: cur.name,
                team_id: cur.team,
                season_number: ctx.season_number,
                match_id: ctx.match_id,
              });
            }
          }
        }
      });
    }
  }

  if (newRecords.length > 0) {
    await supabase.from("records").insert(newRecords);
  }
}
