import { supabase } from "@/integrations/supabase/client";

export interface H2HSummary {
  team_a: string;
  team_b: string;
  played: number;
  aWins: number;
  bWins: number;
  ties: number;
  highestA: { runs: number; wkts: number; matchId?: string; season?: number } | null;
  highestB: { runs: number; wkts: number; matchId?: string; season?: number } | null;
  topBatA: { name: string; runs: number } | null;
  topBatB: { name: string; runs: number } | null;
  topBowlA: { name: string; wkts: number } | null;
  topBowlB: { name: string; wkts: number } | null;
  nrrA: number;
  nrrB: number;
  recent: Array<{ id: string; season: number; winner: string | null; result: string | null; team_a: string; team_b: string }>;
}

export async function getH2H(leagueId: string, teamA: string, teamB: string, oversPerInnings = 2): Promise<H2HSummary> {
  // Get all seasons in league
  const { data: seasons } = await supabase.from("seasons").select("id, season_number").eq("league_id", leagueId);
  const seasonMap = new Map((seasons ?? []).map(s => [s.id, s.season_number]));
  const seasonIds = (seasons ?? []).map(s => s.id);

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .in("season_id", seasonIds.length ? seasonIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "done")
    .or(`and(team_a.eq.${teamA},team_b.eq.${teamB}),and(team_a.eq.${teamB},team_b.eq.${teamA})`);

  const result: H2HSummary = {
    team_a: teamA, team_b: teamB,
    played: 0, aWins: 0, bWins: 0, ties: 0,
    highestA: null, highestB: null,
    topBatA: null, topBatB: null, topBowlA: null, topBowlB: null,
    nrrA: 0, nrrB: 0, recent: [],
  };

  const batA = new Map<string, { name: string; runs: number }>();
  const batB = new Map<string, { name: string; runs: number }>();
  const bowlA = new Map<string, { name: string; wkts: number }>();
  const bowlB = new Map<string, { name: string; wkts: number }>();

  let runsForA = 0, oversForA = 0, runsForB = 0, oversForB = 0;

  for (const m of matches ?? []) {
    result.played++;
    if (m.winner === teamA) result.aWins++;
    else if (m.winner === teamB) result.bWins++;
    else result.ties++;

    const sc: any = m.scorecard ?? {};
    const inns = [sc.innings1, sc.innings2].filter(Boolean);
    for (const inn of inns) {
      const isA = inn.battingTeam === teamA;
      const target = isA ? batA : batB;
      const bowlTarget = isA ? bowlB : bowlA;
      Object.values(inn.bat ?? {}).forEach((b: any) => {
        const x = target.get(b.player_id) ?? { name: b.name, runs: 0 };
        x.runs += b.runs ?? 0; target.set(b.player_id, x);
      });
      Object.values(inn.bowl ?? {}).forEach((b: any) => {
        const x = bowlTarget.get(b.player_id) ?? { name: b.name, wkts: 0 };
        x.wkts += b.wickets ?? 0; bowlTarget.set(b.player_id, x);
      });
      const overs = inn.doneReason === "allOut" ? oversPerInnings : (inn.legalBalls ?? 0) / 6;
      const total = { runs: inn.runs ?? 0, wkts: inn.wickets ?? 0, matchId: m.id, season: seasonMap.get(m.season_id) };
      if (isA) {
        runsForA += inn.runs ?? 0; oversForA += overs;
        if (!result.highestA || total.runs > result.highestA.runs) result.highestA = total;
      } else {
        runsForB += inn.runs ?? 0; oversForB += overs;
        if (!result.highestB || total.runs > result.highestB.runs) result.highestB = total;
      }
    }

    result.recent.unshift({
      id: m.id, season: seasonMap.get(m.season_id) ?? 0,
      winner: m.winner, result: m.result_text,
      team_a: m.team_a, team_b: m.team_b,
    });
  }

  const topOf = <T extends { runs?: number; wkts?: number }>(map: Map<string, T>, key: "runs" | "wkts") =>
    Array.from(map.values()).sort((a: any, b: any) => (b[key] ?? 0) - (a[key] ?? 0))[0] ?? null;

  result.topBatA = topOf(batA, "runs") as any;
  result.topBatB = topOf(batB, "runs") as any;
  result.topBowlA = topOf(bowlA, "wkts") as any;
  result.topBowlB = topOf(bowlB, "wkts") as any;

  // NRR within these matchups
  result.nrrA = oversForA > 0 && oversForB > 0 ? +((runsForA / oversForA) - (runsForB / oversForB)).toFixed(3) : 0;
  result.nrrB = -result.nrrA;
  result.recent = result.recent.slice(0, 10);
  return result;
}
