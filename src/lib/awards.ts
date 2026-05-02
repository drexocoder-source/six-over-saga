// Expanded awards & achievements
import { supabase } from "@/integrations/supabase/client";

export type AwardKey =
  | "champion" | "runnerup"
  | "orange_cap" | "purple_cap" | "mvp"
  | "emerging_player" | "most_sixes" | "most_fours"
  | "best_economy" | "best_strike_rate"
  | "fair_play" | "best_catch" | "fastest_fifty";

export const AWARD_META: Record<AwardKey, { emoji: string; title: string; subtitle: string }> = {
  champion:        { emoji: "🏆", title: "Champions",         subtitle: "IPL T20 Title Winners" },
  runnerup:        { emoji: "🥈", title: "Runners-up",        subtitle: "Lost the final by a whisker" },
  orange_cap:      { emoji: "🟧", title: "Orange Cap",        subtitle: "Most runs in the season" },
  purple_cap:      { emoji: "🟪", title: "Purple Cap",        subtitle: "Most wickets in the season" },
  mvp:             { emoji: "🌟", title: "MVP",               subtitle: "Most Valuable Player" },
  emerging_player: { emoji: "🌱", title: "Emerging Player",   subtitle: "Best uncapped under 80 rating" },
  most_sixes:      { emoji: "💥", title: "Universe Boss",     subtitle: "Most 6s in the season" },
  most_fours:      { emoji: "🎯", title: "Boundary King",     subtitle: "Most 4s in the season" },
  best_economy:    { emoji: "🛡️", title: "Iron Wall",         subtitle: "Best economy rate (min 6 overs)" },
  best_strike_rate:{ emoji: "⚡", title: "Strike Lord",       subtitle: "Best strike rate (min 30 balls)" },
  fair_play:       { emoji: "🤝", title: "Fair Play",         subtitle: "Cleanest team this season" },
  best_catch:      { emoji: "🧤", title: "Catch of Season",   subtitle: "Stunning take" },
  fastest_fifty:   { emoji: "🚀", title: "Fastest 25",        subtitle: "Quickest 25-run knock" },
};

export interface SeasonAwardComputation {
  award: AwardKey;
  player_id?: string;
  player_name?: string;
  team_id?: string;
  value?: number;
}

/** Compute end-of-season awards from all matches. */
export async function computeSeasonAwards(seasonId: string, leagueId: string): Promise<SeasonAwardComputation[]> {
  const { data: matches } = await supabase
    .from("matches").select("scorecard, winner, team_a, team_b")
    .eq("season_id", seasonId).eq("status", "done");

  const batMap = new Map<string, { name: string; team: string; runs: number; balls: number; sixes: number; fours: number; rating?: number }>();
  const bowlMap = new Map<string, { name: string; team: string; wkts: number; runs: number; balls: number }>();

  (matches ?? []).forEach((m: any) => {
    const sc = m.scorecard; if (!sc) return;
    (["innings1", "innings2"] as const).forEach(ik => {
      const inn = sc[ik]; if (!inn) return;
      Object.values(inn.bat as Record<string, any>).forEach((b: any) => {
        const c = batMap.get(b.player_id) ?? { name: b.name, team: inn.battingTeam, runs: 0, balls: 0, sixes: 0, fours: 0 };
        c.runs += b.runs; c.balls += b.balls; c.sixes += b.sixes; c.fours += b.fours;
        batMap.set(b.player_id, c);
      });
      Object.values(inn.bowl as Record<string, any>).forEach((b: any) => {
        const c = bowlMap.get(b.player_id) ?? { name: b.name, team: inn.bowlingTeam, wkts: 0, runs: 0, balls: 0 };
        c.wkts += b.wickets; c.runs += b.runs; c.balls += b.balls;
        bowlMap.set(b.player_id, c);
      });
    });
  });

  const awards: SeasonAwardComputation[] = [];

  const orange = [...batMap.entries()].sort((a, b) => b[1].runs - a[1].runs)[0];
  if (orange) awards.push({ award: "orange_cap", player_id: orange[0], player_name: orange[1].name, team_id: orange[1].team, value: orange[1].runs });

  const purple = [...bowlMap.entries()].sort((a, b) => b[1].wkts - a[1].wkts)[0];
  if (purple) awards.push({ award: "purple_cap", player_id: purple[0], player_name: purple[1].name, team_id: purple[1].team, value: purple[1].wkts });

  const sixes = [...batMap.entries()].sort((a, b) => b[1].sixes - a[1].sixes)[0];
  if (sixes && sixes[1].sixes > 0) awards.push({ award: "most_sixes", player_id: sixes[0], player_name: sixes[1].name, team_id: sixes[1].team, value: sixes[1].sixes });

  const fours = [...batMap.entries()].sort((a, b) => b[1].fours - a[1].fours)[0];
  if (fours && fours[1].fours > 0) awards.push({ award: "most_fours", player_id: fours[0], player_name: fours[1].name, team_id: fours[1].team, value: fours[1].fours });

  const econs = [...bowlMap.entries()].filter(([, v]) => v.balls >= 36)
    .map(([id, v]) => ({ id, ...v, econ: (v.runs / v.balls) * 6 }))
    .sort((a, b) => a.econ - b.econ)[0];
  if (econs) awards.push({ award: "best_economy", player_id: econs.id, player_name: econs.name, team_id: econs.team, value: +econs.econ.toFixed(2) });

  const srs = [...batMap.entries()].filter(([, v]) => v.balls >= 30)
    .map(([id, v]) => ({ id, ...v, sr: (v.runs / v.balls) * 100 }))
    .sort((a, b) => b.sr - a.sr)[0];
  if (srs) awards.push({ award: "best_strike_rate", player_id: srs.id, player_name: srs.name, team_id: srs.team, value: +srs.sr.toFixed(1) });

  return awards;
}
