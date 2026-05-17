import { supabase } from "@/integrations/supabase/client";

export interface PlayerCareer {
  player: any;
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  bestScore: { runs: number; balls: number; out: boolean; matchId?: string; season?: number } | null;
  ducks: number;

  bowlInnings: number;
  wickets: number;
  bowlBalls: number;
  bowlRuns: number;
  bestBowling: { wickets: number; runs: number; matchId?: string; season?: number } | null;
  threeFers: number;

  debutSeason?: number;
  teams: string[];
  awards: Array<{ award: string; season: number }>;
  byTeam: Record<string, { runs: number; wickets: number; matches: number }>;
}

export async function getPlayerCareer(leagueId: string, playerId: string): Promise<PlayerCareer> {
  const { data: player } = await supabase.from("players").select("*").eq("id", playerId).maybeSingle();
  const { data: seasons } = await supabase.from("seasons").select("id, season_number, year").eq("league_id", leagueId).order("season_number");
  const seasonMap = new Map((seasons ?? []).map(s => [s.id, s.season_number]));
  const seasonIds = (seasons ?? []).map(s => s.id);

  const { data: matches } = await supabase
    .from("matches")
    .select("id, season_id, scorecard, status, winner, team_a, team_b")
    .in("season_id", seasonIds.length ? seasonIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "done");

  const { data: trophies } = await supabase
    .from("trophies").select("award, season_number").eq("league_id", leagueId).eq("player_id", playerId);

  const c: PlayerCareer = {
    player, matches: 0, innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0,
    fifties: 0, hundreds: 0, bestScore: null, ducks: 0,
    bowlInnings: 0, wickets: 0, bowlBalls: 0, bowlRuns: 0, bestBowling: null, threeFers: 0,
    debutSeason: undefined, teams: [], byTeam: {},
    awards: (trophies ?? []).map(t => ({ award: t.award, season: t.season_number ?? 0 })),
  };

  const teamSet = new Set<string>();
  const matchSet = new Set<string>();
  let firstSeason: number | undefined;

  for (const m of matches ?? []) {
    const sc: any = m.scorecard; if (!sc) continue;
    const seasonNum = seasonMap.get(m.season_id);
    for (const ik of ["innings1", "innings2"]) {
      const inn = sc[ik]; if (!inn) continue;
      const bat = (inn.bat ?? {})[playerId];
      const bowl = (inn.bowl ?? {})[playerId];
      if (bat) {
        c.innings++;
        c.runs += bat.runs ?? 0;
        c.balls += bat.balls ?? 0;
        c.fours += bat.fours ?? 0;
        c.sixes += bat.sixes ?? 0;
        if ((bat.runs ?? 0) >= 50 && (bat.runs ?? 0) < 100) c.fifties++;
        if ((bat.runs ?? 0) >= 100) c.hundreds++;
        if ((bat.runs ?? 0) === 0 && bat.out) c.ducks++;
        if (!c.bestScore || (bat.runs ?? 0) > c.bestScore.runs) {
          c.bestScore = { runs: bat.runs ?? 0, balls: bat.balls ?? 0, out: !!bat.out, matchId: m.id, season: seasonNum };
        }
        matchSet.add(m.id);
        teamSet.add(inn.battingTeam);
        const t = c.byTeam[inn.battingTeam] ??= { runs: 0, wickets: 0, matches: 0 };
        t.runs += bat.runs ?? 0;
        if (firstSeason === undefined || (seasonNum ?? 99) < firstSeason) firstSeason = seasonNum;
      }
      if (bowl) {
        c.bowlInnings++;
        c.wickets += bowl.wickets ?? 0;
        c.bowlBalls += bowl.balls ?? 0;
        c.bowlRuns += bowl.runs ?? 0;
        if ((bowl.wickets ?? 0) >= 3) c.threeFers++;
        if (!c.bestBowling || (bowl.wickets ?? 0) > c.bestBowling.wickets ||
            ((bowl.wickets ?? 0) === c.bestBowling.wickets && (bowl.runs ?? 0) < c.bestBowling.runs)) {
          c.bestBowling = { wickets: bowl.wickets ?? 0, runs: bowl.runs ?? 0, matchId: m.id, season: seasonNum };
        }
        matchSet.add(m.id);
        const opp = inn.battingTeam === m.team_a ? m.team_b : m.team_a;
        const t = c.byTeam[opp] ??= { runs: 0, wickets: 0, matches: 0 };
        t.wickets += bowl.wickets ?? 0;
        if (firstSeason === undefined || (seasonNum ?? 99) < firstSeason) firstSeason = seasonNum;
      }
    }
  }
  c.matches = matchSet.size;
  c.teams = Array.from(teamSet);
  c.debutSeason = firstSeason;
  Object.values(c.byTeam).forEach(_ => {});
  // also count match counts per team
  return c;
}

export async function listAllPlayersWithStats(leagueId: string) {
  const { data: players } = await supabase.from("players").select("*").eq("league_id", leagueId).order("name");
  return players ?? [];
}
