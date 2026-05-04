// Schedule generator + points table calculator with NRR
import { supabase } from "@/integrations/supabase/client";
import { buildSchedule } from "./schedule";

export interface PointsRow {
  team_id: string;
  P: number; W: number; L: number; T: number; NR: number;
  pts: number;
  runsFor: number; oversFor: number;
  runsAgainst: number; oversAgainst: number;
  nrr: number;
  form: string[]; // last 5: W/L/T
  rank?: number;
}

export async function generateScheduleForSeason(seasonId: string, teamIds: string[], seasonYear?: number, matchesPerTeam = 14) {
  const startDate = seasonYear ? new Date(`${seasonYear}-03-22T19:30:00+05:30`) : undefined;
  const sched = buildSchedule(teamIds, { startDate, matchesPerTeam });
  const rows = sched.map(m => ({
    season_id: seasonId,
    match_number: m.match_number,
    stage: m.stage,
    team_a: m.team_a,
    team_b: m.team_b,
    home_team: m.home_team,
    venue: m.venue,
    match_date: m.match_date,
    status: "scheduled",
  }));
  await supabase.from("matches").insert(rows);
}

export async function computePointsTable(seasonId: string, teamIds: string[], oversPerInnings: number): Promise<PointsRow[]> {
  const init = (id: string): PointsRow => ({
    team_id: id, P:0, W:0, L:0, T:0, NR:0, pts:0,
    runsFor:0, oversFor:0, runsAgainst:0, oversAgainst:0, nrr:0, form: [],
  });
  const map = new Map(teamIds.map(id => [id, init(id)]));

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("season_id", seasonId)
    .eq("stage", "league")
    .eq("status", "done")
    .order("match_number", { ascending: true });

  for (const m of matches ?? []) {
    const sc = (m.scorecard as any) ?? {};
    const i1 = sc.innings1; const i2 = sc.innings2;
    if (!i1 || !i2) continue;
    const A = map.get(m.team_a); const B = map.get(m.team_b);
    if (!A || !B) continue;

    const battingFirst = i1.battingTeam;
    const battingSecond = i2.battingTeam;
    const T1 = battingFirst === m.team_a ? A : B;
    const T2 = battingSecond === m.team_a ? A : B;

    // Overs faced: if all out, treat as full overs for NRR (standard ICC rule)
    const overs1 = i1.doneReason === "allOut" ? oversPerInnings : i1.legalBalls / 6;
    const overs2 = i2.doneReason === "allOut" ? oversPerInnings : i2.legalBalls / 6;

    T1.runsFor += i1.runs;       T1.oversFor += overs1;
    T1.runsAgainst += i2.runs;   T1.oversAgainst += overs2;
    T2.runsFor += i2.runs;       T2.oversFor += overs2;
    T2.runsAgainst += i1.runs;   T2.oversAgainst += overs1;

    A.P += 1; B.P += 1;

    if (m.winner === m.team_a)      { A.W += 1; A.pts += 2; B.L += 1; A.form.push("W"); B.form.push("L"); }
    else if (m.winner === m.team_b) { B.W += 1; B.pts += 2; A.L += 1; B.form.push("W"); A.form.push("L"); }
    else                            { A.T += 1; B.T += 1; A.pts += 1; B.pts += 1; A.form.push("T"); B.form.push("T"); }
  }

  const rows = Array.from(map.values()).map(r => {
    const rrFor = r.oversFor > 0 ? r.runsFor / r.oversFor : 0;
    const rrAgainst = r.oversAgainst > 0 ? r.runsAgainst / r.oversAgainst : 0;
    r.nrr = +(rrFor - rrAgainst).toFixed(3);
    r.form = r.form.slice(-5);
    return r;
  }).sort((a,b) => b.pts - a.pts || b.nrr - a.nrr);

  rows.forEach((r,i) => r.rank = i+1);
  return rows;
}

/** Returns top 2 ranks for final qualification. Call after league done. */
export async function ensureFinalScheduled(seasonId: string, top1: string, top2: string) {
  const { data: finals } = await supabase
    .from("matches").select("*").eq("season_id", seasonId).eq("stage", "final");
  if (!finals || finals.length === 0) return;
  const f = finals[0];
  if (f.status === "done") return;
  await supabase.from("matches").update({ team_a: top1, team_b: top2 }).eq("id", f.id);
}
