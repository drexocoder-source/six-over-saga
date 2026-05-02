// Squad depth & role balance analysis
export interface RoleBalance {
  team_id: string;
  bat: number;
  bowl: number;
  ar: number;
  wk: number;
  total: number;
  capRated: number; // count of >=85 rated
  avgRating: number;
  warnings: string[];
}

const ROLE_TARGETS = {
  // T2 — small balanced squad recommendations
  bat: { min: 2, ideal: 3 },
  bowl: { min: 2, ideal: 3 },
  ar: { min: 1, ideal: 2 },
  wk: { min: 1, ideal: 1 },
};

export function analyzeSquad(players: Array<{ role: string; rating: number }>, teamId: string): RoleBalance {
  const r: RoleBalance = { team_id: teamId, bat: 0, bowl: 0, ar: 0, wk: 0, total: players.length, capRated: 0, avgRating: 0, warnings: [] };
  let sum = 0;
  for (const p of players) {
    const role = (p.role ?? "").toUpperCase();
    if (role === "BAT") r.bat++;
    else if (role === "BOWL") r.bowl++;
    else if (role === "AR" || role === "ALL") r.ar++;
    else if (role === "WK") r.wk++;
    if (p.rating >= 85) r.capRated++;
    sum += p.rating ?? 0;
  }
  r.avgRating = players.length ? +(sum / players.length).toFixed(1) : 0;
  if (r.bat < ROLE_TARGETS.bat.min) r.warnings.push(`Only ${r.bat} pure batter${r.bat===1?"":"s"} — risky top order`);
  if (r.bowl < ROLE_TARGETS.bowl.min) r.warnings.push(`Only ${r.bowl} pure bowler${r.bowl===1?"":"s"} — death overs vulnerable`);
  if (r.wk < ROLE_TARGETS.wk.min) r.warnings.push(`No wicket-keeper signed`);
  if (r.ar < ROLE_TARGETS.ar.min) r.warnings.push(`No all-rounder for balance`);
  if (r.capRated < 2) r.warnings.push(`Only ${r.capRated} marquee player(s) (rating 85+)`);
  return r;
}
