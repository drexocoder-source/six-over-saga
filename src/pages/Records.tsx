import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Loader2, Trophy } from "lucide-react";

interface Rec {
  id: string; record_key: string; label: string; value: number | null;
  player_name: string | null; team_id: string | null; season_number: number | null; created_at: string;
}

const GROUPS: { keys: RegExp; title: string; emoji: string }[] = [
  { keys: /highest_score|best_strike|highest_team|most_sixes|most_fours/, title: "Batting Records", emoji: "🏏" },
  { keys: /best_bowling|best_economy/, title: "Bowling Records", emoji: "🎯" },
  { keys: /lowest_team/, title: "Defence Records", emoji: "🛡️" },
  { keys: /first_/, title: "Firsts", emoji: "✨" },
];

export default function Records() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const lg = await getOrCreateLeague();
      setTeams(lg.teams);
      const { data } = await supabase.from("records").select("*").eq("league_id", lg.id).order("created_at", { ascending: false });
      setRecs((data ?? []) as Rec[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs tracking-[0.3em] text-primary/80">ALL TIME</div>
        <h1 className="font-display text-4xl tracking-wider">Records & Milestones</h1>
      </div>

      {recs.length === 0 ? (
        <Card className="p-12 text-center gradient-card border-border/60">
          <Award className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <div className="font-display text-xl">No records yet</div>
          <p className="text-muted-foreground text-sm">Play a match to start setting records.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GROUPS.map(g => {
            const items = recs.filter(r => g.keys.test(r.record_key));
            if (items.length === 0) return null;
            return (
              <Card key={g.title} className="p-4 gradient-card border-border/60">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{g.emoji}</span>
                  <div className="font-display text-lg">{g.title}</div>
                </div>
                <div className="space-y-2">
                  {items.map(r => (
                    <div key={r.id} className="flex items-start gap-2 text-sm py-2 px-2 rounded bg-secondary/30">
                      <Trophy className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{r.label}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.player_name && <span>{r.player_name} • </span>}
                          {r.team_id && <span style={{ color: teamColor(r.team_id, teams) }}>{r.team_id}</span>}
                          {r.season_number && <span> • S{r.season_number}</span>}
                        </div>
                      </div>
                      {r.team_id && <Badge variant="outline" className="text-[10px]" style={{borderColor: teamColor(r.team_id, teams), color: teamColor(r.team_id, teams)}}>{r.team_id}</Badge>}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
