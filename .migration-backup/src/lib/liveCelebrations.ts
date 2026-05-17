// Detect celebration-worthy events from the latest engine state diff.
import type { MatchEngineState, InningsState } from "./matchEngine";
import type { CelebrationEvent } from "@/components/match/CelebrationOverlay";

export interface CelebrationTrackerState {
  fiftyDone: Set<string>;
  centuryDone: Set<string>;
  fiveWktDone: Set<string>;
  hatTrickDone: Set<string>;
  team100Done: Set<string>;
  team200Done: Set<string>;
  /** consecutive boundaries by current striker (resets on dot/wicket/strike-change) */
  consecBoundaries: number;
  /** consecutive sixes anyone (resets after a non-six legal ball) */
  consecSixes: number;
  /** wickets-in-a-row per bowler — last 3 events */
  bowlerLastEvents: Record<string, ("W" | "0" | "R" | "X")[]>;
}

export function newCelebrationTracker(): CelebrationTrackerState {
  return {
    fiftyDone: new Set(),
    centuryDone: new Set(),
    fiveWktDone: new Set(),
    hatTrickDone: new Set(),
    team100Done: new Set(),
    team200Done: new Set(),
    consecBoundaries: 0,
    consecSixes: 0,
    bowlerLastEvents: {},
  };
}

/**
 * Inspect the current innings AFTER applying a ball and emit celebrations.
 * Returns 0..N events to flash. Mutates tracker.
 */
export function detectCelebrations(
  state: MatchEngineState,
  tracker: CelebrationTrackerState,
  lastBall: {
    isFour?: boolean; isSix?: boolean; isWicket?: boolean; isExtra?: boolean;
    bowlerId?: string; strikerId?: string;
  },
): CelebrationEvent[] {
  const events: CelebrationEvent[] = [];
  const inn: InningsState = state.currentInnings === 1 ? state.innings1 : state.innings2!;
  const teamKey = `${inn.battingTeam}-${state.currentInnings}`;

  // Batting milestones — striker BEFORE ball is the one credited
  // Use the player whose entry got the runs added (lastBall.strikerId is the striker who faced)
  const strikerId = lastBall.strikerId ?? inn.strikerId;
  const bs = inn.bat[strikerId];
  if (bs) {
    const fkey = `${teamKey}-${strikerId}`;
    if (bs.runs >= 50 && bs.runs < 100 && !tracker.fiftyDone.has(fkey)) {
      tracker.fiftyDone.add(fkey);
      events.push({
        id: `fifty-${fkey}-${Date.now()}`,
        kind: "fifty",
        title: "FIFTY!",
        subtitle: `${bs.name} — ${bs.runs} off ${bs.balls} (${bs.fours}×4, ${bs.sixes}×6)`,
      });
    }
    if (bs.runs >= 100 && !tracker.centuryDone.has(fkey)) {
      tracker.centuryDone.add(fkey);
      events.push({
        id: `century-${fkey}-${Date.now()}`,
        kind: "century",
        title: "CENTURY!",
        subtitle: `${bs.name} — ${bs.runs} off ${bs.balls} (${bs.fours}×4, ${bs.sixes}×6)`,
      });
    }
  }

  // Bowler milestones
  const bowlerId = lastBall.bowlerId ?? inn.bowlerId;
  const bw = inn.bowl[bowlerId];
  if (bw) {
    const wkey = `${teamKey}-${bowlerId}`;

    // Five-wicket haul
    if (bw.wickets >= 5 && !tracker.fiveWktDone.has(wkey)) {
      tracker.fiveWktDone.add(wkey);
      events.push({
        id: `5w-${wkey}-${Date.now()}`,
        kind: "five_wicket",
        title: "FIVE-FOR!",
        subtitle: `${bw.name} — ${bw.wickets}/${bw.runs}`,
      });
    }

    // Hat-trick: 3 wickets in 3 consecutive legal balls by same bowler
    if (lastBall.isWicket || (!lastBall.isExtra)) {
      const log = tracker.bowlerLastEvents[bowlerId] ?? [];
      const tag: "W" | "0" | "R" | "X" =
        lastBall.isExtra ? "X" :
        lastBall.isWicket ? "W" : "R";
      log.push(tag);
      tracker.bowlerLastEvents[bowlerId] = log.slice(-5);
      const last3 = log.slice(-3);
      if (last3.length === 3 && last3.every(t => t === "W") && !tracker.hatTrickDone.has(wkey + "-" + bw.wickets)) {
        tracker.hatTrickDone.add(wkey + "-" + bw.wickets);
        events.push({
          id: `hattrick-${wkey}-${Date.now()}`,
          kind: "hat_trick",
          title: "HAT-TRICK!",
          subtitle: `${bw.name} on fire — ${bw.wickets}/${bw.runs}`,
        });
      }
    }
  }

  // Boundary streak (4 in a row by current striker) & back-to-back sixes
  if (lastBall.isFour || lastBall.isSix) {
    tracker.consecBoundaries += 1;
    if (lastBall.isSix) tracker.consecSixes += 1; else tracker.consecSixes = 0;

    if (tracker.consecBoundaries === 4) {
      events.push({
        id: `bstreak-${Date.now()}`,
        kind: "boundary_streak",
        title: "BOUNDARY STREAK!",
        subtitle: `4 boundaries in a row — ${bs?.name ?? "Striker"} on fire`,
      });
    }
    if (tracker.consecSixes === 2) {
      events.push({
        id: `b2bsix-${Date.now()}`,
        kind: "back_to_back_six",
        title: "BACK-TO-BACK SIXES!",
        subtitle: `${bs?.name ?? "Striker"} clearing the rope at will`,
      });
    }
  } else if (!lastBall.isExtra) {
    // a non-boundary legal ball resets streaks
    tracker.consecBoundaries = 0;
    tracker.consecSixes = 0;
  }

  // Team milestones
  if (inn.runs >= 100 && !tracker.team100Done.has(teamKey)) {
    tracker.team100Done.add(teamKey);
    events.push({
      id: `t100-${teamKey}-${Date.now()}`,
      kind: "team_100",
      title: `${inn.battingTeam} 100 UP!`,
      subtitle: `${inn.runs}/${inn.wickets} in ${Math.floor(inn.legalBalls / 6)}.${inn.legalBalls % 6} ov`,
    });
  }
  if (inn.runs >= 200 && !tracker.team200Done.has(teamKey)) {
    tracker.team200Done.add(teamKey);
    events.push({
      id: `t200-${teamKey}-${Date.now()}`,
      kind: "team_200",
      title: `${inn.battingTeam} 200!`,
      subtitle: `${inn.runs}/${inn.wickets} — what a total brewing`,
    });
  }

  return events;
}
