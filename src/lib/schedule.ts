// Realistic round-robin double schedule with home/away venues and dates.
// Spreads out fixtures so no team plays back-to-back days; alternates venues.
import { DEFAULT_TEAMS, type TeamConfig } from "./teams";

export interface ScheduledMatch {
  match_number: number;
  stage: "league" | "qualifier1" | "eliminator" | "qualifier2" | "final";
  team_a: string;            // batting/bowling order is decided at toss; team_a = home by convention
  team_b: string;
  home_team: string;
  venue: string;
  match_date: string;        // ISO
}

const HOME_OF: Record<string, string> = Object.fromEntries(
  DEFAULT_TEAMS.map(t => [t.id, t.home ?? t.fullName])
);

/** Build IPL-style schedule. Default = 14 matches per team (1 single round-robin + 5 extra rivalry second-legs).
 *  Pass `matchesPerTeam` to control: 14 (default) or 18 (full DRR home+away). */
export function buildSchedule(
  teams: string[],
  opts?: { startDate?: Date; teamsCfg?: TeamConfig[]; matchesPerTeam?: number }
): ScheduledMatch[] {
  const homeOf: Record<string, string> = opts?.teamsCfg
    ? Object.fromEntries(opts.teamsCfg.map(t => [t.id, t.home ?? t.fullName]))
    : HOME_OF;
  const N = teams.length;
  const target = opts?.matchesPerTeam ?? 14;

  // Build pair list. For double round-robin (target = 2*(N-1)) we keep both home/away.
  // Otherwise: 1 single round-robin (each pair once) + up to `extraDoubles` per team as second legs.
  const pairs: { home: string; away: string }[] = [];
  if (target >= 2 * (N - 1)) {
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) pairs.push({ home: teams[i], away: teams[j] });
  } else {
    // Single round-robin: random home assignment per pair
    const rrHome: { home: string; away: string }[] = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const homeFirst = (i + j) % 2 === 0;
      rrHome.push({ home: homeFirst ? teams[i] : teams[j], away: homeFirst ? teams[j] : teams[i] });
    }
    // Doubles (return-leg) — pick a k-regular graph; offsets {1,2,...} until each team has `extra` doubles.
    const extra = Math.max(0, target - (N - 1));
    const used = new Set<string>();
    const second: { home: string; away: string }[] = [];
    const degOf = (id: string) => second.filter(p => p.home === id || p.away === id).length;
    // Try offsets greedily
    for (let off = 1; off <= Math.floor(N / 2) && Math.min(...teams.map(degOf)) < extra; off++) {
      for (let i = 0; i < N; i++) {
        const a = teams[i], b = teams[(i + off) % N];
        if (a === b) continue;
        const key = [a, b].sort().join("|");
        if (used.has(key)) continue;
        if (degOf(a) >= extra || degOf(b) >= extra) continue;
        // Reverse home of the original RR meeting
        const orig = rrHome.find(p => (p.home === a && p.away === b) || (p.home === b && p.away === a))!;
        second.push({ home: orig.away, away: orig.home });
        used.add(key);
      }
    }
    pairs.push(...rrHome, ...second);
  }

  // Greedy ordering with rest-day constraint: a team can't play 2 days in a row.
  // We slot one match per "day". Try to honor min-rest = 1 day (≥2 calendar days between).
  const ordered: { home: string; away: string }[] = [];
  const remaining = [...pairs];
  // Track last day a team played
  const lastDay: Record<string, number> = {};
  let day = 0;
  while (remaining.length > 0) {
    // Find best pair for this day: both teams rested ≥ 1 day; prefer biggest rest.
    let pickIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const { home, away } = remaining[i];
      const restH = day - (lastDay[home] ?? -10);
      const restA = day - (lastDay[away] ?? -10);
      if (restH < 1 || restA < 1) continue;          // hard rest constraint
      const score = Math.min(restH, restA) + 0.1 * (restH + restA);
      if (score > bestScore) { bestScore = score; pickIdx = i; }
    }
    if (pickIdx === -1) {
      // No fully-rested pair — relax (still avoid same-day duplicate); pick max-rest available.
      for (let i = 0; i < remaining.length; i++) {
        const { home, away } = remaining[i];
        const restH = day - (lastDay[home] ?? -10);
        const restA = day - (lastDay[away] ?? -10);
        if (restH < 1 && restA < 1) continue;
        const score = restH + restA;
        if (score > bestScore) { bestScore = score; pickIdx = i; }
      }
      if (pickIdx === -1) pickIdx = 0;
    }
    const m = remaining.splice(pickIdx, 1)[0];
    ordered.push(m);
    lastDay[m.home] = day;
    lastDay[m.away] = day;
    day += 1;
  }

  const start = opts?.startDate ?? new Date("2026-03-22T19:30:00+05:30");
  const matches: ScheduledMatch[] = ordered.map((p, idx) => {
    const date = new Date(start);
    date.setDate(start.getDate() + idx);
    return {
      match_number: idx + 1,
      stage: "league",
      team_a: p.home,         // home listed first
      team_b: p.away,
      home_team: p.home,
      venue: homeOf[p.home] ?? p.home,
      match_date: date.toISOString(),
    };
  });

  // Playoffs (Q1/Elim/Q2/Final) are scheduled after league stage completes — see lib/playoffs.ts.
  return matches;
}
