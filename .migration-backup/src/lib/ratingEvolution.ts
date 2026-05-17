// Subtle player rating evolution at season end.
// Based on form (last entries), season totals (runs/wkts), and injury risk.
// Shifts are intentionally small (-3..+3) so stars stay stars but breakouts and slumps matter.
import { supabase } from "@/integrations/supabase/client";

interface BatAgg { runs: number; balls: number; innings: number; }
interface BowlAgg { wkts: number; runs: number; balls: number; innings: number; }

export async function applySeasonRatingEvolution(leagueId: string, seasonId: string, seasonNumber: number) {
  const { data: matches } = await supabase
    .from("matches").select("scorecard")
    .eq("season_id", seasonId).eq("status", "done");

  const bat = new Map<string, BatAgg>();
  const bowl = new Map<string, BowlAgg>();
  (matches ?? []).forEach((m: any) => {
    const sc = m.scorecard; if (!sc) return;
    (["innings1", "innings2"] as const).forEach(ik => {
      const inn = sc[ik]; if (!inn) return;
      Object.values(inn.bat as Record<string, any>).forEach((b: any) => {
        const c = bat.get(b.player_id) ?? { runs: 0, balls: 0, innings: 0 };
        c.runs += b.runs; c.balls += b.balls; c.innings += b.balls > 0 || b.runs > 0 ? 1 : 0;
        bat.set(b.player_id, c);
      });
      Object.values(inn.bowl as Record<string, any>).forEach((b: any) => {
        const c = bowl.get(b.player_id) ?? { wkts: 0, runs: 0, balls: 0, innings: 0 };
        c.wkts += b.wickets; c.runs += b.runs; c.balls += b.balls; c.innings += b.balls > 0 ? 1 : 0;
        bowl.set(b.player_id, c);
      });
    });
  });

  const { data: players } = await supabase.from("players").select("id, name, role, rating").eq("league_id", leagueId);
  if (!players) return;

  const updates: { id: string; old: number; nw: number; reason: string }[] = [];

  for (const p of players) {
    const role = p.role;
    const b = bat.get(p.id);
    const w = bowl.get(p.id);

    let delta = 0;
    const reasons: string[] = [];

    // BATTING contribution
    if (b && b.innings >= 2) {
      const sr = b.balls > 0 ? (b.runs / b.balls) * 100 : 0;
      const avg = b.runs / Math.max(1, b.innings);
      if (avg >= 40 && sr >= 150) { delta += 3; reasons.push("elite bat (avg≥40 SR≥150)"); }
      else if (avg >= 30 && sr >= 135) { delta += 2; reasons.push("strong bat"); }
      else if (avg >= 22 && sr >= 120) { delta += 1; reasons.push("solid bat"); }
      else if (avg < 12 && b.innings >= 4) { delta -= 2; reasons.push("poor bat form"); }
      else if (avg < 18 && b.innings >= 3) { delta -= 1; reasons.push("below par bat"); }
    } else if (role === "BAT" || role === "AR" || role === "WK") {
      // didn't get many chances — small drop
      delta -= 1; reasons.push("limited opportunities");
    }

    // BOWLING contribution
    if (w && w.innings >= 2 && w.balls >= 12) {
      const econ = (w.runs / w.balls) * 6;
      const wktsPerInn = w.wkts / Math.max(1, w.innings);
      if (wktsPerInn >= 1.4 && econ <= 7.5) { delta += 3; reasons.push("elite bowler (≥1.4 wpi, econ≤7.5)"); }
      else if (wktsPerInn >= 1.0 && econ <= 8.5) { delta += 2; reasons.push("strong bowler"); }
      else if (wktsPerInn >= 0.7 && econ <= 9.5) { delta += 1; reasons.push("decent bowler"); }
      else if (econ >= 11 && w.innings >= 3) { delta -= 2; reasons.push("expensive bowler"); }
      else if (econ >= 10 && w.innings >= 3) { delta -= 1; reasons.push("leaky overs"); }
    } else if (role === "BOWL" || role === "AR") {
      delta -= 1; reasons.push("few overs bowled");
    }

    // Injury risk — random small chance per season, biased toward higher-mileage older players
    let injury_status: string | null = null;
    let injury_until_season: number | null = null;
    if (Math.random() < 0.04) {
      delta -= 2;
      injury_status = "injured";
      injury_until_season = seasonNumber + 1;
      reasons.push("season-ending injury");
    } else if (Math.random() < 0.06) {
      delta -= 1;
      injury_status = "niggles";
      reasons.push("nagging niggles");
    } else {
      injury_status = "fit";
      injury_until_season = null;
    }

    // Subtle: clamp to ±3 per season (per user preference: subtle)
    delta = Math.max(-3, Math.min(3, delta));

    // Reversion to mean — very low rated players who didn't disgrace get a tiny bump
    if (delta === 0 && p.rating < 70 && (b?.innings ?? 0) + (w?.innings ?? 0) >= 3) {
      delta = 1; reasons.push("steady role player");
    }

    const newRating = Math.max(45, Math.min(99, p.rating + delta));
    if (newRating !== p.rating || injury_status) {
      updates.push({ id: p.id, old: p.rating, nw: newRating, reason: reasons.join("; ") || "no notable change" });

      const updateRow: any = { rating: newRating };
      if (injury_status) updateRow.injury_status = injury_status;
      if (injury_until_season !== null) updateRow.injury_until_season = injury_until_season;
      // bump seasons_played
      updateRow.seasons_played = (await supabase.from("players").select("seasons_played").eq("id", p.id).maybeSingle()).data?.seasons_played ?? 0;
      updateRow.seasons_played += 1;

      await supabase.from("players").update(updateRow).eq("id", p.id);
    }
  }

  // History rows
  if (updates.length) {
    const rows = updates.map(u => ({
      league_id: leagueId, player_id: u.id, season_number: seasonNumber,
      old_rating: u.old, new_rating: u.nw, delta: u.nw - u.old, reason: u.reason,
    }));
    await supabase.from("rating_history").insert(rows);
  }
}
