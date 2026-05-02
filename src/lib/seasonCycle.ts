// Season cycle — mega (year 1, 5, 9..) vs mini (in-between) IPL-20 style.
export interface SeasonCycleConfig {
  type: "mega" | "mini";
  purse: number;
  retentionAllowed: boolean;
  maxRetentions: number;
  retentionCostScale: number; // mini auctions: keep at original purchase price
}

/** Returns config for a given season number (1-indexed). Mega every 4th season. */
export function seasonCycleFor(seasonNumber: number): SeasonCycleConfig {
  // Season 1, 5, 9, 13... are mega
  const isMega = seasonNumber === 1 || (seasonNumber - 1) % 4 === 0;
  if (isMega) {
    return { type: "mega", purse: 70, retentionAllowed: false, maxRetentions: 0, retentionCostScale: 1 };
  }
  return { type: "mini", purse: 50, retentionAllowed: true, maxRetentions: 4, retentionCostScale: 1 };
}

export function nextSeasonCycle(currentSeasonNumber: number): SeasonCycleConfig {
  return seasonCycleFor(currentSeasonNumber + 1);
}
