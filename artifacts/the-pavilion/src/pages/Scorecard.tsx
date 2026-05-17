import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor, teamFull } from "@/lib/teams";
import { FullScorecard } from "@/components/match/FullScorecard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Trophy, Calendar, Sparkles } from "lucide-react";

export default function Scorecard() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const id = params.get("id");
  const [league, setLeague] = useState<League | null>(null);
  const [match, setMatch] = useState<any>(null);
  const [potm, setPotm] = useState<any>(null);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const lg = await getOrCreateLeague(); setLeague(lg);
    const { data: list } = await supabase
      .from("matches")
      .select("id, match_number, team_a, team_b, stage, winner, result_text, status, season_id, seasons!inner(season_number, league_id)")
      .eq("seasons.league_id", lg.id)
      .eq("status", "done")
      .order("created_at", { ascending: false });
    setAllMatches(list ?? []);
    if (id) {
      const { data: m } = await supabase.from("matches").select("*").eq("id", id).single();
      setMatch(m);
      if (m?.player_of_match) {
        const { data: p } = await supabase.from("players").select("id,name,role,pfp_url,rating").eq("id", m.player_of_match).maybeSingle();
        setPotm(p);
      } else setPotm(null);
    } else if (list && list.length) {
      nav(`/scorecard?id=${list[0].id}`, { replace: true });
    }
    setLoading(false);
  })(); }, [id]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;
  if (!league) return null;

  const tcolor = (tid: string) => teamColor(tid, league.teams);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-primary/80 flex items-center gap-2"><Calendar className="w-3 h-3"/> MATCH ARCHIVE</div>
          <h1 className="font-display text-4xl tracking-wider">Scorecard</h1>
          <p className="text-sm text-muted-foreground mt-1">Re-live every ball of every game.</p>
        </div>
        <Button variant="outline" onClick={() => nav(-1)} className="border-border"><ArrowLeft className="w-4 h-4 mr-1"/>Back</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Match list */}
        <Card className="p-2 gradient-card border-border/60 max-h-[700px] overflow-y-auto">
          {allMatches.length === 0 && <div className="text-center text-muted-foreground text-xs py-8">No completed matches yet.</div>}
          {allMatches.map((m: any) => {
            const active = m.id === id;
            return (
              <Link key={m.id} to={`/scorecard?id=${m.id}`}
                className={`block px-2.5 py-2 rounded-md text-xs mb-1 transition-colors ${active ? "bg-primary/15 text-primary" : "hover:bg-secondary/40"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-display tracking-wider">M{m.match_number} · S{m.seasons?.season_number}</span>
                  {m.stage !== "league" && <Badge variant="outline" className="text-[9px]">{m.stage}</Badge>}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span style={{color: tcolor(m.team_a)}}>{m.team_a}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span style={{color: tcolor(m.team_b)}}>{m.team_b}</span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{m.result_text}</div>
              </Link>
            );
          })}
        </Card>

        {/* Detail */}
        <div className="space-y-4">
          {!match ? (
            <Card className="p-12 text-center gradient-card border-border/60 text-muted-foreground">Pick a match from the left to view its scorecard.</Card>
          ) : (
            <>
              <Card className="p-5 gradient-card border-border/60 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{background: match.winner ? `radial-gradient(circle at top right, ${tcolor(match.winner)}, transparent 60%)` : ""}}/>
                <div className="relative flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-[10px] tracking-widest text-muted-foreground">MATCH {match.match_number} · {match.stage?.toUpperCase()}</div>
                    <div className="font-display text-2xl tracking-wider mt-1">
                      <span style={{color: tcolor(match.team_a)}}>{teamFull(match.team_a, league.teams)}</span>
                      <span className="text-muted-foreground mx-2">vs</span>
                      <span style={{color: tcolor(match.team_b)}}>{teamFull(match.team_b, league.teams)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      {match.winner && <Badge className="bg-primary/15 text-primary border-primary/30"><Trophy className="w-3 h-3 mr-1"/>{match.result_text}</Badge>}
                      {match.toss_winner && <span className="text-muted-foreground">Toss: {match.toss_winner} ({match.toss_decision})</span>}
                    </div>
                  </div>
                  {potm && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
                      {potm.pfp_url && <img src={potm.pfp_url} alt="" className="w-12 h-12 rounded-full bg-secondary border border-primary/40"/>}
                      <div>
                        <div className="text-[10px] tracking-widest text-primary flex items-center gap-1"><Sparkles className="w-3 h-3"/> PLAYER OF THE MATCH</div>
                        <div className="font-display text-lg">{potm.name}</div>
                        <div className="text-[10px] text-muted-foreground">{potm.role} · ★{potm.rating}</div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {match.scorecard ? (
                <FullScorecard state={match.scorecard as any} teamColorFn={tcolor}/>
              ) : (
                <Card className="p-8 text-center text-muted-foreground gradient-card border-border/60">No detailed scorecard saved for this match.</Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
