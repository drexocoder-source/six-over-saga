// Post-match "Super Sixes" — biggest sixes (and 4s) with timestamps.
import { Card } from "@/components/ui/card";
import type { MatchEngineState } from "@/lib/matchEngine";
import { playerPhoto } from "@/lib/seedPlayers";

interface Moment {
  type: "SIX" | "FOUR";
  over: number; ball: number;
  innings: 1 | 2;
  batter: string;
  bowler: string;
  team: string;
}

export function SuperSixes({ state, teamColorFn }: { state: MatchEngineState; teamColorFn: (id: string) => string }) {
  const moments: Moment[] = [];
  ([state.innings1, state.innings2!] as const).forEach((inn, idx) => {
    if (!inn) return;
    inn.ballEvents.forEach(ev => {
      if (ev.isBoundary !== 6 && ev.isBoundary !== 4) return;
      const bowler = inn.bowl[inn.bowlerId]?.name ?? "—";
      const batter = inn.bat[inn.strikerId]?.name ?? "—";
      moments.push({
        type: ev.isBoundary === 6 ? "SIX" : "FOUR",
        over: ev.over, ball: ev.ball,
        innings: (idx + 1) as 1 | 2,
        batter, bowler, team: inn.battingTeam,
      });
    });
  });

  const sixes = moments.filter(m => m.type === "SIX");
  const fours = moments.filter(m => m.type === "FOUR");
  if (sixes.length + fours.length === 0) return null;

  return (
    <Card className="p-5 gradient-card border-primary/40 glow-primary animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-primary">Highlights Reel</div>
          <div className="font-display text-2xl">🚀 Super Sixes & Boundaries</div>
        </div>
        <div className="text-xs text-muted-foreground">
          <b className="text-foreground">{sixes.length}</b> sixes · <b className="text-foreground">{fours.length}</b> fours
        </div>
      </div>

      {sixes.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Maximums</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {sixes.slice(0, 12).map((m, i) => (
              <MomentTile key={`s${i}`} m={m} teamColorFn={teamColorFn} />
            ))}
          </div>
        </div>
      )}

      {fours.length > 0 && (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Best Boundaries</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {fours.slice(0, 8).map((m, i) => (
              <MomentTile key={`f${i}`} m={m} teamColorFn={teamColorFn} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function MomentTile({ m, teamColorFn }: { m: Moment; teamColorFn: (id: string) => string }) {
  const color = teamColorFn(m.team);
  const isSix = m.type === "SIX";
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/30 overflow-hidden hover:border-primary/40 transition-colors">
      <div className="aspect-[16/10] relative" style={{ background: `linear-gradient(135deg, ${color}33, hsl(var(--card)))` }}>
        <img src={playerPhoto(m.batter)} alt={m.batter} className="absolute inset-0 w-full h-full object-cover opacity-70" loading="lazy" />
        <div className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded text-[10px] font-display tracking-widest ${isSix ? "bg-[hsl(var(--six))]/90 text-foreground" : "bg-[hsl(var(--boundary))]/90 text-background"}`}>
          {isSix ? "6️⃣ SIX" : "4️⃣ FOUR"}
        </div>
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/60 text-white">
          {m.over}.{m.ball} · I{m.innings}
        </div>
      </div>
      <div className="p-2">
        <div className="font-display text-sm truncate">{m.batter}</div>
        <div className="text-[10px] text-muted-foreground truncate">off {m.bowler}</div>
      </div>
    </div>
  );
}
