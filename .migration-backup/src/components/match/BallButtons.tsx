// Quick-tap ball input grid + selectable extras
import { Button } from "@/components/ui/button";
import type { BallEvent } from "@/lib/matchEngine";
import { useState } from "react";

interface Props { onBall: (ev: BallEvent) => void; disabled?: boolean; }

export function BallButtons({ onBall, disabled }: Props) {
  const [showWicket, setShowWicket] = useState(false);

  if (showWicket) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground uppercase tracking-widest">Wicket type</div>
        <div className="grid grid-cols-3 gap-2">
          {(["Bowled","Caught","LBW","Stumped","Run Out","Hit Wicket"] as const).map(h => (
            <Button key={h} variant="destructive" disabled={disabled}
              onClick={() => { onBall({ kind: "wicket", how: h }); setShowWicket(false); }}>
              {h}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowWicket(false)}>Cancel</Button>
      </div>
    );
  }

  const runBtn = (n: 0|1|2|3|4|6) => (
    <Button key={n} disabled={disabled} onClick={() => onBall({ kind: "run", runs: n })}
      variant={n === 4 ? "default" : n === 6 ? "default" : "secondary"}
      className={`h-14 text-xl font-display tracking-wider
        ${n === 4 ? "gradient-four text-background hover:opacity-90" : ""}
        ${n === 6 ? "gradient-six text-foreground hover:opacity-90" : ""}
      `}>
      {n}
    </Button>
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {([0,1,2,3] as const).map(runBtn)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {runBtn(4)}
        {runBtn(6)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" disabled={disabled} onClick={() => onBall({ kind: "wide" })} className="border-[hsl(var(--extra))]/50 text-[hsl(var(--extra))]">WIDE</Button>
        <Button variant="outline" disabled={disabled} onClick={() => onBall({ kind: "nb" })} className="border-[hsl(var(--extra))]/50 text-[hsl(var(--extra))]">NO BALL</Button>
        <Button variant="destructive" disabled={disabled} onClick={() => setShowWicket(true)} className="gradient-wicket">WICKET</Button>
      </div>
    </div>
  );
}
