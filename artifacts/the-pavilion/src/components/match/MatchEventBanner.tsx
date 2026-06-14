import { useEffect, useState } from "react";
import { Cloud, Zap, AlertTriangle, Shield, Flame, Users } from "lucide-react";
import type { MatchEvent } from "@/lib/matchEvents";

export type { MatchEvent };

const EVENT_STYLES: Record<MatchEvent["type"], {
  icon: React.ReactNode;
  bg: string;
  border: string;
  accent: string;
  glow: string;
  badge: string;
}> = {
  rain: {
    icon: <Cloud className="w-6 h-6" />,
    bg: "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(14,165,233,0.06))",
    border: "rgba(56,189,248,0.35)",
    accent: "#38bdf8",
    glow: "0 0 40px rgba(56,189,248,0.25)",
    badge: "RAIN DELAY",
  },
  floodlight: {
    icon: <Zap className="w-6 h-6" />,
    bg: "linear-gradient(135deg, rgba(250,204,21,0.12), rgba(234,179,8,0.06))",
    border: "rgba(250,204,21,0.35)",
    accent: "#facc15",
    glow: "0 0 40px rgba(250,204,21,0.25)",
    badge: "FLOODLIGHT FAILURE",
  },
  injury: {
    icon: <AlertTriangle className="w-6 h-6" />,
    bg: "linear-gradient(135deg, rgba(248,113,113,0.12), rgba(239,68,68,0.06))",
    border: "rgba(248,113,113,0.35)",
    accent: "#f87171",
    glow: "0 0 40px rgba(248,113,113,0.25)",
    badge: "INJURY SCARE",
  },
  drs: {
    icon: <Shield className="w-6 h-6" />,
    bg: "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(139,92,246,0.06))",
    border: "rgba(167,139,250,0.35)",
    accent: "#a78bfa",
    glow: "0 0 40px rgba(167,139,250,0.25)",
    badge: "DRS UNDER REVIEW",
  },
  pitch: {
    icon: <Flame className="w-6 h-6" />,
    bg: "linear-gradient(135deg, rgba(251,146,60,0.12), rgba(249,115,22,0.06))",
    border: "rgba(251,146,60,0.35)",
    accent: "#fb923c",
    glow: "0 0 40px rgba(251,146,60,0.25)",
    badge: "PITCH DAMAGE",
  },
  crowd: {
    icon: <Users className="w-6 h-6" />,
    bg: "linear-gradient(135deg, rgba(52,211,153,0.12), rgba(16,185,129,0.06))",
    border: "rgba(52,211,153,0.35)",
    accent: "#34d399",
    glow: "0 0 40px rgba(52,211,153,0.25)",
    badge: "CROWD INCIDENT",
  },
};

interface Props {
  event: MatchEvent | null;
  onDismiss: () => void;
}

export function MatchEventBanner({ event, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (event) {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 400);
      }, event.resumeDelay ?? 3500);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      return undefined;
    }
  }, [event?.id]);

  if (!event) return null;

  const s = EVENT_STYLES[event.type];

  return (
    <div className={`transition-all duration-400 overflow-hidden ${visible ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
      <div className="rounded-2xl p-4 mb-3 relative overflow-hidden"
        style={{
          background: s.bg,
          border: `1px solid ${s.border}`,
          boxShadow: s.glow,
        }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `${s.accent}20`, color: s.accent, border: `1px solid ${s.accent}44` }}>
            {s.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-black uppercase tracking-[0.25em] px-2 py-0.5 rounded-full"
                style={{ background: `${s.accent}22`, color: s.accent, border: `1px solid ${s.accent}44` }}>
                ⚡ {s.badge}
              </span>
              <span className="text-[9px] text-white/25 uppercase tracking-widest">MATCH UPDATE</span>
            </div>
            <div className="font-display text-lg tracking-wider text-white/95 leading-tight">{event.headline}</div>
            <div className="text-xs text-white/50 mt-0.5 leading-relaxed">{event.detail}</div>
          </div>
          <button onClick={() => { setVisible(false); setTimeout(onDismiss, 400); }}
            className="text-white/20 hover:text-white/60 transition-colors text-xl shrink-0">×</button>
        </div>
      </div>
    </div>
  );
}
