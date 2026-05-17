// Real team logo registry. Imports compiled assets so they ship via Vite hashed URLs.
import csk from "@/assets/logos/csk.png";
import mi from "@/assets/logos/mi.png";
import rcb from "@/assets/logos/rcb.png";
import kkr from "@/assets/logos/kkr.png";
import srh from "@/assets/logos/srh.png";
import rr from "@/assets/logos/rr.png";
import dc from "@/assets/logos/dc.png";
import pbks from "@/assets/logos/pbks.png";
import gt from "@/assets/logos/gt.png";
import lsg from "@/assets/logos/lsg.png";

const LOGOS: Record<string, string> = {
  CSK: csk, MI: mi, RCB: rcb, KKR: kkr, SRH: srh,
  RR: rr, DC: dc, PBKS: pbks, GT: gt, LSG: lsg,
};

/** Real franchise logo URL. Falls back to the legacy DiceBear crest for unknown teams. */
export function teamLogo(teamId: string): string {
  if (LOGOS[teamId]) return LOGOS[teamId];
  // fallback for custom teams added via Chairman
  const url = new URL(`https://api.dicebear.com/9.x/shapes/svg`);
  url.searchParams.set("seed", teamId);
  url.searchParams.set("size", "256");
  return url.toString();
}
