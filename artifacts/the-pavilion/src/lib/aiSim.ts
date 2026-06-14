// AI ball-by-ball simulator — uses player skills, form, momentum, pressure, death-overs.
import type { BallEvent } from "./matchEngine";
import type { PlayerAttrs, Personality } from "./skills";

export interface SimContext {
  // Batter
  batPower: number;        // 0-100
  batTiming: number;
  batConsistency: number;
  batFinishing: number;
  batPersonality: Personality;
  batterRuns: number;      // current innings runs of batter
  batterBalls: number;
  // Bowler
  bowlPace: number;
  bowlSpin: number;
  bowlControl: number;
  bowlDeath: number;
  bowlPersonality: Personality;
  // Match state
  isDeath: boolean;        // last over of innings?
  isPowerplay?: boolean;   // first N overs (chairman rule)
  pressure: number;        // 0-100; rises in chase / low wkts
  difficulty: "easy" | "normal" | "hard" | "pro";
  isFreeHit: boolean;
  /** Chairman dial — biases scoring intent. */
  scoreProfile?: "150+" | "200+" | "250+" | "300+";
  /** Captaincy / leadership of batting captain (0-100) — small impact on stability. */
  battingCaptaincy?: number;
  /** Bowling captain leadership (0-100) — small impact on dot/wicket chance. */
  bowlingCaptaincy?: number;
  /** Home Fortress — batting team is playing at their home ground (+boundary, -wicket). */
  homeAdvantage?: boolean;
}

export interface SimOutcomeProb {
  dot: number;
  one: number;
  two: number;
  three: number;
  four: number;
  six: number;
  wide: number;
  nb: number;
  wicket: number;
}

/** Build outcome probabilities from skills & context. Returns weights summing to 1. */
export function buildProbs(ctx: SimContext): SimOutcomeProb {
  // Base T20-ish distribution
  let p = { dot: 30, one: 30, two: 8, three: 1, four: 12, six: 6, wide: 3, nb: 1, wicket: 9 };

  // Batter influence
  const batScore = (ctx.batPower + ctx.batTiming) / 2;
  // Boundary chance scales with power; dot scales inversely with timing
  p.six += (ctx.batPower - 70) * 0.18;
  p.four += (ctx.batPower - 70) * 0.12 + (ctx.batTiming - 70) * 0.06;
  p.dot -= (ctx.batTiming - 70) * 0.18;
  p.one += (ctx.batConsistency - 70) * 0.12;
  // Wicket chance drops with consistency
  p.wicket -= (ctx.batConsistency - 70) * 0.12;

  // Bowler influence
  // Pace bowler with control suppresses runs
  p.dot += (ctx.bowlControl - 70) * 0.22;
  p.four -= (ctx.bowlControl - 70) * 0.10;
  p.six -= (ctx.bowlControl - 70) * 0.08;
  p.wicket += (Math.max(ctx.bowlPace, ctx.bowlSpin) - 70) * 0.12;
  p.wide += (70 - ctx.bowlControl) * 0.05;
  p.nb += (70 - ctx.bowlControl) * 0.02;

  // Death-over modifier
  if (ctx.isDeath) {
    p.six += (ctx.batFinishing - 70) * 0.15;
    p.four += (ctx.batFinishing - 70) * 0.10;
    p.dot -= (ctx.batFinishing - 70) * 0.10;
    // bowler's death rating reverses it
    p.dot += (ctx.bowlDeath - 70) * 0.12;
    p.six -= (ctx.bowlDeath - 70) * 0.10;
    // overall scoring intent rises
    p.wicket += 1.5; // batters take risks
  }

  // Powerplay modifier — fielding restrictions strongly bias toward boundaries
  // and aggressive intent. Wickets also rise as batters take more risk.
  if (ctx.isPowerplay) {
    p.four += 5.5;
    p.six += 3.0;
    p.dot -= 4.5;
    p.one -= 1.2;
    p.two += 0.4;
    p.wicket += 1.4;
    // Bowler control matters less under restrictions
    p.dot -= Math.max(0, (ctx.bowlControl - 70) * 0.10);
  }

  // Personality flavor
  if (ctx.batPersonality === "swashbuckler" || ctx.batPersonality === "all-out-attack") {
    p.six += 2; p.four += 1.5; p.dot -= 1.5; p.wicket += 1;
  }
  if (ctx.batPersonality === "anchor" || ctx.batPersonality === "defensive") {
    p.dot += 2; p.one += 1; p.six -= 1.5; p.four -= 1; p.wicket -= 0.5;
  }
  if (ctx.batPersonality === "finisher" && ctx.isDeath) {
    p.six += 3; p.four += 1.5; p.wicket -= 0.5;
  }
  if (ctx.bowlPersonality === "death-specialist" && ctx.isDeath) {
    p.dot += 2; p.six -= 2; p.wicket += 1;
  }
  if (ctx.bowlPersonality === "spin-wizard") {
    p.wicket += 0.8; p.six -= 0.5;
  }

  // Pressure modifier — high pressure → more dots/wickets unless clutch personality
  const pressureFactor = ctx.pressure / 100;
  if (ctx.batPersonality === "clutch" || ctx.batPersonality === "finisher") {
    p.six += pressureFactor * 1.5;
    p.four += pressureFactor * 1.2;
  } else {
    p.wicket += pressureFactor * 1.5;
    p.dot += pressureFactor * 1.5;
    p.six -= pressureFactor * 1;
  }

  // Settled batter bonus (after 5 balls)
  if (ctx.batterBalls >= 5) {
    p.dot -= 1; p.four += 0.5; p.six += 0.3;
  }

  // Free hit → no wicket possible
  if (ctx.isFreeHit) {
    p.wicket = 0; p.six += 3; p.four += 2;
  }

  // Difficulty
  if (ctx.difficulty === "easy") { p.wicket *= 0.6; p.six += 1; p.four += 1; }
  if (ctx.difficulty === "hard") { p.wicket *= 1.4; p.dot += 2; p.six -= 1; }
  if (ctx.difficulty === "pro")  { /* realistic */ }

  // Score-profile convergence — biases scoring intent toward an expected total.
  // Now driven per-match (see matchScoreTarget in Match page) so games vary
  // wildly: 50, 120, 180, 240, 300+ are all possible.
  if (ctx.scoreProfile) {
    const targetMap = { "150+": 150, "200+": 200, "250+": 250, "300+": 300 } as const;
    const target = targetMap[ctx.scoreProfile];
    const intensity = (target - 100) / 200; // 0..1 for 100..300
    if (target >= 200) {
      p.four += 1.5 + intensity * 2;
      p.six += 1.0 + intensity * 2.5;
      p.dot -= 1.5 + intensity * 2;
      p.wicket *= (1 - intensity * 0.15);
    } else if (target >= 150) {
      // par chase — leave neutral
    } else {
      // collapse / low-scoring grind
      p.dot += 4;
      p.four -= 2; p.six -= 2.2; p.one += 0.6;
      p.wicket *= 1.25;
    }
    // randomness — sometimes an upset, sometimes a thriller
    const variance = (Math.random() - 0.5) * 2; // -1..1
    p.four += variance * 0.8;
    p.six += variance * 0.6;
    p.dot -= variance * 0.6;
  }
  // Captaincy nudges (small)
  if (typeof ctx.bowlingCaptaincy === "number") {
    const k = (ctx.bowlingCaptaincy - 70) * 0.04;
    p.dot += k; p.wicket += k * 0.5; p.four -= k * 0.4;
  }
  if (typeof ctx.battingCaptaincy === "number") {
    const k = (ctx.battingCaptaincy - 70) * 0.04;
    p.wicket -= k * 0.4; p.one += k * 0.3;
  }

  // 🏟️ Home Fortress — batting at home stadium gives slight edge
  if (ctx.homeAdvantage) {
    p.four += 1.2;
    p.six += 0.8;
    p.dot -= 1.0;
    p.wicket -= 1.2;
    p.one += 0.4;
  }

  // Clamp non-negative
  for (const k of Object.keys(p) as (keyof SimOutcomeProb)[]) p[k] = Math.max(0.1, p[k]);

  // Normalize
  const sum = Object.values(p).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(p) as (keyof SimOutcomeProb)[]) p[k] = p[k] / sum;
  return p;
}

/** Sample a ball outcome from the probability distribution. */
export function sampleOutcome(probs: SimOutcomeProb): { event: BallEvent; label: string } {
  const r = Math.random();
  let acc = 0;
  const order: (keyof SimOutcomeProb)[] = ["dot","one","two","three","four","six","wide","nb","wicket"];
  for (const k of order) {
    acc += probs[k];
    if (r <= acc) {
      switch (k) {
        case "dot":   return { event: { kind: "run", runs: 0 }, label: "0" };
        case "one":   return { event: { kind: "run", runs: 1 }, label: "1" };
        case "two":   return { event: { kind: "run", runs: 2 }, label: "2" };
        case "three": return { event: { kind: "run", runs: 3 }, label: "3" };
        case "four":  return { event: { kind: "run", runs: 4 }, label: "4" };
        case "six":   return { event: { kind: "run", runs: 6 }, label: "6" };
        case "wide":  return { event: { kind: "wide" }, label: "WD" };
        case "nb":    return { event: { kind: "nb", offBat: 0 }, label: "NB" };
        case "wicket": {
          // Pick wicket type based on weights
          const types: BallEvent["kind"] extends "wicket" ? any : any[] = ["Caught","Bowled","LBW","Stumped","Run Out"];
          const w = [0.45, 0.25, 0.13, 0.05, 0.12];
          const rr = Math.random(); let aa = 0;
          let how: any = "Caught";
          for (let i = 0; i < types.length; i++) { aa += w[i]; if (rr <= aa) { how = types[i]; break; } }
          return { event: { kind: "wicket", how }, label: "W" };
        }
      }
    }
  }
  return { event: { kind: "run", runs: 0 }, label: "0" };
}

/** Estimate pressure for current state (0-100). */
export function computePressure(opts: {
  innings: 1 | 2;
  runs: number; wickets: number; legalBalls: number; oversTotal: number; allOutWkts: number;
  target?: number;
}): number {
  if (opts.innings === 1) {
    // Pressure on batting side: low-ish unless wickets falling fast
    const wktPressure = (opts.wickets / opts.allOutWkts) * 50;
    return Math.min(70, wktPressure);
  }
  if (!opts.target) return 30;
  const ballsLeft = opts.oversTotal * 6 - opts.legalBalls;
  const need = opts.target - opts.runs;
  if (ballsLeft <= 0 || need <= 0) return 0;
  const reqRR = need / (ballsLeft / 6);
  const wktsLeft = opts.allOutWkts - opts.wickets;
  // higher RR & fewer wickets → higher pressure
  let p = 30 + (reqRR - 8) * 6 + (5 - wktsLeft) * 6;
  return Math.max(10, Math.min(95, p));
}

/** Build commentary line given outcome and chosen style. */
export function aiCommentary(args: {
  outcome: string;
  batter: string;
  bowler: string;
  runs: number;
  isWicket: boolean;
  isExtra?: boolean;
  isPowerplay?: boolean;
  style: "normal" | "hype" | "funny" | "serious";
}): string {
  const { batter, bowler, runs, isWicket, style, outcome, isPowerplay } = args;
  const ppTag = isPowerplay ? "⚡PP " : "";
  if (isWicket) {
    if (style === "hype")    return `${ppTag}🚨 GONEEEE! ${bowler} sends ${batter} packing! UTTER CARNAGE! 🔥`;
    if (style === "funny")   return `${ppTag}😂 Bye-bye ${batter}! Walk back, the dressing room misses you!`;
    if (style === "serious") return `${ppTag}${batter} dismissed off ${bowler}. Crucial breakthrough at this stage.`;
    return `${ppTag}🎯 WICKET! ${bowler} cleans up ${batter}!`;
  }
  if (outcome === "WD") return `${ppTag}` + (style === "funny" ? `😅 Wide! ${bowler} sprayed it down leg.` : `Wide called by the umpire.`);
  if (outcome === "NB") return `${ppTag}` + (style === "hype" ? `⚠️ NO BALL! Free hit incoming — DRAMA TIME!` : `No ball — free hit next.`);
  if (runs === 6) {
    if (style === "hype")    return `${ppTag}💥 MAXIMUM!! ${batter} launches it into the stands!! WHAT A SHOT!`;
    if (style === "funny")   return `${ppTag}🚀 ${batter} sent that into orbit. Someone find the ball!`;
    if (style === "serious") return `${ppTag}${batter} clears the rope — clean strike off ${bowler}.`;
    return `${ppTag}🚀 SIX! ${batter} crunches it${isPowerplay ? " — powerplay punishment!" : ""}!`;
  }
  if (runs === 4) {
    if (style === "hype")    return `${ppTag}🔥 FOUR!! Beautifully timed by ${batter}${isPowerplay ? " — fielders pinned in!" : ""}!`;
    if (style === "funny")   return `${ppTag}🏃 Fielder didn't even bother chasing that one!`;
    if (style === "serious") return `${ppTag}${batter} threads the gap for four${isPowerplay ? " inside the powerplay" : ""}.`;
    return `${ppTag}💥 FOUR! ${batter} finds the boundary!`;
  }
  if (runs === 0) {
    if (style === "funny")  return `${ppTag}🥱 Dot ball. Yawn.`;
    if (style === "hype")   return `${ppTag}🛑 Dot! ${bowler} keeps the pressure on!`;
    if (style === "serious")return `${ppTag}Defended back to ${bowler}. Building pressure.`;
    return `${ppTag}Dot ball${isPowerplay ? " — rare in the powerplay." : "."}`;
  }
  return `${ppTag}${runs} run${runs > 1 ? "s" : ""} taken by ${batter}.`;
}
