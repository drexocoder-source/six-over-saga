// Animated celebration overlay for live match milestones.
import { useEffect, useState } from "react";

export type CelebrationKind =
  | "fifty" | "century"
  | "hat_trick" | "five_wicket"
  | "boundary_streak" | "back_to_back_six"
  | "team_100" | "team_200"
  | "maiden" | "wicket_maiden";

export interface CelebrationEvent {
  id: string;       // unique to retrigger animation
  kind: CelebrationKind;
  title: string;    // e.g. "FIFTY!"
  subtitle?: string;// e.g. "Rohit Sharma — 50 off 28"
  color?: string;   // optional team color
}

const STYLES: Record<CelebrationKind, { emoji: string; bg: string; ring: string }> = {
  fifty:            { emoji: "5️⃣0️⃣",  bg: "from-amber-500 via-yellow-400 to-orange-500", ring: "ring-amber-300/60" },
  century:          { emoji: "💯",    bg: "from-fuchsia-500 via-purple-500 to-indigo-500", ring: "ring-fuchsia-300/60" },
  hat_trick:        { emoji: "🎩🔥",  bg: "from-rose-500 via-red-500 to-orange-500",       ring: "ring-rose-300/60" },
  five_wicket:      { emoji: "🖐️🎯", bg: "from-rose-600 via-pink-500 to-fuchsia-500",      ring: "ring-pink-300/60" },
  boundary_streak:  { emoji: "🔥💥",  bg: "from-orange-500 via-amber-500 to-yellow-400",   ring: "ring-orange-300/60" },
  back_to_back_six: { emoji: "🚀🚀", bg: "from-emerald-500 via-teal-500 to-cyan-500",      ring: "ring-emerald-300/60" },
  team_100:         { emoji: "💯⚡",  bg: "from-sky-500 via-blue-500 to-indigo-500",        ring: "ring-sky-300/60" },
  team_200:         { emoji: "🎉",    bg: "from-violet-500 via-purple-600 to-pink-500",     ring: "ring-violet-300/60" },
  maiden:           { emoji: "🚫",    bg: "from-slate-500 via-zinc-500 to-stone-500",       ring: "ring-slate-300/60" },
  wicket_maiden:    { emoji: "🎯🚫", bg: "from-red-500 via-rose-500 to-pink-500",          ring: "ring-red-300/60" },
};

export function CelebrationOverlay({ event, onClose }: { event: CelebrationEvent | null; onClose: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!event) return;
    setShow(true);
    const t = setTimeout(() => { setShow(false); setTimeout(onClose, 300); }, 2600);
    return () => clearTimeout(t);
  }, [event?.id]);

  if (!event) return null;
  const s = STYLES[event.kind];
  return (
    <div className={`fixed inset-x-0 top-16 z-50 flex justify-center pointer-events-none transition-all duration-300 ${show ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}>
      <div className={`px-8 py-4 rounded-2xl bg-gradient-to-br ${s.bg} ring-4 ${s.ring} shadow-2xl text-white text-center animate-scale-in max-w-sm`}>
        <div className="text-3xl">{s.emoji}</div>
        <div className="font-display text-3xl tracking-widest mt-1 drop-shadow">{event.title}</div>
        {event.subtitle && <div className="text-sm font-medium opacity-95 mt-1">{event.subtitle}</div>}
        {/* confetti dots */}
        <div className="flex justify-center gap-1 mt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
