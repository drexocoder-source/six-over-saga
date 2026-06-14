import { useState, useEffect } from "react";
import { Mic, X, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface QA {
  journalist: string;
  tone: "ENTHUSIASTIC" | "PROBING" | "ANALYTICAL" | "CHEEKY";
  question: string;
  answer: string;
}

interface Props {
  playerOfMatch: string;
  winnerTeam: string;
  loserTeam: string;
  resultText: string;
  topBat: string;
  topBowl: string;
  margin: string;
  onClose: () => void;
}

const TONE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  ENTHUSIASTIC: { label: "Enthusiastic", color: "#34d399", bg: "rgba(52,211,153,0.10)" },
  PROBING:      { label: "Probing",      color: "#f87171", bg: "rgba(248,113,113,0.10)" },
  ANALYTICAL:   { label: "Analytical",   color: "#60a5fa", bg: "rgba(96,165,250,0.10)" },
  CHEEKY:       { label: "Cheeky",       color: "#fbbf24", bg: "rgba(251,191,36,0.10)" },
};

export function PressConference({ playerOfMatch, winnerTeam, loserTeam, resultText, topBat, topBowl, margin, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [transcript, setTranscript] = useState<QA[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<number>(0);

  async function fetchTranscript() {
    setLoading(true);
    setError(null);
    setTranscript([]);
    setRevealed(0);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("press-conference", {
        body: { playerOfMatch, winnerTeam, loserTeam, resultText, topBat, topBowl, margin },
      });
      if (fnErr) throw new Error(fnErr.message);
      const qa: QA[] = data?.transcript ?? [];
      setTranscript(qa);
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate press conference.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTranscript(); }, []);

  useEffect(() => {
    if (transcript.length === 0 || revealed >= transcript.length) return;
    const t = setTimeout(() => setRevealed(r => r + 1), 600);
    return () => clearTimeout(t);
  }, [revealed, transcript.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0e0e12 0%, #12121a 100%)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 80px rgba(0,0,0,0.8)" }}>

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 shrink-0"
          style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(99,102,241,0.06))", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-transparent" />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] tracking-[0.4em] uppercase text-purple-400/70 mb-1">Post-Match</div>
              <div className="font-display text-2xl tracking-widest text-white flex items-center gap-3">
                <Mic className="w-5 h-5 text-purple-400" />
                PRESS CONFERENCE
              </div>
              <div className="text-xs text-white/40 mt-1">
                {playerOfMatch} · Player of the Match · {winnerTeam} beat {loserTeam}
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/05 hover:bg-white/10 flex items-center justify-center transition-colors text-white/40 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-purple-400 animate-spin" />
              </div>
              <div className="text-sm text-white/40 text-center">
                <div>Setting up the press room…</div>
                <div className="text-xs mt-1 text-white/25">Journalists are preparing their questions</div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="text-red-400/60 text-sm mb-4">{error}</div>
              <Button variant="outline" size="sm" onClick={fetchTranscript}>
                <RefreshCw className="w-3.5 h-3.5 mr-2" /> Try again
              </Button>
            </div>
          )}

          {transcript.slice(0, revealed).map((qa, i) => {
            const ts = TONE_STYLE[qa.tone] ?? TONE_STYLE.ANALYTICAL;
            return (
              <div key={i} className="animate-fade-in rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${ts.color}22`, background: ts.bg }}>
                {/* Journalist question */}
                <div className="px-4 pt-3 pb-2" style={{ borderBottom: `1px solid ${ts.color}18` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black"
                      style={{ background: ts.color, color: "#000" }}>Q</div>
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: ts.color }}>
                      {qa.journalist}
                    </span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full"
                      style={{ background: `${ts.color}20`, color: ts.color, border: `1px solid ${ts.color}30` }}>
                      {ts.label}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed font-medium">"{qa.question}"</p>
                </div>
                {/* Player answer */}
                <div className="px-4 pt-2 pb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-black text-white/60">A</div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">{playerOfMatch}</span>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed italic">"{qa.answer}"</p>
                </div>
              </div>
            );
          })}

          {/* Typing indicator — show while more Q&A to reveal */}
          {!loading && !error && revealed < transcript.length && (
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="w-2 h-2 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="text-xs text-white/25 ml-1">Next question…</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && revealed >= transcript.length && transcript.length > 0 && (
          <div className="px-6 py-4 flex justify-between items-center shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <Button variant="ghost" size="sm" onClick={fetchTranscript} className="text-white/30 hover:text-white/60 gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> New questions
            </Button>
            <Button size="sm" onClick={onClose} className="gradient-primary text-primary-foreground">
              Close Press Room
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
