import { useMemo } from "react";

interface JerseyCardProps {
  teamName: string;
  primaryColor: string;
  secondaryColor?: string;
  seasonNumber?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const PATTERNS = [
  // Stripes
  (cx: string, cy: string) => `<path d="M68 0L100 32V120H68V0Z" fill="${cy}" opacity="0.9"/>`,
  // Diagonal band
  (cx: string, cy: string) => `<path d="M0 60L100 0V40L0 100Z" fill="${cy}" opacity="0.8"/>`,
  // V-neck accent
  (cx: string, cy: string) => `<path d="M30 0L50 30L70 0H30Z" fill="${cy}" opacity="0.9"/>`,
  // Side panels
  (cx: string, cy: string) => `<path d="M0 0H20V120H0Z" fill="${cy}" opacity="0.7"/><path d="M80 0H100V120H80Z" fill="${cy}" opacity="0.7"/>`,
  // Chevron
  (cx: string, cy: string) => `<path d="M0 45L50 70L100 45V60L50 85L0 60Z" fill="${cy}" opacity="0.8"/>`,
  // Horizontal band
  (cx: string, cy: string) => `<path d="M0 35H100V60H0Z" fill="${cy}" opacity="0.75"/>`,
  // Diamond center
  (cx: string, cy: string) => `<path d="M50 20L70 55L50 90L30 55Z" fill="${cy}" opacity="0.75"/>`,
  // Cross pattern
  (cx: string, cy: string) => `<path d="M40 0H60V120H40Z" fill="${cy}" opacity="0.5"/><path d="M0 50H100V70H0Z" fill="${cy}" opacity="0.5"/>`,
];

export function JerseyCard({ teamName, primaryColor, secondaryColor, seasonNumber, size = "md", showLabel = true }: JerseyCardProps) {
  const secondary = secondaryColor ?? "#ffffff";

  const pattern = useMemo(() => {
    const seed = hashStr(teamName + (seasonNumber ?? 0));
    const fn = PATTERNS[seed % PATTERNS.length];
    return fn(primaryColor, secondary);
  }, [teamName, seasonNumber, primaryColor, secondary]);

  const dims = size === "sm" ? 56 : size === "lg" ? 100 : 72;
  const svgH = Math.round(dims * 1.25);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 125" width="${dims}" height="${svgH}">
  <defs>
    <clipPath id="jersey-clip-${hashStr(teamName)}">
      <path d="M20 0L0 25V45H18V125H82V45H100V25L80 0C80 0 72 10 50 10C28 10 20 0 20 0Z"/>
    </clipPath>
  </defs>
  <g clip-path="url(#jersey-clip-${hashStr(teamName)})">
    <rect width="100" height="125" fill="${primaryColor}"/>
    ${pattern}
    <rect x="18" y="0" width="2" height="125" fill="${secondary}" opacity="0.2"/>
    <rect x="80" y="0" width="2" height="125" fill="${secondary}" opacity="0.2"/>
  </g>
  <path d="M20 0L0 25V45H18V125H82V45H100V25L80 0C80 0 72 10 50 10C28 10 50 10 20 0Z" fill="none" stroke="${secondary}" stroke-width="1.5" opacity="0.4"/>
</svg>`;

  return (
    <div className="flex flex-col items-center gap-1">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      {showLabel && (
        <div className="text-[10px] text-center font-display tracking-widest text-muted-foreground uppercase max-w-16 leading-tight">
          {seasonNumber != null && <span className="text-primary text-[9px]">S{seasonNumber} · </span>}
          {teamName.split(" ").slice(-1)[0]}
        </div>
      )}
    </div>
  );
}
