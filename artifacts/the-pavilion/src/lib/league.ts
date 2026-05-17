import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "./device";
import { DEFAULT_TEAMS } from "./teams";
import { SEED_POOL, playerPhoto } from "./seedPlayers";

export type ScoreProfile = "150+" | "200+" | "250+" | "300+";

export interface League {
  id: string;
  device_id: string;
  name: string;
  teams: typeof DEFAULT_TEAMS;
  settings: {
    oversPerInnings: number;
    allOutWickets: number;
    squadMin: number;
    squadMax: number;
    playingXI: number;
    startingPurse: number;
    powerplayEnabled?: boolean;
    powerplayOvers?: number;
    overseasMaxXI?: number;
    impactPlayerEnabled?: boolean;
    scoreProfile?: ScoreProfile;
  };
  current_season: number;
}

export const DEFAULT_SETTINGS: League["settings"] = {
  oversPerInnings: 20,
  allOutWickets: 10,
  squadMin: 18,
  squadMax: 25,
  playingXI: 11,
  startingPurse: 100,
  powerplayEnabled: true,
  powerplayOvers: 4,
  overseasMaxXI: 4,
  impactPlayerEnabled: true,
  scoreProfile: "200+",
};

/** Insert players in safe chunks of 200 to avoid any payload/param limits. */
async function seedPlayersForLeague(leagueId: string): Promise<void> {
  const players = SEED_POOL.map(p => ({
    league_id: leagueId,
    name: p.name,
    role: p.role,
    base_price: p.base_price,
    rating: p.rating,
    nationality: p.nationality ?? "IND",
    pfp_url: playerPhoto(p.name),
  }));

  const CHUNK = 200;
  for (let i = 0; i < players.length; i += CHUNK) {
    const chunk = players.slice(i, i + CHUNK);
    const { error } = await supabase.from("players").insert(chunk);
    if (error) {
      console.error(`[league] Player seed chunk ${i}–${i + CHUNK} failed:`, error.message);
      // continue — partial seed is better than crashing, and we check count below
    }
  }
}

export async function getOrCreateLeague(): Promise<League> {
  const device_id = getDeviceId();
  const { data: { user } } = await supabase.auth.getUser();

  // Prefer an owned league for this user; otherwise fall back to a device-only league.
  let existing: any = null;
  if (user) {
    const { data } = await supabase
      .from("leagues")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    existing = data;
  }
  if (!existing) {
    // Try unclaimed device-id league first
    const { data: unclaimed } = await supabase
      .from("leagues")
      .select("*")
      .eq("device_id", device_id)
      .is("owner_id", null)
      .maybeSingle();
    existing = unclaimed;
    // Also try a claimed-by-anyone league on this device (safety net when session expired)
    if (!existing) {
      const { data: claimed } = await supabase
        .from("leagues")
        .select("*")
        .eq("device_id", device_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      existing = claimed;
    }
    // If signed in and we just found a device-only league, claim it.
    if (existing && user && !existing.owner_id) {
      await supabase.from("leagues").update({ owner_id: user.id }).eq("id", existing.id);
      existing.owner_id = user.id;
    }
  }

  if (existing) {
    // Auto-heal: if the player pool is missing or tiny, re-seed now.
    const { count } = await supabase
      .from("players")
      .select("*", { count: "exact", head: true })
      .eq("league_id", existing.id);

    if ((count ?? 0) < SEED_POOL.length * 0.5) {
      console.info(`[league] Under-seeded league ${existing.id} (${count} players) — re-seeding now…`);
      // Delete whatever partial rows are there and start fresh
      await supabase.from("players").delete().eq("league_id", existing.id);
      await seedPlayersForLeague(existing.id);
    }

    const merged = { ...DEFAULT_SETTINGS, ...(existing.settings as any) };
    return { ...(existing as any), settings: merged } as unknown as League;
  }

  const { data: created, error } = await supabase
    .from("leagues")
    .insert({
      device_id,
      owner_id: user?.id ?? null,
      name: "Indian Premier League",
      teams: DEFAULT_TEAMS as unknown as never,
      settings: DEFAULT_SETTINGS as unknown as never,
    })
    .select()
    .single();

  if (error || !created) throw error ?? new Error("League creation failed");

  await seedPlayersForLeague(created.id);

  return created as unknown as League;
}
