import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Shield, Star, ChevronDown } from "lucide-react";
import type { PlayerLite } from "@/lib/matchEngine";
import { getOrCreateLeague } from "@/lib/league";
import {
  loadLeagueCareer, battingAvg, battingSR, bowlingEcon, bowlingAvg, captainWinPct,
  type CareerBundle,
} from "@/lib/leagueCareer";

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
  const nav = useNavigate();
  const [selA, setSelA] = useState<Set<string>>(() => new Set(squadA.slice(0, playingXISize).map(p=>p.id)));
  const [selB, setSelB] = useState<Set<string>>(() => new Set(squadB.slice(0, playingXISize).map(p=>p.id)));
  const [career, setCareer] = useState<CareerBundle>({ byPlayer: {} });
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const lg = await getOrCreateLeague();
      const c = await loadLeagueCareer(lg.id);
      setCareer(c);
    })();
  }, []);

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
      {squad.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <div className="text-2xl mb-2">🏏</div>
          <div className="font-medium text-foreground">No squad found for {name}</div>
          <div className="text-xs mt-1 mb-4 opacity-70">You need to run the auction before playing matches.</div>
          <Button size="sm" variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" onClick={() => nav("/auction")}>
            Go to Auction →
          </Button>
        </div>
      )}
      <div className="space-y-1 max-h-[520px] overflow-auto pr-1">
        {squad.map(p => {
          const on = sel.has(p.id);
          const c = career.byPlayer[p.id];
          const open = expanded === p.id;
          return (
            <div key={p.id}
              className={`rounded transition-all ${on ? "bg-primary/15 border border-primary/40" : "bg-secondary/40 border border-transparent hover:bg-secondary/70"}`}>
              <div className="flex items-center gap-2 text-xs py-2 px-2">
                <button onClick={() => toggle(sel, set, p.id)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                  {p.is_captain && <Crown className="w-3 h-3 text-primary shrink-0" />}
                  {p.is_vice_captain && <Shield className="w-3 h-3 text-accent shrink-0" />}
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className={`px-1.5 rounded text-[10px] ${ROLE_COLOR[p.role]}`}>{p.role}</span>
                  <span className="text-muted-foreground flex items-center gap-0.5"><Star className="w-2.5 h-2.5"/>{p.rating}</span>
                </button>
                <button onClick={() => setExpanded(open ? null : p.id)} className="p-0.5 rounded hover:bg-background/40" aria-label="Show stats">
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}/>
                </button>
              </div>
              {/* Quick mini stats — always visible if any history */}
              {c && c.matches > 0 && (
                <div className="px-2 pb-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>M <b className="text-foreground">{c.matches}</b></span>
                  {c.innings > 0 && <span>R <b className="text-[hsl(var(--boundary))]">{c.runs}</b></span>}
                  {c.balls > 0 && <span>SR <b className="text-foreground">{battingSR(c).toFixed(1)}</b></span>}
                  {c.wickets > 0 && <span>W <b className="text-[hsl(var(--six))]">{c.wickets}</b></span>}
                  {p.is_captain && c.capMatches > 0 && (
                    <span className="text-primary">C: {c.capWins}-{c.capLosses} ({captainWinPct(c).toFixed(0)}%)</span>
                  )}
                </div>
              )}
              {/* Expanded full career card */}
              {open && c && (
                <div className="border-t border-border/40 mx-2 mb-2 p-2 rounded bg-background/30 space-y-2">
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-primary/80 mb-1">Batting Career</div>
                    <div className="grid grid-cols-4 gap-x-2 gap-y-1 text-[10px]">
                      <Stat l="M" v={c.matches}/>
                      <Stat l="Inn" v={c.innings}/>
                      <Stat l="Runs" v={c.runs}/>
                      <Stat l="HS" v={`${c.hs}${c.hsNotOut ? "*" : ""}`}/>
                      <Stat l="Avg" v={c.outs > 0 ? battingAvg(c).toFixed(1) : "—"}/>
                      <Stat l="SR" v={c.balls > 0 ? battingSR(c).toFixed(1) : "—"}/>
                      <Stat l="50s" v={c.fifties}/>
                      <Stat l="100s" v={c.hundreds}/>
                      <Stat l="4s" v={c.fours}/>
                      <Stat l="6s" v={c.sixes}/>
                    </div>
                  </div>
                  {c.bowlBalls > 0 && (
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-primary/80 mb-1">Bowling Career</div>
                      <div className="grid grid-cols-4 gap-x-2 gap-y-1 text-[10px]">
                        <Stat l="W" v={c.wickets}/>
                        <Stat l="Econ" v={bowlingEcon(c).toFixed(2)}/>
                        <Stat l="Avg" v={c.wickets > 0 ? bowlingAvg(c).toFixed(1) : "—"}/>
                        <Stat l="BBI" v={c.bbiW > 0 ? `${c.bbiW}/${c.bbiR}` : "—"}/>
                      </div>
                    </div>
                  )}
                  {c.capMatches > 0 && (
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-primary/80 mb-1">Captaincy</div>
                      <div className="grid grid-cols-4 gap-x-2 text-[10px]">
                        <Stat l="Led" v={c.capMatches}/>
                        <Stat l="Won" v={c.capWins} cls="text-emerald-400"/>
                        <Stat l="Lost" v={c.capLosses} cls="text-rose-400"/>
                        <Stat l="Win%" v={captainWinPct(c).toFixed(0) + "%"} cls="text-primary"/>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {open && (!c || c.matches === 0) && (
                <div className="px-3 pb-2 text-[10px] text-muted-foreground italic">No career history yet — uncapped player.</div>
              )}
            </div>
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

function Stat({ l, v, cls }: { l: string; v: any; cls?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[8px] uppercase tracking-widest text-muted-foreground">{l}</span>
      <span className={`font-mono ${cls ?? "text-foreground"}`}>{v}</span>
    </div>
  );
}
