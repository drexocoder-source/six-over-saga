// Worm chart — cumulative runs per innings, with wicket markers
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Legend } from "recharts";
import type { WormPoint } from "@/lib/worm";

interface Props {
  series: WormPoint[][];   // [innings1Points, innings2Points?]
  colors: [string, string];
}

export function WormChart({ series, colors }: Props) {
  // Merge into a single dataset keyed by ball index for direct overlay
  const maxLen = Math.max(...series.map(s => s.length));
  const data = Array.from({ length: maxLen }, (_, i) => {
    const row: any = { ball: i + 1 };
    series.forEach((s, idx) => {
      const p = s[i];
      if (p) row[`team${idx}`] = p.runs;
    });
    return row;
  });

  return (
    <div className="w-full h-72 bg-secondary/20 rounded-lg p-3 border border-border/40">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Worm Chart — Cumulative Runs</div>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis dataKey="ball" stroke="hsl(var(--muted-foreground))" fontSize={10} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(ball) => `Ball ${ball}`}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, idx) => (
            <Line key={idx}
              type="monotone"
              dataKey={`team${idx}`}
              name={s[0]?.team ?? `Innings ${idx + 1}`}
              stroke={colors[idx]}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
          {/* Wicket markers */}
          {series.flatMap((s, idx) =>
            s.filter(p => p.isWicket).map((p, j) => (
              <ReferenceDot key={`${idx}-${j}`} x={p.ball} y={p.runs} r={4} fill={colors[idx]} stroke="#fff" strokeWidth={1} />
            ))
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
