// Live record-break detector — runs after every ball during a live match.
// Maintains a baseline of pre-match leaderboards; fires a toast when the
// current striker / bowler surpasses an existing record.
import { aggregate, type MatchRow } from "@/lib/recordsAgg";

export interface LiveBaseline {
  allTimeTopRuns: { player_id: string; name: string; runs: number } | null;
  allTimeTopWickets: { player_id: string; name: string; wickets: number } | null;
  allTimeTopSixes: { player_id: string; name: string; sixes: number } | null;
  seasonTopRuns: { player_id: string; name: string; runs: number } | null;  // Orange Cap
  seasonTopWickets: { player_id: string; name: string; wickets: number } | null; // Purple Cap
  fired: Set<string>;
}

export function buildBaseline(allTimeMatches: MatchRow[], seasonMatches: MatchRow[]): LiveBaseline {
  const allTime = aggregate(allTimeMatches);
  const season = aggregate(seasonMatches);
  const topBy = <K extends "runs" | "wickets" | "sixes">(rows: ReturnType<typeof aggregate>, k: K) => {
    const sorted = [...rows].sort((a, b) => (b as any)[k] - (a as any)[k]);
    return sorted[0] && (sorted[0] as any)[k] > 0
      ? { player_id: sorted[0].player_id, name: sorted[0].name, [k]: (sorted[0] as any)[k] } as any
      : null;
  };
  return {
    allTimeTopRuns: topBy(allTime, "runs"),
    allTimeTopWickets: topBy(allTime, "wickets"),
    allTimeTopSixes: topBy(allTime, "sixes"),
    seasonTopRuns: topBy(season, "runs"),
    seasonTopWickets: topBy(season, "wickets"),
    fired: new Set<string>(),
  };
}

export interface LiveRecordBreak {
  id: string;       // dedupe key
  title: string;    // big text
  subtitle: string; // who & previous holder
  emoji: string;
}

interface LiveCtx {
  striker?: { player_id: string; name: string; team: string; runsThisInnings: number; careerRunsBefore: number; seasonRunsBefore: number };
  bowler?:  { player_id: string; name: string; team: string; wktsThisInnings: number; careerWktsBefore: number; seasonWktsBefore: number };
  sixCarrier?: { player_id: string; name: string; careerSixesBefore: number };
}

export function detectRecordBreaks(b: LiveBaseline, ctx: LiveCtx): LiveRecordBreak[] {
  const out: LiveRecordBreak[] = [];
  const push = (id: string, title: string, subtitle: string, emoji: string) => {
    if (b.fired.has(id)) return;
    b.fired.add(id);
    out.push({ id, title, subtitle, emoji });
  };

  // Orange Cap (season leading run-scorer) overtake
  const s = ctx.striker;
  if (s && b.seasonTopRuns && s.player_id !== b.seasonTopRuns.player_id) {
    const liveSeasonTotal = s.seasonRunsBefore + s.runsThisInnings;
    if (liveSeasonTotal > b.seasonTopRuns.runs) {
      push(
        `oc-${s.player_id}`,
        "🍊 ORANGE CAP CLAIMED",
        `${s.name} (${liveSeasonTotal}) overtakes ${b.seasonTopRuns.name} (${b.seasonTopRuns.runs})`,
        "🍊",
      );
      b.seasonTopRuns = { player_id: s.player_id, name: s.name, runs: liveSeasonTotal };
    }
  }
  // All-time top scorer overtake
  if (s && b.allTimeTopRuns && s.player_id !== b.allTimeTopRuns.player_id) {
    const liveCareerTotal = s.careerRunsBefore + s.runsThisInnings;
    if (liveCareerTotal > b.allTimeTopRuns.runs) {
      push(
        `at-runs-${s.player_id}`,
        "👑 ALL-TIME LEADING SCORER",
        `${s.name} surpasses ${b.allTimeTopRuns.name} — career ${liveCareerTotal} runs`,
        "👑",
      );
      b.allTimeTopRuns = { player_id: s.player_id, name: s.name, runs: liveCareerTotal };
    }
  }
  // All-time sixes overtake
  const sx = ctx.sixCarrier;
  if (sx && b.allTimeTopSixes && sx.player_id !== b.allTimeTopSixes.player_id) {
    const liveCareerSixes = sx.careerSixesBefore + 1;
    if (liveCareerSixes > b.allTimeTopSixes.sixes) {
      push(
        `at-sixes-${sx.player_id}`,
        "🚀 MOST SIXES — ALL TIME",
        `${sx.name} clears ${b.allTimeTopSixes.name} with ${liveCareerSixes} career sixes`,
        "🚀",
      );
      b.allTimeTopSixes = { player_id: sx.player_id, name: sx.name, sixes: liveCareerSixes };
    }
  }
  // Purple Cap (season leading wicket-taker) overtake
  const bw = ctx.bowler;
  if (bw && b.seasonTopWickets && bw.player_id !== b.seasonTopWickets.player_id) {
    const liveSeasonW = bw.seasonWktsBefore + bw.wktsThisInnings;
    if (liveSeasonW > b.seasonTopWickets.wickets) {
      push(
        `pc-${bw.player_id}`,
        "💜 PURPLE CAP CLAIMED",
        `${bw.name} (${liveSeasonW}) leapfrogs ${b.seasonTopWickets.name} (${b.seasonTopWickets.wickets})`,
        "💜",
      );
      b.seasonTopWickets = { player_id: bw.player_id, name: bw.name, wickets: liveSeasonW };
    }
  }
  // All-time top wicket-taker overtake
  if (bw && b.allTimeTopWickets && bw.player_id !== b.allTimeTopWickets.player_id) {
    const liveCareerW = bw.careerWktsBefore + bw.wktsThisInnings;
    if (liveCareerW > b.allTimeTopWickets.wickets) {
      push(
        `at-wkts-${bw.player_id}`,
        "🎯 ALL-TIME LEADING WICKET-TAKER",
        `${bw.name} surpasses ${b.allTimeTopWickets.name} — career ${liveCareerW} wickets`,
        "🎯",
      );
      b.allTimeTopWickets = { player_id: bw.player_id, name: bw.name, wickets: liveCareerW };
    }
  }
  return out;
}
