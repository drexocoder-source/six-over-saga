import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import { AWARD_META, type AwardKey } from "@/lib/awards";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, ArrowRight, Star, Shield, Flame, Crown, TrendingUp, TrendingDown } from "lucide-react";

const GROUP_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  team:  { label: "Team Honours",      icon: <Trophy className="w-4 h-4" />,  color: "hsl(42 95% 58%)" },
  bat:   { label: "Batting Awards",    icon: <Flame className="w-4 h-4" />,   color: "hsl(142 55% 48%)" },
  bowl:  { label: "Bowling Awards",    icon: <Shield className="w-4 h-4" />,  color: "hsl(270 60% 60%)" },
  ar:    { label: "All-Rounders",      icon: <Star className="w-4 h-4" />,    color: "hsl(36 95% 55%)" },
  misc:  { label: "Special Honours",   icon: <Crown className="w-4 h-4" />,   color: "hsl(330 70% 62%)" },
};

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
      const { data: rh } = await supabase.from("rating_history").select("*, players(name, role)")
        .eq("league_id", lg.id).eq("season_number", s.season_number).order("delta", { ascending: false });
      setRatingChanges(rh ?? []);
    }
    setLoading(false);
  })(); }, [seasonId]);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="animate-spin text-primary w-8 h-8"/>
    </div>
  );
  if (!season || !league) return (
    <div className="text-center py-24">
      <Trophy className="w-16 h-16 mx-auto text-primary/20 mb-4" />
      <div className="font-display text-3xl text-foreground/40">Season Not Found</div>
      <p className="text-sm text-muted-foreground mt-2">Navigate from the Schedule or Dashboard.</p>
    </div>
  );

  const champion = season.champion_team_id;
  const champColor = champion ? teamColor(champion, league.teams) : "hsl(var(--primary))";
  const runnerup = trophies.find((t: any) => t.award === "runnerup");
  const playerAwards = trophies.filter((t: any) => !["champion", "runnerup"].includes(t.award));
  const risers = ratingChanges.filter((r: any) => r.delta > 0).slice(0, 6);
  const fallers = ratingChanges.filter((r: any) => r.delta < 0).slice(-6).reverse();

  // Group awards
  const grouped: Record<string, any[]> = {};
  for (const t of playerAwards) {
    const meta = AWARD_META[t.award as AwardKey];
    const g = meta?.group ?? "misc";
    grouped[g] = [...(grouped[g] ?? []), { ...t, meta }];
  }

  return (
    <div className="space-y-0 animate-fade-in">
      {/* ── Cinematic Hero ── */}
      <div className="relative overflow-hidden rounded-2xl mb-8 ceremony-bg">
        {/* Spotlight beams */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="spotlight-beam animate-beam-l" style={{ left: "20%", opacity: 0.8 }} />
          <div className="spotlight-beam animate-beam-r" style={{ right: "20%", opacity: 0.8 }} />
          <div className="spotlight-beam animate-beam-l" style={{ left: "45%", animationDelay: "2s", opacity: 0.5 }} />
        </div>

        {/* Gold particle scatter */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute w-1 h-1 rounded-full"
              style={{
                left: `${5 + (i * 47 % 90)}%`,
                top: `${10 + (i * 31 % 80)}%`,
                background: `hsl(42 95% ${60 + (i % 4) * 8}%)`,
                opacity: 0.15 + (i % 5) * 0.06,
                transform: `scale(${0.5 + (i % 3) * 0.5})`,
              }} />
          ))}
        </div>

        <div className="relative z-10 px-6 py-14 md:py-20 text-center">
          <div className="kicker mb-3 text-primary/80">SEASON {season.season_number} · TROPHY CEREMONY</div>

          <div className="animate-trophy-float inline-block mb-6">
            <Trophy
              className="w-20 h-20 md:w-28 md:h-28 mx-auto glow-gold"
              style={{ color: champColor, filter: `drop-shadow(0 0 20px ${champColor}88)` }}
            />
          </div>

          <div className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-2">CHAMPIONS</div>

          <div className="font-display text-shimmer-gold leading-none mb-3"
            style={{ fontSize: "clamp(3.5rem, 10vw, 7rem)" }}>
            {champion ?? "—"}
          </div>

          {runnerup && (
            <div className="text-sm text-white/40 mt-2">
              Runners-up:{" "}
              <span className="font-display text-xl" style={{ color: teamColor(runnerup.team_id, league.teams) }}>
                {runnerup.team_id}
              </span>
            </div>
          )}

          <div className="mt-10 flex justify-center gap-3 flex-wrap">
            <Button variant="outline" onClick={() => nav("/history")}
              className="border-primary/30 text-primary hover:border-primary/60 hover:bg-primary/8">
              Season History
            </Button>
            <Button onClick={() => nav("/")}
              className="gradient-primary text-primary-foreground font-semibold">
              Continue <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* Bottom vignette */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* ── Award Categories ── */}
      {Object.entries(GROUP_LABELS).map(([g, meta]) => {
        const awards = grouped[g] ?? [];
        if (!awards.length) return null;
        return (
          <section key={g} className="mb-8">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${meta.color}22`, color: meta.color }}>
                {meta.icon}
              </div>
              <div className="font-display text-2xl tracking-wider" style={{ color: meta.color }}>
                {meta.label}
              </div>
              <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${meta.color}44, transparent)` }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {awards.map((t: any, i: number) => {
                const m = t.meta ?? { emoji: "🏅", title: t.award, subtitle: "" };
                const tColor = t.team_id ? teamColor(t.team_id, league.teams) : meta.color;
                return (
                  <div key={i}
                    className="relative rounded-xl overflow-hidden card-lift animate-award"
                    style={{
                      animationDelay: `${i * 0.07}s`,
                      background: `linear-gradient(145deg, color-mix(in srgb, ${tColor} 10%, #0e0e0e) 0%, #0b0b0b 75%)`,
                      border: `1px solid ${tColor}33`,
                      boxShadow: `0 0 20px -8px ${tColor}44`,
                    }}>
                    {/* Top stripe */}
                    <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${tColor}, transparent)` }} />

                    <div className="p-5">
                      <div className="text-4xl mb-2">{m.emoji}</div>
                      <div className="font-display text-xl tracking-wider mb-0.5" style={{ color: tColor }}>
                        {m.title}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">{m.subtitle}</div>

                      <div className="font-semibold text-white/90 text-sm">
                        {t.player_name ?? t.team_id ?? "—"}
                      </div>
                      {t.value != null && (
                        <div className="text-xs text-white/40 font-mono mt-0.5">
                          {typeof t.value === "number" ? t.value.toLocaleString() : t.value}
                        </div>
                      )}

                      {/* Team pill */}
                      {t.team_id && (
                        <div className="mt-3 inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{ background: `${tColor}22`, color: tColor, border: `1px solid ${tColor}44` }}>
                          {t.team_id}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* ── Rating Movements ── */}
      {(risers.length > 0 || fallers.length > 0) && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <div className="font-display text-2xl tracking-wider">Player Ratings</div>
            <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {risers.length > 0 && (
              <div className="rounded-xl overflow-hidden border border-emerald-500/20"
                style={{ background: "linear-gradient(145deg, hsl(142 30% 9%), hsl(142 10% 7%))" }}>
                <div className="px-4 py-3 flex items-center gap-2 border-b border-emerald-500/15">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="font-display text-lg tracking-wider text-emerald-400">Rising Stars</span>
                </div>
                <div className="p-3 space-y-2">
                  {risers.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                      <div>
                        <div className="font-semibold text-sm text-white/90">{r.players?.name ?? "—"}</div>
                        <div className="text-[10px] text-white/35 italic">{r.reason}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-xs text-emerald-400 font-bold">+{r.delta}</div>
                        <div className="text-[10px] text-white/25 font-mono">{r.old_rating}→{r.new_rating}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fallers.length > 0 && (
              <div className="rounded-xl overflow-hidden border border-rose-500/20"
                style={{ background: "linear-gradient(145deg, hsl(0 30% 9%), hsl(0 10% 7%))" }}>
                <div className="px-4 py-3 flex items-center gap-2 border-b border-rose-500/15">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  <span className="font-display text-lg tracking-wider text-rose-400">Slumps & Setbacks</span>
                </div>
                <div className="p-3 space-y-2">
                  {fallers.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10">
                      <div>
                        <div className="font-semibold text-sm text-white/90">{r.players?.name ?? "—"}</div>
                        <div className="text-[10px] text-white/35 italic">{r.reason}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-xs text-rose-400 font-bold">{r.delta}</div>
                        <div className="text-[10px] text-white/25 font-mono">{r.old_rating}→{r.new_rating}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
