import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { getPlayerCareer, type PlayerCareer } from "@/lib/playerCareer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, User, Trophy, Award, Star, Target } from "lucide-react";

export default function PlayerProfile() {
  const [league, setLeague] = useState<League | null>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [career, setCareer] = useState<PlayerCareer | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { (async () => {
    const lg = await getOrCreateLeague(); setLeague(lg);
    const { data } = await supabase.from("players").select("*").eq("league_id", lg.id).order("rating", { ascending: false });
    setPlayers(data ?? []);
    if (data?.length) setSelectedId(data[0].id);
  })(); }, []);

  useEffect(() => { (async () => {
    if (!league || !selectedId) return;
    setLoading(true);
    const c = await getPlayerCareer(league.id, selectedId); setCareer(c); setLoading(false);
  })(); }, [league, selectedId]);

  const filtered = players.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
  const sr = career && career.balls > 0 ? ((career.runs / career.balls) * 100).toFixed(1) : "—";
  const avg = career && career.innings > 0 ? (career.runs / Math.max(1, career.innings - (career.bestScore && !career.bestScore.out ? 1 : 0))).toFixed(2) : "—";
  const econ = career && career.bowlBalls > 0 ? (career.bowlRuns / (career.bowlBalls / 6)).toFixed(2) : "—";
  const bowlAvg = career && career.wickets > 0 ? (career.bowlRuns / career.wickets).toFixed(2) : "—";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs tracking-[0.3em] text-primary/80">CAREER ARCHIVE</div>
        <h1 className="font-display text-4xl tracking-wider flex items-center gap-2"><User className="w-7 h-7 text-primary"/> Player Profile</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <Card className="p-3 gradient-card border-border/60 max-h-[600px] overflow-hidden flex flex-col">
          <Input placeholder="Search player…" value={filter} onChange={e => setFilter(e.target.value)} className="mb-2"/>
          <div className="overflow-y-auto -mr-2 pr-2 space-y-1">
            {filtered.map(p => (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-2.5 py-2 rounded-md text-sm transition-colors ${selectedId === p.id ? "bg-primary/15 text-primary" : "hover:bg-secondary/40"}`}>
                <div className="flex items-center gap-2.5">
                  {p.pfp_url && <img src={p.pfp_url} alt="" className="w-7 h-7 rounded-full bg-secondary border border-border/40 flex-shrink-0" loading="lazy"/>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{p.role}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{p.nationality} · ★{p.rating}</div>
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">No matches.</div>}
          </div>
        </Card>

        <div className="space-y-4">
          {loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin w-4 h-4"/> Loading career…</div>}
          {career?.player && !loading && (
            <>
              <Card className="p-5 gradient-card border-border/60 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)),transparent_60%)]"/>
                <div className="relative flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    {career.player.pfp_url && (
                      <img src={career.player.pfp_url} alt="" className="w-20 h-20 rounded-2xl border-2 border-primary/40 bg-secondary shadow-[var(--shadow-card)] flex-shrink-0"/>
                    )}
                    <div>
                      <div className="font-display text-3xl tracking-wider">{career.player.name}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <Badge variant="outline">{career.player.role}</Badge>
                        <span>{career.player.nationality}</span>
                        <span>· Rating ★{career.player.rating}</span>
                        {career.debutSeason && <Badge className="bg-primary/15 text-primary border-primary/30">Debut S{career.debutSeason}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {career.teams.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
              </Card>

              {/* Highlights */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Highlight label="Matches" value={career.matches} icon={<Target className="w-4 h-4"/>}/>
                <Highlight label="Best Score" value={career.bestScore ? `${career.bestScore.runs}${career.bestScore.out ? "" : "*"}` : "—"} sub={career.bestScore ? `(${career.bestScore.balls}b · S${career.bestScore.season})` : ""} icon={<Star className="w-4 h-4 text-primary"/>}/>
                <Highlight label="Best Bowling" value={career.bestBowling ? `${career.bestBowling.wickets}/${career.bestBowling.runs}` : "—"} sub={career.bestBowling ? `S${career.bestBowling.season}` : ""} icon={<Trophy className="w-4 h-4 text-accent"/>}/>
                <Highlight label="Awards" value={career.awards.length} icon={<Award className="w-4 h-4 text-primary"/>}/>
              </div>

              {/* Batting */}
              <Card className="p-5 gradient-card border-border/60">
                <div className="font-display tracking-wider text-sm mb-3 text-[hsl(var(--boundary))]">BATTING CAREER</div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center text-xs">
                  <Stat k="Innings" v={career.innings}/>
                  <Stat k="Runs" v={career.runs}/>
                  <Stat k="Avg" v={avg}/>
                  <Stat k="SR" v={sr}/>
                  <Stat k="50s / 100s" v={`${career.fifties} / ${career.hundreds}`}/>
                  <Stat k="4s / 6s" v={`${career.fours} / ${career.sixes}`}/>
                </div>
              </Card>

              {/* Bowling */}
              <Card className="p-5 gradient-card border-border/60">
                <div className="font-display tracking-wider text-sm mb-3 text-[hsl(var(--six))]">BOWLING CAREER</div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center text-xs">
                  <Stat k="Innings" v={career.bowlInnings}/>
                  <Stat k="Wickets" v={career.wickets}/>
                  <Stat k="Avg" v={bowlAvg}/>
                  <Stat k="Econ" v={econ}/>
                  <Stat k="3W Hauls" v={career.threeFers}/>
                  <Stat k="Runs Conceded" v={career.bowlRuns}/>
                </div>
              </Card>

              {/* Awards */}
              {career.awards.length > 0 && (
                <Card className="p-5 gradient-card border-border/60">
                  <div className="font-display tracking-wider text-sm mb-3 text-primary">TROPHY CABINET</div>
                  <div className="flex flex-wrap gap-2">
                    {career.awards.map((a, i) => (
                      <div key={i} className="px-3 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-xs">
                        🏆 {a.award} <span className="text-muted-foreground ml-1">S{a.season}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
          {!career && !loading && <Card className="p-12 text-center gradient-card border-border/60 text-muted-foreground">Pick a player to see their career.</Card>}
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: any }) {
  return <div className="bg-secondary/30 rounded p-2"><div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div><div className="font-display text-lg">{v}</div></div>;
}
function Highlight({ label, value, sub, icon }: { label: string; value: any; sub?: string; icon?: any }) {
  return (
    <Card className="p-4 gradient-card border-border/60">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span>{icon}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}
