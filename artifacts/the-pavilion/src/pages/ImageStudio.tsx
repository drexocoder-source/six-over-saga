import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague } from "@/lib/league";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Download, Trash2, ImageIcon, Wand2, Trophy, Users, Camera, Zap } from "lucide-react";
import { toast } from "sonner";

interface GeneratedImage {
  id: string;
  url: string;
  label: string;
  category: string;
  timestamp: number;
}

type Category = "portrait" | "moment" | "trophy" | "team" | "custom";

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode; color: string; presets: { label: string; body: object }[] }[] = [
  {
    id: "portrait",
    label: "Player Portrait",
    icon: <Camera className="w-4 h-4" />,
    color: "hsl(142 55% 48%)",
    presets: [
      { label: "Batting Hero", body: { kind: "portrait", prompt: "Epic cricket batsman in full IPL gear, aggressive batting stance, stadium lights, dramatic dark background, photorealistic" } },
      { label: "Bowling Legend", body: { kind: "portrait", prompt: "Dynamic cricket fast bowler in IPL jersey mid-delivery action, ball in hand, stadium background, ultra detailed" } },
      { label: "Wicket-Keeper", body: { kind: "portrait", prompt: "IPL wicket-keeper in crouching ready position, gloves raised, full cricket gear, dramatic lighting, photorealistic" } },
    ],
  },
  {
    id: "moment",
    label: "Match Moment",
    icon: <Zap className="w-4 h-4" />,
    color: "hsl(36 95% 55%)",
    presets: [
      { label: "Six Hit", body: { kind: "match_moment", prompt: "Cricket batsman hitting a huge six, ball flying over boundary, packed stadium, fireworks, night match, dramatic" } },
      { label: "Last Over", body: { kind: "match_moment", prompt: "Tense last over cricket scene, fielders in positions, batsman ready, scoreboard showing close game, electrifying atmosphere" } },
      { label: "Celebration", body: { kind: "match_moment", prompt: "IPL team celebrating winning the championship, confetti raining down, players jumping, crowd roaring, golden trophies" } },
    ],
  },
  {
    id: "trophy",
    label: "Ceremony",
    icon: <Trophy className="w-4 h-4" />,
    color: "hsl(42 95% 65%)",
    presets: [
      { label: "IPL Trophy", body: { kind: "trophy", prompt: "Glowing IPL trophy on dramatic dark background, gold and silver, spotlights, cinematic, hyper-detailed" } },
      { label: "Awards Night", body: { kind: "trophy", prompt: "Cricket awards ceremony stage, trophies lined up, red carpet, dramatic spotlights, luxury event hall, cinematic" } },
      { label: "Medal Ceremony", body: { kind: "trophy", prompt: "Cricket player receiving gold medal on podium, crowd cheering, flags, dramatic stadium lighting, emotional moment" } },
    ],
  },
  {
    id: "team",
    label: "Team Banner",
    icon: <Users className="w-4 h-4" />,
    color: "hsl(270 60% 60%)",
    presets: [
      { label: "Team Photo", body: { kind: "team", prompt: "IPL cricket team official squad photo, professional kit, stadium backdrop, dramatic lighting, majestic composition" } },
      { label: "Stadium Banner", body: { kind: "team", prompt: "Cricket franchise stadium banner, bold team colors, lion mascot, IPL logo aesthetic, epic composition" } },
      { label: "Dressing Room", body: { kind: "team", prompt: "Cricket team dressing room before a big match, jerseys hanging, boots lined up, tense atmosphere, cinematic lighting" } },
    ],
  },
];

export default function ImageStudio() {
  const [activeCategory, setActiveCategory] = useState<Category>("portrait");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [gallery, setGallery] = useState<GeneratedImage[]>([]);
  const [selected, setSelected] = useState<GeneratedImage | null>(null);

  const cat = CATEGORIES.find(c => c.id === activeCategory)!;

  async function generate(label: string, body: object) {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", { body });
      if (error) throw error;
      if (!data?.image_url) throw new Error("No image returned.");
      const img: GeneratedImage = {
        id: Date.now().toString(),
        url: data.image_url,
        label,
        category: activeCategory,
        timestamp: Date.now(),
      };
      setGallery(prev => [img, ...prev]);
      setSelected(img);
      toast.success("Image generated!");
    } catch (e: any) {
      const msg = e?.message ?? "Generation failed.";
      if (msg.includes("OpenAI") || msg.includes("API key")) {
        toast.error("Set OPENAI_API_KEY in Replit Secrets to enable image generation.");
      } else {
        toast.error(msg);
      }
    } finally {
      setGenerating(false);
    }
  }

  function handleCustomGenerate() {
    if (!customPrompt.trim()) { toast.error("Enter a prompt."); return; }
    generate(customPrompt.slice(0, 40), { kind: "custom", prompt: customPrompt });
  }

  function downloadImage(img: GeneratedImage) {
    const a = document.createElement("a");
    a.href = img.url;
    a.download = `pavilion-${img.id}.png`;
    a.click();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-8 md:p-12"
        style={{
          background: "linear-gradient(145deg, hsl(270 30% 10%), hsl(24 12% 7%))",
          border: "1px solid hsl(270 50% 30% / 0.3)",
          boxShadow: "0 0 60px -20px hsl(270 60% 50% / 0.3)",
        }}>
        <div className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top left, hsl(270 60% 50% / 0.25), transparent 60%)" }} />
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at bottom right, hsl(36 95% 55% / 0.2), transparent 60%)" }} />

        <div className="relative">
          <div className="kicker mb-2 text-purple-400/80">AI-POWERED</div>
          <h1 className="font-display text-5xl md:text-6xl tracking-wider flex items-center gap-4">
            <Sparkles className="w-10 h-10 text-purple-400" />
            Image Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg">
            Generate cinematic cricket imagery — match moments, player portraits, trophy ceremonies and more — powered by DALL·E.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Controls ── */}
        <div className="space-y-4">
          {/* Category tabs */}
          <div className="rounded-xl overflow-hidden glass-card">
            <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" />
              <span className="font-display text-lg tracking-wider">Category</span>
            </div>
            <div className="p-3 space-y-1.5">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setActiveCategory(c.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all text-left ${
                    activeCategory === c.id ? "border" : "hover:bg-white/4 text-white/50"
                  }`}
                  style={activeCategory === c.id ? {
                    background: `${c.color}15`,
                    borderColor: `${c.color}44`,
                    color: c.color,
                  } : {}}>
                  <span style={activeCategory === c.id ? { color: c.color } : {}}>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Presets */}
          <div className="rounded-xl overflow-hidden glass-card">
            <div className="px-4 py-3 border-b border-white/6">
              <div className="font-display text-lg tracking-wider">Quick Generate</div>
              <div className="text-[10px] text-white/30 mt-0.5">One-click presets for {cat.label}</div>
            </div>
            <div className="p-3 space-y-2">
              {cat.presets.map((p, i) => (
                <button key={i} onClick={() => generate(p.label, p.body)} disabled={generating}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm text-left transition-all studio-card disabled:opacity-50">
                  <span className="font-semibold text-white/80">{p.label}</span>
                  {generating ? <Loader2 className="w-4 h-4 animate-spin text-white/30" /> : <Sparkles className="w-3.5 h-3.5 text-white/20" />}
                </button>
              ))}
            </div>
          </div>

          {/* Custom prompt */}
          <div className="rounded-xl overflow-hidden glass-card">
            <div className="px-4 py-3 border-b border-white/6">
              <div className="font-display text-lg tracking-wider">Custom Prompt</div>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Describe your cricket image in vivid detail…"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20 resize-none focus:outline-none focus:border-primary/50 transition-colors"
                rows={4}
              />
              <Button onClick={handleCustomGenerate} disabled={generating || !customPrompt.trim()}
                className="w-full gradient-primary font-semibold">
                {generating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating…</> : <><Sparkles className="w-4 h-4 mr-2" />Generate</>}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Preview + Gallery ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Main preview */}
          <div className="rounded-xl overflow-hidden glass-card aspect-square md:aspect-video flex items-center justify-center relative"
            style={{ minHeight: 300 }}>
            {generating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "hsl(270 50% 20%)", border: "1px solid hsl(270 50% 40% / 0.4)" }}>
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                </div>
                <div className="text-sm text-white/60 font-semibold">Conjuring your image…</div>
                <div className="text-xs text-white/30">This takes about 10–20 seconds</div>
              </div>
            )}

            {selected ? (
              <>
                <img src={selected.url} alt={selected.label}
                  className="w-full h-full object-contain rounded-xl" />
                <div className="absolute bottom-0 left-0 right-0 p-4"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="font-semibold text-sm text-white/90">{selected.label}</div>
                      <div className="text-[10px] text-white/40">{new Date(selected.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => downloadImage(selected)}
                        className="border-white/20 text-white/70 hover:bg-white/10">
                        <Download className="w-3.5 h-3.5 mr-1.5" />Download
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center p-8">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <ImageIcon className="w-8 h-8 text-white/20" />
                </div>
                <div className="font-display text-xl text-white/30">Your image will appear here</div>
                <div className="text-xs text-white/20 mt-1">Pick a preset or write a custom prompt</div>
              </div>
            )}
          </div>

          {/* Gallery */}
          {gallery.length > 0 && (
            <div className="rounded-xl overflow-hidden glass-card">
              <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
                <span className="font-display text-lg tracking-wider">Generated Images</span>
                <span className="text-[10px] text-white/30 font-mono">{gallery.length} images</span>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {gallery.map(img => (
                    <div key={img.id} className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer"
                      style={{ border: `2px solid ${selected?.id === img.id ? "hsl(var(--primary))" : "transparent"}` }}
                      onClick={() => setSelected(img)}>
                      <img src={img.url} alt={img.label} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                      <button
                        onClick={e => { e.stopPropagation(); setGallery(prev => prev.filter(i => i.id !== img.id)); if (selected?.id === img.id) setSelected(null); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3 text-rose-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
