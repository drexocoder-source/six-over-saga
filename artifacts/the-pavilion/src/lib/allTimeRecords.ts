import { supabase } from "@/integrations/supabase/client";

export interface RankRow {
  player_id: string;
  name: string;
  team?: string;
  value: number;
  extra?: string;
}

export interface AllTimeData {
  topRuns: RankRow[];
  topAvg: RankRow[];
  topSR: RankRow[];
  mostFours: RankRow[];
  mostSixes: RankRow[];
  bestScores: RankRow[];
  topWickets: RankRow[];
  bestEcon: RankRow[];
  bestBowling: RankRow[];
  mostThreeFers: RankRow[];
  highestTotals: Array<{ team: string; runs: number; wkts: number; opp: string; season: number; matchId: string }>;
  lowestTotals: Array<{ team: string; runs: number; wkts: number; opp: string; season: number; matchId: string }>;
  partnerships: Array<{ a: string; b: string; runs: number; team: string; matchId: string; season: number }>;
  playerOfMatchAwards: RankRow[];
}

export async function getAllTimeRecords(leagueId: string): Promise<AllTimeData> {
  const { data: seasons } = await supabase.from("seasons").select("id, season_number").eq("league_id", leagueId);
  const seasonMap = new Map((seasons ?? []).map(s => [s.id, s.season_number]));
  const seasonIds = (seasons ?? []).map(s => s.id);
  const { data: matches } = await supabase
    .from("matches").select("*").in("season_id", seasonIds.length ? seasonIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "done");

  type Bat = { name: string; runs: number; balls: number; fours: number; sixes: number; outs: number; team?: string; best: number; bestBalls: number };
  type Bowl = { name: string; wkts: number; runs: number; balls: number; team?: string; best: { w: number; r: number } };
  const bat = new Map<string, Bat>();
  const bowl = new Map<string, Bowl>();
  const totals: AllTimeData["highestTotals"] = [];
  const partnerships: AllTimeData["partnerships"] = [];
  const poms = new Map<string, { name: string; v: number }>();

  for (const m of matches ?? []) {
    const sc: any = m.scorecard; if (!sc) continue;
    const season = seasonMap.get(m.season_id) ?? 0;
    if (m.player_of_match) {
      // we may not have name → skip until we look up names below
    }

    for (const ik of ["innings1", "innings2"]) {
      const inn = sc[ik]; if (!inn) continue;
      const opp = inn.battingTeam === m.team_a ? m.team_b : m.team_a;
      totals.push({ team: inn.battingTeam, runs: inn.runs ?? 0, wkts: inn.wickets ?? 0, opp, season, matchId: m.id });

      Object.entries(inn.bat ?? {}).forEach(([pid, b0]) => {
        const b: any = b0;
        const x = bat.get(pid) ?? { name: b.name, runs: 0, balls: 0, fours: 0, sixes: 0, outs: 0, team: inn.battingTeam, best: 0, bestBalls: 0 };
        x.runs += b.runs ?? 0; x.balls += b.balls ?? 0;
        x.fours += b.fours ?? 0; x.sixes += b.sixes ?? 0;
        if (b.out) x.outs += 1;
        if ((b.runs ?? 0) > x.best) { x.best = b.runs ?? 0; x.bestBalls = b.balls ?? 0; }
        bat.set(pid, x);
      });
      Object.entries(inn.bowl ?? {}).forEach(([pid, b0]) => {
        const b: any = b0;
        const x = bowl.get(pid) ?? { name: b.name, wkts: 0, runs: 0, balls: 0, team: opp, best: { w: 0, r: 999 } };
        x.wkts += b.wkts ?? b.wickets ?? 0;
        x.runs += b.runs ?? 0; x.balls += b.balls ?? 0;
        const w = b.wickets ?? 0;
        if (w > x.best.w || (w === x.best.w && (b.runs ?? 0) < x.best.r)) x.best = { w, r: b.runs ?? 0 };
        bowl.set(pid, x);
      });

      // partnerships from inn.partnerships if available
      (inn.partnerships ?? []).forEach((p: any) => {
        if (!p) return;
        partnerships.push({ a: p.aName ?? p.a ?? "?", b: p.bName ?? p.b ?? "?", runs: p.runs ?? 0, team: inn.battingTeam, matchId: m.id, season });
      });
    }

    // POM tally
    if (m.player_of_match) {
      const id = m.player_of_match;
      const cur = poms.get(id) ?? { name: "—", v: 0 };
      cur.v += 1; poms.set(id, cur);
    }
  }

  // resolve POM names
  if (poms.size) {
    const ids = Array.from(poms.keys());
    const { data: ps } = await supabase.from("players").select("id, name").in("id", ids);
    (ps ?? []).forEach(p => { const c = poms.get(p.id); if (c) c.name = p.name; });
  }

  const batArr = Array.from(bat.entries()).map(([pid, x]) => ({ pid, ...x }));
  const bowlArr = Array.from(bowl.entries()).map(([pid, x]) => ({ pid, ...x }));

  const top = <T,>(arr: T[], n = 10) => arr.slice(0, n);
  const toRow = (p: any, value: number, extra?: string): RankRow => ({ player_id: p.pid, name: p.name, team: p.team, value, extra });

  return {
    topRuns: top(batArr.sort((a,b) => b.runs - a.runs)).map(p => toRow(p, p.runs)),
    topAvg: top(batArr.filter(b => b.outs > 0 && b.runs >= 30).sort((a,b) => (b.runs/b.outs) - (a.runs/a.outs)))
                .map(p => toRow(p, +(p.runs/p.outs).toFixed(2))),
    topSR: top(batArr.filter(b => b.balls >= 12).sort((a,b) => (b.runs/b.balls) - (a.runs/a.balls)))
                .map(p => toRow(p, +((p.runs/p.balls)*100).toFixed(1))),
    mostFours: top(batArr.sort((a,b) => b.fours - a.fours)).map(p => toRow(p, p.fours)),
    mostSixes: top(batArr.sort((a,b) => b.sixes - a.sixes)).map(p => toRow(p, p.sixes)),
    bestScores: top(batArr.sort((a,b) => b.best - a.best)).map(p => toRow(p, p.best, `(${p.bestBalls}b)`)),
    topWickets: top(bowlArr.sort((a,b) => b.wkts - a.wkts)).map(p => toRow(p, p.wkts)),
    bestEcon: top(bowlArr.filter(b => b.balls >= 12).sort((a,b) => (a.runs/(a.balls/6)) - (b.runs/(b.balls/6))))
                .map(p => toRow(p, +(p.runs/(p.balls/6)).toFixed(2))),
    bestBowling: top(bowlArr.sort((a,b) => b.best.w - a.best.w || a.best.r - b.best.r)).map(p => toRow(p, p.best.w, `for ${p.best.r}`)),
    mostThreeFers: top(bowlArr.filter(b => b.wkts >= 3).sort((a,b) => b.wkts - a.wkts)).map(p => toRow(p, p.wkts)),
    highestTotals: totals.sort((a,b) => b.runs - a.runs).slice(0, 10),
    lowestTotals: totals.sort((a,b) => a.runs - b.runs).slice(0, 10),
    partnerships: partnerships.sort((a,b) => b.runs - a.runs).slice(0, 10),
    playerOfMatchAwards: Array.from(poms.entries()).map(([pid, x]) => ({ player_id: pid, name: x.name, value: x.v }))
                          .sort((a,b) => b.value - a.value).slice(0, 10),
  };
}
