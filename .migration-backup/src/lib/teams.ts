// Team registry — real 10 IPL franchises (editable via Chairman).
export type TeamId = string;

export interface TeamConfig {
  id: TeamId;
  shortName: string;
  fullName: string;
  colorVar: string; // CSS var name without --
  primary: string;  // hsl()
  home?: string;    // home city
}

export const DEFAULT_TEAMS: TeamConfig[] = [
  { id: "CSK",  shortName: "CSK",  fullName: "Chennai Super Kings",        colorVar: "csk",  primary: "hsl(48 100% 50%)",  home: "Chennai"   },
  { id: "MI",   shortName: "MI",   fullName: "Mumbai Indians",             colorVar: "mi",   primary: "hsl(215 80% 45%)",  home: "Mumbai"    },
  { id: "RCB",  shortName: "RCB",  fullName: "Royal Challengers Bengaluru",colorVar: "rcb",  primary: "hsl(0 75% 48%)",    home: "Bengaluru" },
  { id: "KKR",  shortName: "KKR",  fullName: "Kolkata Knight Riders",      colorVar: "kkr",  primary: "hsl(270 55% 45%)",  home: "Kolkata"   },
  { id: "SRH",  shortName: "SRH",  fullName: "Sunrisers Hyderabad",        colorVar: "srh",  primary: "hsl(22 95% 55%)",   home: "Hyderabad" },
  { id: "RR",   shortName: "RR",   fullName: "Rajasthan Royals",           colorVar: "rr",   primary: "hsl(330 70% 55%)",  home: "Jaipur"    },
  { id: "DC",   shortName: "DC",   fullName: "Delhi Capitals",             colorVar: "dc",   primary: "hsl(220 75% 55%)",  home: "Delhi"     },
  { id: "PBKS", shortName: "PBKS", fullName: "Punjab Kings",               colorVar: "pbks", primary: "hsl(355 80% 55%)",  home: "Mohali"    },
  { id: "GT",   shortName: "GT",   fullName: "Gujarat Titans",             colorVar: "gt",   primary: "hsl(200 50% 25%)",  home: "Ahmedabad" },
  { id: "LSG",  shortName: "LSG",  fullName: "Lucknow Super Giants",       colorVar: "lsg",  primary: "hsl(195 85% 50%)",  home: "Lucknow"   },
];

export function teamColor(id: TeamId, teams: TeamConfig[] = DEFAULT_TEAMS): string {
  const t = teams.find(x => x.id === id);
  return t?.primary ?? "hsl(var(--primary))";
}

export function teamFull(id: TeamId, teams: TeamConfig[] = DEFAULT_TEAMS): string {
  return teams.find(x => x.id === id)?.fullName ?? id;
}

/** Logo / crest for a team using DiceBear shapes — deterministic + free. */
export function teamCrest(id: TeamId): string {
  const url = new URL(`https://api.dicebear.com/9.x/shapes/svg`);
  url.searchParams.set("seed", id);
  url.searchParams.set("size", "128");
  return url.toString();
}
