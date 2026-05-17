// Chairman AI chat — streams responses from /chairman-chat edge function.
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Loader2, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import type { League } from "@/lib/league";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Who's leading the points table and why?",
  "Best captain pick from the top-rated all-rounders?",
  "Explain the Q1 vs Eliminator difference.",
  "Which team has the easiest run-in?",
  "Suggest a retention strategy for next mini auction.",
  "Predict the playoff bracket from current form.",
];

export interface ChairmanChatContext {
  league: { name: string; teamsCount: number; settings: any };
  season?: { number: number; year: number; status: string };
  topPlayers?: Array<{ name: string; rating: number; role: string }>;
  standings?: Array<{ team: string; P: number; W: number; L: number; pts: number; nrr: number }>;
  topScorers?: Array<{ name: string; team: string; runs: number }>;
  topWicketTakers?: Array<{ name: string; team: string; wickets: number }>;
  recentResults?: Array<{ teamA: string; teamB: string; winner: string | null }>;
}

export default function ChairmanChat({ league, context }: { league: League; context: ChairmanChatContext }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: `Yo Chairman 👋 — I've read up on **${league.name}**. Ask me about standings, records, captain picks, scenarios, or anything cricket strategy.` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chairman-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })), context }),
      });
      if (resp.status === 429) { toast.error("AI rate limit — try in a moment."); setLoading(false); return; }
      if (resp.status === 402) { toast.error("Out of AI credits. Top up in Cloud settings."); setLoading(false); return; }
      if (!resp.ok || !resp.body) { toast.error("AI failed"); setLoading(false); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", soFar = "", done = false;
      setMessages(m => [...m, { role: "assistant", content: "" }]);
      const flush = (chunk: string) => {
        soFar += chunk;
        setMessages(m => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: soFar };
          return copy;
        });
      };
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) flush(c);
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e) {
      toast.error("Chat failed");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="gradient-card border-border/60 flex flex-col h-[70vh] max-h-[700px]">
      <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
        <Bot className="w-4 h-4 text-primary"/>
        <div>
          <div className="font-display text-base">Chairman AI Assistant</div>
          <div className="text-[10px] text-muted-foreground">Knows your league inside-out · powered by Lovable AI</div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><Bot className="w-3.5 h-3.5 text-primary"/></div>}
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary/50 border border-border/40"}`}>
              {m.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_strong]:text-primary">
                  <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                </div>
              ) : (
                <span>{m.content}</span>
              )}
            </div>
            {m.role === "user" && <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0"><User className="w-3.5 h-3.5"/></div>}
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2"><div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center"><Loader2 className="w-3.5 h-3.5 animate-spin text-primary"/></div><div className="text-xs text-muted-foreground italic pt-1">thinking…</div></div>
        )}
      </div>
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)} disabled={loading}
              className="text-[11px] px-2 py-1 rounded border border-border/50 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-colors flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary/70"/>{s}
            </button>
          ))}
        </div>
      )}
      <div className="p-3 border-t border-border/60 flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask the Chairman AI…"
          disabled={loading}
        />
        <Button onClick={() => send(input)} disabled={loading || !input.trim()} className="gradient-primary text-primary-foreground">
          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
        </Button>
      </div>
    </Card>
  );
}
