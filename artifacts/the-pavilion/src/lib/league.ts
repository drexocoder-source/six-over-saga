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
    overseasMaxXI?: number;       // max overseas in playing XI
    impactPlayerEnabled?: boolean;// 1 substitution allowed mid-match
    scoreProfile?: ScoreProfile;  // chairman dial that biases AI sim
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
  powerplayOvers: 4,        // overs 1–4 (matches old IPL inner-fielding rules close enough for sim)
  overseasMaxXI: 4,
  impactPlayerEnabled: true,
  scoreProfile: "200+",
};

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

  // Seed players with photos
  const players = SEED_POOL.map(p => ({
    league_id: created.id,
    name: p.name,
    role: p.role,
    base_price: p.base_price,
    rating: p.rating,
    nationality: p.nationality ?? "IND",
    pfp_url: playerPhoto(p.name),
  }));
  await supabase.from("players").insert(players);

  return created as unknown as League;
}
