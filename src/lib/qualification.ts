// Mathematical qualification scenario after each league match.
// Q = guaranteed top-N. E = cannot reach top-N. Otherwise we compute a Monte-Carlo qualification %.
import type { PointsRow } from "./standings";

export type QualStatus = "Q" | "E" | "";

export interface QualInfo {
  team_id: string;
  status: QualStatus;
  maxPts: number;
  minPts: number;
  remaining: number;
  qualPct: number;     // 0–100 estimated chance of finishing in top-N
  scenario: string;
}

function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

export function computeQualification(
  table: PointsRow[],
  matchesPerTeam: number,
  topN = 4,
): Record<string, QualInfo> {
  const info: Record<string, QualInfo> = {};
  for (const r of table) {
    const remaining = Math.max(0, matchesPerTeam - r.P);
    info[r.team_id] = {
      team_id: r.team_id,
      status: "",
      maxPts: r.pts + 2 * remaining,
      minPts: r.pts,
      remaining,
      qualPct: 0,
      scenario: "",
    };
  }
  const teams = Object.values(info);
  const ids = teams.map(t => t.team_id);
  const ptsMap: Record<string, number> = Object.fromEntries(table.map(r => [r.team_id, r.pts]));
  const remMap: Record<string, number> = Object.fromEntries(teams.map(t => [t.team_id, t.remaining]));
  const nrrMap: Record<string, number> = Object.fromEntries(table.map(r => [r.team_id, r.nrr]));

  // Monte-Carlo simulation of remaining matches: each team plays its remaining games against random opponents.
  // We build a synthetic remaining-fixture pool by pairing random teams until each team's remaining count is met.
  const SIMS = 600;
  const topCount: Record<string, number> = Object.fromEntries(ids.map(id => [id, 0]));

  for (let s = 0; s < SIMS; s++) {
    const pts = { ...ptsMap };
    const rem: Record<string, number> = { ...remMap };
    // Build pairs greedily
    const pool = shuffle(ids.flatMap(id => Array(rem[id]).fill(id)));
    const used: boolean[] = pool.map(() => false);
    for (let i = 0; i < pool.length; i++) {
      if (used[i]) continue;
      for (let j = i + 1; j < pool.length; j++) {
        if (used[j] || pool[j] === pool[i]) continue;
        used[i] = used[j] = true;
        // random outcome biased a bit by current pts (stronger team slightly favored)
        const a = pool[i], b = pool[j];
        const bias = (pts[a] - pts[b]) * 0.02 + (nrrMap[a] - nrrMap[b]) * 0.05;
        const r = Math.random() + bias;
        if (r > 0.55) pts[a] += 2;
        else if (r < 0.45) pts[b] += 2;
        else { pts[a] += 1; pts[b] += 1; }
        break;
      }
    }
    const ranked = ids.slice().sort((x, y) => pts[y] - pts[x] || nrrMap[y] - nrrMap[x]);
    ranked.slice(0, topN).forEach(id => topCount[id]++);
  }

  for (const t of teams) {
    const canBeatMin = teams.filter(u => u.team_id !== t.team_id && u.maxPts > t.minPts).length;
    const lockedAbove = teams.filter(u => u.team_id !== t.team_id && u.minPts > t.maxPts).length;
    t.qualPct = Math.round((topCount[t.team_id] / SIMS) * 100);

    if (t.remaining === 0 && canBeatMin === 0) {
      t.status = "Q"; t.qualPct = 100; t.scenario = `Locked top-${topN} — season finished.`;
    } else if (canBeatMin <= topN - 1) {
      t.status = "Q"; t.qualPct = 100;
      t.scenario = `Guaranteed top-${topN}: at most ${canBeatMin} team(s) can reach your ${t.minPts} pts.`;
    } else if (lockedAbove >= topN) {
      t.status = "E"; t.qualPct = 0;
      t.scenario = `Eliminated: ${lockedAbove} teams already locked above your max ${t.maxPts} pts.`;
    } else {
      const winsToGuarantee = Math.min(t.remaining, Math.max(0, Math.ceil(((teams.slice().sort((a,b)=>b.minPts-a.minPts)[topN-1]?.minPts ?? 0) + 2 - t.minPts) / 2)));
      t.scenario = `${t.qualPct}% chance · ${t.remaining} games left · win ~${winsToGuarantee} more to lock top-${topN}.`;
    }
  }
  return info;
}
