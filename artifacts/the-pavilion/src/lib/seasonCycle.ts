// Season cycle — IPL-style mega (year 1, 5, 9..) vs mini auctions.
// Retention pricing brackets mirror IPL 2025: each retention slot has a fixed cost.
export interface RetentionBracket {
  /** Cost in ₹cr per retention slot, in order (1st, 2nd, 3rd...). */
  costs: number[];
  /** Uncapped (emerging) retention slot — cheaper. */
  uncappedCost: number;
}

export interface SeasonCycleConfig {
  type: "mega" | "mini";
  purse: number;          // total purse in ₹cr
  retentionAllowed: boolean;
  minRetentions: number;
  maxRetentions: number;
  /** RTM (Right-to-match) cards available — for mega only. */
  rtmCards: number;
  retention: RetentionBracket;
}

// Mega auction (IPL 2025 style): purse 120cr, up to 6 retentions (incl. RTM), capped retention costs 18/14/11 + 18/14
const MEGA_RETENTION: RetentionBracket = {
  costs: [18, 14, 11, 18, 14], // 3 capped + 2 capped slots beyond, IPL style
  uncappedCost: 4,             // 1 uncapped slot
};

// Mini auction: unlimited retentions (no count cap) — money simply deducts from purse at player price.
// We expose generous bracket costs that scale gracefully; any extra retentions are charged at the last bracket.
const MINI_RETENTION: RetentionBracket = {
  costs: [14, 11, 8, 6, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  uncappedCost: 3,
};

/** Returns config for a given season number (1-indexed). Mega every 4th season. */
export function seasonCycleFor(seasonNumber: number): SeasonCycleConfig {
  const isMega = seasonNumber === 1 || (seasonNumber - 1) % 4 === 0;
  if (isMega) {
    return {
      type: "mega",
      purse: 120,
      retentionAllowed: seasonNumber > 1,
      minRetentions: 0,
      // Mega: hard cap 5 retentions total (≥1 must be uncapped — enforced in UI).
      maxRetentions: 5,
      rtmCards: 2,
      retention: MEGA_RETENTION,
    };
  }
  return {
    type: "mini",
    purse: 90,
    retentionAllowed: true,
    minRetentions: 0,
    // Mini auctions have no count cap — purse naturally limits retentions.
    maxRetentions: 99,
    rtmCards: 0,
    retention: MINI_RETENTION,
  };
}

export function nextSeasonCycle(currentSeasonNumber: number): SeasonCycleConfig {
  return seasonCycleFor(currentSeasonNumber + 1);
}

/**
 * Compute the retention cost for the Nth retained player (1-indexed),
 * given whether the player counts as uncapped (rating < 75 / debut season).
 * Cost is deducted from the auction purse.
 */
export function retentionCost(cfg: SeasonCycleConfig, indexOneBased: number, uncapped = false): number {
  if (uncapped) return cfg.retention.uncappedCost;
  const arr = cfg.retention.costs;
  return arr[Math.min(indexOneBased - 1, arr.length - 1)];
}

/** Total deduction summary for a team's retention list (in selection order). */
export function totalRetentionCost(cfg: SeasonCycleConfig, players: { uncapped?: boolean }[]): number {
  // Capped first by IPL rule, then uncapped. Sort to match.
  const capped = players.filter(p => !p.uncapped);
  const unc = players.filter(p => p.uncapped);
  let sum = 0;
  capped.forEach((_, i) => { sum += retentionCost(cfg, i + 1, false); });
  unc.forEach(() => { sum += cfg.retention.uncappedCost; });
  return sum;
}
