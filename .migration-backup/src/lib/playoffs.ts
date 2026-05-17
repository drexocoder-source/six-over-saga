// IPL-style playoff bracket: Qualifier 1 (1v2) → Eliminator (3v4) → Qualifier 2 (loser Q1 v winner Elim) → Final.
import { supabase } from "@/integrations/supabase/client";
import type { PointsRow } from "./standings";

export type PlayoffStage = "qualifier1" | "eliminator" | "qualifier2" | "final";

export interface PlayoffMatchRow {
  id: string;
  stage: string;
  team_a: string;
  team_b: string;
  status: string;
  winner: string | null;
  result_text: string | null;
  match_number: number;
  match_date?: string | null;
  venue?: string | null;
}

const PLAYOFF_VENUES: Record<PlayoffStage, string> = {
  qualifier1: "Wankhede Stadium, Mumbai",
  eliminator: "M. Chinnaswamy Stadium, Bengaluru",
  qualifier2: "Eden Gardens, Kolkata",
  final:      "Narendra Modi Stadium, Ahmedabad",
};

/** When league is finished, ensure 4 playoff matches exist. Updates teams as bracket unfolds. */
export async function ensurePlayoffsScheduled(seasonId: string, table: PointsRow[]) {
  if (table.length < 4) return;
  const top4 = table.slice(0, 4);
  const [t1, t2, t3, t4] = top4.map(r => r.team_id);

  // Pull all non-league matches for the season
  const { data: existing } = await supabase
    .from("matches").select("*")
    .eq("season_id", seasonId)
    .in("stage", ["qualifier1", "eliminator", "qualifier2", "final"]);

  const have = new Set((existing ?? []).map(m => m.stage));
  const lastLeagueNum = await maxLeagueMatchNumber(seasonId);

  // Determine base match dates from final match or last league
  const lastMatch = await getLatestMatchDate(seasonId);
  const baseDate = lastMatch ? new Date(lastMatch) : new Date();

  const newMatches: any[] = [];
  const stageOrder: PlayoffStage[] = ["qualifier1", "eliminator", "qualifier2", "final"];

  // Drop the legacy single "final" if it's still TBD vs TBD AND we don't have a real final yet
  const legacyFinal = (existing ?? []).find(m =>
    m.stage === "final" && (m.team_a === "TBD" || m.team_b === "TBD") && m.status !== "done"
  );
  if (legacyFinal) {
    await supabase.from("matches").delete().eq("id", legacyFinal.id);
    have.delete("final");
  }

  for (let i = 0; i < stageOrder.length; i++) {
    const stage = stageOrder[i];
    if (have.has(stage)) continue;
    const date = new Date(baseDate); date.setDate(baseDate.getDate() + 3 + i * 2);
    let teamA = "TBD", teamB = "TBD";
    if (stage === "qualifier1") { teamA = t1; teamB = t2; }
    else if (stage === "eliminator") { teamA = t3; teamB = t4; }
    newMatches.push({
      season_id: seasonId,
      match_number: lastLeagueNum + 1 + i,
      stage,
      team_a: teamA, team_b: teamB, home_team: null,
      venue: PLAYOFF_VENUES[stage],
      match_date: date.toISOString(),
      status: "scheduled",
    });
  }
  if (newMatches.length) {
    await supabase.from("matches").insert(newMatches);
  }

  // Wire up downstream stages once their inputs are decided
  await wirePlayoffDependencies(seasonId);
}

async function maxLeagueMatchNumber(seasonId: string): Promise<number> {
  const { data } = await supabase
    .from("matches").select("match_number")
    .eq("season_id", seasonId).eq("stage", "league")
    .order("match_number", { ascending: false }).limit(1);
  return data?.[0]?.match_number ?? 0;
}

async function getLatestMatchDate(seasonId: string): Promise<string | null> {
  const { data } = await supabase
    .from("matches").select("match_date")
    .eq("season_id", seasonId)
    .order("match_date", { ascending: false }).limit(1);
  return data?.[0]?.match_date ?? null;
}

/** After any playoff finishes, slot winners/losers into next matches. */
export async function wirePlayoffDependencies(seasonId: string) {
  const { data: rows } = await supabase
    .from("matches").select("*")
    .eq("season_id", seasonId)
    .in("stage", ["qualifier1", "eliminator", "qualifier2", "final"])
    .order("match_number");
  const map = Object.fromEntries((rows ?? []).map((m: any) => [m.stage, m]));

  const q1 = map.qualifier1, elim = map.eliminator, q2 = map.qualifier2, fn = map.final;
  if (q1?.status === "done" && q2 && q2.status !== "done") {
    // Q1 loser into Q2 slot A
    const loser = q1.winner === q1.team_a ? q1.team_b : q1.team_a;
    if (q2.team_a !== loser) {
      await supabase.from("matches").update({ team_a: loser }).eq("id", q2.id);
    }
  }
  if (elim?.status === "done" && q2 && q2.status !== "done") {
    if (q2.team_b !== elim.winner) {
      await supabase.from("matches").update({ team_b: elim.winner }).eq("id", q2.id);
    }
  }
  if (q1?.status === "done" && fn && fn.status !== "done") {
    if (fn.team_a !== q1.winner) {
      await supabase.from("matches").update({ team_a: q1.winner }).eq("id", fn.id);
    }
  }
  if (q2?.status === "done" && fn && fn.status !== "done") {
    if (fn.team_b !== q2.winner) {
      await supabase.from("matches").update({ team_b: q2.winner }).eq("id", fn.id);
    }
  }
}

export const PLAYOFF_STAGES: PlayoffStage[] = ["qualifier1", "eliminator", "qualifier2", "final"];

export const STAGE_LABEL: Record<string, string> = {
  qualifier1: "Qualifier 1",
  eliminator: "Eliminator",
  qualifier2: "Qualifier 2",
  final:      "Grand Final",
};

export const STAGE_SUBTITLE: Record<string, string> = {
  qualifier1: "1st vs 2nd · Winner straight to Final",
  eliminator: "3rd vs 4th · Loser eliminated",
  qualifier2: "Loser Q1 vs Winner Eliminator",
  final:      "One night. One trophy.",
};
