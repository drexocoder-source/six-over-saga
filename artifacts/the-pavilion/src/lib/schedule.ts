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
 *  Pass `matchesPerTeam` to control: 14 (default) or 18 (full DRR home+away).
 *  Pass `seed` to vary the fixture list per season (e.g. season number). Same seed = same schedule. */
export function buildSchedule(
  teams: string[],
  opts?: { startDate?: Date; teamsCfg?: TeamConfig[]; matchesPerTeam?: number; seed?: number; openingMatch?: { home: string; away: string } }
): ScheduledMatch[] {
  const homeOf: Record<string, string> = opts?.teamsCfg
    ? Object.fromEntries(opts.teamsCfg.map(t => [t.id, t.home ?? t.fullName]))
    : HOME_OF;
  const N = teams.length;
  const target = opts?.matchesPerTeam ?? 14;
  // Seeded RNG (mulberry32) for stable, varied schedules per season.
  let seedState = (opts?.seed ?? 1) >>> 0;
  const rng = () => {
    seedState = (seedState + 0x6D2B79F5) >>> 0;
    let t = seedState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Build pair list. For double round-robin (target = 2*(N-1)) we keep both home/away.
  // Otherwise: 1 single round-robin (each pair once) + up to `extraDoubles` per team as second legs.
  const pairs: { home: string; away: string }[] = [];
  if (target >= 2 * (N - 1)) {
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) pairs.push({ home: teams[i], away: teams[j] });
  } else {
    // Single round-robin: seeded home assignment per pair (varies each season).
    const rrHome: { home: string; away: string }[] = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const homeFirst = rng() < 0.5;
      rrHome.push({ home: homeFirst ? teams[i] : teams[j], away: homeFirst ? teams[j] : teams[i] });
    }
    // Doubles (return-leg): seeded greedy selection so rivalry pairs rotate yearly.
    const extra = Math.max(0, target - (N - 1));
    const second: { home: string; away: string }[] = [];
    const remaining: Record<string, number> = Object.fromEntries(teams.map(t => [t, extra]));
    const chosen = new Set<string>();
    const shuffled = <T,>(arr: T[]): T[] => arr.map(v => [rng(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    while (Object.values(remaining).some(v => v > 0)) {
      const a = shuffled([...teams]).filter(t => remaining[t] > 0).sort((x, y) => remaining[y] - remaining[x])[0];
      const b = shuffled([...teams])
        .filter(t => t !== a && remaining[t] > 0 && !chosen.has([a, t].sort().join("|")))
        .sort((x, y) => remaining[y] - remaining[x])[0];
      if (!a || !b) break;
      const key = [a, b].sort().join("|");
      const orig = rrHome.find(p => (p.home === a && p.away === b) || (p.home === b && p.away === a));
      if (!orig) break;
      // Flip home for return leg (different from first meeting)
      second.push({ home: orig.away, away: orig.home });
      chosen.add(key);
      remaining[a]--; remaining[b]--;
    }
    pairs.push(...rrHome, ...second);
  }

  // If an opening match was requested (e.g. previous champion vs random opponent), move it to the front.
  if (opts?.openingMatch) {
    const { home, away } = opts.openingMatch;
    const idx = pairs.findIndex(p => (p.home === home && p.away === away) || (p.home === away && p.away === home));
    if (idx > 0) {
      const [pick] = pairs.splice(idx, 1);
      // Force the requested home team to actually be home in the opener.
      pairs.unshift({ home, away: pick.home === home ? pick.away : pick.home });
    } else if (idx === -1) {
      pairs.unshift({ home, away });
    }
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
