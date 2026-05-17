// Form & momentum tracking — last 5 innings per player + within-match momentum.
import { supabase } from "@/integrations/supabase/client";

export interface FormEntry {
  match_id: string;
  season: number;
  runs?: number;
  balls?: number;
  wickets?: number;
  conceded?: number;
  bowlBalls?: number;
}

/** Compute "form rating" 0-100 from last 5 innings. */
export function formRating(form: FormEntry[], role: "BAT" | "BOWL" | "AR" | "WK"): number {
  if (!form || form.length === 0) return 60;
  const last = form.slice(-5);
  if (role === "BOWL") {
    const wkts = last.reduce((a, f) => a + (f.wickets ?? 0), 0);
    const econs = last.filter(f => (f.bowlBalls ?? 0) > 0).map(f => ((f.conceded ?? 0) / (f.bowlBalls ?? 1)) * 6);
    const econ = econs.length ? econs.reduce((a, b) => a + b, 0) / econs.length : 8;
    return Math.max(20, Math.min(99, 60 + wkts * 5 - (econ - 8) * 4));
  }
  const runs = last.reduce((a, f) => a + (f.runs ?? 0), 0);
  const balls = last.reduce((a, f) => a + (f.balls ?? 0), 0);
  const sr = balls ? (runs / balls) * 100 : 100;
  return Math.max(20, Math.min(99, 50 + (runs / last.length - 12) * 1.5 + (sr - 130) * 0.3));
}

/** Append a form entry & cap to last 10. */
export async function recordForm(playerId: string, entry: FormEntry) {
  const { data: p } = await supabase.from("players").select("form").eq("id", playerId).maybeSingle();
  const arr: FormEntry[] = ((p?.form as any) ?? []).concat([entry]).slice(-10);
  await supabase.from("players").update({ form: arr as any }).eq("id", playerId);
}

/** Within-match momentum (-100..+100) from last 6 balls of an innings. */
export function momentum(ballEvents: { runs: number; isWicket: boolean }[]): number {
  const last = ballEvents.slice(-6);
  if (!last.length) return 0;
  let m = 0;
  last.forEach(b => {
    if (b.isWicket) m -= 25;
    else if (b.runs >= 6) m += 18;
    else if (b.runs >= 4) m += 12;
    else if (b.runs === 0) m -= 5;
    else m += b.runs * 2;
  });
  return Math.max(-100, Math.min(100, m));
}
