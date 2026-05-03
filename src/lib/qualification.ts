// Mathematical qualification scenario after each league match.
// Q = guaranteed top-4. E = cannot reach top-4 in any scenario. "" = still in contention.
import type { PointsRow } from "./standings";

export type QualStatus = "Q" | "E" | "";

export interface QualInfo {
  team_id: string;
  status: QualStatus;
  maxPts: number;       // max possible final points
  minPts: number;       // min possible final points (= current pts)
  remaining: number;    // remaining league matches
  scenario: string;     // human description
}

export function computeQualification(
  table: PointsRow[],
  matchesPerTeam: number, // total league matches each team plays
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
      scenario: "",
    };
  }
  const teams = Object.values(info);
  for (const t of teams) {
    // Qualified if at most (topN-1) other teams can possibly exceed t's MIN points
    const canBeatMin = teams.filter(u => u.team_id !== t.team_id && u.maxPts > t.minPts).length;
    // Eliminated if at least topN teams already have min > t's MAX (locked above)
    const lockedAbove = teams.filter(u => u.team_id !== t.team_id && u.minPts > t.maxPts).length;

    if (t.remaining === 0 && canBeatMin === 0) {
      t.status = "Q"; t.scenario = `Locked top-${topN} — season finished for ${t.team_id}`;
    } else if (canBeatMin <= topN - 1) {
      t.status = "Q";
      t.scenario = `Guaranteed top-${topN}: at most ${canBeatMin} team(s) can finish above current ${t.minPts} pts.`;
    } else if (lockedAbove >= topN) {
      t.status = "E";
      t.scenario = `Eliminated: ${lockedAbove} teams already have more pts than your max possible (${t.maxPts}).`;
    } else {
      const need = Math.max(0, topN - teams.filter(u => u.minPts > t.maxPts).length);
      t.scenario = `In contention. Max ${t.maxPts} pts (${t.remaining} matches left). Need fewer than ${topN - 1 - canBeatMin >= 0 ? "X" : ""}rivals to surge.`;
      // simpler readable scenario
      const winsToGuarantee = Math.min(t.remaining, Math.max(0, Math.ceil(((teams.slice().sort((a,b)=>b.minPts-a.minPts)[topN-1]?.minPts ?? 0) + 1 - t.minPts) / 2)));
      t.scenario = `Need ~${winsToGuarantee} more win(s) of ${t.remaining} to push top-${topN}.`;
    }
  }
  return info;
}
