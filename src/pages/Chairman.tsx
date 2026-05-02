import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Settings2, Users, UserPlus, Trophy, Megaphone, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["BAT", "BOWL", "AR", "WK"] as const;

export default function Chairman() {
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<any[]>([]);
  const [customRecs, setCustomRecs] = useState<any[]>([]);

  // Forms
  const [newTeam, setNewTeam] = useState({ id: "", shortName: "", fullName: "", color: "#e11d48" });
  const [newPlayer, setNewPlayer] = useState({ name: "", role: "BAT", base_price: 1, rating: 78, nationality: "IND" });
  const [newRule, setNewRule] = useState<any>({ oversPerInnings: 20, allOutWickets: 10, squadMin: 18, squadMax: 25, playingXI: 11, startingPurse: 100, powerplayEnabled: true, powerplayOvers: 6, overseasMaxXI: 4, impactPlayerEnabled: true, scoreProfile: "200+" });
  const [newRec, setNewRec] = useState({ name: "", description: "", scope: "batting", metric: "runs", threshold: "" as string, higher_is_better: true, emoji: "🏆" });

  const reload = async () => {
    const lg = await getOrCreateLeague();
    setLeague(lg);
    setNewRule({ powerplayEnabled: true, powerplayOvers: 4, overseasMaxXI: 4, impactPlayerEnabled: true, scoreProfile: "200+", ...lg.settings });
    const [{ data: pl }, { data: cr }] = await Promise.all([
      supabase.from("players").select("*").eq("league_id", lg.id).order("rating", { ascending: false }),
      supabase.from("custom_records").select("*").eq("league_id", lg.id).order("created_at", { ascending: false }),
    ]);
    setPlayers(pl ?? []);
    setCustomRecs(cr ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  // ----- helpers
  const hexToHsl = (hex: string): string => {
    const m = hex.replace("#", "");
    const r = parseInt(m.slice(0,2),16)/255, g = parseInt(m.slice(2,4),16)/255, b = parseInt(m.slice(4,6),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h = 0, s = 0; const l = (max+min)/2;
    if (max !== min) {
      const d = max-min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      switch (max) { case r: h=(g-b)/d+(g<b?6:0); break; case g: h=(b-r)/d+2; break; case b: h=(r-g)/d+4; break; }
      h /= 6;
    }
    return `${Math.round(h*360)} ${Math.round(s*100)}% ${Math.round(l*100)}%`;
  };

  const addTeam = async () => {
    if (!league) return;
    const id = newTeam.id.trim().toUpperCase();
    if (!id || !newTeam.shortName || !newTeam.fullName) return toast.error("Fill all team fields");
    if (league.teams.some((t: any) => t.id === id)) return toast.error("Team ID already exists");
    const hsl = hexToHsl(newTeam.color);
    const teams = [...league.teams, { id, shortName: newTeam.shortName, fullName: newTeam.fullName, colorVar: id.toLowerCase(), primary: `hsl(${hsl})` }];
    await supabase.from("leagues").update({ teams: teams as any, updated_at: new Date().toISOString() }).eq("id", league.id);
    toast.success(`✅ ${id} added — they'll feature in the next auction`);
    setNewTeam({ id: "", shortName: "", fullName: "", color: "#e11d48" });
    reload();
  };

  const removeTeam = async (id: string) => {
    if (!league) return;
    if (!confirm(`Remove ${id}? This won't delete past matches.`)) return;
    const teams = league.teams.filter((t: any) => t.id !== id);
    await supabase.from("leagues").update({ teams: teams as any }).eq("id", league.id);
    toast.success(`${id} removed`);
    reload();
  };

  const addPlayer = async () => {
    if (!league) return;
    if (!newPlayer.name) return toast.error("Player name required");
    await supabase.from("players").insert({ ...newPlayer, league_id: league.id });
    toast.success(`👤 ${newPlayer.name} added to the pool`);
    setNewPlayer({ name: "", role: "BAT", base_price: 1, rating: 78, nationality: "IND" });
    reload();
  };

  const deletePlayer = async (id: string, name: string) => {
    if (!confirm(`Delete ${name} from the pool?`)) return;
    await supabase.from("players").delete().eq("id", id);
    toast.success("Player removed");
    reload();
  };

  const saveRules = async () => {
    if (!league) return;
    await supabase.from("leagues").update({ settings: newRule as any, updated_at: new Date().toISOString() }).eq("id", league.id);
    toast.success("📜 Rules updated");
    reload();
  };

  const addCustomRec = async () => {
    if (!league) return;
    if (!newRec.name) return toast.error("Record name required");
    await supabase.from("custom_records").insert({
      league_id: league.id,
      name: newRec.name, description: newRec.description, scope: newRec.scope, metric: newRec.metric,
      threshold: newRec.threshold ? Number(newRec.threshold) : null,
      higher_is_better: newRec.higher_is_better, emoji: newRec.emoji,
    });
    toast.success(`${newRec.emoji} Custom record created`);
    setNewRec({ name: "", description: "", scope: "batting", metric: "runs", threshold: "", higher_is_better: true, emoji: "🏆" });
    reload();
  };

  const deleteCustomRec = async (id: string) => {
    await supabase.from("custom_records").delete().eq("id", id);
    reload();
  };

  if (loading || !league) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-primary/80 flex items-center gap-2"><Megaphone className="w-3 h-3"/> CHAIRMAN'S CORNER</div>
          <h1 className="font-display text-4xl tracking-wider">League Control Room</h1>
          <p className="text-sm text-muted-foreground mt-1">Add teams, sign players, rewrite rules and invent records.</p>
        </div>
        <Badge variant="outline" className="border-primary/40 text-primary">
          {league.teams.length} TEAMS · {players.length} PLAYERS · {customRecs.length} CUSTOM RECORDS
        </Badge>
      </div>

      <Tabs defaultValue="teams">
        <TabsList className="bg-secondary/40">
          <TabsTrigger value="teams"><Users className="w-3.5 h-3.5 mr-1"/>Teams</TabsTrigger>
          <TabsTrigger value="players"><UserPlus className="w-3.5 h-3.5 mr-1"/>Player Pool</TabsTrigger>
          <TabsTrigger value="rules"><Settings2 className="w-3.5 h-3.5 mr-1"/>Rules</TabsTrigger>
          <TabsTrigger value="records"><Trophy className="w-3.5 h-3.5 mr-1"/>Custom Records</TabsTrigger>
        </TabsList>

        {/* TEAMS */}
        <TabsContent value="teams" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5 gradient-card border-border/60">
              <div className="font-display text-lg mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-primary"/> Franchise Onboarding</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Team ID</Label>
                  <Input maxLength={4} value={newTeam.id} onChange={e => setNewTeam({...newTeam, id: e.target.value.toUpperCase()})} placeholder="e.g. KKR" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Short Name</Label>
                  <Input value={newTeam.shortName} onChange={e => setNewTeam({...newTeam, shortName: e.target.value})} placeholder="KKR" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Full Name</Label>
                  <Input value={newTeam.fullName} onChange={e => setNewTeam({...newTeam, fullName: e.target.value})} placeholder="Kolkata Knight Riders" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Brand Color</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={newTeam.color} onChange={e => setNewTeam({...newTeam, color: e.target.value})} className="w-14 h-10 rounded border border-border bg-transparent cursor-pointer"/>
                    <Input value={newTeam.color} onChange={e => setNewTeam({...newTeam, color: e.target.value})} className="flex-1 font-mono"/>
                    <div className="w-10 h-10 rounded shadow-[var(--shadow-card)]" style={{background: newTeam.color}}/>
                  </div>
                </div>
              </div>
              <Button onClick={addTeam} className="w-full mt-4 gradient-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1"/>Add Franchise</Button>
            </Card>

            <Card className="p-5 gradient-card border-border/60">
              <div className="font-display text-lg mb-3">Active Franchises</div>
              <div className="space-y-2">
                {league.teams.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded bg-secondary/30 border border-border/40">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded flex items-center justify-center font-display text-lg" style={{background: t.primary, color: "#0a0a0a"}}>{t.shortName?.[0]}</div>
                      <div>
                        <div className="font-display tracking-wider">{t.id}</div>
                        <div className="text-[11px] text-muted-foreground">{t.fullName}</div>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeTeam(t.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5"/></Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* PLAYERS */}
        <TabsContent value="players" className="space-y-4 mt-4">
          <Card className="p-5 gradient-card border-border/60">
            <div className="font-display text-lg mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary"/> Add a Player to the Pool</div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="col-span-2">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Name</Label>
                <Input value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} placeholder="Player name"/>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Role</Label>
                <Select value={newPlayer.role} onValueChange={v => setNewPlayer({...newPlayer, role: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Base ₹Cr</Label>
                <Input type="number" step="0.5" value={newPlayer.base_price} onChange={e => setNewPlayer({...newPlayer, base_price: Number(e.target.value)})}/>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Rating</Label>
                <Input type="number" min={50} max={99} value={newPlayer.rating} onChange={e => setNewPlayer({...newPlayer, rating: Number(e.target.value)})}/>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Nation</Label>
                <Input maxLength={3} value={newPlayer.nationality} onChange={e => setNewPlayer({...newPlayer, nationality: e.target.value.toUpperCase()})}/>
              </div>
            </div>
            <Button onClick={addPlayer} className="w-full mt-4 gradient-primary text-primary-foreground"><UserPlus className="w-4 h-4 mr-1"/>Sign Player</Button>
          </Card>

          <Card className="gradient-card border-border/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
              <div className="font-display text-lg">Pool ({players.length})</div>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Player</th>
                    <th className="text-left px-2 py-2">Role</th>
                    <th className="text-right px-2 py-2">Rating</th>
                    <th className="text-right px-2 py-2">Base</th>
                    <th className="text-left px-2 py-2">Nation</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(p => (
                    <tr key={p.id} className="border-t border-border/30 hover:bg-secondary/20">
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          {p.pfp_url && <img src={p.pfp_url} alt="" className="w-7 h-7 rounded-full bg-secondary border border-border/40 flex-shrink-0" loading="lazy"/>}
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5"><Badge variant="outline" className="text-[10px]">{p.role}</Badge></td>
                      <td className="text-right px-2 py-1.5 font-mono text-primary">{p.rating}</td>
                      <td className="text-right px-2 py-1.5 font-mono">₹{Number(p.base_price).toFixed(1)}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{p.nationality}</td>
                      <td className="px-2 py-1.5"><button onClick={() => deletePlayer(p.id, p.name)} className="text-destructive/70 hover:text-destructive"><Trash2 className="w-3.5 h-3.5"/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* RULES */}
        <TabsContent value="rules" className="space-y-4 mt-4">
          <Card className="p-5 gradient-card border-border/60">
            <div className="font-display text-lg mb-4 flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary"/> League Rule Book</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { k: "oversPerInnings", l: "Overs / Innings" },
                { k: "allOutWickets",   l: "All-out Wickets" },
                { k: "squadMin",        l: "Squad Min" },
                { k: "squadMax",        l: "Squad Max" },
                { k: "playingXI",       l: "Playing XI Size" },
                { k: "startingPurse",   l: "Starting Purse (₹Cr)" },
              ].map(({k,l}) => (
                <div key={k}>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</Label>
                  <Input type="number" value={(newRule as any)[k]} onChange={e => setNewRule({...newRule, [k]: Number(e.target.value)})}/>
                </div>
              ))}
            </div>

            <div className="mt-5 p-4 rounded-lg border border-primary/30 bg-secondary/20">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-display text-base flex items-center gap-2">⚡ Powerplay Overs</div>
                  <div className="text-[11px] text-muted-foreground">First N overs: bigger boundary chance, lower wicket pressure, special commentary.</div>
                </div>
                <Switch checked={!!newRule.powerplayEnabled} onCheckedChange={v => setNewRule({...newRule, powerplayEnabled: v})}/>
              </div>
              {newRule.powerplayEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Powerplay Overs</Label>
                    <Input type="number" min={1} max={Math.max(1, (newRule.oversPerInnings ?? 2) - 1)}
                      value={newRule.powerplayOvers ?? 1}
                      onChange={e => setNewRule({...newRule, powerplayOvers: Math.max(1, Math.min((newRule.oversPerInnings ?? 2) - 1, Number(e.target.value)))})}/>
                  </div>
                  <div className="flex items-end text-[11px] text-muted-foreground">
                    Active in overs 1–{newRule.powerplayOvers ?? 1} of each innings.
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 p-4 rounded-lg border border-primary/30 bg-secondary/20">
              <div className="font-display text-base mb-1">🎯 Match Score Profile</div>
              <div className="text-[11px] text-muted-foreground mb-3">Sets how high-scoring AI-simulated games trend. Affects boundary &amp; intent rates.</div>
              <Select value={newRule.scoreProfile ?? "200+"} onValueChange={v => setNewRule({...newRule, scoreProfile: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="150+">150+ — Bowler's paradise</SelectItem>
                  <SelectItem value="200+">200+ — Balanced T20</SelectItem>
                  <SelectItem value="250+">250+ — Belter pitch</SelectItem>
                  <SelectItem value="300+">300+ — Run-fest mode</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-lg border border-border/60 bg-secondary/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display text-base">🌍 Overseas Cap</div>
                </div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Max overseas in XI</Label>
                <Input type="number" min={0} max={11} value={newRule.overseasMaxXI ?? 4} onChange={e => setNewRule({...newRule, overseasMaxXI: Number(e.target.value)})}/>
              </div>
              <div className="p-4 rounded-lg border border-border/60 bg-secondary/20 flex items-center justify-between">
                <div>
                  <div className="font-display text-base">⚡ Impact Player</div>
                  <div className="text-[11px] text-muted-foreground">One mid-match substitution allowed.</div>
                </div>
                <Switch checked={!!newRule.impactPlayerEnabled} onCheckedChange={v => setNewRule({...newRule, impactPlayerEnabled: v})}/>
              </div>
            </div>

            <Button onClick={saveRules} className="w-full mt-4 gradient-primary text-primary-foreground"><Save className="w-4 h-4 mr-1"/>Publish Rule Book</Button>
            <p className="text-[11px] text-muted-foreground mt-3">Changes apply to the next match / season. Past results stay intact.</p>
          </Card>
        </TabsContent>

        {/* CUSTOM RECORDS */}
        <TabsContent value="records" className="space-y-4 mt-4">
          <Card className="p-5 gradient-card border-border/60">
            <div className="font-display text-lg mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-primary"/> Invent a New Record</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Name</Label>
                <Input value={newRec.name} onChange={e => setNewRec({...newRec, name: e.target.value})} placeholder="e.g. Six Machine"/>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Emoji</Label>
                <Input value={newRec.emoji} onChange={e => setNewRec({...newRec, emoji: e.target.value})} maxLength={3}/>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Threshold (opt)</Label>
                <Input type="number" value={newRec.threshold} onChange={e => setNewRec({...newRec, threshold: e.target.value})} placeholder="Min value"/>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Scope</Label>
                <Select value={newRec.scope} onValueChange={v => setNewRec({...newRec, scope: v, metric: v==="bowling"?"wickets":v==="team"?"total":"runs"})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="batting">Batting</SelectItem>
                    <SelectItem value="bowling">Bowling</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Metric</Label>
                <Select value={newRec.metric} onValueChange={v => setNewRec({...newRec, metric: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {newRec.scope === "batting" && <>
                      <SelectItem value="runs">Runs</SelectItem>
                      <SelectItem value="sixes">Sixes</SelectItem>
                      <SelectItem value="fours">Fours</SelectItem>
                      <SelectItem value="sr">Strike Rate</SelectItem>
                    </>}
                    {newRec.scope === "bowling" && <>
                      <SelectItem value="wickets">Wickets</SelectItem>
                      <SelectItem value="econ">Economy</SelectItem>
                    </>}
                    {newRec.scope === "team" && <>
                      <SelectItem value="total">Team Total</SelectItem>
                      <SelectItem value="wickets">Team Wickets Lost</SelectItem>
                    </>}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch checked={newRec.higher_is_better} onCheckedChange={v => setNewRec({...newRec, higher_is_better: v})}/>
                <span className="text-[11px] text-muted-foreground">{newRec.higher_is_better ? "Higher = better" : "Lower = better"}</span>
              </div>
              <div className="col-span-2 md:col-span-4">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Description</Label>
                <Input value={newRec.description} onChange={e => setNewRec({...newRec, description: e.target.value})} placeholder="What does it celebrate?"/>
              </div>
            </div>
            <Button onClick={addCustomRec} className="w-full mt-4 gradient-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1"/>Create Record</Button>
            <p className="text-[11px] text-muted-foreground mt-3">Engine will auto-track this from the next match onward and surface it on the Records page.</p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customRecs.map(r => (
              <Card key={r.id} className="p-4 gradient-card border-border/60 flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="text-2xl">{r.emoji}</div>
                  <div>
                    <div className="font-display tracking-wider">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.scope} · {r.metric}{r.threshold ? ` · ≥${r.threshold}` : ""} · {r.higher_is_better ? "↑ best" : "↓ best"}</div>
                    {r.description && <div className="text-xs mt-1 text-muted-foreground">{r.description}</div>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteCustomRec(r.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5"/></Button>
              </Card>
            ))}
            {customRecs.length === 0 && (
              <Card className="p-8 text-center gradient-card border-border/60 md:col-span-2 text-muted-foreground text-sm">No custom records yet — invent one above ✍️</Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
