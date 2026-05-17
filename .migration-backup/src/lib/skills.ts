// Player skills system — auto-derived from rating, editable via Chairman.
import type { Role } from "./seedPlayers";

export interface PlayerAttrs {
  // Batting
  power: number;        // boundary-hitting strength (0-100)
  timing: number;       // shot quality, vs pace
  consistency: number;  // dot-ball avoidance, low dismissal chance
  finishing: number;    // performance under pressure / death overs
  // Bowling
  pace: number;         // raw speed (0 for spinners)
  spin: number;         // spin variation
  control: number;      // economy, dot rate
  death: number;        // death-over execution
  // Fielding
  reflex: number;       // run-out / direct hit chance
  catch: number;        // catch completion %
  // Mental
  pressure: number;     // performance in clutch moments
}

export type Personality = "aggressive" | "anchor" | "finisher" | "clutch" | "defensive" | "swashbuckler" | "workhorse" | "death-specialist" | "spin-wizard" | "all-out-attack";

const clamp = (n: number, lo = 30, hi = 99) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Auto-derive balanced attrs from a player's overall rating + role. */
export function deriveAttrs(rating: number, role: Role, seed?: string): PlayerAttrs {
  // Deterministic jitter from name seed (so same player always gets same attrs)
  const s = seed ?? "x";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  const rand = (k: number) => {
    const x = Math.sin(h + k) * 10000;
    return (x - Math.floor(x)); // 0..1
  };
  const j = (k: number, range = 8) => Math.round((rand(k) - 0.5) * range);

  const base = rating;
  // Role-weighted derivation
  if (role === "BAT") {
    return {
      power: clamp(base + j(1, 14)),
      timing: clamp(base + 2 + j(2)),
      consistency: clamp(base - 3 + j(3)),
      finishing: clamp(base - 5 + j(4, 18)),
      pace: clamp(40 + j(5, 10), 30, 60),
      spin: clamp(40 + j(6, 10), 30, 60),
      control: clamp(45 + j(7, 12), 30, 65),
      death: clamp(50 + j(8, 12), 30, 70),
      reflex: clamp(base - 10 + j(9)),
      catch: clamp(base - 8 + j(10)),
      pressure: clamp(base - 6 + j(11, 14)),
    };
  }
  if (role === "BOWL") {
    const isSpin = rand(99) < 0.45;
    return {
      power: clamp(45 + j(1, 18), 30, 70),
      timing: clamp(50 + j(2, 14), 30, 70),
      consistency: clamp(50 + j(3, 12), 30, 75),
      finishing: clamp(45 + j(4, 16), 30, 70),
      pace: isSpin ? clamp(35 + j(5, 8), 30, 55) : clamp(base + j(5, 10)),
      spin: isSpin ? clamp(base + j(6, 10)) : clamp(35 + j(6, 8), 30, 55),
      control: clamp(base + j(7, 10)),
      death: clamp(base - 4 + j(8, 14)),
      reflex: clamp(base - 8 + j(9, 12)),
      catch: clamp(base - 12 + j(10, 14)),
      pressure: clamp(base - 5 + j(11, 14)),
    };
  }
  if (role === "AR") {
    return {
      power: clamp(base - 4 + j(1, 14)),
      timing: clamp(base - 5 + j(2, 12)),
      consistency: clamp(base - 4 + j(3, 12)),
      finishing: clamp(base - 6 + j(4, 16)),
      pace: clamp(base - 6 + j(5, 14)),
      spin: clamp(base - 8 + j(6, 14)),
      control: clamp(base - 4 + j(7, 12)),
      death: clamp(base - 6 + j(8, 14)),
      reflex: clamp(base - 4 + j(9, 12)),
      catch: clamp(base - 4 + j(10, 12)),
      pressure: clamp(base - 5 + j(11, 14)),
    };
  }
  // WK
  return {
    power: clamp(base - 4 + j(1, 14)),
    timing: clamp(base - 2 + j(2, 12)),
    consistency: clamp(base - 4 + j(3, 12)),
    finishing: clamp(base - 6 + j(4, 18)),
    pace: clamp(40 + j(5, 10), 30, 60),
    spin: clamp(40 + j(6, 10), 30, 60),
    control: clamp(45 + j(7, 12), 30, 65),
    death: clamp(50 + j(8, 12), 30, 70),
    reflex: clamp(base + 4 + j(9, 8)),
    catch: clamp(base + 6 + j(10, 8)),
    pressure: clamp(base - 4 + j(11, 14)),
  };
}

export function derivePersonality(rating: number, attrs: PlayerAttrs, role: Role): Personality {
  if (role === "BAT") {
    if (attrs.finishing >= 85 && attrs.pressure >= 80) return "finisher";
    if (attrs.power >= 88) return "swashbuckler";
    if (attrs.consistency >= 85) return "anchor";
    if (attrs.power >= 80) return "aggressive";
    return "defensive";
  }
  if (role === "BOWL") {
    if (attrs.death >= 85) return "death-specialist";
    if (attrs.spin >= 80) return "spin-wizard";
    if (attrs.control >= 85) return "workhorse";
    if (attrs.pace >= 85) return "all-out-attack";
    return "aggressive";
  }
  if (attrs.pressure >= 80) return "clutch";
  return "all-out-attack";
}

export function ensureAttrs(p: { id?: string; name: string; role: Role; rating: number; attrs?: PlayerAttrs | null; personality?: string | null }): { attrs: PlayerAttrs; personality: Personality } {
  const valid = p.attrs && typeof (p.attrs as any).power === "number";
  const attrs = valid ? (p.attrs as PlayerAttrs) : deriveAttrs(p.rating, p.role, p.id ?? p.name);
  const personality = (p.personality as Personality) ?? derivePersonality(p.rating, attrs, p.role);
  return { attrs, personality };
}

/** Pretty label for display. */
export const PERSONALITY_LABEL: Record<Personality, string> = {
  aggressive: "Aggressive",
  anchor: "The Anchor",
  finisher: "Finisher",
  clutch: "Clutch Player",
  defensive: "Defensive",
  swashbuckler: "Swashbuckler",
  workhorse: "Workhorse",
  "death-specialist": "Death Specialist",
  "spin-wizard": "Spin Wizard",
  "all-out-attack": "All-Out Attack",
};
