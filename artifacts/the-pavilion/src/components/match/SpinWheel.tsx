// Spinning wheel ball-result picker
import { useState } from "react";
import { Button } from "@/components/ui/button";

const SEGMENTS = [
  { label: "0", color: "hsl(var(--muted))" },
  { label: "1", color: "hsl(var(--secondary))" },
  { label: "2", color: "hsl(var(--secondary))" },
  { label: "4", color: "hsl(var(--boundary))" },
  { label: "1", color: "hsl(var(--secondary))" },
  { label: "6", color: "hsl(var(--six))" },
  { label: "0", color: "hsl(var(--muted))" },
  { label: "W", color: "hsl(var(--wicket))" },
  { label: "1", color: "hsl(var(--secondary))" },
  { label: "WD", color: "hsl(var(--extra))" },
  { label: "4", color: "hsl(var(--boundary))" },
  { label: "NB", color: "hsl(var(--extra))" },
];

interface Props { onResult: (label: string) => void; disabled?: boolean; }

export function SpinWheel({ onResult, disabled }: Props) {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const seg = 360 / SEGMENTS.length;

  function spin() {
    if (spinning || disabled) return;
    setSpinning(true);
    const idx = Math.floor(Math.random() * SEGMENTS.length);
    const turns = 5 + Math.random() * 3;
    const target = turns * 360 + (360 - idx * seg - seg / 2);
    const newAngle = angle + target;
    setAngle(newAngle);
    setTimeout(() => {
      setSpinning(false);
      onResult(SEGMENTS[idx].label);
    }, 3200);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-56 h-56">
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-primary z-10" />
        <svg viewBox="0 0 200 200" className="w-full h-full transition-transform duration-[3000ms] ease-out drop-shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
             style={{ transform: `rotate(${angle}deg)` }}>
          {SEGMENTS.map((s, i) => {
            const a1 = (i * seg - 90) * Math.PI / 180;
            const a2 = ((i + 1) * seg - 90) * Math.PI / 180;
            const x1 = 100 + 95 * Math.cos(a1), y1 = 100 + 95 * Math.sin(a1);
            const x2 = 100 + 95 * Math.cos(a2), y2 = 100 + 95 * Math.sin(a2);
            const tx = 100 + 60 * Math.cos((a1 + a2) / 2);
            const ty = 100 + 60 * Math.sin((a1 + a2) / 2);
            return (
              <g key={i}>
                <path d={`M100,100 L${x1},${y1} A95,95 0 0,1 ${x2},${y2} Z`} fill={s.color} stroke="hsl(var(--background))" strokeWidth="1.5" />
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="bold" fill="hsl(var(--foreground))"
                      transform={`rotate(${(i + 0.5) * seg}, ${tx}, ${ty})`}>{s.label}</text>
              </g>
            );
          })}
          <circle cx="100" cy="100" r="14" fill="hsl(var(--primary))" />
        </svg>
      </div>
      <Button onClick={spin} disabled={spinning || disabled} size="lg" className="gradient-primary text-primary-foreground font-display text-lg tracking-wider w-full">
        {spinning ? "Spinning…" : "🎡 Spin the Ball"}
      </Button>
    </div>
  );
}
