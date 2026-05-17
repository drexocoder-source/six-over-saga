// Realistic AI auction engine.
// Teams target squadMax (not min), drive bidding wars on marquee players,
// price most players above base, occasionally let players go unsold,
// and have personality-driven aggression.
import type { Role } from "./seedPlayers";

export interface AuctionPlayer {
  id: string;
  name: string;
  role: Role;
  base_price: number;
  rating: number;
  nationality?: string;
}

export interface TeamPurseState {
  teamId: string;
  purse: number;
  squad: { player_id: string; price: number; role: Role; rating: number }[];
}

export interface BidResult {
  winner: string | null;
  finalPrice: number;
  bidLog: { team: string; amount: number }[];
}

// Soft role targets per team (out of ~22 squad)
const ROLE_TARGETS = { BAT: 7, BOWL: 7, AR: 5, WK: 3 } as const;

// Per-team aggression personality (deterministic by teamId hash so it's stable across rounds)
function teamAggression(teamId: string): number {
  let h = 0;
  for (let i = 0; i < teamId.length; i++) h = (h * 31 + teamId.charCodeAt(i)) | 0;
  // 0.75 .. 1.30
  const r = (Math.abs(h) % 1000) / 1000;
  return 0.75 + r * 0.55;
}

export function teamNeedsRole(state: TeamPurseState, role: Role): number {
  const have = state.squad.filter(s => s.role === role).length;
  const target = ROLE_TARGETS[role];
  return Math.max(0, target - have);
}

/** Slots a team still wants to fill toward squadMax. */
export function slotsRemaining(state: TeamPurseState, squadMax: number): number {
  return Math.max(0, squadMax - state.squad.length);
}

/** Avg purse per remaining slot a team has. Used to decide when to be aggressive. */
function purseRunway(state: TeamPurseState, squadMax: number): number {
  const slots = slotsRemaining(state, squadMax);
  if (slots <= 0) return 0;
  return state.purse / slots;
}

export function canTeamBid(
  state: TeamPurseState,
  amount: number,
  squadMax: number
): boolean {
  if (state.squad.length >= squadMax) return false;
  // Reserve 0.3cr per remaining slot after this buy (cheaper floor than before)
  const slotsLeftAfter = squadMax - state.squad.length - 1;
  const reserve = slotsLeftAfter * 0.3;
  return state.purse - amount >= reserve;
}

/** A team's max willingness to pay for this player. */
function teamMaxBid(
  player: AuctionPlayer,
  s: TeamPurseState,
  squadMax: number,
): number {
  const aggression = teamAggression(s.teamId);

  // Marquee multiplier — superstars get 5-15× base
  const ratingGravity =
    player.rating >= 92 ? 1.0 :
    player.rating >= 88 ? 0.75 :
    player.rating >= 84 ? 0.55 :
    player.rating >= 80 ? 0.40 :
    player.rating >= 75 ? 0.25 : 0.10;

  // Need pull
  const need = teamNeedsRole(s, player.role);
  const have = s.squad.filter(x => x.role === player.role).length;
  const target = ROLE_TARGETS[player.role];
  const desperation = need > 0 ? (need / target) : (have >= target ? -0.4 : 0); // negative means already overstocked

  // Slot urgency — fewer remaining slots = more selective on stars only
  const slots = slotsRemaining(s, squadMax);
  const runway = purseRunway(s, squadMax);

  // Star value baseline (in crore) — what an average team would pay
  // 70 rating ~ 0.4cr,  80 ~ 1.5cr,  85 ~ 3.5cr, 90 ~ 8cr, 95 ~ 14cr
  const starValue = Math.max(
    player.base_price,
    Math.pow(Math.max(0, player.rating - 65) / 30, 2.6) * 18
  );

  // Composite cap
  let cap = starValue * (0.7 + ratingGravity * 0.6) * aggression;
  cap += desperation * 2.5;                  // need bonus
  cap *= 0.8 + Math.random() * 0.45;         // variance ±20-25%

  // Form-aware nudge: hot players from last season cost more, cold ones cost less.
  // `formBoost` is set on the player object by the auction page when it knows the value.
  const formBoost = (player as any).formBoost as number | undefined;
  if (typeof formBoost === "number") {
    cap *= 1 + formBoost; // e.g. +0.25 means +25% willingness
  }

  // Don't outspend runway too hard on non-marquee
  if (player.rating < 85) {
    cap = Math.min(cap, runway * 1.8);
  } else {
    // For stars, allow up to 4× runway if team genuinely wants them
    cap = Math.min(cap, runway * 4);
  }

  // Hard cap — purse minus reserve
  const reserve = Math.max(0, slots - 1) * 0.3;
  cap = Math.min(cap, s.purse - reserve);

  // Don't over-stack a role beyond target+2
  if (have >= target + 2) cap = Math.min(cap, player.base_price * 0.9);

  // Floor at base only if interested at all
  return Math.max(0, cap);
}

/** How interested is this team in actually engaging the bidding? */
function interestScore(player: AuctionPlayer, s: TeamPurseState, squadMax: number): number {
  if (!canTeamBid(s, player.base_price, squadMax)) return 0;
  if (slotsRemaining(s, squadMax) <= 0) return 0;

  const need = teamNeedsRole(s, player.role);
  const have = s.squad.filter(x => x.role === player.role).length;
  const target = ROLE_TARGETS[player.role];
  const overstocked = have - target;

  let score = 0;
  // Rating gravity — every team interested in 90+ players
  if (player.rating >= 90) score += 1.5;
  else if (player.rating >= 85) score += 1.0;
  else if (player.rating >= 80) score += 0.7;
  else if (player.rating >= 75) score += 0.4;
  else score += 0.15;

  // Need
  score += need * 0.5;
  if (overstocked > 0) score -= overstocked * 0.6;

  // Aggression personality
  score *= teamAggression(s.teamId);

  // Some randomness — not every team is in on every player
  score += (Math.random() - 0.5) * 0.4;

  return score;
}

/** Simulate AI bidding for one player. Realistic bidding war. */
export function runAIBidRound(
  player: AuctionPlayer,
  states: TeamPurseState[],
  squadMax: number,
  manualOverride?: { teamId: string; maxBid: number }
): BidResult {
  const log: { team: string; amount: number }[] = [];

  // Score interest per team
  const interest = new Map<string, number>();
  const caps = new Map<string, number>();
  for (const s of states) {
    interest.set(s.teamId, interestScore(player, s, squadMax));
    caps.set(s.teamId, teamMaxBid(player, s, squadMax));
  }

  if (manualOverride) {
    interest.set(manualOverride.teamId, 99);
    caps.set(
      manualOverride.teamId,
      Math.max(caps.get(manualOverride.teamId) ?? 0, manualOverride.maxBid)
    );
  }

  // Interest threshold — only marquee players have wide interest
  const minInterest = player.rating >= 88 ? 0.5 : player.rating >= 80 ? 0.7 : 0.9;
  let active = states
    .filter(s => (interest.get(s.teamId) ?? 0) >= minInterest)
    .filter(s => (caps.get(s.teamId) ?? 0) >= player.base_price)
    .map(s => s.teamId);

  if (active.length === 0) {
    return { winner: null, finalPrice: 0, bidLog: [] };
  }

  // Bidding starts at base price. First bidder = highest interest.
  let currentPrice = player.base_price;
  let currentWinner: string | null = null;

  const rank = (t: string) => interest.get(t) ?? 0;
  active.sort((a, b) => rank(b) - rank(a));
  currentWinner = active[0];
  log.push({ team: currentWinner, amount: currentPrice });

  // Iterative bidding
  let safety = 60;
  while (active.length > 1 && safety-- > 0) {
    // Increment scales with current price
    const inc =
      currentPrice < 1 ? 0.1 :
      currentPrice < 2 ? 0.2 :
      currentPrice < 5 ? 0.25 :
      currentPrice < 10 ? 0.5 : 1;

    const nextPrice = +(currentPrice + inc).toFixed(2);

    // Who else (not currentWinner) is willing to raise to nextPrice?
    const challengers = active
      .filter(t => t !== currentWinner)
      .filter(t => (caps.get(t) ?? 0) >= nextPrice)
      // Probabilistic dropout — not every challenger keeps raising every increment
      .filter(t => {
        const cap = caps.get(t) ?? 0;
        if (cap === 0) return false;
        // The closer to their cap, the more likely they drop
        const headroom = (cap - currentPrice) / cap;
        // Marquee players see more persistence
        const persistence = player.rating >= 88 ? 0.85 : player.rating >= 80 ? 0.75 : 0.6;
        return Math.random() < headroom * persistence + 0.1;
      })
      .sort((a, b) => rank(b) - rank(a));

    if (challengers.length === 0) break;

    const next = challengers[0];
    currentPrice = nextPrice;
    currentWinner = next;
    log.push({ team: next, amount: currentPrice });

    // Drop teams that have hit their cap
    active = active.filter(t => (caps.get(t) ?? 0) >= currentPrice + inc * 0.5 || t === currentWinner);
  }

  return { winner: currentWinner, finalPrice: currentPrice, bidLog: log };
}

/** Auto-fill remaining slots toward squadMax (not just min) using base/cheap prices. */
export function autoFillSquads(
  states: TeamPurseState[],
  remainingPool: AuctionPlayer[],
  squadMin: number,
  squadMax?: number,
): { teamId: string; player: AuctionPlayer; price: number }[] {
  const target = squadMax ?? squadMin;
  const assignments: { teamId: string; player: AuctionPlayer; price: number }[] = [];
  const pool = [...remainingPool].sort((a, b) => b.rating - a.rating);

  // First pass: satisfy role minimums
  for (const role of ["BOWL","BAT","AR","WK"] as Role[]) {
    for (const s of states) {
      while (teamNeedsRole(s, role) > 0 && s.squad.length < squadMin) {
        const idx = pool.findIndex(p => p.role === role);
        if (idx === -1) break;
        const p = pool.splice(idx, 1)[0];
        const price = p.base_price;
        if (s.purse < price) break;
        s.purse -= price;
        s.squad.push({ player_id: p.id, price, role: p.role, rating: p.rating });
        assignments.push({ teamId: s.teamId, player: p, price });
      }
    }
  }

  // Second pass: top up toward squadMax with best available, balanced by role
  let progress = true;
  while (progress) {
    progress = false;
    for (const s of states) {
      if (s.squad.length >= target) continue;
      // Pick best available player whose role isn't already overstocked
      const idx = pool.findIndex(p => {
        const have = s.squad.filter(x => x.role === p.role).length;
        return have < ROLE_TARGETS[p.role] + 1 && s.purse >= p.base_price;
      });
      if (idx === -1) continue;
      const p = pool.splice(idx, 1)[0];
      const price = p.base_price;
      s.purse -= price;
      s.squad.push({ player_id: p.id, price, role: p.role, rating: p.rating });
      assignments.push({ teamId: s.teamId, player: p, price });
      progress = true;
    }
  }

  return assignments;
}
