// Match engine — 20-over T20 cricket. Pure functions + types.
import type { Role } from "./seedPlayers";

export type BallEvent =
  | { kind: "run"; runs: 0 | 1 | 2 | 3 | 4 | 6 }
  | { kind: "wide"; runs?: number }      // extra runs beyond the 1
  | { kind: "nb"; offBat?: 0 | 1 | 2 | 3 | 4 | 6 }
  | { kind: "wicket"; how: "Bowled" | "Caught" | "LBW" | "Stumped" | "Run Out" | "Hit Wicket"; runsCompleted?: number };

export interface PlayerLite {
  id: string;
  name: string;
  role: Role;
  rating: number;
  team_id: string;
}

export interface BatStat {
  player_id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  outDesc?: string;
  bowler_id?: string;
}

export interface BowlStat {
  player_id: string;
  name: string;
  balls: number; // legal deliveries
  runs: number;
  wickets: number;
  fours: number;
  sixes: number;
  wides: number;
  noBalls: number;
  dots: number;
}

export interface InningsState {
  battingTeam: string;
  bowlingTeam: string;
  runs: number;
  wickets: number;
  legalBalls: number;     // total legal deliveries bowled
  extras: { wides: number; nb: number; total: number };
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  bat: Record<string, BatStat>;
  bowl: Record<string, BowlStat>;
  battingOrder: string[];     // player ids in order they came in
  nextBatterIdx: number;      // index into batting playing-XI list
  ballEvents: { over: number; ball: number; text: string; runs: number; isWicket: boolean; isBoundary?: 4 | 6 }[];
  done: boolean;
  doneReason?: "allOut" | "oversComplete" | "chaseDone";
}

export interface MatchEngineState {
  matchId: string;
  oversPerInnings: number;
  allOutWickets: number;
  playingXI: number;
  powerplayOvers?: number; // if >0, first N overs are powerplay
  teamA: string;
  teamB: string;
  battingFirst: string;
  innings1: InningsState;
  innings2?: InningsState;
  currentInnings: 1 | 2;
  target?: number;
  result?: { winner: string | null; text: string; tie: boolean };
  // playing XI per team
  xi: Record<string, PlayerLite[]>;
  // bowler usage (player_id -> legal balls bowled this innings) reset each innings
}

export function isPowerplayBall(state: MatchEngineState, legalBalls: number): boolean {
  const pp = state.powerplayOvers ?? 0;
  if (pp <= 0) return false;
  // Powerplay covers balls 0 .. pp*6-1 (i.e. before delivery legalBalls < pp*6)
  return legalBalls < pp * 6;
}

// ---------- factories ----------
export function newBat(p: PlayerLite): BatStat {
  return { player_id: p.id, name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
}
export function newBowl(p: PlayerLite): BowlStat {
  return { player_id: p.id, name: p.name, balls: 0, runs: 0, wickets: 0, fours: 0, sixes: 0, wides: 0, noBalls: 0, dots: 0 };
}

export function startInnings(opts: {
  battingTeam: string; bowlingTeam: string;
  openers: [PlayerLite, PlayerLite]; bowler: PlayerLite;
  battingXI: PlayerLite[];
}): InningsState {
  const [a, b] = opts.openers;
  return {
    battingTeam: opts.battingTeam,
    bowlingTeam: opts.bowlingTeam,
    runs: 0, wickets: 0, legalBalls: 0,
    extras: { wides: 0, nb: 0, total: 0 },
    strikerId: a.id, nonStrikerId: b.id, bowlerId: opts.bowler.id,
    bat: { [a.id]: newBat(a), [b.id]: newBat(b) },
    bowl: { [opts.bowler.id]: newBowl(opts.bowler) },
    battingOrder: [a.id, b.id],
    nextBatterIdx: 2,
    ballEvents: [],
    done: false,
  };
}

// ---------- core: apply a ball ----------
export function applyBall(
  state: MatchEngineState,
  ev: BallEvent,
  battingXI: PlayerLite[],
  opts?: { newBatterId?: string }   // pre-chosen incoming batter for wicket
): { state: MatchEngineState; needsBatter: boolean; needsBowler: boolean; commentary: string; events: { isFour?: boolean; isSix?: boolean; isWicket?: boolean; isExtra?: boolean } } {
  const inn = state.currentInnings === 1 ? state.innings1 : state.innings2!;
  if (inn.done) return { state, needsBatter: false, needsBowler: false, commentary: "Innings already complete.", events: {} };

  const striker = inn.bat[inn.strikerId];
  const bowler = inn.bowl[inn.bowlerId];
  let runsThisBall = 0;
  let isLegal = true;
  let extraType: "wd" | "nb" | undefined;
  let runsOffBat = 0;
  let isFour = false, isSix = false, isWicket = false, isExtra = false;
  let commentary = "";
  let needsBatter = false;
  let wicketEntry: { name: string; how: string } | null = null;

  switch (ev.kind) {
    case "run": {
      runsOffBat = ev.runs;
      runsThisBall = ev.runs;
      striker.runs += ev.runs;
      striker.balls += 1;
      bowler.balls += 1;
      bowler.runs += ev.runs;
      if (ev.runs === 4) { striker.fours += 1; bowler.fours += 1; isFour = true; }
      if (ev.runs === 6) { striker.sixes += 1; bowler.sixes += 1; isSix = true; }
      if (ev.runs === 0) bowler.dots += 1;
      commentary = ev.runs === 0 ? `Dot ball.` :
        ev.runs === 4 ? `FOUR! ${striker.name} finds the gap!` :
        ev.runs === 6 ? `SIX!! Massive hit by ${striker.name}!` :
        `${ev.runs} run${ev.runs>1?"s":""} taken by ${striker.name}.`;
      break;
    }
    case "wide": {
      isLegal = false;
      isExtra = true;
      extraType = "wd";
      const w = 1 + (ev.runs ?? 0);
      runsThisBall = w;
      bowler.runs += w;
      bowler.wides += 1;
      inn.extras.wides += w;
      inn.extras.total += w;
      commentary = `WIDE — ${w} run${w>1?"s":""}.`;
      break;
    }
    case "nb": {
      isLegal = false;
      isExtra = true;
      extraType = "nb";
      const off = ev.offBat ?? 0;
      runsThisBall = 1 + off;
      striker.balls += 0; // not credited as ball
      striker.runs += off;
      bowler.runs += 1 + off;
      bowler.noBalls += 1;
      inn.extras.nb += 1;
      inn.extras.total += 1;
      if (off === 4) { striker.fours += 1; bowler.fours += 1; isFour = true; }
      if (off === 6) { striker.sixes += 1; bowler.sixes += 1; isSix = true; }
      commentary = off > 0 ? `NO BALL + ${off} off the bat!` : `NO BALL — free hit incoming!`;
      runsOffBat = off;
      break;
    }
    case "wicket": {
      isWicket = true;
      striker.balls += 1;
      bowler.balls += 1;
      const completed = ev.runsCompleted ?? 0;
      striker.runs += completed;
      bowler.runs += completed;
      runsThisBall = completed;
      runsOffBat = completed;
      striker.out = true;
      striker.outDesc = `${ev.how} b ${bowler.name}`;
      striker.bowler_id = bowler.player_id;
      // Run-out & stumping technically not credited to bowler in real cricket; we'll credit stumping & bowled-style outs only:
      if (ev.how !== "Run Out") bowler.wickets += 1;
      inn.wickets += 1;
      wicketEntry = { name: striker.name, how: ev.how };
      commentary = `WICKETTT! ${striker.name} ${ev.how.toLowerCase()} — gone for ${striker.runs}.`;
      break;
    }
  }

  inn.runs += runsThisBall;
  if (isLegal) inn.legalBalls += 1;

  // Strike rotation on odd run totals (off the bat only on legal)
  if (!isWicket && (ev.kind === "run") && runsOffBat % 2 === 1) {
    [inn.strikerId, inn.nonStrikerId] = [inn.nonStrikerId, inn.strikerId];
  }
  if (ev.kind === "nb" && runsOffBat % 2 === 1) {
    [inn.strikerId, inn.nonStrikerId] = [inn.nonStrikerId, inn.strikerId];
  }

  // End of over → swap strike, request new bowler
  let needsBowler = false;
  if (isLegal && inn.legalBalls % 6 === 0 && inn.legalBalls < state.oversPerInnings * 6) {
    [inn.strikerId, inn.nonStrikerId] = [inn.nonStrikerId, inn.strikerId];
    needsBowler = true;
  }

  // Rule checker: an innings can ONLY end for one of three reasons.
  // We assert this invariant whenever we set `done` below, and `assertInningsValid`
  // can be called by the UI before any innings transition for an extra safety net.
  // Wicket: bring in next batter (unless all out).
  // IMPORTANT: only auto-assign a new batter when the caller explicitly passes
  // `opts.newBatterId`. Otherwise, return `needsBatter: true` and let the UI flow
  // (manual picker / auto-mode driver) assign the next batter via a separate
  // confirm call. Auto-assigning here used to consume an extra batter from the
  // order on every wicket (engine picked one, UI then picked another), which
  // caused innings to end "all-out" prematurely around 4–6 wickets.
  if (isWicket) {
    if (inn.wickets >= state.allOutWickets) {
      inn.done = true; inn.doneReason = "allOut";
    } else if (opts?.newBatterId) {
      const nextId = opts.newBatterId;
      const nextP = battingXI.find(p => p.id === nextId);
      if (nextP) {
        inn.bat[nextId] = newBat(nextP);
        inn.battingOrder.push(nextId);
        inn.strikerId = nextId;
        inn.nextBatterIdx = battingXI.findIndex(p => p.id === nextId) + 1;
      }
    } else {
      // No batter supplied — leave strikerId as-is; caller must handle
      // `needsBatter: true` (see return value) and call back with a chosen batter.
      // Only mark all-out if there are literally no XI batters left who haven't batted.
      const remaining = battingXI.filter(p => !inn.bat[p.id]);
      if (remaining.length === 0) {
        inn.done = true; inn.doneReason = "allOut";
      }
    }
  }

  // Overs complete?
  if (!inn.done && inn.legalBalls >= state.oversPerInnings * 6) {
    inn.done = true; inn.doneReason = "oversComplete";
    needsBowler = false;
  }

  // Chase complete?
  if (state.currentInnings === 2 && state.target !== undefined && inn.runs >= state.target && !inn.done) {
    inn.done = true; inn.doneReason = "chaseDone";
  }

  // ball event log
  const overNow = Math.floor((inn.legalBalls === 0 && !isLegal ? 0 : (inn.legalBalls - (isLegal ? 1 : 0))) / 6);
  const ballNow = isLegal ? ((inn.legalBalls - 1) % 6) + 1 : ((inn.legalBalls % 6) + 1);
  inn.ballEvents.push({
    over: overNow, ball: ballNow,
    text: extraType === "wd" ? "WD" : extraType === "nb" ? "NB" : isWicket ? "W" : String(runsOffBat),
    runs: runsThisBall, isWicket,
    isBoundary: isFour ? 4 : isSix ? 6 : undefined,
  });

  return { state, needsBatter: isWicket && !inn.done, needsBowler, commentary, events: { isFour, isSix, isWicket, isExtra } };
}

export function ballsToOvers(legalBalls: number): string {
  const o = Math.floor(legalBalls / 6);
  const b = legalBalls % 6;
  return `${o}.${b}`;
}

export function runRate(runs: number, legalBalls: number): number {
  if (legalBalls === 0) return 0;
  return +(runs / (legalBalls / 6)).toFixed(2);
}

export function reqRR(target: number, runsScored: number, legalBalls: number, oversTotal: number): number {
  const ballsLeft = oversTotal * 6 - legalBalls;
  if (ballsLeft <= 0) return 99;
  return +(((target - runsScored) / (ballsLeft / 6)).toFixed(2));
}

// ---------- Win Probability (heuristic for T20) ----------
export function winProb(state: MatchEngineState): { batting: number; bowling: number } {
  if (state.currentInnings === 1) {
    // Use projected score vs avg-ish (~30)
    const inn = state.innings1;
    const proj = inn.legalBalls === 0 ? 170 : (inn.runs / inn.legalBalls) * (state.oversPerInnings * 6);
    const wktsLeft = state.allOutWickets - inn.wickets;
    const adj = proj + wktsLeft * 4;
    const battingProb = Math.max(15, Math.min(85, 50 + (adj - 175) * 0.5));
    return { batting: Math.round(battingProb), bowling: Math.round(100 - battingProb) };
  }
  const inn = state.innings2!;
  const target = state.target ?? 0;
  const need = target - inn.runs;
  const ballsLeft = state.oversPerInnings * 6 - inn.legalBalls;
  const wktsLeft = state.allOutWickets - inn.wickets;
  if (need <= 0) return { batting: 100, bowling: 0 };
  if (wktsLeft === 0 || ballsLeft === 0) return { batting: 0, bowling: 100 };
  const reqRunRate = need / (ballsLeft / 6);
  const par = 9; // roughly par RR for T20 chase
  let p = 50 - (reqRunRate - par) * 6 + (wktsLeft - 2) * 4 + (ballsLeft - 6) * 0.5;
  p = Math.max(2, Math.min(98, p));
  return { batting: Math.round(p), bowling: Math.round(100 - p) };
}
