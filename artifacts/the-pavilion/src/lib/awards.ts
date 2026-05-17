// Expanded awards & achievements — IPL-ceremony style
import { supabase } from "@/integrations/supabase/client";

export type AwardKey =
  // Team trophies
  | "champion" | "runnerup" | "qualifier_winner" | "fair_play" | "highest_team_total"
  // Batting (6+)
  | "orange_cap" | "most_sixes" | "most_fours" | "best_strike_rate" | "fastest_fifty" | "highest_individual" | "most_fifties"
  // Bowling (6+)
  | "purple_cap" | "best_economy" | "best_bowling_figures" | "most_maidens" | "most_dots" | "best_average_bowl" | "hat_trick_hero"
  // All-rounders (2+)
  | "best_allrounder" | "impact_player"
  // Misc
  | "mvp" | "emerging_player" | "best_catch" | "captain_of_season";

export const AWARD_META: Record<AwardKey, { emoji: string; title: string; subtitle: string; group?: string }> = {
  // Trophies
  champion:           { emoji: "🏆", title: "Champions",            subtitle: "IPL T20 Title Winners",       group: "team" },
  runnerup:           { emoji: "🥈", title: "Runners-up",           subtitle: "Lost the final by a whisker", group: "team" },
  qualifier_winner:   { emoji: "🥉", title: "Qualifier Winners",    subtitle: "Topped the league stage",     group: "team" },
  fair_play:          { emoji: "🤝", title: "Fair Play",            subtitle: "Fewest extras conceded",      group: "team" },
  highest_team_total: { emoji: "📈", title: "Highest Team Total",   subtitle: "Biggest single innings",      group: "team" },
  // Batting
  orange_cap:         { emoji: "🟧", title: "Orange Cap",           subtitle: "Most runs in the season",     group: "bat" },
  highest_individual: { emoji: "🏏", title: "Knock of the Season",  subtitle: "Best single-innings score",   group: "bat" },
  most_sixes:         { emoji: "💥", title: "Universe Boss",        subtitle: "Most 6s in the season",       group: "bat" },
  most_fours:         { emoji: "🎯", title: "Boundary King",        subtitle: "Most 4s in the season",       group: "bat" },
  best_strike_rate:   { emoji: "⚡", title: "Strike Lord",          subtitle: "Best strike rate (min 30 b)", group: "bat" },
  most_fifties:       { emoji: "5️⃣", title: "Mr. Consistent",       subtitle: "Most 50+ scores",             group: "bat" },
  fastest_fifty:      { emoji: "🚀", title: "Fastest Fifty",        subtitle: "Quickest 50",                 group: "bat" },
  // Bowling
  purple_cap:         { emoji: "🟪", title: "Purple Cap",           subtitle: "Most wickets in the season",  group: "bowl" },
  best_bowling_figures:{emoji: "🔥", title: "Best Bowling Figures", subtitle: "Best wkts/runs in an innings",group: "bowl" },
  best_economy:       { emoji: "🛡️", title: "Iron Wall",            subtitle: "Best economy (min 6 ov)",     group: "bowl" },
  best_average_bowl:  { emoji: "📐", title: "Surgeon",              subtitle: "Best bowling avg (min 4 wk)", group: "bowl" },
  most_maidens:       { emoji: "🚫", title: "Stranglehold",         subtitle: "Most maiden overs",           group: "bowl" },
  most_dots:          { emoji: "⏸️", title: "Dot Machine",          subtitle: "Most dot balls bowled",       group: "bowl" },
  hat_trick_hero:     { emoji: "🎩", title: "Hat-trick Hero",       subtitle: "Took a hat-trick",            group: "bowl" },
  // All-rounders
  best_allrounder:    { emoji: "🌟", title: "Game-Changer",         subtitle: "Best combined bat+bowl impact", group: "ar" },
  impact_player:      { emoji: "💫", title: "Impact Sub",           subtitle: "Biggest match-turning sub",    group: "ar" },
  // Misc
  mvp:                { emoji: "👑", title: "MVP",                  subtitle: "Most Valuable Player",        group: "misc" },
  emerging_player:    { emoji: "🌱", title: "Emerging Player",      subtitle: "Best uncapped under 80",      group: "misc" },
  best_catch:         { emoji: "🧤", title: "Catch of Season",      subtitle: "Stunning take",               group: "misc" },
  captain_of_season:  { emoji: "🎖️", title: "Captain of Season",    subtitle: "Best leadership win %",       group: "misc" },
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
    .from("matches").select("scorecard, winner, team_a, team_b, stage")
    .eq("season_id", seasonId).eq("status", "done");

  type B = { name: string; team: string; runs: number; balls: number; sixes: number; fours: number; fifties: number; outs: number; inn: number; bestScore: number; bestBalls: number; fastest50Balls: number };
  type W = { name: string; team: string; wkts: number; runs: number; balls: number; maidens: number; dots: number; bestWkts: number; bestRuns: number };
  const batMap = new Map<string, B>();
  const bowlMap = new Map<string, W>();
  const teamExtras = new Map<string, number>();
  const teamMaxTotal = new Map<string, { runs: number; vs: string; wkts: number }>();

  (matches ?? []).forEach((m: any) => {
    const sc = m.scorecard; if (!sc) return;
    (["innings1", "innings2"] as const).forEach(ik => {
      const inn = sc[ik]; if (!inn) return;
      // team total
      const cur = teamMaxTotal.get(inn.battingTeam);
      if (!cur || inn.runs > cur.runs) teamMaxTotal.set(inn.battingTeam, { runs: inn.runs, vs: inn.bowlingTeam, wkts: inn.wickets });
      // extras tracked on bowling side
      const ex = inn.extras ?? 0;
      teamExtras.set(inn.bowlingTeam, (teamExtras.get(inn.bowlingTeam) ?? 0) + ex);

      Object.values(inn.bat as Record<string, any>).forEach((b: any) => {
        const c = batMap.get(b.player_id) ?? { name: b.name, team: inn.battingTeam, runs: 0, balls: 0, sixes: 0, fours: 0, fifties: 0, outs: 0, inn: 0, bestScore: 0, bestBalls: 0, fastest50Balls: 999 };
        c.runs += b.runs ?? 0; c.balls += b.balls ?? 0; c.sixes += b.sixes ?? 0; c.fours += b.fours ?? 0;
        if ((b.runs ?? 0) >= 50) c.fifties++;
        if ((b.balls ?? 0) > 0 || (b.runs ?? 0) > 0) c.inn++;
        if (b.out) c.outs++;
        if ((b.runs ?? 0) > c.bestScore) { c.bestScore = b.runs; c.bestBalls = b.balls; }
        if ((b.runs ?? 0) >= 50 && (b.balls ?? 0) > 0 && b.balls < c.fastest50Balls) c.fastest50Balls = b.balls;
        batMap.set(b.player_id, c);
      });
      Object.values(inn.bowl as Record<string, any>).forEach((b: any) => {
        const c = bowlMap.get(b.player_id) ?? { name: b.name, team: inn.bowlingTeam, wkts: 0, runs: 0, balls: 0, maidens: 0, dots: 0, bestWkts: 0, bestRuns: 999 };
        c.wkts += b.wickets ?? 0; c.runs += b.runs ?? 0; c.balls += b.balls ?? 0;
        c.maidens += b.maidens ?? 0; c.dots += b.dots ?? 0;
        if ((b.wickets ?? 0) > c.bestWkts || ((b.wickets ?? 0) === c.bestWkts && (b.runs ?? 0) < c.bestRuns)) {
          c.bestWkts = b.wickets ?? 0; c.bestRuns = b.runs ?? 0;
        }
        bowlMap.set(b.player_id, c);
      });
    });
  });

  const awards: SeasonAwardComputation[] = [];
  const push = (award: AwardKey, src: { id?: string; name?: string; team?: string }, value?: number) =>
    awards.push({ award, player_id: src.id, player_name: src.name, team_id: src.team, value });

  // ----- Batting (7) -----
  const batArr = [...batMap.entries()];
  const orange = batArr.sort((a, b) => b[1].runs - a[1].runs)[0];
  if (orange) push("orange_cap", { id: orange[0], name: orange[1].name, team: orange[1].team }, orange[1].runs);

  const hi = batArr.slice().sort((a, b) => b[1].bestScore - a[1].bestScore)[0];
  if (hi && hi[1].bestScore > 0) push("highest_individual", { id: hi[0], name: hi[1].name, team: hi[1].team }, hi[1].bestScore);

  const sixes = batArr.slice().sort((a, b) => b[1].sixes - a[1].sixes)[0];
  if (sixes && sixes[1].sixes > 0) push("most_sixes", { id: sixes[0], name: sixes[1].name, team: sixes[1].team }, sixes[1].sixes);

  const fours = batArr.slice().sort((a, b) => b[1].fours - a[1].fours)[0];
  if (fours && fours[1].fours > 0) push("most_fours", { id: fours[0], name: fours[1].name, team: fours[1].team }, fours[1].fours);

  const sr = batArr.filter(([, v]) => v.balls >= 30).map(([id, v]) => ({ id, ...v, sr: (v.runs / v.balls) * 100 })).sort((a, b) => b.sr - a.sr)[0];
  if (sr) push("best_strike_rate", { id: sr.id, name: sr.name, team: sr.team }, +sr.sr.toFixed(1));

  const fifties = batArr.slice().sort((a, b) => b[1].fifties - a[1].fifties)[0];
  if (fifties && fifties[1].fifties > 0) push("most_fifties", { id: fifties[0], name: fifties[1].name, team: fifties[1].team }, fifties[1].fifties);

  const f50 = batArr.filter(([, v]) => v.fastest50Balls < 999).sort((a, b) => a[1].fastest50Balls - b[1].fastest50Balls)[0];
  if (f50) push("fastest_fifty", { id: f50[0], name: f50[1].name, team: f50[1].team }, f50[1].fastest50Balls);

  // ----- Bowling (7) -----
  const bowlArr = [...bowlMap.entries()];
  const purple = bowlArr.sort((a, b) => b[1].wkts - a[1].wkts)[0];
  if (purple && purple[1].wkts > 0) push("purple_cap", { id: purple[0], name: purple[1].name, team: purple[1].team }, purple[1].wkts);

  const bbf = bowlArr.slice().sort((a, b) => b[1].bestWkts - a[1].bestWkts || a[1].bestRuns - b[1].bestRuns)[0];
  if (bbf && bbf[1].bestWkts > 0) push("best_bowling_figures", { id: bbf[0], name: bbf[1].name, team: bbf[1].team }, bbf[1].bestWkts);

  const econ = bowlArr.filter(([, v]) => v.balls >= 36).map(([id, v]) => ({ id, ...v, e: (v.runs / v.balls) * 6 })).sort((a, b) => a.e - b.e)[0];
  if (econ) push("best_economy", { id: econ.id, name: econ.name, team: econ.team }, +econ.e.toFixed(2));

  const avgB = bowlArr.filter(([, v]) => v.wkts >= 4).map(([id, v]) => ({ id, ...v, a: v.runs / v.wkts })).sort((a, b) => a.a - b.a)[0];
  if (avgB) push("best_average_bowl", { id: avgB.id, name: avgB.name, team: avgB.team }, +avgB.a.toFixed(2));

  const maid = bowlArr.slice().sort((a, b) => b[1].maidens - a[1].maidens)[0];
  if (maid && maid[1].maidens > 0) push("most_maidens", { id: maid[0], name: maid[1].name, team: maid[1].team }, maid[1].maidens);

  const dot = bowlArr.slice().sort((a, b) => b[1].dots - a[1].dots)[0];
  if (dot && dot[1].dots > 0) push("most_dots", { id: dot[0], name: dot[1].name, team: dot[1].team }, dot[1].dots);

  // ----- All-rounders (2) -----
  const arSet = new Map<string, { name: string; team: string; runs: number; wkts: number; impact: number }>();
  for (const [id, v] of batArr) arSet.set(id, { name: v.name, team: v.team, runs: v.runs, wkts: 0, impact: 0 });
  for (const [id, v] of bowlArr) {
    const c = arSet.get(id) ?? { name: v.name, team: v.team, runs: 0, wkts: 0, impact: 0 };
    c.wkts = v.wkts;
    arSet.set(id, c);
  }
  const ars = [...arSet.entries()].filter(([, v]) => v.runs >= 50 && v.wkts >= 3)
    .map(([id, v]) => ({ id, ...v, impact: v.runs + v.wkts * 20 }))
    .sort((a, b) => b.impact - a.impact);
  if (ars[0]) push("best_allrounder", { id: ars[0].id, name: ars[0].name, team: ars[0].team }, +ars[0].impact.toFixed(0));
  if (ars[1]) push("impact_player", { id: ars[1].id, name: ars[1].name, team: ars[1].team }, +ars[1].impact.toFixed(0));

  // ----- Team awards (5 incl. champ/runnerup added by caller) -----
  // Fair play (fewest extras conceded)
  const fp = [...teamExtras.entries()].sort((a, b) => a[1] - b[1])[0];
  if (fp) push("fair_play", { team: fp[0] }, fp[1]);
  // Highest team total
  const hit = [...teamMaxTotal.entries()].sort((a, b) => b[1].runs - a[1].runs)[0];
  if (hit) push("highest_team_total", { team: hit[0] }, hit[1].runs);

  // ----- MVP — top combined points: 1 per run + 20 per wicket -----
  const mvpArr = [...arSet.entries()].map(([id, v]) => ({ id, ...v, mvp: v.runs + v.wkts * 20 })).sort((a, b) => b.mvp - a.mvp);
  if (mvpArr[0]) push("mvp", { id: mvpArr[0].id, name: mvpArr[0].name, team: mvpArr[0].team }, mvpArr[0].mvp);

  return awards;
}
