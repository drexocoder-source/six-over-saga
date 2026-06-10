import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, GitBranch, Zap, Star, Send, RefreshCw, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PRESETS = [
  { icon: "🦁", label: "What if Dhoni captained RCB?", prompt: "Imagine MS Dhoni captaining Royal Challengers Bangalore instead of Chennai Super Kings for an entire IPL season. Describe the tactical changes, how the team would play differently, the dressing room dynamics, and what the season results might look like. Be vivid and specific." },
  { icon: "💥", label: "What if MI never released Bumrah?", prompt: "Imagine Mumbai Indians never released Jasprit Bumrah and he played his entire career there. How would the death-over dynamics change for MI? What records might he hold? How would other teams have adapted? Paint a detailed alternate history." },
  { icon: "👑", label: "Fantasy Super Team — all-time XI", prompt: "Build the ultimate fantasy XI from any era of IPL cricket. Pick the best batters, all-rounders, bowlers and a keeper. For each player explain why they make the cut over others. Then predict how this super team would demolish a full IPL season." },
  { icon: "🌪️", label: "What if Virat never left RCB captaincy?", prompt: "Virat Kohli stepped down as RCB captain after 2021. What if he stayed captain through 2026? How would the team-building strategy differ, which players would RCB target in auction, and would they finally win the IPL title? Write the alternate timeline." },
  { icon: "🤝", label: "What if Rohit-Virat opened together?", prompt: "Imagine a scenario where Rohit Sharma and Virat Kohli bat together as opening partners for the same IPL franchise. What franchise? What would the opening partnerships look like? What bowling attacks would struggle most? Write the fantasy match scenario." },
  { icon: "🏆", label: "Greatest final never played", prompt: "Design the greatest IPL final that never actually happened — pick two iconic squads from different eras, describe the build-up, key match-ups, and write the ball-by-ball narrative of the last over. Make it dramatic and unforgettable." },
  { icon: "🌍", label: "What if overseas rules were removed?", prompt: "Imagine IPL removed the 4 overseas player limit entirely — teams could field all 11 overseas players. How would auctions change? Which franchises would dominate? Which Indian talents would lose out? How would Indian cricket develop? Analyze the full impact." },
  { icon: "⏳", label: "2008 squad vs 2024 squad", prompt: "Pit the best IPL squad of 2008 against the best IPL squad of 2024 in a time-travel T20 match. Who wins? Which 2008 legends would handle modern powerplay rules? Which modern players would struggle against the 2008 bowling attacks? Play out the match." },
];

interface Message { role: "user" | "assistant"; content: string; }

export default function Multiverse() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function ask(prompt: string) {
    if (streaming) return;
    const newMsg: Message = { role: "user", content: prompt };
    const history = [...messages, newMsg];
    setMessages(history);
    setInput("");
    setStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages([...history, assistantMsg]);

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chairman-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are the IPL Multiverse Oracle — a dramatic, knowledgeable cricket storyteller. When asked 'what if' questions, paint vivid alternate histories with tactical depth, player personalities, crowd reactions, and unforgettable match moments. Use cricket terminology. Be bold, specific and entertaining. Use markdown for structure when helpful." },
            ...history.map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      });
      if (!resp.ok || !resp.body) throw new Error(await resp.text());
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (raw === "[DONE]") break;
          try {
            const d = JSON.parse(raw);
            const delta = d.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              assistantMsg.content += delta;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { ...assistantMsg };
                return next;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Multiverse unreachable — try again");
    }
    setStreaming(false);
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setActivePreset(null);
    setStreaming(false);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-primary/80">AI · ALTERNATE HISTORIES</div>
          <h1 className="font-display text-4xl tracking-wider flex items-center gap-2">
            <GitBranch className="w-8 h-8 text-primary"/> Multiverse
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ask the AI "what if?" about your league, legendary players, or cricket history. Every answer is a different universe.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" onClick={reset} className="border-primary/40 text-primary">
            <RefreshCw className="w-4 h-4 mr-2"/> New Universe
          </Button>
        )}
      </div>

      {messages.length === 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => { setActivePreset(i); ask(p.prompt); }}
                className="text-left p-4 rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/50 hover:border-primary/40 transition-all group"
              >
                <div className="text-2xl mb-2">{p.icon}</div>
                <div className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">{p.label}</div>
                <ChevronRight className="w-3.5 h-3.5 text-primary/0 group-hover:text-primary/70 mt-2 transition-colors"/>
              </button>
            ))}
          </div>

          <Card className="p-6 gradient-card border-primary/20 text-center">
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3 opacity-60"/>
            <p className="text-muted-foreground text-sm">Choose a scenario above or ask your own "what if" question below.</p>
          </Card>
        </>
      )}

      {messages.length > 0 && (
        <div className="space-y-4 max-w-3xl">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <Card className={`p-4 max-w-[85%] ${m.role === "user" ? "gradient-primary text-primary-foreground border-primary/60" : "gradient-card border-border/60"}`}>
                {m.role === "assistant" && (
                  <div className="flex items-center gap-1.5 text-[10px] tracking-widest text-primary mb-2 uppercase">
                    <Zap className="w-3 h-3"/> Multiverse Oracle
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {m.content}
                  {streaming && i === messages.length - 1 && m.role === "assistant" && (
                    <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse"/>
                  )}
                </div>
                {m.role === "assistant" && !streaming && m.content && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[9px] border-primary/30 text-primary/70">
                      <Star className="w-2.5 h-2.5 mr-1"/> AI Generated
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">What If?</Badge>
                  </div>
                )}
              </Card>
            </div>
          ))}
          {streaming && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary"/>
              Exploring the multiverse…
            </div>
          )}
        </div>
      )}

      <div className="max-w-3xl">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && input.trim()) { e.preventDefault(); ask(input.trim()); }}}
            placeholder='Ask your own "What if…?" — e.g. "What if IPL had no auction and used a draft system?"'
            className="bg-secondary/30 border-border/40 resize-none"
            rows={2}
            disabled={streaming}
          />
          <Button
            onClick={() => ask(input.trim())}
            disabled={!input.trim() || streaming}
            className="gradient-primary text-primary-foreground self-end"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Shift+Enter for newline · Enter to send</p>
      </div>
    </div>
  );
}
