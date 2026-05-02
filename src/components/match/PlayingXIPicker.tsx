import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Shield, Star } from "lucide-react";
import type { PlayerLite } from "@/lib/matchEngine";

interface SquadMember extends PlayerLite { is_captain: boolean; is_vice_captain: boolean; price: number; }

const ROLE_COLOR: Record<string,string> = {
  BAT:"bg-[hsl(var(--boundary))]/20 text-[hsl(var(--boundary))]",
  BOWL:"bg-[hsl(var(--mi))]/20 text-[hsl(var(--mi))]",
  AR:"bg-primary/20 text-primary",
  WK:"bg-accent/20 text-accent",
};

interface Props {
  teamA: string; teamB: string;
  squadA: SquadMember[]; squadB: SquadMember[];
  playingXISize: number;
  teamColorFn: (id: string) => string;
  onConfirm: (xiA: PlayerLite[], xiB: PlayerLite[]) => void;
}

export function PlayingXIPicker({ teamA, teamB, squadA, squadB, playingXISize, teamColorFn, onConfirm }: Props) {
  const [selA, setSelA] = useState<Set<string>>(() => new Set(squadA.slice(0, playingXISize).map(p=>p.id)));
  const [selB, setSelB] = useState<Set<string>>(() => new Set(squadB.slice(0, playingXISize).map(p=>p.id)));

  const toggle = (sel: Set<string>, set: (s: Set<string>) => void, id: string) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else if (n.size < playingXISize) n.add(id);
    set(n);
  };

  const ready = selA.size === playingXISize && selB.size === playingXISize;

  const TeamCol = ({ name, squad, sel, set }: { name: string; squad: SquadMember[]; sel: Set<string>; set: (s: Set<string>) => void; }) => (
    <Card className="p-4 gradient-card border-border/60">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-2xl" style={{ color: teamColorFn(name) }}>{name}</div>
        <Badge variant="outline" className={sel.size === playingXISize ? "border-primary text-primary" : ""}>{sel.size}/{playingXISize}</Badge>
      </div>
      <div className="space-y-1 max-h-[440px] overflow-auto pr-1">
        {squad.map(p => {
          const on = sel.has(p.id);
          return (
            <button key={p.id} onClick={() => toggle(sel, set, p.id)}
              className={`w-full flex items-center gap-2 text-xs py-2 px-2 rounded transition-all ${on ? "bg-primary/15 border border-primary/40" : "bg-secondary/40 border border-transparent hover:bg-secondary/70"}`}>
              {p.is_captain && <Crown className="w-3 h-3 text-primary shrink-0" />}
              {p.is_vice_captain && <Shield className="w-3 h-3 text-accent shrink-0" />}
              <span className="flex-1 truncate text-left">{p.name}</span>
              <span className={`px-1.5 rounded text-[10px] ${ROLE_COLOR[p.role]}`}>{p.role}</span>
              <span className="text-muted-foreground flex items-center gap-0.5"><Star className="w-2.5 h-2.5"/>{p.rating}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TeamCol name={teamA} squad={squadA} sel={selA} set={setSelA} />
        <TeamCol name={teamB} squad={squadB} sel={selB} set={setSelB} />
      </div>
      <div className="flex justify-end">
        <Button size="lg" disabled={!ready}
          onClick={() => onConfirm(
            squadA.filter(p => selA.has(p.id)),
            squadB.filter(p => selB.has(p.id)),
          )}
          className="gradient-primary text-primary-foreground font-semibold">
          Confirm Playing XI →
        </Button>
      </div>
    </div>
  );
}
