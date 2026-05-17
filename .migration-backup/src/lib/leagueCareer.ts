// Aggregate per-player career batting + captaincy record across all done matches in a league.
import { supabase } from "@/integrations/supabase/client";

export interface PlayerCareerLite {
  player_id: string;
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  hs: number;
  hsNotOut: boolean;
  outs: number;
  // bowling
  wickets: number;
  bowlBalls: number;
  bowlRuns: number;
  bbiW: number;
  bbiR: number;
  // captaincy
  capMatches: number;
  capWins: number;
  capLosses: number;
}

export interface CareerBundle {
  byPlayer: Record<string, PlayerCareerLite>;
}

const blank = (id: string): PlayerCareerLite => ({
  player_id: id, matches: 0, innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0,
  fifties: 0, hundreds: 0, hs: 0, hsNotOut: false, outs: 0,
  wickets: 0, bowlBalls: 0, bowlRuns: 0, bbiW: 0, bbiR: 9999,
  capMatches: 0, capWins: 0, capLosses: 0,
});

export async function loadLeagueCareer(leagueId: string): Promise<CareerBundle> {
  // Pull seasons for this league, then matches
  const { data: seasons } = await supabase.from("seasons").select("id").eq("league_id", leagueId);
  const seasonIds = (seasons ?? []).map(s => s.id);
  if (!seasonIds.length) return { byPlayer: {} };

  const { data: matches } = await supabase
    .from("matches")
    .select("id, scorecard, status, winner, team_a, team_b, season_id")
    .in("season_id", seasonIds)
    .eq("status", "done");

  // Get all squads to know captains per match (via season_id + team_id)
  const { data: squads } = await supabase
    .from("squads")
    .select("season_id, team_id, player_id, is_captain")
    .in("season_id", seasonIds)
    .eq("is_captain", true);
  const capMap = new Map<string, string>(); // `${season_id}|${team_id}` -> player_id
  (squads ?? []).forEach(s => capMap.set(`${s.season_id}|${s.team_id}`, s.player_id));

  const byPlayer: Record<string, PlayerCareerLite> = {};
  for (const m of matches ?? []) {
    const sc: any = m.scorecard; if (!sc) continue;
    const matchPlayers = new Set<string>();
    for (const ik of ["innings1", "innings2"]) {
      const inn = sc[ik]; if (!inn) continue;
      Object.values(inn.bat as Record<string, any>).forEach((b: any) => {
        const c = byPlayer[b.player_id] ??= blank(b.player_id);
        c.innings++;
        c.runs += b.runs ?? 0;
        c.balls += b.balls ?? 0;
        c.fours += b.fours ?? 0;
        c.sixes += b.sixes ?? 0;
        if (b.out) c.outs++;
        if ((b.runs ?? 0) >= 50 && (b.runs ?? 0) < 100) c.fifties++;
        if ((b.runs ?? 0) >= 100) c.hundreds++;
        if ((b.runs ?? 0) > c.hs) { c.hs = b.runs ?? 0; c.hsNotOut = !b.out; }
        matchPlayers.add(b.player_id);
      });
      Object.values(inn.bowl as Record<string, any>).forEach((b: any) => {
        const c = byPlayer[b.player_id] ??= blank(b.player_id);
        c.wickets += b.wickets ?? 0;
        c.bowlBalls += b.balls ?? 0;
        c.bowlRuns += b.runs ?? 0;
        if ((b.wickets ?? 0) > c.bbiW || ((b.wickets ?? 0) === c.bbiW && (b.runs ?? 0) < c.bbiR)) {
          c.bbiW = b.wickets ?? 0; c.bbiR = b.runs ?? 0;
        }
        matchPlayers.add(b.player_id);
      });
    }
    matchPlayers.forEach(pid => { byPlayer[pid] ??= blank(pid); byPlayer[pid].matches++; });

    // Captaincy
    for (const team of [m.team_a, m.team_b]) {
      const cap = capMap.get(`${m.season_id}|${team}`);
      if (!cap) continue;
      const c = byPlayer[cap] ??= blank(cap);
      c.capMatches++;
      if (m.winner === team) c.capWins++;
      else if (m.winner && m.winner !== team) c.capLosses++;
    }
  }
  return { byPlayer };
}

export function battingAvg(c: PlayerCareerLite) {
  return c.outs > 0 ? c.runs / c.outs : c.runs;
}
export function battingSR(c: PlayerCareerLite) {
  return c.balls > 0 ? (c.runs / c.balls) * 100 : 0;
}
export function bowlingEcon(c: PlayerCareerLite) {
  return c.bowlBalls > 0 ? (c.bowlRuns / c.bowlBalls) * 6 : 0;
}
export function bowlingAvg(c: PlayerCareerLite) {
  return c.wickets > 0 ? c.bowlRuns / c.wickets : 0;
}
export function captainWinPct(c: PlayerCareerLite) {
  return c.capMatches > 0 ? (c.capWins / c.capMatches) * 100 : 0;
}
