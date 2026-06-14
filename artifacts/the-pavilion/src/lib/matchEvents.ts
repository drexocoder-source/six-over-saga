// Match event utilities — separated from MatchEventBanner to satisfy Vite Fast Refresh rules.

export interface MatchEvent {
  id: string;
  type: "rain" | "floodlight" | "injury" | "drs" | "pitch" | "crowd";
  headline: string;
  detail: string;
  resumeDelay?: number;
}

const EVENT_POOL: Omit<MatchEvent, "id">[] = [
  { type: "rain",       headline: "Brief drizzle on the outfield!",      detail: "Ground staff rush the covers out. Umpires inspect and confirm play will resume shortly.", resumeDelay: 4000 },
  { type: "rain",       headline: "Shower threatens play!",              detail: "Light rain sweeps across the ground. The covers come on for a 3-minute delay. Players huddle at the boundary.", resumeDelay: 4000 },
  { type: "floodlight", headline: "Floodlight malfunction!",             detail: "One of the four towers blinks out momentarily. Engineers scramble. Full light restored — play resumes.", resumeDelay: 4000 },
  { type: "floodlight", headline: "Power flicker in the stands!",        detail: "Brief electrical fault causes a delay. The giant screen goes dark, then blazes back to life. Play on!", resumeDelay: 4000 },
  { type: "injury",     headline: "Batter takes a nasty blow!",          detail: "The ball catches the helmet grille. Physio rushes on. Medical check complete — all good to continue.", resumeDelay: 4000 },
  { type: "injury",     headline: "Fielder pulls up sharply!",           detail: "Hamstring twinge during a diving stop. The physio assesses — minor strain, he'll carry on.", resumeDelay: 4000 },
  { type: "drs",        headline: "REVIEW called! Replays rolling…",     detail: "Ball-tracking confirms the impact was outside off stump. Umpire's call stands — NOT OUT. Review retained.", resumeDelay: 4500 },
  { type: "drs",        headline: "DRS overturns the on-field call!",    detail: "Ultra-edge picks up a feather! Third umpire reverses the decision. Huge moment in the match!", resumeDelay: 4500 },
  { type: "pitch",      headline: "Pitch inspection called!",            detail: "A deep footmark near a good length is creating variable bounce. Umpires and groundsmen assess the surface.", resumeDelay: 4000 },
  { type: "pitch",      headline: "Surface roughed up in the crease!",   detail: "The batting crease has been severely worn. Brief delay for repairs. Pitch expected to assist spinners.", resumeDelay: 4000 },
  { type: "crowd",      headline: "Crowd invasion attempt stopped!",     detail: "A fan leaps the boundary rope and is swiftly escorted off by security. Play held up briefly.", resumeDelay: 3500 },
  { type: "crowd",      headline: "Mexican wave sweeps the stadium!",    detail: "The crowd unites in a massive Mexican wave — pure electricity in the stands. Players feed off the energy!", resumeDelay: 3000 },
];

export function pickMatchEvent(): MatchEvent {
  const base = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
  return { ...base, id: `${Date.now()}-${Math.random()}` };
}
