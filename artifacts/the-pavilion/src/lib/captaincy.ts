// Captaincy stats & auto-swap helpers.
import { supabase } from "@/integrations/supabase/client";

export interface CaptaincyStats {
  player_id: string;
  player_name: string;
  team_id: string;
  matches: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  finalsReached: number;
  trophies: number;
  rating: number;
  role: string;
}

/** Compute captaincy stats for a given team & league across all completed matches. */
export async function getTeamCaptaincyStats(leagueId: string, teamId: string): Promise<CaptaincyStats[]> {
  const { data: seasons } = await supabase.from("seasons").select("id, season_number").eq("league_id", leagueId);
  const seasonIds = (seasons ?? []).map(s => s.id);
  if (!seasonIds.length) return [];

  const { data: squads } = await supabase
    .from("squads")
    .select("season_id, team_id, player_id, is_captain, players(id, name, rating, role)")
    .in("season_id", seasonIds)
    .eq("team_id", teamId)
    .eq("is_captain", true);

  const { data: matches } = await supabase
    .from("matches")
    .select("id, stage, winner, team_a, team_b, season_id, status")
    .in("season_id", seasonIds)
    .eq("status", "done");

  const byPlayer = new Map<string, CaptaincyStats>();
  (squads ?? []).forEach((s: any) => {
    if (!s.players) return;
    if (!byPlayer.has(s.player_id)) {
      byPlayer.set(s.player_id, {
        player_id: s.player_id,
        player_name: s.players.name,
        team_id: teamId,
        matches: 0, wins: 0, losses: 0, ties: 0, winPct: 0,
        finalsReached: 0, trophies: 0,
        rating: s.players.rating ?? 70,
        role: s.players.role ?? "—",
      });
    }
  });

  const seasonCaptain = new Map<string, string>(); // season_id -> player_id (captain for team)
  (squads ?? []).forEach((s: any) => seasonCaptain.set(s.season_id, s.player_id));

  (matches ?? []).forEach((m: any) => {
    const team = m.team_a === teamId ? teamId : m.team_b === teamId ? teamId : null;
    if (!team) return;
    const captainId = seasonCaptain.get(m.season_id);
    if (!captainId) return;
    const c = byPlayer.get(captainId);
    if (!c) return;
    c.matches++;
    if (m.winner === team) c.wins++;
    else if (m.winner === null) c.ties++;
    else c.losses++;
    if (m.stage === "final") {
      c.finalsReached++;
      if (m.winner === team) c.trophies++;
    }
  });

  byPlayer.forEach(c => { c.winPct = c.matches > 0 ? (c.wins / c.matches) * 100 : 0; });
  return Array.from(byPlayer.values()).sort((a, b) => b.winPct - a.winPct);
}

/** Recommend a new captain. Score = 0.6*rating + 0.4*(min(matches,30) bonus) - penalty if no leadership exp. */
export interface CaptainSuggestion {
  player_id: string;
  player_name: string;
  rating: number;
  reason: string;
}

export async function suggestNewCaptain(
  seasonId: string,
  teamId: string,
  currentCaptainId: string | null,
): Promise<CaptainSuggestion | null> {
  const { data: squad } = await supabase
    .from("squads")
    .select("player_id, is_vice_captain, players(id, name, rating, role)")
    .eq("season_id", seasonId)
    .eq("team_id", teamId);

  if (!squad?.length) return null;

  const candidates = squad
    .filter((r: any) => r.player_id !== currentCaptainId && r.players)
    .map((r: any) => {
      const p = r.players;
      const roleBonus = p.role === "BAT" || p.role === "AR" ? 5 : p.role === "WK" ? 3 : 0;
      const viceBonus = r.is_vice_captain ? 8 : 0;
      const score = (p.rating ?? 70) + roleBonus + viceBonus;
      const reason = r.is_vice_captain
        ? `${p.name} is the current vice-captain (rating ${p.rating}).`
        : `${p.name} has the strongest rating (${p.rating}) for the leadership role.`;
      return { player_id: p.id, player_name: p.name, rating: p.rating, score, reason };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0] ?? null;
}

/** Swap captain for a team in a given season. */
export async function swapCaptain(seasonId: string, teamId: string, newCaptainId: string): Promise<void> {
  await supabase.from("squads").update({ is_captain: false }).eq("season_id", seasonId).eq("team_id", teamId);
  await supabase.from("squads").update({ is_captain: true }).eq("season_id", seasonId).eq("team_id", teamId).eq("player_id", newCaptainId);
}
