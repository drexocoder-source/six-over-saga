// Image Studio — preset-driven AI image generation for posters, leaderboards & moments.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Download, Image as ImageIcon, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateImage, type ImageKind } from "@/lib/imageGen";
import { loadAllDoneMatches, aggregate, type MatchRow } from "@/lib/recordsAgg";
import type { League } from "@/lib/league";

interface Preset {
  id: string;
  kind: ImageKind;
  label: string;
  emoji: string;
  desc: string;
  build: (ctx: StudioCtx) => string;
}

interface StudioCtx {
  league: League;
  matches: MatchRow[];
  currentSeason?: number;
}

const PRESETS: Preset[] = [
  {
    id: "playoffs", kind: "playoffs_poster", emoji: "🏆",
    label: "Playoffs Poster",
    desc: "Top 4 bracket art with Q1 / Eliminator / Q2 / Final",
    build: (c) => `Top 4 franchises of ${c.league.name} entering the playoffs. Teams: ${c.league.teams.slice(0,4).map((t:any)=>t.fullName).join(", ")}. Season ${c.currentSeason ?? "X"}.`,
  },
  {
    id: "final", kind: "final_poster", emoji: "👑",
    label: "Grand Final Poster",
    desc: "Hero matchup art for the season decider",
    build: (c) => `Grand Final of ${c.league.name} Season ${c.currentSeason ?? "X"}. Two captains in heroic stance, the trophy gleaming between them.`,
  },
  {
    id: "top5runs", kind: "leaderboard_poster", emoji: "🏏",
    label: "Top 5 Run-Scorers (All-Time)",
    desc: "Stylish leaderboard card of the highest run-makers ever",
    build: (c) => {
      const agg = aggregate(c.matches);
      const top = [...agg].sort((a,b)=>b.runs-a.runs).slice(0,5);
      return `ALL-TIME TOP 5 RUN SCORERS leaderboard: ${top.map((p,i)=>`${i+1}. ${p.name} (${p.team}) — ${p.runs} runs`).join("; ")}. League: ${c.league.name}.`;
    },
  },
  {
    id: "top5wkts", kind: "leaderboard_poster", emoji: "🎯",
    label: "Top 5 Wicket-Takers (All-Time)",
    desc: "Bowling leaders rendered as glowing player cards",
    build: (c) => {
      const agg = aggregate(c.matches);
      const top = [...agg].sort((a,b)=>b.wickets-a.wickets).slice(0,5);
      return `ALL-TIME TOP 5 WICKET TAKERS leaderboard: ${top.map((p,i)=>`${i+1}. ${p.name} (${p.team}) — ${p.wickets} wickets`).join("; ")}. League: ${c.league.name}.`;
    },
  },
  {
    id: "top5sixes", kind: "leaderboard_poster", emoji: "💥",
    label: "Top 5 Six-Hitters",
    desc: "Maximum kings — explosive aesthetic",
    build: (c) => {
      const agg = aggregate(c.matches);
      const top = [...agg].sort((a,b)=>b.sixes-a.sixes).slice(0,5);
      return `TOP 5 SIX HITTERS leaderboard with fireball motif: ${top.map((p,i)=>`${i+1}. ${p.name} (${p.team}) — ${p.sixes} sixes`).join("; ")}.`;
    },
  },
  {
    id: "seasonTop", kind: "leaderboard_poster", emoji: "📈",
    label: "Season Top Scorers",
    desc: "Current-season run-scorer leaderboard poster",
    build: (c) => {
      // crude: matches already pertain to whole league; recordsAgg.aggregate doesn't take season filter so we approximate by latest matches.
      const agg = aggregate(c.matches);
      const top = [...agg].sort((a,b)=>b.runs-a.runs).slice(0,5);
      return `SEASON ${c.currentSeason ?? ""} ORANGE CAP race poster — top run scorers: ${top.map((p,i)=>`${i+1}. ${p.name} (${p.team}) — ${p.runs}`).join("; ")}.`;
    },
  },
  {
    id: "recap", kind: "season_recap", emoji: "🎬",
    label: "Season Recap Collage",
    desc: "Cinematic montage of the season's big moments",
    build: (c) => `${c.league.name} Season ${c.currentSeason ?? "X"} recap collage with iconic moments composited together.`,
  },
  {
    id: "trophy", kind: "trophy_lift", emoji: "🥇",
    label: "Champions Trophy Lift",
    desc: "The winning squad hoisting silverware",
    build: (c) => `Champions of ${c.league.name} Season ${c.currentSeason ?? "X"} lifting the trophy together.`,
  },
  {
    id: "matchup", kind: "matchup_poster", emoji: "⚔️",
    label: "Matchup / Clash Poster",
    desc: "Two teams head-to-head VS art",
    build: (c) => `Head-to-head clash poster between ${c.league.teams[0]?.fullName ?? "Team A"} and ${c.league.teams[1]?.fullName ?? "Team B"}.`,
  },
  {
    id: "jersey", kind: "jersey_concept", emoji: "👕",
    label: "Jersey Concept",
    desc: "Concept kit art for a chosen franchise",
    build: (c) => {
      const t: any = c.league.teams[0];
      return `New season jersey concept for ${t?.fullName ?? "the team"}, primary color ${t?.primary ?? "navy"}.`;
    },
  },
  {
    id: "stadium", kind: "stadium_atmosphere", emoji: "🏟️",
    label: "Stadium Atmosphere",
    desc: "Sold-out floodlit stadium hero shot",
    build: () => `Sold-out T20 stadium under blazing floodlights, sea of flags.`,
  },
  {
    id: "huddle", kind: "team_huddle", emoji: "🤝",
    label: "Team Huddle",
    desc: "Pre-match team huddle moment",
    build: (c) => `Pre-match huddle for ${c.league.teams[0]?.fullName ?? "the team"}, captain giving a pep talk.`,
  },
];

export default function ImageStudio({ league }: { league: League }) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [currentSeason, setCurrentSeason] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ id: string; url: string; label: string }[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customLabel, setCustomLabel] = useState("");

  useEffect(() => {
    (async () => {
      const [ms, sn] = await Promise.all([
        loadAllDoneMatches(league.id),
        supabase.from("seasons").select("season_number").eq("league_id", league.id).order("season_number", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setMatches(ms);
      setCurrentSeason(sn.data?.season_number);
      setLoading(false);
    })();
  }, [league.id]);

  const ctx: StudioCtx = useMemo(() => ({ league, matches, currentSeason }), [league, matches, currentSeason]);

  async function run(preset: Preset) {
    setBusyId(preset.id);
    const prompt = preset.build(ctx);
    toast.info(`Generating "${preset.label}"…`, { duration: 2500 });
    const url = await generateImage({
      kind: preset.kind,
      prompt,
      leagueId: league.id,
      seasonNumber: currentSeason,
    });
    if (url) {
      setGallery(g => [{ id: `${preset.id}-${Date.now()}`, url, label: `${preset.emoji} ${preset.label}` }, ...g]);
      toast.success(`${preset.emoji} ${preset.label} ready`);
    }
    setBusyId(null);
  }

  async function runCustom() {
    if (!customPrompt.trim()) { toast.error("Add a prompt first"); return; }
    setBusyId("custom");
    const url = await generateImage({
      kind: "custom", prompt: customPrompt, leagueId: league.id, seasonNumber: currentSeason,
    });
    if (url) {
      setGallery(g => [{ id: `custom-${Date.now()}`, url, label: customLabel || "✨ Custom" }, ...g]);
      toast.success("Custom image ready");
    }
    setBusyId(null);
  }

  function download(url: string, label: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.replace(/[^a-z0-9]+/gi,"_")}.png`;
    a.click();
  }

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-primary"/></div>;

  return (
    <div className="space-y-5">
      <Card className="p-5 gradient-card border-border/60">
        <div className="font-display text-lg mb-1 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-primary"/> AI Image Studio
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Generate posters, leaderboards & ceremony art. Each tile pulls live league data into the prompt.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {PRESETS.map(p => (
            <button
              key={p.id}
              disabled={!!busyId}
              onClick={() => run(p)}
              className="group text-left p-3 rounded-lg border border-border/40 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-2xl mb-1">{p.emoji}</div>
              <div className="font-display text-sm tracking-wide">{p.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{p.desc}</div>
              {busyId === p.id && <Loader2 className="w-3 h-3 mt-2 animate-spin text-primary"/>}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5 gradient-card border-border/60">
        <div className="font-display text-lg mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary"/> Custom Prompt</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="Label (optional)" value={customLabel} onChange={e => setCustomLabel(e.target.value)} />
          <Textarea
            className="md:col-span-2 min-h-[60px]"
            placeholder="e.g. A retro 1990s cricket trading-card style portrait of the captain holding the trophy."
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
          />
        </div>
        <Button onClick={runCustom} disabled={busyId === "custom"} className="mt-3 gradient-primary text-primary-foreground">
          {busyId === "custom" ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
          Generate
        </Button>
      </Card>

      <Card className="p-5 gradient-card border-border/60">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-lg flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary"/> Gallery</div>
          <Badge variant="outline" className="border-primary/40">{gallery.length} images</Badge>
        </div>
        {gallery.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">No images yet — tap a preset above to start.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {gallery.map(g => (
              <div key={g.id} className="rounded-lg overflow-hidden border border-border/40 bg-secondary/20">
                <img src={g.url} alt={g.label} className="w-full aspect-square object-cover" loading="lazy"/>
                <div className="p-2 flex items-center justify-between gap-2">
                  <div className="text-[11px] truncate">{g.label}</div>
                  <button onClick={() => download(g.url, g.label)} className="text-primary hover:text-primary/80">
                    <Download className="w-3.5 h-3.5"/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
