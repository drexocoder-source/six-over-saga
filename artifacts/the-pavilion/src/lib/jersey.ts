// Deterministic team jerseys per (team, season). Uses DiceBear "shapes" with seeded variation.
// Refreshes every season — same team gets a new look each year.
import { teamColor } from "./teams";

export function jerseyUrl(teamId: string, season: number, size = 256): string {
  const url = new URL("https://api.dicebear.com/9.x/shapes/svg");
  url.searchParams.set("seed", `${teamId}-S${season}`);
  url.searchParams.set("size", String(size));
  return url.toString();
}

/** A pure-CSS jersey "kit" used as a fallback / preview tile. Returns inline style + JSX-friendly props. */
export function jerseyTile(teamId: string, season: number) {
  const color = teamColor(teamId);
  const variant = (season + teamId.charCodeAt(0)) % 4;
  const accent = ["255 255 255", "0 0 0", "250 204 21", "234 88 12"][variant];
  return {
    bg: color,
    accent: `rgb(${accent})`,
    pattern: variant,
  };
}
