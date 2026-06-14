// Hidden Wonderkid system — generates 1-2 young prodigies each season.
import { supabase } from "@/integrations/supabase/client";

export interface Wonderkid {
  id: string;
  name: string;
  age: number;
  nationality: string;
  role: string;
  currentRating: number;
  potential: number; // 85-99
  discoveredSeason: number;
  teamId?: string;
  trait: string;
}

const FIRST_NAMES = [
  "Aryan","Dev","Vihaan","Aarav","Rohan","Karan","Arjun","Vivaan","Aditya","Ishaan",
  "Prithvi","Shubman","Yashasvi","Tilak","Ruturaj","Abhishek","Sai","Raj","Neil","Dhruv",
  "Luca","Marco","Seb","Gio","Ahmed","Hassan","Yusuf","Tariq","Bilal","Zain",
];
const LAST_NAMES = [
  "Sharma","Singh","Patel","Kumar","Verma","Gupta","Yadav","Joshi","Shah","Mehta",
  "Chahal","Pandya","Iyer","Gaikwad","Padikkal","Bishnoi","Sakariya","Sahu","Baig","Khan",
];
const ROLES = ["BAT", "BOWL", "AR", "WK"] as const;
const NATIONALITIES = ["Indian","Indian","Indian","Indian","Indian","Indian","Indian","Indian","West Indian","Australian"];
const TRAITS = [
  "Fearless strokemaker","Ice-cool under pressure","Natural match-winner",
  "Prodigious talent","Death-over specialist","Wristy spin wizard",
  "Aggressive opener","Gifted all-rounder","Brilliant fielder-batter","Raw pace sensation",
];

function randomName() {
  const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${fn} ${ln}`;
}

/** Generate 1-3 wonderkids for the start of a new season. */
export function generateWonderkids(seasonNumber: number): Wonderkid[] {
  const count = Math.random() < 0.5 ? 1 : Math.random() < 0.7 ? 2 : 3;
  return Array.from({ length: count }, (_, i) => {
    const potential = Math.floor(Math.random() * 14) + 86; // 86-99
    const currentRating = Math.floor(potential * (0.55 + Math.random() * 0.2)); // 55-75% of potential
    return {
      id: `wk-s${seasonNumber}-${i}-${Date.now()}`,
      name: randomName(),
      age: Math.floor(Math.random() * 5) + 16, // 16-20
      nationality: NATIONALITIES[Math.floor(Math.random() * NATIONALITIES.length)],
      role: ROLES[Math.floor(Math.random() * ROLES.length)],
      currentRating,
      potential,
      discoveredSeason: seasonNumber,
      trait: TRAITS[Math.floor(Math.random() * TRAITS.length)],
    };
  });
}

/** Persist wonderkids to the players table as regular players (base_price discounted). */
export async function seedWonderkidsToPool(wonderkids: Wonderkid[], leagueId: string) {
  const rows = wonderkids.map(w => ({
    league_id: leagueId,
    name: w.name,
    role: w.role,
    nationality: w.nationality,
    rating: w.currentRating,
    base_price: 0.3,
    is_overseas: w.nationality !== "Indian",
    personality: "big_match",
    form: [],
  }));
  const { data, error } = await supabase.from("players").insert(rows as any).select("id, name");
  if (error) console.warn("[Wonderkids] seed failed", error);
  return data ?? [];
}

/** Storage key for the current-session wonderkid announcements. */
export const WONDERKIDS_STORAGE_KEY = "pavilion_wonderkids";

export function getStoredWonderkids(): Wonderkid[] {
  try {
    const raw = localStorage.getItem(WONDERKIDS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function storeWonderkids(wks: Wonderkid[]) {
  localStorage.setItem(WONDERKIDS_STORAGE_KEY, JSON.stringify(wks));
}

export function clearWonderkids() {
  localStorage.removeItem(WONDERKIDS_STORAGE_KEY);
}
