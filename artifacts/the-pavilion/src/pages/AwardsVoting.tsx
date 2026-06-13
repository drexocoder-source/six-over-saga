import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import { AWARD_META, type AwardKey } from "@/lib/awards";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Award, CheckCircle, Trophy, Crown, Flame, Zap } from "lucide-react";
import { toast } from "sonner";

interface Nominee {
  player_id: string;
  name: string;
  team: string;
  stat: string;
  value: number;
}

interface VotingCategory {
  award: AwardKey;
  nominees: Nominee[];
  winner: string | null;
}

function computeNominees(matches: any[]): Record<string, Nominee[]> {
  type B = { name: string; team: string; runs: number; balls: number; sixes: number; fours: number; inn: number; fastest50: number; wkts: number; wkRuns: number; wkBalls: number; maidens: number; dots: number };
  const map = new Map<string, B>();

  matches.forEach((m: any) => {
    const sc = m.scorecard; if (!sc) return;
    (["innings1","innings2"] as const).forEach(ik => {
      const inn = sc[ik]; if (!inn) return;
      Object.values(inn.bat as Record<string, any>).forEach((b: any) => {
        const c = map.get(b.player_id) ?? { name: b.name, team: inn.battingTeam, runs: 0, balls: 0, sixes: 0, fours: 0, inn: 0, fastest50: 999, wkts: 0, wkRuns: 0, wkBalls: 0, maidens: 0, dots: 0 };
        c.runs += b.runs ?? 0; c.balls += b.balls ?? 0; c.sixes += b.sixes ?? 0; c.fours += b.fours ?? 0;
        if ((b.balls ?? 0) > 0) c.inn++;
        if ((b.runs ?? 0) >= 50 && (b.balls ?? 0) > 0 && b.balls < c.fastest50) c.fastest50 = b.balls;
        map.set(b.player_id, c);
      });
      Object.values(inn.bowl as Record<string, any>).forEach((b: any) => {
        const c = map.get(b.player_id) ?? { name: b.name, team: inn.bowlingTeam, runs: 0, balls: 0, sixes: 0, fours: 0, inn: 0, fastest50: 999, wkts: 0, wkRuns: 0, wkBalls: 0, maidens: 0, dots: 0 };
        c.wkts += b.wickets ?? 0; c.wkRuns += b.runs ?? 0; c.wkBalls += b.balls ?? 0;
        c.maidens += b.maidens ?? 0; c.dots += b.dots ?? 0;
        map.set(b.player_id, c);
      });
    });
  });

  const arr = [...map.entries()].map(([id, v]) => ({ id, ...v }));
  const top3 = (list: typeof arr, stat: (x: typeof arr[0]) => string, filter?: (x: typeof arr[0]) => boolean): Nominee[] =>
    (filter ? list.filter(filter) : list).slice(0, 3).map(x => ({ player_id: x.id, name: x.name, team: x.team, stat: stat(x), value: 0 }));

  return {
    orange_cap: arr.sort((a,b) => b.runs - a.runs).slice(0,3).map(x => ({ player_id: x.id, name: x.name, team: x.team, stat: `${x.runs} runs · SR ${x.balls ? ((x.runs/x.balls)*100).toFixed(1) : "—"}`, value: x.runs })),
    purple_cap: arr.filter(x => x.wkts > 0).sort((a,b) => b.wkts - a.wkts).slice(0,3).map(x => ({ player_id: x.id, name: x.name, team: x.team, stat: `${x.wkts} wkts · Econ ${x.wkBalls ? ((x.wkRuns/x.wkBalls)*6).toFixed(2) : "—"}`, value: x.wkts })),
    most_sixes: arr.filter(x => x.sixes > 0).sort((a,b) => b.sixes - a.sixes).slice(0,3).map(x => ({ player_id: x.id, name: x.name, team: x.team, stat: `${x.sixes} sixes · ${x.fours} fours`, value: x.sixes })),
    best_strike_rate: arr.filter(x => x.balls >= 30).sort((a,b) => (b.runs/b.balls) - (a.runs/a.balls)).slice(0,3).map(x => ({ player_id: x.id, name: x.name, team: x.team, stat: `SR ${((x.runs/x.balls)*100).toFixed(1)} · ${x.runs} runs (${x.balls}b)`, value: +((x.runs/x.balls)*100).toFixed(1) })),
    best_economy: arr.filter(x => x.wkBalls >= 36).sort((a,b) => (a.wkRuns/a.wkBalls) - (b.wkRuns/b.wkBalls)).slice(0,3).map(x => ({ player_id: x.id, name: x.name, team: x.team, stat: `Econ ${((x.wkRuns/x.wkBalls)*6).toFixed(2)} · ${x.wkts} wkts`, value: +((x.wkRuns/x.wkBalls)*6).toFixed(2) })),
    most_fours: arr.filter(x => x.fours > 0).sort((a,b) => b.fours - a.fours).slice(0,3).map(x => ({ player_id: x.id, name: x.name, team: x.team, stat: `${x.fours} fours · ${x.runs} runs`, value: x.fours })),
    mvp: arr.map(x => ({ ...x, score: x.runs + x.wkts * 20 })).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0,3).map(x => ({ player_id: x.id, name: x.name, team: x.team, stat: `Score ${x.runs + x.wkts * 20} · ${x.runs} runs, ${x.wkts} wkts`, value: x.runs + x.wkts * 20 })),
    captain_of_season: top3(arr.slice(0,3), x => `Selected as captain candidate`, x => x.inn > 0),
  };
}

export default function AwardsVoting() {
  const [league, setLeague] = useState<League | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [existingTrophies, setExistingTrophies] = useState<any[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [awarded, setAwarded] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const lg = await getOrCreateLeague(); setLeague(lg);
      const { data: s } = await supabase.from("seasons").select("*").eq("league_id", lg.id).order("season_number", { ascending: false });
      setSeasons(s ?? []);
      const target = (s ?? []).find((x: any) => x.status !== "done") ?? (s ?? [])[0];
      if (target) setSelectedSeason(target);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedSeason || !league) return;
    setMatches([]); setExistingTrophies([]);
    (async () => {
      const [{ data: m }, { data: tr }] = await Promise.all([
        supabase.from("matches").select("scorecard, winner, team_a, team_b").eq("season_id", selectedSeason.id).eq("status", "done"),
        supabase.from("trophies").select("*").eq("league_id", league.id).eq("season_number", selectedSeason.season_number),
      ]);
      setMatches(m ?? []);
      setExistingTrophies(tr ?? []);
      const awd: Record<string, string> = {};
      (tr ?? []).forEach((t: any) => { awd[t.award] = t.player_name ?? t.team_id ?? ""; });
      setAwarded(awd);
    })();
  }, [selectedSeason, league]);

  const nominees = useMemo(() => computeNominees(matches), [matches]);

  const VOTING_CATEGORIES: { award: AwardKey; label: string; emoji: string; desc: string; valueLabel: string }[] = [
    { award: "orange_cap",       label: "Orange Cap",    emoji: "🟧", desc: "Most runs in the season",        valueLabel: "runs" },
    { award: "purple_cap",       label: "Purple Cap",    emoji: "🟪", desc: "Most wickets in the season",     valueLabel: "wkts" },
    { award: "most_sixes",       label: "Universe Boss", emoji: "💥", desc: "Most sixes hit",                 valueLabel: "6s" },
    { award: "best_strike_rate", label: "Strike Lord",   emoji: "⚡", desc: "Best strike rate (min 30 balls)", valueLabel: "SR" },
    { award: "best_economy",     label: "Iron Wall",     emoji: "🛡️", desc: "Best economy (min 6 overs)",     valueLabel: "econ" },
    { award: "most_fours",       label: "Boundary King", emoji: "4️⃣", desc: "Most fours hit",                 valueLabel: "4s" },
    { award: "mvp",              label: "MVP",           emoji: "👑", desc: "Most Valuable Player overall",   valueLabel: "score" },
  ];

  async function giveAward(award: AwardKey, nomineeId: string, nomineeName: string, nomineeTeam: string, value: number) {
    if (!league || !selectedSeason) return;
    setSaving(award);
    const existing = existingTrophies.find(t => t.award === award);
    if (existing) {
      await supabase.from("trophies").delete().eq("id", existing.id);
    }
    const { error } = await supabase.from("trophies").insert({
      league_id: league.id,
      season_number: selectedSeason.season_number,
      award,
      player_id: nomineeId,
      player_name: nomineeName,
      team_id: nomineeTeam,
      value,
    });
    setSaving(null);
    if (error) { toast.error("Failed to save award"); return; }
    setAwarded(prev => ({ ...prev, [award]: nomineeName }));
    setVotes(prev => ({ ...prev, [award]: nomineeId }));
    toast.success(`🏆 ${nomineeName} wins the ${AWARD_META[award]?.title ?? award}!`);
  }

  if (loading || !league) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  const totalCategories = VOTING_CATEGORIES.length;
  const awardedCount = VOTING_CATEGORIES.filter(c => awarded[c.award]).length;

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl">
      <div className="border-b border-border/40 pb-4">
        <div className="text-[10px] tracking-[0.35em] text-primary/70 mb-0.5">AWARDS CHAMBER</div>
        <h1 className="font-display text-4xl md:text-5xl tracking-wider text-foreground">Season Awards Voting</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick from the top 3 nominees in each category. Your vote awards the trophy.</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Season:</span>
          <Select value={selectedSeason?.id ?? ""} onValueChange={v => setSelectedSeason(seasons.find(s => s.id === v))}>
            <SelectTrigger className="w-36"><SelectValue/></SelectTrigger>
            <SelectContent>
              {seasons.map(s => <SelectItem key={s.id} value={s.id}>Season {s.season_number}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">{matches.length} matches played</div>
          <Badge className={`text-xs ${awardedCount === totalCategories ? "bg-primary/20 text-primary" : "bg-secondary/40"}`}>
            {awardedCount}/{totalCategories} awarded
          </Badge>
        </div>
      </div>

      {matches.length === 0 ? (
        <Card className="p-14 text-center gradient-card border-border/60">
          <Award className="w-12 h-12 mx-auto text-primary/30 mb-3"/>
          <div className="font-display text-2xl text-foreground/70">No match data yet</div>
          <p className="text-muted-foreground text-sm mt-1">Complete matches to unlock nominees.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {VOTING_CATEGORIES.map(cat => {
            const cats = nominees[cat.award] ?? [];
            const alreadyAwarded = awarded[cat.award];
            const currentVote = votes[cat.award];

            return (
              <Card key={cat.award} className={`p-5 gradient-card transition-all ${alreadyAwarded ? "border-primary/40 bg-primary/5" : "border-border/60"}`}>
                <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{cat.emoji}</span>
                    <div>
                      <div className="font-display text-xl tracking-wider">{cat.label}</div>
                      <div className="text-xs text-muted-foreground">{cat.desc}</div>
                    </div>
                  </div>
                  {alreadyAwarded && (
                    <div className="flex items-center gap-2 bg-primary/15 border border-primary/30 rounded-lg px-3 py-1.5 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary"/>
                      <span className="font-semibold text-primary">{alreadyAwarded}</span>
                      <span className="text-xs text-muted-foreground">awarded</span>
                    </div>
                  )}
                </div>

                {cats.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">Not enough data for nominees yet.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {cats.map((nominee, idx) => {
                      const isSelected = currentVote === nominee.player_id || (alreadyAwarded === nominee.name && !currentVote);
                      const rank = ["🥇","🥈","🥉"][idx];
                      const isSaving = saving === cat.award;
                      const tcolor = teamColor(nominee.team, league.teams);

                      return (
                        <div key={nominee.player_id} className={`relative rounded-xl border p-4 transition-all cursor-pointer group ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)]"
                            : "border-border/50 bg-secondary/10 hover:border-primary/40 hover:bg-secondary/30"
                        }`} onClick={() => !isSaving && giveAward(cat.award, nominee.player_id, nominee.name, nominee.team, nominee.value)}>
                          <div className="absolute top-2.5 right-2.5 text-base">{rank}</div>
                          <div className="font-display text-lg leading-tight pr-6">{nominee.name}</div>
                          <div className="text-xs mt-0.5 mb-2 font-semibold" style={{ color: tcolor }}>{nominee.team}</div>
                          <div className="text-[11px] text-muted-foreground">{nominee.stat}</div>
                          {!isSelected && !alreadyAwarded && (
                            <Button size="sm" variant="outline" className="w-full mt-3 h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                              {isSaving ? <Loader2 className="w-3 h-3 animate-spin"/> : "Award This"}
                            </Button>
                          )}
                          {isSelected && (
                            <div className="flex items-center gap-1.5 mt-3 text-xs text-primary font-semibold">
                              <Trophy className="w-3 h-3"/>{alreadyAwarded ? "Awarded" : "Your pick"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}

          {awardedCount === totalCategories && (
            <Card className="p-6 gradient-card border-primary/50 glow-primary text-center">
              <Crown className="w-10 h-10 mx-auto text-primary mb-2"/>
              <div className="font-display text-2xl tracking-wider text-primary">All Awards Given!</div>
              <p className="text-sm text-muted-foreground mt-1">Season {selectedSeason?.season_number} honours are complete. Check the Ceremony page to see the full trophy cabinet.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
