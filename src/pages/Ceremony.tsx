import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import { AWARD_META, type AwardKey } from "@/lib/awards";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Crown, ArrowRight } from "lucide-react";

export default function Ceremony() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const seasonId = params.get("season");
  const [league, setLeague] = useState<League | null>(null);
  const [season, setSeason] = useState<any>(null);
  const [trophies, setTrophies] = useState<any[]>([]);
  const [ratingChanges, setRatingChanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const lg = await getOrCreateLeague(); setLeague(lg);
    if (!seasonId) { setLoading(false); return; }
    const { data: s } = await supabase.from("seasons").select("*").eq("id", seasonId).maybeSingle();
    setSeason(s);
    if (s) {
      const { data: tr } = await supabase.from("trophies").select("*").eq("league_id", lg.id).eq("season_number", s.season_number);
      setTrophies(tr ?? []);
      const { data: rh } = await supabase.from("rating_history").select("*, players(name, role)").eq("league_id", lg.id).eq("season_number", s.season_number).order("delta", { ascending: false });
      setRatingChanges(rh ?? []);
    }
    setLoading(false);
  })(); }, [seasonId]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;
  if (!season || !league) return <div className="text-center py-12 text-muted-foreground">Season not found.</div>;

  const champion = season.champion_team_id;
  const champTrophy = trophies.find((t: any) => t.award === "champion");
  const runnerup = trophies.find((t: any) => t.award === "runnerup");
  const playerAwards = trophies.filter((t: any) => !["champion", "runnerup"].includes(t.award));
  const risers = ratingChanges.filter((r: any) => r.delta > 0).slice(0, 6);
  const fallers = ratingChanges.filter((r: any) => r.delta < 0).slice(-6).reverse();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Champion hero */}
      <Card className="p-8 gradient-card border-primary/50 glow-primary text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,hsl(var(--primary)),transparent_70%)]" />
        <div className="relative">
          <div className="text-xs tracking-[0.4em] text-primary mb-2">SEASON {season.season_number} · TROPHY CEREMONY</div>
          <Trophy className="w-20 h-20 mx-auto text-primary mb-3" />
          <div className="text-sm uppercase tracking-widest text-muted-foreground">Champions</div>
          <div className="font-display text-6xl tracking-wider mt-2" style={{ color: champion ? teamColor(champion, league.teams) : undefined }}>
            {champion ?? "—"}
          </div>
          {runnerup && (
            <div className="mt-4 text-sm text-muted-foreground">
              Runners-up: <span className="font-display text-lg" style={{ color: teamColor(runnerup.team_id, league.teams) }}>{runnerup.team_id}</span>
            </div>
          )}
          <div className="mt-6 flex justify-center gap-2 flex-wrap">
            <Button onClick={() => nav("/history")} variant="outline" className="border-primary/40 text-primary">View Full History</Button>
            <Button onClick={() => nav("/")} className="gradient-primary text-primary-foreground">Continue <ArrowRight className="w-4 h-4 ml-1"/></Button>
          </div>
        </div>
      </Card>

      {/* Player awards */}
      <div>
        <div className="text-xs tracking-[0.3em] text-primary/80 mb-3">INDIVIDUAL HONOURS</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {playerAwards.length === 0 && <div className="text-sm text-muted-foreground italic col-span-full">No individual awards recorded.</div>}
          {playerAwards.map((t: any, i: number) => {
            const meta = AWARD_META[t.award as AwardKey] ?? { emoji: "🏅", title: t.award, subtitle: "" };
            return (
              <Card key={i} className="p-4 gradient-card border-border/60 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: t.team_id ? teamColor(t.team_id, league.teams) : "hsl(var(--primary))" }} />
                <div className="text-3xl">{meta.emoji}</div>
                <div className="font-display text-lg tracking-wider mt-1">{meta.title}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{meta.subtitle}</div>
                <div className="mt-2 font-semibold" style={{ color: t.team_id ? teamColor(t.team_id, league.teams) : undefined }}>
                  {t.player_name ?? t.team_id}
                </div>
                {t.value != null && <div className="text-xs text-muted-foreground">{t.value}</div>}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Rating movements */}
      {(risers.length > 0 || fallers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 gradient-card border-border/60">
            <div className="text-xs tracking-widest text-[hsl(var(--boundary))] mb-3">📈 RISING STARS</div>
            <div className="space-y-1.5">
              {risers.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-secondary/30">
                  <div>
                    <div className="font-medium">{r.players?.name ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{r.reason}</div>
                  </div>
                  <Badge className="bg-[hsl(var(--boundary))]/15 text-[hsl(var(--boundary))]">★{r.old_rating} → {r.new_rating} (+{r.delta})</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4 gradient-card border-border/60">
            <div className="text-xs tracking-widest text-[hsl(var(--wicket))] mb-3">📉 SLUMPS & SETBACKS</div>
            <div className="space-y-1.5">
              {fallers.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-secondary/30">
                  <div>
                    <div className="font-medium">{r.players?.name ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{r.reason}</div>
                  </div>
                  <Badge className="bg-[hsl(var(--wicket))]/15 text-[hsl(var(--wicket))]">★{r.old_rating} → {r.new_rating} ({r.delta})</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
