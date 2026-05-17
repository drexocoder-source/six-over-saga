import { useEffect, useState } from "react";
import { getOrCreateLeague, type League } from "@/lib/league";
import { getAllTimeRecords, type AllTimeData, type RankRow } from "@/lib/allTimeRecords";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Trophy, Crown } from "lucide-react";

export default function AllTime() {
  const [league, setLeague] = useState<League | null>(null);
  const [data, setData] = useState<AllTimeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const lg = await getOrCreateLeague(); setLeague(lg);
    const d = await getAllTimeRecords(lg.id); setData(d); setLoading(false);
  })(); }, []);

  if (loading || !data) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-xs tracking-[0.3em] text-primary/80">ALL-TIME</div>
        <h1 className="font-display text-4xl tracking-wider flex items-center gap-2"><Crown className="w-7 h-7 text-primary"/> Hall of Records</h1>
        <p className="text-sm text-muted-foreground mt-1">Top 10 across every category — ever.</p>
      </div>

      <Tabs defaultValue="batting">
        <TabsList className="bg-secondary/40 flex-wrap h-auto">
          <TabsTrigger value="batting">Batting</TabsTrigger>
          <TabsTrigger value="bowling">Bowling</TabsTrigger>
          <TabsTrigger value="totals">Totals</TabsTrigger>
          <TabsTrigger value="partnerships">Partnerships</TabsTrigger>
          <TabsTrigger value="impact">Match-Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="batting" className="mt-4 grid md:grid-cols-2 gap-4">
          <Board title="Most Runs" rows={data.topRuns} unit="runs"/>
          <Board title="Highest Strike Rate" rows={data.topSR} unit="SR"/>
          <Board title="Best Batting Average" rows={data.topAvg} unit="avg"/>
          <Board title="Most Sixes" rows={data.mostSixes} unit="6s"/>
          <Board title="Most Fours" rows={data.mostFours} unit="4s"/>
          <Board title="Highest Individual Scores" rows={data.bestScores} unit=""/>
        </TabsContent>

        <TabsContent value="bowling" className="mt-4 grid md:grid-cols-2 gap-4">
          <Board title="Most Wickets" rows={data.topWickets} unit="wkts"/>
          <Board title="Best Economy" rows={data.bestEcon} unit="econ" lowerBetter/>
          <Board title="Best Bowling Figures" rows={data.bestBowling} unit="wkts"/>
          <Board title="3-Wicket Hauls" rows={data.mostThreeFers} unit="hauls"/>
        </TabsContent>

        <TabsContent value="totals" className="mt-4 grid md:grid-cols-2 gap-4">
          <Card className="p-5 gradient-card border-border/60">
            <div className="font-display tracking-wider mb-3 text-primary">HIGHEST TEAM TOTALS</div>
            <div className="space-y-1.5 text-sm">
              {data.highestTotals.map((t, i) => (
                <div key={i} className="flex items-center justify-between border-b border-border/20 pb-1.5 last:border-0">
                  <span className="flex items-center gap-2"><span className="text-muted-foreground w-5 text-xs">#{i+1}</span><b>{t.team}</b> <span className="text-muted-foreground text-xs">vs {t.opp}</span></span>
                  <span className="font-display text-lg">{t.runs}<span className="text-xs text-muted-foreground">/{t.wkts}</span></span>
                </div>
              ))}
              {data.highestTotals.length === 0 && <div className="text-muted-foreground text-xs">No totals recorded yet.</div>}
            </div>
          </Card>
          <Card className="p-5 gradient-card border-border/60">
            <div className="font-display tracking-wider mb-3 text-destructive">LOWEST TEAM TOTALS</div>
            <div className="space-y-1.5 text-sm">
              {data.lowestTotals.map((t, i) => (
                <div key={i} className="flex items-center justify-between border-b border-border/20 pb-1.5 last:border-0">
                  <span className="flex items-center gap-2"><span className="text-muted-foreground w-5 text-xs">#{i+1}</span><b>{t.team}</b> <span className="text-muted-foreground text-xs">vs {t.opp}</span></span>
                  <span className="font-display text-lg">{t.runs}<span className="text-xs text-muted-foreground">/{t.wkts}</span></span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="partnerships" className="mt-4">
          <Card className="p-5 gradient-card border-border/60">
            <div className="font-display tracking-wider mb-3 text-primary">BIGGEST PARTNERSHIPS</div>
            {data.partnerships.length === 0 ? <div className="text-xs text-muted-foreground">Partnership tracking will populate as matches are played.</div> :
              <div className="space-y-1.5 text-sm">
                {data.partnerships.map((p, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-border/20 pb-1.5 last:border-0">
                    <span><span className="text-muted-foreground text-xs mr-2">#{i+1}</span><b>{p.a}</b> & <b>{p.b}</b> <span className="text-xs text-muted-foreground">({p.team}, S{p.season})</span></span>
                    <span className="font-display text-lg">{p.runs}</span>
                  </div>
                ))}
              </div>
            }
          </Card>
        </TabsContent>

        <TabsContent value="impact" className="mt-4">
          <Board title="Most Player-of-the-Match Awards" rows={data.playerOfMatchAwards} unit="POM"/>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Board({ title, rows, unit, lowerBetter }: { title: string; rows: RankRow[]; unit: string; lowerBetter?: boolean }) {
  return (
    <Card className="p-5 gradient-card border-border/60">
      <div className="font-display tracking-wider mb-3 text-primary flex items-center gap-2"><Trophy className="w-4 h-4"/>{title}</div>
      {rows.length === 0 ? <div className="text-xs text-muted-foreground">No data yet.</div> :
        <div className="space-y-1 text-sm">
          {rows.map((r, i) => (
            <div key={r.player_id + i} className="flex items-center justify-between border-b border-border/20 pb-1 last:border-0">
              <span className="flex items-center gap-2 truncate">
                <span className={`text-xs w-5 text-right ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>#{i+1}</span>
                <span className="truncate">{r.name}</span>
                {r.team && <span className="text-[10px] text-muted-foreground">{r.team}</span>}
              </span>
              <span className="font-display text-base">{r.value} {r.extra && <span className="text-[10px] text-muted-foreground ml-1">{r.extra}</span>} <span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span></span>
            </div>
          ))}
        </div>}
    </Card>
  );
}
