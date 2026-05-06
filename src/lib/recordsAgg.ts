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
}

/** Fetch all done matches in a league with season number attached. */
export async function loadAllDoneMatches(leagueId: string): Promise<MatchRow[]> {
  const { data: seasons } = await supabase.from("seasons").select("id, season_number").eq("league_id", leagueId);
  const sMap = new Map((seasons ?? []).map(s => [s.id, s.season_number]));
  const ids = (seasons ?? []).map(s => s.id);
  if (!ids.length) return [];
  const { data } = await supabase.from("matches")
    .select("id, season_id, match_number, scorecard, team_a, team_b, winner, status")
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

