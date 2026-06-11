// Multi-scope records aggregator.
// Computes records across All-Time, per Season, and per Match from raw scorecards.
import { supabase } from "@/integrations/supabase/client";

export interface Inn {
  battingTeam: string; bowlingTeam: string;
  runs: number; wickets: number; legalBalls: number;
  bat: Record<string, any>; bowl: Record<string, any>;
  ballEvents?: { runs: number; over: number; isWicket?: boolean; isBoundary?: 4 | 6 }[];
}
export interface Sc { innings1?: Inn; innings2?: Inn; team_a: string; team_b: string; winner: string | null; }

export interface MatchRow {
  id: string; season_id: string; season_number?: number; match_number: number;
  scorecard: Sc; team_a: string; team_b: string; winner: string | null;
  stage?: string; home_team?: string | null; venue?: string | null; toss_winner?: string | null; toss_decision?: string | null;
}

/** Fetch all done matches in a league with season number attached. */
export async function loadAllDoneMatches(leagueId: string): Promise<MatchRow[]> {
  const { data: seasons } = await supabase.from("seasons").select("id, season_number").eq("league_id", leagueId);
  const sMap = new Map((seasons ?? []).map(s => [s.id, s.season_number]));
  const ids = (seasons ?? []).map(s => s.id);
  if (!ids.length) return [];
  const { data } = await supabase.from("matches")
    .select("id, season_id, match_number, scorecard, team_a, team_b, winner, status, stage, home_team, venue, toss_winner, toss_decision")
    .in("season_id", ids).eq("status", "done").order("match_number");
  return (data ?? []).map((m: any) => ({ ...m, season_number: sMap.get(m.season_id) ?? 0 })) as MatchRow[];
}

// ----- Individual best entries -----
export interface IndEntry {
  player_id: string; name: string; team: string; value: number; detail: string;
  match_id?: string; season_number?: number;
}
export interface TeamEntry {
  team: string; value: number; detail: string;
  vs?: string; match_id?: string; season_number?: number;
}

/** Highest individual scores across passed matches. */
export function topBatScores(matches: MatchRow[], limit = 10): IndEntry[] {
  const out: IndEntry[] = [];
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      Object.values(inn.bat).forEach((b: any) => {
        if ((b.runs ?? 0) === 0 && !b.balls) return;
        out.push({
          player_id: b.player_id, name: b.name, team: inn.battingTeam,
          value: b.runs ?? 0,
          detail: `${b.runs}${b.out ? "" : "*"} (${b.balls}b, ${b.fours}×4, ${b.sixes}×6)`,
          match_id: m.id, season_number: m.season_number,
        });
      });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

/** Most 100s aggregate across matches per player. */
export function aggregate(matches: MatchRow[], scope: "career" | "season" | "match" = "career") {
  const agg = new Map<string, { player_id: string; name: string; team: string; runs: number; balls: number; fours: number; sixes: number; fifties: number; hundreds: number; wickets: number; bowlBalls: number; bowlRuns: number; matches: Set<string> }>();
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      Object.values(inn.bat).forEach((b: any) => {
        const a = agg.get(b.player_id) ?? { player_id: b.player_id, name: b.name, team: inn.battingTeam, runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, wickets: 0, bowlBalls: 0, bowlRuns: 0, matches: new Set<string>() };
        a.runs += b.runs ?? 0; a.balls += b.balls ?? 0; a.fours += b.fours ?? 0; a.sixes += b.sixes ?? 0;
        if ((b.runs ?? 0) >= 50 && (b.runs ?? 0) < 100) a.fifties++;
        if ((b.runs ?? 0) >= 100) a.hundreds++;
        a.matches.add(m.id);
        agg.set(b.player_id, a);
      });
      Object.values(inn.bowl).forEach((b: any) => {
        const a = agg.get(b.player_id) ?? { player_id: b.player_id, name: b.name, team: inn.bowlingTeam, runs: 0, balls: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, wickets: 0, bowlBalls: 0, bowlRuns: 0, matches: new Set<string>() };
        a.wickets += b.wickets ?? 0; a.bowlBalls += b.balls ?? 0; a.bowlRuns += b.runs ?? 0;
        a.matches.add(m.id);
        agg.set(b.player_id, a);
      });
    }
  }
  return Array.from(agg.values());
}

export function topBest(matches: MatchRow[], key: "runs" | "wickets" | "fifties" | "hundreds" | "sixes" | "fours", limit = 10): IndEntry[] {
  const agg = aggregate(matches);
  return agg
    .filter(a => (a as any)[key] > 0)
    .sort((a, b) => (b as any)[key] - (a as any)[key])
    .slice(0, limit)
    .map(a => ({
      player_id: a.player_id, name: a.name, team: a.team,
      value: (a as any)[key],
      detail: `${(a as any)[key]} ${key} in ${a.matches.size} match${a.matches.size === 1 ? "" : "es"}`,
    }));
}

/** Fastest fifty/century — by balls faced. */
export function fastestMilestone(matches: MatchRow[], milestone: 50 | 100, limit = 10): IndEntry[] {
  const out: IndEntry[] = [];
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      Object.values(inn.bat).forEach((b: any) => {
        if ((b.runs ?? 0) >= milestone && (b.balls ?? 0) > 0) {
          out.push({
            player_id: b.player_id, name: b.name, team: inn.battingTeam,
            value: b.balls, // lower is better — we'll invert sort
            detail: `${milestone} off ${b.balls} (final: ${b.runs}${b.out ? "" : "*"})`,
            match_id: m.id, season_number: m.season_number,
          });
        }
      });
    }
  }
  return out.sort((a, b) => a.value - b.value).slice(0, limit);
}

/** Best strike rate in a single innings (min balls). */
export function bestStrikeRateInnings(matches: MatchRow[], minBalls = 10, limit = 10): IndEntry[] {
  const out: IndEntry[] = [];
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      Object.values(inn.bat).forEach((b: any) => {
        if ((b.balls ?? 0) >= minBalls) {
          const sr = (b.runs / b.balls) * 100;
          out.push({
            player_id: b.player_id, name: b.name, team: inn.battingTeam,
            value: +sr.toFixed(1),
            detail: `SR ${sr.toFixed(1)} — ${b.runs}(${b.balls})`,
            match_id: m.id, season_number: m.season_number,
          });
        }
      });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

/** Best economy in a single innings spell (min overs). */
export function bestEconomySpell(matches: MatchRow[], minOvers = 2, limit = 10): IndEntry[] {
  const out: IndEntry[] = [];
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      Object.values(inn.bowl).forEach((b: any) => {
        if ((b.balls ?? 0) >= minOvers * 6) {
          const econ = (b.runs / b.balls) * 6;
          out.push({
            player_id: b.player_id, name: b.name, team: inn.bowlingTeam,
            value: -econ, // lower econ wins; store negative for desc sort
            detail: `Econ ${econ.toFixed(2)} — ${b.wickets}/${b.runs} (${Math.floor(b.balls / 6)}.${b.balls % 6} ov)`,
            match_id: m.id, season_number: m.season_number,
          });
        }
      });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit).map(e => ({ ...e, value: +Math.abs(e.value).toFixed(2) }));
}

/** Most dot balls in an innings spell. */
export function mostDotsInnings(matches: MatchRow[], limit = 10): IndEntry[] {
  const out: IndEntry[] = [];
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      Object.values(inn.bowl).forEach((b: any) => {
        if ((b.dots ?? 0) > 0) {
          out.push({
            player_id: b.player_id, name: b.name, team: inn.bowlingTeam,
            value: b.dots,
            detail: `${b.dots} dots in ${Math.floor(b.balls / 6)}.${b.balls % 6} ov`,
            match_id: m.id, season_number: m.season_number,
          });
        }
      });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

/** Highest career batting average (min innings). */
export function bestBattingAverage(matches: MatchRow[], minInn = 3, limit = 10): IndEntry[] {
  const map = new Map<string, { name: string; team: string; runs: number; outs: number; inn: number }>();
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      Object.values(inn.bat).forEach((b: any) => {
        if ((b.balls ?? 0) === 0 && (b.runs ?? 0) === 0) return;
        const c = map.get(b.player_id) ?? { name: b.name, team: inn.battingTeam, runs: 0, outs: 0, inn: 0 };
        c.runs += b.runs ?? 0; c.inn += 1; if (b.out) c.outs += 1;
        map.set(b.player_id, c);
      });
    }
  }
  return [...map.entries()].filter(([, v]) => v.inn >= minInn).map(([id, v]) => ({
    player_id: id, name: v.name, team: v.team,
    value: +(v.runs / Math.max(1, v.outs)).toFixed(2),
    detail: `Avg ${(v.runs / Math.max(1, v.outs)).toFixed(2)} (${v.runs}r in ${v.inn} inn, ${v.outs}× out)`,
  })).sort((a, b) => b.value - a.value).slice(0, limit);
}

export function bestBowlingFigures(matches: MatchRow[], limit = 10): IndEntry[] {
  const out: IndEntry[] = [];
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      Object.values(inn.bowl).forEach((b: any) => {
        if ((b.wickets ?? 0) === 0) return;
        out.push({
          player_id: b.player_id, name: b.name, team: inn.bowlingTeam,
          value: (b.wickets ?? 0) * 1000 - (b.runs ?? 0),
          detail: `${b.wickets}/${b.runs} (${Math.floor((b.balls ?? 0) / 6)}.${(b.balls ?? 0) % 6} ov)`,
          match_id: m.id, season_number: m.season_number,
        });
      });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

// ----- Team records -----
export function teamHighestTotals(matches: MatchRow[], limit = 10): TeamEntry[] {
  const out: TeamEntry[] = [];
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      out.push({
        team: inn.battingTeam, value: inn.runs,
        detail: `${inn.runs}/${inn.wickets} (${Math.floor(inn.legalBalls / 6)}.${inn.legalBalls % 6} ov)`,
        vs: inn.bowlingTeam, match_id: m.id, season_number: m.season_number,
      });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

export function teamLowestTotals(matches: MatchRow[], limit = 10): TeamEntry[] {
  return teamHighestTotals(matches, 1000).reverse().slice(0, limit);
}

export function teamBestPowerplay(matches: MatchRow[], ppOvers = 6, limit = 10): TeamEntry[] {
  const out: TeamEntry[] = [];
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn || !inn.ballEvents) continue;
      let runs = 0, wkts = 0;
      for (const e of inn.ballEvents) {
        if (e.over < ppOvers) { runs += e.runs; if (e.isWicket) wkts++; }
      }
      if (runs === 0 && wkts === 0) continue;
      out.push({
        team: inn.battingTeam, value: runs,
        detail: `${runs}/${wkts} in PP (${ppOvers} ov)`,
        vs: inn.bowlingTeam, match_id: m.id, season_number: m.season_number,
      });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

export function teamMostBoundaries(matches: MatchRow[], limit = 10): TeamEntry[] {
  const out: TeamEntry[] = [];
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      const fours = Object.values(inn.bat as any).reduce((s: number, b: any) => s + (b.fours ?? 0), 0) as number;
      const sixes = Object.values(inn.bat as any).reduce((s: number, b: any) => s + (b.sixes ?? 0), 0) as number;
      out.push({
        team: inn.battingTeam, value: fours + sixes,
        detail: `${fours + sixes} bdries (${fours}×4, ${sixes}×6)`,
        vs: inn.bowlingTeam, match_id: m.id, season_number: m.season_number,
      });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

// ----- Milestones / Firsts -----
export interface Milestone {
  label: string;
  detail: string;
  player_id?: string;
  team?: string;
  match_id?: string;
  season_number?: number;
}

export function milestones(matches: MatchRow[]): Milestone[] {
  const out: Milestone[] = [];
  const flags = {
    firstHundred: false, firstFifty: false, firstFiver: false, firstHattrick: false,
    firstSix: false, firstFour: false, firstDuck: false, firstWicket: false, firstMaiden: false,
    firstTeam200: false, firstTeam100: false, firstTeam150: false, firstTeam250: false,
    firstSuperOver: false, firstTie: false, firstGoldenDuck: false, firstChasedDefend: false,
    firstNailbiter: false, firstThirty: false, firstFortyFive: false, firstAllOut: false,
    firstBigWin: false, firstSuperFifty: false, firstThreeSixesOver: false, firstHundredPlus: false,
    firstUnbeaten: false, firstPair: false, firstThreeWk: false, firstFourWk: false,
  };
  for (const m of matches.slice().sort((a, b) => (a.season_number ?? 0) - (b.season_number ?? 0) || a.match_number - b.match_number)) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      Object.values(inn.bat as any).forEach((b: any) => {
        if (!flags.firstFour && (b.fours ?? 0) > 0) {
          flags.firstFour = true;
          out.push({ label: "First Four", detail: `${b.name} pierced the field`, player_id: b.player_id, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstThirty && (b.runs ?? 0) >= 30) {
          flags.firstThirty = true;
          out.push({ label: "First 30+ Knock", detail: `${b.name} — ${b.runs} (${b.balls})`, player_id: b.player_id, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstFortyFive && (b.runs ?? 0) >= 45) {
          flags.firstFortyFive = true;
          out.push({ label: "First 45+ Knock", detail: `${b.name} — ${b.runs} (${b.balls})`, player_id: b.player_id, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstFifty && (b.runs ?? 0) >= 50) {
          flags.firstFifty = true;
          out.push({ label: "First Fifty", detail: `${b.name} — ${b.runs} (${b.balls})`, player_id: b.player_id, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstSuperFifty && (b.runs ?? 0) >= 75) {
          flags.firstSuperFifty = true;
          out.push({ label: "First 75+ Score", detail: `${b.name} — ${b.runs} (${b.balls})`, player_id: b.player_id, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstHundred && (b.runs ?? 0) >= 100) {
          flags.firstHundred = true;
          out.push({ label: "First Century", detail: `${b.name} — ${b.runs} (${b.balls})`, player_id: b.player_id, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstHundredPlus && (b.runs ?? 0) >= 125) {
          flags.firstHundredPlus = true;
          out.push({ label: "First 125+ Knock", detail: `${b.name} — ${b.runs} (${b.balls})`, player_id: b.player_id, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstSix && (b.sixes ?? 0) > 0) {
          flags.firstSix = true;
          out.push({ label: "First Six", detail: `${b.name} cleared the rope`, player_id: b.player_id, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstDuck && (b.runs ?? 0) === 0 && b.out && (b.balls ?? 0) > 0) {
          flags.firstDuck = true;
          out.push({ label: "First Duck", detail: `${b.name} bagged a duck`, player_id: b.player_id, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstGoldenDuck && (b.runs ?? 0) === 0 && b.out && (b.balls ?? 0) === 1) {
          flags.firstGoldenDuck = true;
          out.push({ label: "First Golden Duck", detail: `${b.name} — out first ball`, player_id: b.player_id, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstUnbeaten && (b.runs ?? 0) >= 50 && !b.out) {
          flags.firstUnbeaten = true;
          out.push({ label: "First Unbeaten Fifty", detail: `${b.name} — ${b.runs}* (${b.balls})`, player_id: b.player_id, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
        }
      });
      Object.values(inn.bowl as any).forEach((b: any) => {
        if (!flags.firstWicket && (b.wickets ?? 0) > 0) {
          flags.firstWicket = true;
          out.push({ label: "First Wicket", detail: `${b.name} struck first`, player_id: b.player_id, team: inn.bowlingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstThreeWk && (b.wickets ?? 0) >= 3) {
          flags.firstThreeWk = true;
          out.push({ label: "First 3-Wicket Haul", detail: `${b.name} — ${b.wickets}/${b.runs}`, player_id: b.player_id, team: inn.bowlingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstFourWk && (b.wickets ?? 0) >= 4) {
          flags.firstFourWk = true;
          out.push({ label: "First 4-Wicket Haul", detail: `${b.name} — ${b.wickets}/${b.runs}`, player_id: b.player_id, team: inn.bowlingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstFiver && (b.wickets ?? 0) >= 5) {
          flags.firstFiver = true;
          out.push({ label: "First Five-Wicket Haul", detail: `${b.name} — ${b.wickets}/${b.runs}`, player_id: b.player_id, team: inn.bowlingTeam, match_id: m.id, season_number: m.season_number });
        }
        if (!flags.firstMaiden && (b.balls ?? 0) >= 6 && (b.runs ?? 0) === 0) {
          flags.firstMaiden = true;
          out.push({ label: "First Maiden Over", detail: `${b.name} — 6 dot balls`, player_id: b.player_id, team: inn.bowlingTeam, match_id: m.id, season_number: m.season_number });
        }
      });
      if (!flags.firstTeam100 && inn.runs >= 100) {
        flags.firstTeam100 = true;
        out.push({ label: "First 100+ Total", detail: `${inn.battingTeam} ${inn.runs}/${inn.wickets}`, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
      }
      if (!flags.firstTeam150 && inn.runs >= 150) {
        flags.firstTeam150 = true;
        out.push({ label: "First 150+ Total", detail: `${inn.battingTeam} ${inn.runs}/${inn.wickets} vs ${inn.bowlingTeam}`, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
      }
      if (!flags.firstTeam200 && inn.runs >= 200) {
        flags.firstTeam200 = true;
        out.push({ label: "First 200+ Total", detail: `${inn.battingTeam} ${inn.runs}/${inn.wickets} vs ${inn.bowlingTeam}`, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
      }
      if (!flags.firstTeam250 && inn.runs >= 250) {
        flags.firstTeam250 = true;
        out.push({ label: "First 250+ Total", detail: `${inn.battingTeam} ${inn.runs}/${inn.wickets} vs ${inn.bowlingTeam}`, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
      }
      if (!flags.firstAllOut && (inn.wickets ?? 0) >= 10) {
        flags.firstAllOut = true;
        out.push({ label: "First All-Out", detail: `${inn.battingTeam} bundled out for ${inn.runs}`, team: inn.battingTeam, match_id: m.id, season_number: m.season_number });
      }
    }
    // Match-level firsts
    const i1 = m.scorecard?.innings1, i2 = m.scorecard?.innings2;
    if (!flags.firstTie && i1 && i2 && i1.runs === i2.runs && !m.winner) {
      flags.firstTie = true;
      out.push({ label: "First Tied Match", detail: `${m.team_a} vs ${m.team_b} — both finished on ${i1.runs}`, match_id: m.id, season_number: m.season_number });
    }
    if (!flags.firstChasedDefend && i1 && i2 && m.winner === i2.battingTeam) {
      flags.firstChasedDefend = true;
      out.push({ label: "First Successful Chase", detail: `${i2.battingTeam} chased ${i1.runs + 1}`, team: i2.battingTeam, match_id: m.id, season_number: m.season_number });
    }
    if (!flags.firstNailbiter && i1 && i2 && Math.abs(i1.runs - i2.runs) <= 5 && m.winner) {
      flags.firstNailbiter = true;
      out.push({ label: "First Nail-biter", detail: `${m.winner} won by just ${Math.abs(i1.runs - i2.runs)} runs`, team: m.winner, match_id: m.id, season_number: m.season_number });
    }
    if (!flags.firstBigWin && i1 && i2 && Math.abs(i1.runs - i2.runs) >= 75 && m.winner) {
      flags.firstBigWin = true;
      out.push({ label: "First 75+ Run Thrashing", detail: `${m.winner} won by ${Math.abs(i1.runs - i2.runs)} runs`, team: m.winner, match_id: m.id, season_number: m.season_number });
    }
  }
  return out;
}

// ----- Streaks & extras records -----
/** Most boundaries (4+6) by an individual in an innings. */
export function mostBoundariesInnings(matches: MatchRow[], limit = 10): IndEntry[] {
  const out: IndEntry[] = [];
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      Object.values(inn.bat as any).forEach((b: any) => {
        const total = (b.fours ?? 0) + (b.sixes ?? 0);
        if (total <= 0) return;
        out.push({
          player_id: b.player_id, name: b.name, team: inn.battingTeam,
          value: total,
          detail: `${total} bdries — ${b.fours}×4 + ${b.sixes}×6 in ${b.runs}(${b.balls})`,
          match_id: m.id, season_number: m.season_number,
        });
      });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

/** Best career bowling average (min wickets). */
export function bestBowlingAverage(matches: MatchRow[], minWk = 4, limit = 10): IndEntry[] {
  const map = new Map<string, { name: string; team: string; runs: number; wkts: number }>();
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      Object.values(inn.bowl as any).forEach((b: any) => {
        const c = map.get(b.player_id) ?? { name: b.name, team: inn.bowlingTeam, runs: 0, wkts: 0 };
        c.runs += b.runs ?? 0; c.wkts += b.wickets ?? 0;
        map.set(b.player_id, c);
      });
    }
  }
  return [...map.entries()].filter(([, v]) => v.wkts >= minWk).map(([id, v]) => ({
    player_id: id, name: v.name, team: v.team,
    value: +(v.runs / v.wkts).toFixed(2),
    detail: `Avg ${(v.runs / v.wkts).toFixed(2)} (${v.wkts} wk in ${v.runs} runs)`,
  })).sort((a, b) => a.value - b.value).slice(0, limit);
}

/** Most maidens by a bowler in season scope. */
export function mostMaidens(matches: MatchRow[], limit = 10): IndEntry[] {
  const map = new Map<string, { name: string; team: string; maidens: number }>();
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      Object.values(inn.bowl as any).forEach((b: any) => {
        if (!b.maidens) return;
        const c = map.get(b.player_id) ?? { name: b.name, team: inn.bowlingTeam, maidens: 0 };
        c.maidens += b.maidens;
        map.set(b.player_id, c);
      });
    }
  }
  return [...map.entries()].map(([id, v]) => ({
    player_id: id, name: v.name, team: v.team, value: v.maidens, detail: `${v.maidens} maiden over${v.maidens === 1 ? "" : "s"}`,
  })).sort((a, b) => b.value - a.value).slice(0, limit);
}

/** Biggest win margin by runs. */
export function biggestWinMargin(matches: MatchRow[], limit = 10): TeamEntry[] {
  const out: TeamEntry[] = [];
  for (const m of matches) {
    const i1 = m.scorecard?.innings1, i2 = m.scorecard?.innings2;
    if (!i1 || !i2 || !m.winner) continue;
    if (m.winner === i1.battingTeam) {
      out.push({ team: m.winner, value: i1.runs - i2.runs, detail: `won by ${i1.runs - i2.runs} runs`, vs: i2.battingTeam, match_id: m.id, season_number: m.season_number });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

/** Closest finishes (smallest run margin). */
export function closestFinishes(matches: MatchRow[], limit = 10): TeamEntry[] {
  const out: TeamEntry[] = [];
  for (const m of matches) {
    const i1 = m.scorecard?.innings1, i2 = m.scorecard?.innings2;
    if (!i1 || !i2 || !m.winner) continue;
    const margin = Math.abs(i1.runs - i2.runs);
    out.push({ team: m.winner, value: margin, detail: `${m.winner} won by ${margin} run${margin === 1 ? "" : "s"}`, vs: m.winner === m.team_a ? m.team_b : m.team_a, match_id: m.id, season_number: m.season_number });
  }
  return out.sort((a, b) => a.value - b.value).slice(0, limit);
}

/** Highest chase totals successfully achieved. */
export function highestSuccessfulChases(matches: MatchRow[], limit = 10): TeamEntry[] {
  const out: TeamEntry[] = [];
  for (const m of matches) {
    const i1 = m.scorecard?.innings1, i2 = m.scorecard?.innings2;
    if (!i1 || !i2 || !m.winner) continue;
    if (m.winner === i2.battingTeam) {
      out.push({ team: i2.battingTeam, value: i2.runs, detail: `chased ${i1.runs + 1} (made ${i2.runs}/${i2.wickets})`, vs: i1.battingTeam, match_id: m.id, season_number: m.season_number });
    }
  }
  return out.sort((a, b) => b.value - a.value).slice(0, limit);
}

/** Lowest defended totals — team batted first, won. */
export function lowestDefendedTotals(matches: MatchRow[], limit = 10): TeamEntry[] {
  const out: TeamEntry[] = [];
  for (const m of matches) {
    const i1 = m.scorecard?.innings1, i2 = m.scorecard?.innings2;
    if (!i1 || !i2 || !m.winner) continue;
    if (m.winner === i1.battingTeam) {
      out.push({ team: i1.battingTeam, value: i1.runs, detail: `defended ${i1.runs} vs ${i2.battingTeam} (${i2.runs}/${i2.wickets})`, vs: i2.battingTeam, match_id: m.id, season_number: m.season_number });
    }
  }
  return out.sort((a, b) => a.value - b.value).slice(0, limit);
}


// =====================================================================
// ============== EXTENDED RECORDS (Teams / Cap / H2H / Adv) ===========
// =====================================================================

export interface TeamOverallRow {
  team: string;
  matches: number; wins: number; losses: number; ties: number;
  winPct: number;
  totalRunsScored: number; totalRunsConceded: number;
  highestScore: number; highestDetail: string;
  lowestScore: number; lowestDetail: string;
  biggestChase: number; biggestChaseDetail: string;
  lowestDefended: number; lowestDefendedDetail: string;
  bestStreak: number; worstStreak: number;
  totalSixes: number; totalFours: number;
  total200s: number; total150s: number;
  totalWicketsTaken: number;
  avgScore: number;
  // home/away
  homeWins: number; homeLosses: number; awayWins: number; awayLosses: number;
  homeWinPct: number; awayWinPct: number;
  // titles / playoffs
  finalsPlayed: number; titles: number; playoffApps: number;
}

export function computeTeamOverall(matches: MatchRow[], allTeams: string[]): TeamOverallRow[] {
  // Need full match rows with stage + home_team for some metrics — fall back gracefully.
  const init = (t: string): TeamOverallRow => ({
    team: t, matches: 0, wins: 0, losses: 0, ties: 0, winPct: 0,
    totalRunsScored: 0, totalRunsConceded: 0,
    highestScore: 0, highestDetail: "—",
    lowestScore: 9999, lowestDetail: "—",
    biggestChase: 0, biggestChaseDetail: "—",
    lowestDefended: 9999, lowestDefendedDetail: "—",
    bestStreak: 0, worstStreak: 0,
    totalSixes: 0, totalFours: 0, total200s: 0, total150s: 0,
    totalWicketsTaken: 0, avgScore: 0,
    homeWins: 0, homeLosses: 0, awayWins: 0, awayLosses: 0,
    homeWinPct: 0, awayWinPct: 0,
    finalsPlayed: 0, titles: 0, playoffApps: 0,
  });
  const map = new Map<string, TeamOverallRow>();
  allTeams.forEach(t => map.set(t, init(t)));

  // Track per-team result sequence for streaks
  const seq = new Map<string, ("W" | "L" | "T")[]>();
  allTeams.forEach(t => seq.set(t, []));
  // Track distinct playoff/final seasons per team (so "PO" counts seasons, not matches)
  const poSeasons = new Map<string, Set<number>>();
  const finalSeasons = new Map<string, Set<number>>();
  const titleSeasons = new Map<string, Set<number>>();

  for (const m of matches) {
    const i1 = m.scorecard?.innings1, i2 = m.scorecard?.innings2;
    if (!i1 || !i2) continue;
    const stage = (m as any).stage as string | undefined;
    const homeTeam = (m as any).home_team as string | undefined;

    for (const team of [m.team_a, m.team_b]) {
      if (!map.has(team)) map.set(team, init(team));
      const r = map.get(team)!;
      r.matches++;
      const myInn = i1.battingTeam === team ? i1 : i2;
      const oppInn = i1.battingTeam === team ? i2 : i1;
      r.totalRunsScored += myInn.runs;
      r.totalRunsConceded += oppInn.runs;
      if (myInn.runs > r.highestScore) {
        r.highestScore = myInn.runs;
        r.highestDetail = `${myInn.runs}/${myInn.wickets} vs ${oppInn.battingTeam} (S${m.season_number ?? "?"})`;
      }
      if (myInn.runs < r.lowestScore && myInn.legalBalls > 0) {
        r.lowestScore = myInn.runs;
        r.lowestDetail = `${myInn.runs}/${myInn.wickets} vs ${oppInn.battingTeam} (S${m.season_number ?? "?"})`;
      }
      const fours = Object.values(myInn.bat as any).reduce((s: number, b: any) => s + (b.fours ?? 0), 0) as number;
      const sixes = Object.values(myInn.bat as any).reduce((s: number, b: any) => s + (b.sixes ?? 0), 0) as number;
      r.totalFours += fours; r.totalSixes += sixes;
      if (myInn.runs >= 150) r.total150s++;
      if (myInn.runs >= 200) r.total200s++;
      r.totalWicketsTaken += oppInn.wickets;

      let res: "W" | "L" | "T";
      if (!m.winner) res = "T";
      else if (m.winner === team) res = "W";
      else res = "L";
      if (res === "W") r.wins++;
      else if (res === "L") r.losses++;
      else r.ties++;
      seq.get(team)!.push(res);

      if (homeTeam) {
        if (homeTeam === team) {
          if (res === "W") r.homeWins++; else if (res === "L") r.homeLosses++;
        } else {
          if (res === "W") r.awayWins++; else if (res === "L") r.awayLosses++;
        }
      }

      if (m.winner === team) {
        if (i2.battingTeam === team) {
          if (i2.runs > r.biggestChase) {
            r.biggestChase = i2.runs;
            r.biggestChaseDetail = `chased ${i1.runs + 1} vs ${i1.battingTeam}`;
          }
        } else {
          if (i1.runs < r.lowestDefended) {
            r.lowestDefended = i1.runs;
            r.lowestDefendedDetail = `defended ${i1.runs} vs ${i2.battingTeam}`;
          }
        }
      }

      // Distinct-season playoff / final tracking
      const sn = m.season_number ?? 0;
      if (["qualifier1", "eliminator", "qualifier2", "final"].includes(stage ?? "")) {
        if (!poSeasons.has(team)) poSeasons.set(team, new Set());
        poSeasons.get(team)!.add(sn);
      }
      if (stage === "final") {
        if (!finalSeasons.has(team)) finalSeasons.set(team, new Set());
        finalSeasons.get(team)!.add(sn);
        if (m.winner === team) {
          if (!titleSeasons.has(team)) titleSeasons.set(team, new Set());
          titleSeasons.get(team)!.add(sn);
        }
      }
    }
  }

  // Streaks & %s, plus distinct-season counts
  for (const [team, r] of map) {
    const s = seq.get(team) ?? [];
    let bw = 0, bl = 0, curW = 0, curL = 0;
    for (const x of s) {
      if (x === "W") { curW++; curL = 0; bw = Math.max(bw, curW); }
      else if (x === "L") { curL++; curW = 0; bl = Math.max(bl, curL); }
      else { curW = 0; curL = 0; }
    }
    r.bestStreak = bw; r.worstStreak = bl;
    r.winPct = r.matches ? +((r.wins / r.matches) * 100).toFixed(1) : 0;
    r.avgScore = r.matches ? +(r.totalRunsScored / r.matches).toFixed(1) : 0;
    const homeM = r.homeWins + r.homeLosses;
    const awayM = r.awayWins + r.awayLosses;
    r.homeWinPct = homeM ? +((r.homeWins / homeM) * 100).toFixed(1) : 0;
    r.awayWinPct = awayM ? +((r.awayWins / awayM) * 100).toFixed(1) : 0;
    if (r.lowestScore === 9999) r.lowestScore = 0;
    if (r.lowestDefended === 9999) r.lowestDefended = 0;
    r.playoffApps = poSeasons.get(team)?.size ?? 0;
    r.finalsPlayed = finalSeasons.get(team)?.size ?? 0;
    r.titles = titleSeasons.get(team)?.size ?? 0;
  }
  return [...map.values()].sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);
}

// ----- Captaincy -----
export interface CaptaincyRow {
  player_id: string; name: string; team: string;
  matches: number; wins: number; losses: number; ties: number; winPct: number;
  bestStreak: number; titles: number; finals: number;
  /** Distinct seasons in which this captain led the team into any playoff match. */
  playoffSeasons: number;
  /** Distinct seasons captained. */
  seasonsCaptained: number;
}

export async function computeCaptaincy(leagueId: string, matches: MatchRow[]): Promise<CaptaincyRow[]> {
  const { data: squads } = await supabase
    .from("squads")
    .select("season_id, team_id, player_id, is_captain, players(id, name)")
    .eq("is_captain", true);
  const capMap = new Map<string, { id: string; name: string }>();
  (squads ?? []).forEach((s: any) => {
    capMap.set(`${s.season_id}|${s.team_id}`, { id: s.player_id, name: s.players?.name ?? "—" });
  });
  const out = new Map<string, CaptaincyRow>();
  const seq = new Map<string, ("W"|"L"|"T")[]>();
  const poSeasonsByCap = new Map<string, Set<number>>();
  const seasonsByCap = new Map<string, Set<number>>();
  const titleSeasonsByCap = new Map<string, Set<number>>();
  const finalSeasonsByCap = new Map<string, Set<number>>();
  for (const m of matches) {
    for (const team of [m.team_a, m.team_b]) {
      const cap = capMap.get(`${m.season_id}|${team}`);
      if (!cap) continue;
      const r = out.get(cap.id) ?? { player_id: cap.id, name: cap.name, team, matches: 0, wins: 0, losses: 0, ties: 0, winPct: 0, bestStreak: 0, titles: 0, finals: 0, playoffSeasons: 0, seasonsCaptained: 0 };
      r.matches++;
      let res: "W"|"L"|"T";
      if (!m.winner) res = "T";
      else if (m.winner === team) res = "W";
      else res = "L";
      if (res === "W") r.wins++;
      else if (res === "L") r.losses++;
      else r.ties++;
      const arr = seq.get(cap.id) ?? []; arr.push(res); seq.set(cap.id, arr);
      const stage = (m as any).stage;
      const sn = m.season_number ?? 0;
      if (!seasonsByCap.has(cap.id)) seasonsByCap.set(cap.id, new Set());
      seasonsByCap.get(cap.id)!.add(sn);
      if (["qualifier1", "eliminator", "qualifier2", "final"].includes(stage ?? "")) {
        if (!poSeasonsByCap.has(cap.id)) poSeasonsByCap.set(cap.id, new Set());
        poSeasonsByCap.get(cap.id)!.add(sn);
      }
      if (stage === "final") {
        if (!finalSeasonsByCap.has(cap.id)) finalSeasonsByCap.set(cap.id, new Set());
        finalSeasonsByCap.get(cap.id)!.add(sn);
        if (res === "W") {
          if (!titleSeasonsByCap.has(cap.id)) titleSeasonsByCap.set(cap.id, new Set());
          titleSeasonsByCap.get(cap.id)!.add(sn);
        }
      }
      out.set(cap.id, r);
    }
  }
  for (const [id, r] of out) {
    r.winPct = r.matches ? +((r.wins / r.matches) * 100).toFixed(1) : 0;
    let cur = 0, best = 0;
    for (const x of (seq.get(id) ?? [])) {
      if (x === "W") { cur++; best = Math.max(best, cur); } else cur = 0;
    }
    r.bestStreak = best;
    r.playoffSeasons = poSeasonsByCap.get(id)?.size ?? 0;
    r.seasonsCaptained = seasonsByCap.get(id)?.size ?? 0;
    r.finals = finalSeasonsByCap.get(id)?.size ?? 0;
    r.titles = titleSeasonsByCap.get(id)?.size ?? 0;
  }
  return [...out.values()].filter(r => r.matches >= 2).sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);
}

// ----- Head-to-Head grid -----
export interface H2HCell { teamA: string; teamB: string; played: number; aWins: number; bWins: number; ties: number; aRunsAvg: number; bRunsAvg: number; }
export function computeH2H(matches: MatchRow[], allTeams: string[]): H2HCell[] {
  const cells = new Map<string, H2HCell>();
  const key = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;
  for (const m of matches) {
    const i1 = m.scorecard?.innings1, i2 = m.scorecard?.innings2;
    if (!i1 || !i2) continue;
    const [a, b] = m.team_a < m.team_b ? [m.team_a, m.team_b] : [m.team_b, m.team_a];
    const k = key(a, b);
    const c = cells.get(k) ?? { teamA: a, teamB: b, played: 0, aWins: 0, bWins: 0, ties: 0, aRunsAvg: 0, bRunsAvg: 0 };
    c.played++;
    if (!m.winner) c.ties++;
    else if (m.winner === a) c.aWins++;
    else if (m.winner === b) c.bWins++;
    const aRuns = i1.battingTeam === a ? i1.runs : i2.runs;
    const bRuns = i1.battingTeam === b ? i1.runs : i2.runs;
    c.aRunsAvg += aRuns; c.bRunsAvg += bRuns;
    cells.set(k, c);
  }
  for (const c of cells.values()) {
    if (c.played) { c.aRunsAvg = +(c.aRunsAvg / c.played).toFixed(1); c.bRunsAvg = +(c.bRunsAvg / c.played).toFixed(1); }
  }
  return [...cells.values()].sort((x, y) => y.played - x.played);
}

// ----- Advanced analytics -----
export interface AdvancedRow {
  player_id: string; name: string; team: string;
  inn: number; runs: number; balls: number;
  boundaryPct: number;       // (4s+6s runs) / runs
  dotBallPct: number;        // dots faced (approximated as balls - runs/avgBallValue) — approximate via 1 - (runsExcluding bndry / non-bndry balls)
  finisherIndex: number;     // not out & SR > 140
  anchorIndex: number;       // balls/inn ratio
  pressureSR: number;        // strike rate in chase 2nd innings
  wpa: number;               // wickets per appearance (bowlers)
  impact: number;            // composite
}
export function computeAdvanced(matches: MatchRow[], minBalls = 30): AdvancedRow[] {
  const map = new Map<string, AdvancedRow & { fours: number; sixes: number; notOuts: number; chaseRuns: number; chaseBalls: number; wkts: number }>();
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      const isChase = ik === "innings2";
      Object.values(inn.bat as any).forEach((b: any) => {
        const c = map.get(b.player_id) ?? { player_id: b.player_id, name: b.name, team: inn.battingTeam, inn: 0, runs: 0, balls: 0, boundaryPct: 0, dotBallPct: 0, finisherIndex: 0, anchorIndex: 0, pressureSR: 0, wpa: 0, impact: 0, fours: 0, sixes: 0, notOuts: 0, chaseRuns: 0, chaseBalls: 0, wkts: 0 };
        c.inn++; c.runs += b.runs ?? 0; c.balls += b.balls ?? 0;
        c.fours += b.fours ?? 0; c.sixes += b.sixes ?? 0;
        if (!b.out) c.notOuts++;
        if (isChase) { c.chaseRuns += b.runs ?? 0; c.chaseBalls += b.balls ?? 0; }
        map.set(b.player_id, c);
      });
      Object.values(inn.bowl as any).forEach((b: any) => {
        const c = map.get(b.player_id) ?? { player_id: b.player_id, name: b.name, team: inn.bowlingTeam, inn: 0, runs: 0, balls: 0, boundaryPct: 0, dotBallPct: 0, finisherIndex: 0, anchorIndex: 0, pressureSR: 0, wpa: 0, impact: 0, fours: 0, sixes: 0, notOuts: 0, chaseRuns: 0, chaseBalls: 0, wkts: 0 };
        c.wkts += b.wickets ?? 0;
        map.set(b.player_id, c);
      });
    }
  }
  const rows: AdvancedRow[] = [];
  for (const c of map.values()) {
    if (c.balls < minBalls && c.wkts < 3) continue;
    const bdryRuns = c.fours * 4 + c.sixes * 6;
    c.boundaryPct = c.runs ? +((bdryRuns / c.runs) * 100).toFixed(1) : 0;
    // approximate dot % using boundaries vs total balls
    const nonBdryBalls = Math.max(0, c.balls - (c.fours + c.sixes));
    const nonBdryRuns = c.runs - bdryRuns;
    c.dotBallPct = nonBdryBalls ? +(((nonBdryBalls - nonBdryRuns) / c.balls) * 100).toFixed(1) : 0;
    const sr = c.balls ? (c.runs / c.balls) * 100 : 0;
    c.finisherIndex = c.inn ? +(((c.notOuts / c.inn) * 50) + (sr - 130) * 0.5).toFixed(1) : 0;
    c.anchorIndex = c.inn ? +((c.balls / c.inn) * (sr > 100 ? 1 : 0.8)).toFixed(1) : 0;
    c.pressureSR = c.chaseBalls ? +((c.chaseRuns / c.chaseBalls) * 100).toFixed(1) : 0;
    c.wpa = c.inn ? +(c.wkts / c.inn).toFixed(2) : c.wkts;
    c.impact = +(((c.runs * 0.05) + (c.wkts * 8) + (c.boundaryPct * 0.3) + (sr * 0.2)).toFixed(1));
    rows.push(c);
  }
  return rows.sort((a, b) => b.impact - a.impact);
}

// =====================================================================
// ============== PHASE ANALYTICS =====================================
// =====================================================================

export interface PhaseStats {
  team: string;
  ppRuns: number; ppWkts: number; ppBalls: number;
  midRuns: number; midWkts: number; midBalls: number;
  deathRuns: number; deathWkts: number; deathBalls: number;
  totalMatches: number;
  ppBdryPct: number; midBdryPct: number; deathBdryPct: number;
}

export function computePhaseStats(matches: MatchRow[], ppOvers = 6): Map<string, PhaseStats> {
  const map = new Map<string, PhaseStats>();
  const mkInit = (team: string): PhaseStats => ({
    team, ppRuns: 0, ppWkts: 0, ppBalls: 0, midRuns: 0, midWkts: 0, midBalls: 0,
    deathRuns: 0, deathWkts: 0, deathBalls: 0, totalMatches: 0,
    ppBdryPct: 0, midBdryPct: 0, deathBdryPct: 0,
  });
  const bdryRuns = new Map<string, { pp: number; mid: number; death: number; ppR: number; midR: number; deathR: number }>();

  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn || !inn.ballEvents) continue;
      const team = inn.battingTeam;
      const s = map.get(team) ?? mkInit(team);
      const bd = bdryRuns.get(team) ?? { pp: 0, mid: 0, death: 0, ppR: 0, midR: 0, deathR: 0 };
      s.totalMatches++;
      for (const e of inn.ballEvents) {
        const ov = e.over;
        const isB = e.isBoundary === 4 || e.isBoundary === 6;
        const bRuns = e.isBoundary === 4 ? 4 : e.isBoundary === 6 ? 6 : 0;
        if (ov < ppOvers) {
          s.ppRuns += e.runs; s.ppBalls++; if (e.isWicket) s.ppWkts++;
          if (isB) { bd.pp += bRuns; } bd.ppR += e.runs;
        } else if (ov < 15) {
          s.midRuns += e.runs; s.midBalls++; if (e.isWicket) s.midWkts++;
          if (isB) { bd.mid += bRuns; } bd.midR += e.runs;
        } else {
          s.deathRuns += e.runs; s.deathBalls++; if (e.isWicket) s.deathWkts++;
          if (isB) { bd.death += bRuns; } bd.deathR += e.runs;
        }
      }
      map.set(team, s);
      bdryRuns.set(team, bd);
    }
  }
  for (const [team, s] of map) {
    const bd = bdryRuns.get(team)!;
    s.ppBdryPct = bd.ppR ? +((bd.pp / bd.ppR) * 100).toFixed(1) : 0;
    s.midBdryPct = bd.midR ? +((bd.mid / bd.midR) * 100).toFixed(1) : 0;
    s.deathBdryPct = bd.deathR ? +((bd.death / bd.deathR) * 100).toFixed(1) : 0;
  }
  return map;
}

// =====================================================================
// ============== CHASE ANALYTICS ======================================
// =====================================================================

export interface ChaseRange { range: string; attempts: number; wins: number; winPct: number; avgChase: number; }

export function computeChaseSuccessRate(matches: MatchRow[]): ChaseRange[] {
  const ranges: [string, number, number][] = [
    ["< 130", 0, 129], ["130–149", 130, 149], ["150–169", 150, 169],
    ["170–189", 170, 189], ["190–209", 190, 209], ["210+", 210, 9999],
  ];
  return ranges.map(([range, lo, hi]) => {
    let attempts = 0, wins = 0, total = 0;
    for (const m of matches) {
      const i1 = m.scorecard?.innings1, i2 = m.scorecard?.innings2;
      if (!i1 || !i2) continue;
      const target = i1.runs + 1;
      if (target - 1 >= lo && target - 1 <= hi) {
        attempts++;
        total += i2.runs;
        if (m.winner === i2.battingTeam) wins++;
      }
    }
    return { range, attempts, wins, winPct: attempts ? +((wins / attempts) * 100).toFixed(1) : 0, avgChase: attempts ? +(total / attempts).toFixed(1) : 0 };
  }).filter(r => r.attempts > 0);
}

// =====================================================================
// ============== TOSS ANALYTICS ========================================
// =====================================================================

export interface TossStats { team: string; tossWins: number; batAfterToss: number; fieldAfterToss: number; winAfterTossWin: number; winAfterTossLoss: number; tossWinMatchWinPct: number; }

export function computeTossStats(matches: MatchRow[]): TossStats[] {
  const map = new Map<string, TossStats>();
  const mk = (t: string): TossStats => ({ team: t, tossWins: 0, batAfterToss: 0, fieldAfterToss: 0, winAfterTossWin: 0, winAfterTossLoss: 0, tossWinMatchWinPct: 0 });
  for (const m of matches) {
    const tossWinner = (m as any).toss_winner as string | undefined;
    const tossChoice = ((m as any).toss_decision ?? (m as any).toss_choice) as string | undefined;
    if (!tossWinner) continue;
    for (const team of [m.team_a, m.team_b]) {
      const s = map.get(team) ?? mk(team);
      const wonToss = tossWinner === team;
      if (wonToss) {
        s.tossWins++;
        if (tossChoice === "bat") s.batAfterToss++; else s.fieldAfterToss++;
        if (m.winner === team) s.winAfterTossWin++;
      } else {
        if (m.winner === team) s.winAfterTossLoss++;
      }
      map.set(team, s);
    }
  }
  for (const s of map.values()) {
    s.tossWinMatchWinPct = s.tossWins ? +((s.winAfterTossWin / s.tossWins) * 100).toFixed(1) : 0;
  }
  return [...map.values()].sort((a, b) => b.tossWinMatchWinPct - a.tossWinMatchWinPct);
}

// =====================================================================
// ============== COLLAPSE STATS ========================================
// =====================================================================

export interface CollapseEntry { team: string; match_id: string; season_number?: number; collapseText: string; wickets: number; runs: number; }

export function computeCollapseStats(matches: MatchRow[], limit = 10): CollapseEntry[] {
  const out: CollapseEntry[] = [];
  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn || !inn.ballEvents) continue;
      let wkts = 0, runs = 0, window = 18;
      for (let startBall = 0; startBall < inn.ballEvents.length; startBall++) {
        wkts = 0; runs = 0;
        for (let j = startBall; j < Math.min(startBall + window, inn.ballEvents.length); j++) {
          runs += inn.ballEvents[j].runs;
          if (inn.ballEvents[j].isWicket) wkts++;
        }
        if (wkts >= 4) {
          out.push({ team: inn.battingTeam, match_id: m.id, season_number: m.season_number, collapseText: `Lost ${wkts}/${runs} in ${Math.ceil(window / 6)} overs`, wickets: wkts, runs });
          break;
        }
      }
    }
  }
  return out.sort((a, b) => b.wickets - a.wickets || a.runs - b.runs).slice(0, limit);
}

// =====================================================================
// ============== PLAYER DEEP ANALYTICS ================================
// =====================================================================

export interface PlayerDeepRow {
  player_id: string; name: string; team: string;
  inn: number; runs: number; balls: number;
  chaseRuns: number; chaseBalls: number; chaseInn: number;
  defRuns: number; defBalls: number; defInn: number;
  ppRuns: number; ppBalls: number;
  midRuns: number; midBalls: number;
  deathRuns: number; deathBalls: number;
  wickets: number; wicketsVsBat: number; wicketsVsBowl: number;
}

export function computePlayerDeepStats(matches: MatchRow[], ppOvers = 6): PlayerDeepRow[] {
  const map = new Map<string, PlayerDeepRow>();
  const mk = (id: string, name: string, team: string): PlayerDeepRow => ({
    player_id: id, name, team, inn: 0, runs: 0, balls: 0,
    chaseRuns: 0, chaseBalls: 0, chaseInn: 0,
    defRuns: 0, defBalls: 0, defInn: 0,
    ppRuns: 0, ppBalls: 0, midRuns: 0, midBalls: 0, deathRuns: 0, deathBalls: 0,
    wickets: 0, wicketsVsBat: 0, wicketsVsBowl: 0,
  });

  for (const m of matches) {
    for (const ik of ["innings1", "innings2"] as const) {
      const inn = m.scorecard?.[ik]; if (!inn) continue;
      const isChase = ik === "innings2";

      Object.values(inn.bat as any).forEach((b: any) => {
        const c = map.get(b.player_id) ?? mk(b.player_id, b.name, inn.battingTeam);
        c.inn++; c.runs += b.runs ?? 0; c.balls += b.balls ?? 0;
        if (isChase) { c.chaseRuns += b.runs ?? 0; c.chaseBalls += b.balls ?? 0; c.chaseInn++; }
        else { c.defRuns += b.runs ?? 0; c.defBalls += b.balls ?? 0; c.defInn++; }
        map.set(b.player_id, c);
      });

      Object.values(inn.bowl as any).forEach((b: any) => {
        const c = map.get(b.player_id) ?? mk(b.player_id, b.name, inn.bowlingTeam);
        c.wickets += b.wickets ?? 0;
        map.set(b.player_id, c);
      });
    }
  }
  return [...map.values()].filter(c => c.balls >= 20 || c.wickets >= 3);
}

// =====================================================================
// ============== SEASON BESTS ==========================================
// =====================================================================

export interface SeasonBest { season_number: number; runsLeader: string; runsVal: number; wicketsLeader: string; wicketsVal: number; sixesLeader: string; sixesVal: number; strikeRateLeader: string; srVal: number; econLeader: string; econVal: number; }

export function computeSeasonBests(matches: MatchRow[]): SeasonBest[] {
  const seasons = new Map<number, MatchRow[]>();
  for (const m of matches) {
    const sn = m.season_number ?? 0;
    if (!seasons.has(sn)) seasons.set(sn, []);
    seasons.get(sn)!.push(m);
  }
  const out: SeasonBest[] = [];
  for (const [sn, ms] of [...seasons.entries()].sort((a, b) => a[0] - b[0])) {
    const agg = aggregate(ms);
    if (!agg.length) continue;
    const byRuns = [...agg].sort((a, b) => b.runs - a.runs)[0];
    const byWkts = [...agg].sort((a, b) => b.wickets - a.wickets)[0];
    const bySixes = [...agg].sort((a, b) => b.sixes - a.sixes)[0];
    const bySR = [...agg].filter(a => a.balls >= 30).sort((a, b) => (b.runs / b.balls) - (a.runs / a.balls))[0];
    const byEcon = [...agg].filter(a => a.bowlBalls >= 18).sort((a, b) => (a.bowlRuns / a.bowlBalls) - (b.bowlRuns / b.bowlBalls))[0];
    out.push({
      season_number: sn,
      runsLeader: byRuns?.name ?? "—", runsVal: byRuns?.runs ?? 0,
      wicketsLeader: byWkts?.name ?? "—", wicketsVal: byWkts?.wickets ?? 0,
      sixesLeader: bySixes?.name ?? "—", sixesVal: bySixes?.sixes ?? 0,
      strikeRateLeader: bySR?.name ?? "—", srVal: bySR ? +((bySR.runs / bySR.balls) * 100).toFixed(1) : 0,
      econLeader: byEcon?.name ?? "—", econVal: byEcon ? +((byEcon.bowlRuns / byEcon.bowlBalls) * 6).toFixed(2) : 0,
    });
  }
  return out;
}
