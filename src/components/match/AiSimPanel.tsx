// Compact panel: "Next Ball (AI)" button + commentary style + difficulty selector
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sparkles, Zap, Bot } from "lucide-react";

export type CommentaryStyle = "normal" | "hype" | "funny" | "serious";
export type Difficulty = "easy" | "normal" | "hard" | "pro";

interface Props {
  onNextBall: () => void;
  disabled?: boolean;
  style: CommentaryStyle;
  difficulty: Difficulty;
  onStyleChange: (s: CommentaryStyle) => void;
  onDifficultyChange: (d: Difficulty) => void;
  autoPlay: boolean;
  onAutoPlayChange: (v: boolean) => void;
  autoMatch?: boolean;
  onAutoMatchChange?: (v: boolean) => void;
  speedMs?: number;
  onSpeedChange?: (ms: number) => void;
}

export function AiSimPanel({ onNextBall, disabled, style, difficulty, onStyleChange, onDifficultyChange, autoPlay, onAutoPlayChange, autoMatch, onAutoMatchChange, speedMs, onSpeedChange }: Props) {
  return (
    <div className="space-y-3 pt-3 border-t border-border/40">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-primary" /> AI Simulation
      </div>
      {onAutoMatchChange && (
        <Button
          onClick={() => onAutoMatchChange(!autoMatch)}
          size="lg"
          variant={autoMatch ? "default" : "outline"}
          className={`w-full font-display tracking-wider ${autoMatch ? "gradient-primary text-primary-foreground glow-primary" : ""}`}
        >
          <Bot className="w-4 h-4 mr-2" /> {autoMatch ? "AI Match: ON — fully auto" : "AI Match (full auto)"}
        </Button>
      )}
      <Button
        onClick={onNextBall}
        disabled={disabled}
        size="lg"
        className="w-full gradient-primary text-primary-foreground font-display tracking-wider"
      >
        <Zap className="w-4 h-4 mr-2" /> Next Ball (AI)
      </Button>
      <Button
        onClick={() => onAutoPlayChange(!autoPlay)}
        size="sm"
        variant={autoPlay ? "default" : "outline"}
        className="w-full"
        disabled={disabled}
      >
        {autoPlay ? "⏸ Pause Auto-play" : `▶ Auto-play (${((speedMs ?? 1200)/1000).toFixed(1)}s/ball)`}
      </Button>
      {onSpeedChange && (
        <div className="px-1">
          <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-muted-foreground mb-1">
            <span>Sim Speed</span>
            <span className="font-mono normal-case tracking-normal text-foreground/80">{((speedMs ?? 1200)/1000).toFixed(2)}s / ball</span>
          </div>
          <Slider
            min={200}
            max={3000}
            step={100}
            value={[speedMs ?? 1200]}
            onValueChange={(v) => onSpeedChange(v[0])}
          />
          <div className="flex justify-between text-[9px] text-muted-foreground/70 mt-1">
            <span>Fast</span><span>Slow</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Commentary</div>
          <Select value={style} onValueChange={v => onStyleChange(v as CommentaryStyle)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">🎙️ Normal</SelectItem>
              <SelectItem value="hype">🔥 Hype</SelectItem>
              <SelectItem value="funny">😂 Funny</SelectItem>
              <SelectItem value="serious">📊 Serious</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Difficulty</div>
          <Select value={difficulty} onValueChange={v => onDifficultyChange(v as Difficulty)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">🟢 Easy</SelectItem>
              <SelectItem value="normal">⚪ Normal</SelectItem>
              <SelectItem value="hard">🟠 Hard</SelectItem>
              <SelectItem value="pro">🔴 Pro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground/80 italic">
        Or use Manual / Wheel above to override.
      </div>
    </div>
  );
}
