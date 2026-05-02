import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { teamColor } from "@/lib/teams";
import {
  applyBall, startInnings, type BallEvent, type MatchEngineState, type PlayerLite,
  ballsToOvers, isPowerplayBall, assertInningsValid, describeInningsEnd,
} from "@/lib/matchEngine";
import { processRecords } from "@/lib/records";
import { evaluateCustomRecords } from "@/lib/customRecords";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Coins, Trophy, Sparkles, Repeat, ArrowRight, Download, FileJson, FileText } from "lucide-react";
import { toast } from "sonner";
import { PlayingXIPicker } from "@/components/match/PlayingXIPicker";
import { LiveScorecard } from "@/components/match/LiveScorecard";
import { FullScorecard } from "@/components/match/FullScorecard";
import { WinProbBar, OverTimeline, CapsRace } from "@/components/match/MatchWidgets";
import { PowerplayBreakdown } from "@/components/match/PowerplayBreakdown";
import { SuperSixes } from "@/components/match/SuperSixes";
import { BallButtons } from "@/components/match/BallButtons";
import { SpinWheel } from "@/components/match/SpinWheel";
import { AiSimPanel, type CommentaryStyle, type Difficulty } from "@/components/match/AiSimPanel";
import { buildProbs, sampleOutcome, computePressure, aiCommentary, type SimContext } from "@/lib/aiSim";
import { deriveAttrs, type PlayerAttrs } from "@/lib/skills";
import { downloadJSON, downloadPDF, type ExportMeta } from "@/lib/exportMatch";
import { formRating, type FormEntry } from "@/lib/form";

type Phase = "loading" | "toss" | "xi" | "openers" | "live" | "innings_break" | "needs_bowler" | "needs_batter" | "done";

interface SquadMember extends PlayerLite { is_captain: boolean; is_vice_captain: boolean; price: number; attrs?: PlayerAttrs; personality?: string; form?: FormEntry[]; }

type ScoreProfile = "150+" | "200+" | "250+" | "300+";

/** Score = 0.7 * rating + 0.3 * formRating(last 2 innings). */
function scoreFor(p: SquadMember): number {
  const fr = formRating((p.form ?? []).slice(-2), p.role as any);
  return p.rating * 0.7 + fr * 0.3;
}

/** Pick the best Playing XI based on rating + recent form (last 2 innings). */
function pickAutoXI(squad: SquadMember[], size: number): PlayerLite[] {
  const scored = squad.map(p => ({ p, score: scoreFor(p), role: p.role }));
  const wk = scored.filter(s => s.role === "WK").sort((a,b)=>b.score-a.score);
  const bat = scored.filter(s => s.role === "BAT").sort((a,b)=>b.score-a.score);
  const bowl = scored.filter(s => s.role === "BOWL").sort((a,b)=>b.score-a.score);
  const ar = scored.filter(s => s.role === "AR").sort((a,b)=>b.score-a.score);
  const picked: typeof scored = [];
  if (wk[0]) picked.push(wk[0]);
  picked.push(...bat.slice(0, 4));
  picked.push(...bowl.slice(0, 4));
  picked.push(...ar.slice(0, 2));
  const used = new Set(picked.map(s => s.p.id));
  const rest = scored.filter(s => !used.has(s.p.id)).sort((a,b)=>b.score-a.score);
  while (picked.length < size && rest.length) picked.push(rest.shift()!);
  return picked.slice(0, size).map(s => s.p);
}

/**
 * Order an XI into a realistic batting order:
 *  openers/top-order = WK + BAT (by score)
 *  middle = AR (by score)
 *  tail = BOWL (by score)
 * Bowlers NEVER open. WK can open if highly rated, otherwise stays at 4-6.
 */
function pickBattingOrder(xiPlayers: PlayerLite[], squad: SquadMember[]): PlayerLite[] {
  const byId = new Map(squad.map(s => [s.id, s]));
  const scoreOf = (p: PlayerLite) => {
    const sm = byId.get(p.id);
    return sm ? scoreFor(sm) : p.rating;
  };
  const bats = xiPlayers.filter(p => p.role === "BAT").sort((a,b) => scoreOf(b) - scoreOf(a));
  const wks  = xiPlayers.filter(p => p.role === "WK").sort((a,b) => scoreOf(b) - scoreOf(a));
  const ars  = xiPlayers.filter(p => p.role === "AR").sort((a,b) => scoreOf(b) - scoreOf(a));
  const bwls = xiPlayers.filter(p => p.role === "BOWL").sort((a,b) => scoreOf(b) - scoreOf(a));

  // Top order: best 2 from BAT first, then fill with WK/BAT remainder up to top-5
  const top: PlayerLite[] = [];
  // Openers: prefer 2 best BAT. If only 1 BAT exists, use a high-rated WK as 2nd opener.
  if (bats.length >= 2) top.push(bats[0], bats[1]);
  else if (bats.length === 1 && wks.length >= 1) top.push(bats[0], wks.shift()!);
  else if (wks.length >= 2) top.push(wks.shift()!, wks.shift()!);
  else top.push(...xiPlayers.slice(0, 2)); // pathological fallback

  // Remove any used from pools
  const used = new Set(top.map(p => p.id));
  const remBat = bats.filter(p => !used.has(p.id));
  const remWk  = wks.filter(p => !used.has(p.id));

  const order: PlayerLite[] = [...top];
  // 3,4 — next best BAT, then WK
  order.push(...remBat);
  order.push(...remWk);
  // 5+ — all-rounders by score
  order.push(...ars);
  // Tail — bowlers
  order.push(...bwls);

  // Dedup preserving order, in case of overlap
  const seen = new Set<string>();
  return order.filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

/** Pick a per-match score profile based on team strengths + randomness. */
function pickMatchScoreProfile(xiA: PlayerLite[], xiB: PlayerLite[]): ScoreProfile {
  const avg = (arr: PlayerLite[]) => arr.reduce((a,b) => a+b.rating, 0) / Math.max(1, arr.length);
  const strength = (avg(xiA) + avg(xiB)) / 2;        // ~70..90
  const r = Math.random();
  // Random base — wide variance: pitch/conditions
  let base = 200;
  if (r < 0.10) base = 100;       // collapse / bowler-friendly
  else if (r < 0.25) base = 140;
  else if (r < 0.55) base = 180;
  else if (r < 0.80) base = 220;
  else if (r < 0.93) base = 260;
  else base = 310;                 // belter
  // Strength nudge: stronger XIs push score up
  base += (strength - 78) * 3;
  if (base < 130) return "150+";
  if (base < 200) return "150+";
  if (base < 250) return "200+";
  if (base < 290) return "250+";
  return "300+";
}

export default function Match() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const matchId = params.get("id");

  const [league, setLeague] = useState<League | null>(null);
  const [match, setMatch] = useState<any>(null);
  const [seasonNum, setSeasonNum] = useState<number>(0);
  const [squads, setSquads] = useState<Record<string, SquadMember[]>>({});
  const [phase, setPhase] = useState<Phase>("loading");
  const [toss, setToss] = useState<{ winner: string; decision: "bat" | "bowl" } | null>(null);
  const [xi, setXi] = useState<Record<string, PlayerLite[]>>({});
  const [engine, setEngine] = useState<MatchEngineState | null>(null);
  const [commentary, setCommentary] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<"buttons" | "wheel">("buttons");
  const [pendingBatter, setPendingBatter] = useState<string>("");
  const [pendingBowler, setPendingBowler] = useState<string>("");
  const [recentBigEvent, setRecentBigEvent] = useState<{ kind: "FOUR" | "SIX" | "WICKET"; text: string } | null>(null);
  const [secondInnSetup, setSecondInnSetup] = useState<{ openers?: [string,string]; bowler?: string }>({});
  const commentaryRef = useRef<HTMLDivElement>(null);

  // AI Sim state
  const [aiStyle, setAiStyle] = useState<CommentaryStyle>("normal");
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("normal");
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoMatch, setAutoMatch] = useState(false); // Full AI match — no manual prompts
  const [aiSpeedMs, setAiSpeedMs] = useState<number>(1500); // user-adjustable ball cadence
  const [matchProfile, setMatchProfile] = useState<ScoreProfile | null>(null);
  const [potmName, setPotmName] = useState<string>("");

  const tcolor = (id: string) => teamColor(id, league?.teams);

  // ---------- LOAD ----------
  useEffect(() => {
    (async () => {
      if (!matchId) { nav("/schedule"); return; }
      const lg = await getOrCreateLeague();
      setLeague(lg);
      const { data: m } = await supabase.from("matches").select("*").eq("id", matchId).single();
      if (!m) { toast.error("Match not found"); nav("/schedule"); return; }
      setMatch(m);
      const { data: season } = await supabase.from("seasons").select("season_number").eq("id", m.season_id).single();
      setSeasonNum(season?.season_number ?? 0);

      // Load squads for both teams
      const { data: rows } = await supabase
        .from("squads")
        .select("team_id, price, is_captain, is_vice_captain, players(id,name,role,rating,attrs,personality,form)")
        .eq("season_id", m.season_id)
        .in("team_id", [m.team_a, m.team_b]);

      const sq: Record<string, SquadMember[]> = { [m.team_a]: [], [m.team_b]: [] };
      (rows ?? []).forEach((r: any) => {
        if (!r.players) return;
        const p = r.players;
        const attrs = (p.attrs && Object.keys(p.attrs).length > 0) ? p.attrs : deriveAttrs(p.rating, p.role, p.name);
        sq[r.team_id].push({
          id: p.id, name: p.name, role: p.role, rating: p.rating,
          team_id: r.team_id, is_captain: r.is_captain, is_vice_captain: r.is_vice_captain, price: Number(r.price),
          attrs, personality: p.personality ?? undefined,
          form: (p.form as FormEntry[] | null) ?? [],
        });
      });
      // Sort: captain, vc, then by rating
      Object.keys(sq).forEach(k => sq[k].sort((a,b) => (Number(b.is_captain)-Number(a.is_captain)) || (Number(b.is_vice_captain)-Number(a.is_vice_captain)) || (b.rating-a.rating)));
      setSquads(sq);

      // Resume if state exists
      if (m.state && (m.status === "live" || m.status === "done")) {
        setEngine(m.state as unknown as MatchEngineState);
        if (m.status === "done") setPhase("done");
        else setPhase("live");
      } else {
        setPhase("toss");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  // Persist engine on each change
  useEffect(() => {
    if (!engine || !matchId) return;
    supabase.from("matches").update({ state: engine as never, status: phase === "done" ? "done" : "live" }).eq("id", matchId).then(()=>{});
  }, [engine, phase, matchId]);

  // Auto-scroll commentary
  useEffect(() => { commentaryRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [commentary.length]);

  // Auto-play loop
  useEffect(() => {
    if (!autoPlay || phase !== "live" || !engine) return;
    const t = setTimeout(() => aiNextBall(), aiSpeedMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, phase, engine, commentary.length, autoMatch, aiSpeedMs]);

  // ---------- AUTO-MATCH DRIVER ----------
  // When autoMatch is on, automatically progress through every prompt:
  // toss → XI → openers/bowler → batter/bowler → innings break → done.
  useEffect(() => {
    if (!autoMatch) return;
    if (phase === "toss" && !toss && match) {
      const t = setTimeout(() => doToss(), 400);
      return () => clearTimeout(t);
    }
    if (phase === "toss" && toss) {
      const t = setTimeout(() => setPhase("xi"), 600);
      return () => clearTimeout(t);
    }
    if (phase === "xi" && match && squads[match.team_a]?.length && squads[match.team_b]?.length && league) {
      const xiA = pickAutoXI(squads[match.team_a], league.settings.playingXI);
      const xiB = pickAutoXI(squads[match.team_b], league.settings.playingXI);
      setMatchProfile(pickMatchScoreProfile(xiA, xiB));
      const t = setTimeout(() => onXIConfirm(xiA, xiB), 400);
      return () => clearTimeout(t);
    }
    if (phase === "openers" && toss && match && xi[match.team_a]?.length) {
      const battingFirst = toss.decision === "bat" ? toss.winner : (toss.winner === match.team_a ? match.team_b : match.team_a);
      const bxi = xi[battingFirst];
      const bowlxi = xi[battingFirst === match.team_a ? match.team_b : match.team_a];
      if (bxi?.length >= 2 && bowlxi?.length) {
        const ordered = pickBattingOrder(bxi, squads[battingFirst] ?? []);
        const bowler = [...bowlxi].sort((a,b) => {
          const aw = a.role === "BOWL" ? 100 : a.role === "AR" ? 70 : 30;
          const bw = b.role === "BOWL" ? 100 : b.role === "AR" ? 70 : 30;
          return (bw + b.rating) - (aw + a.rating);
        })[0];
        const t = setTimeout(() => startMatchEngine([ordered[0].id, ordered[1].id], bowler.id), 500);
        return () => clearTimeout(t);
      }
    }
    if (phase === "needs_batter" && engine) {
      const inn = engine.currentInnings === 1 ? engine.innings1 : engine.innings2!;
      const battingXI = engine.xi[inn.battingTeam];
      // Walk batting-order: pick the next player in order who hasn't batted yet.
      const battingOrder = pickBattingOrder(battingXI, squads[inn.battingTeam] ?? []);
      const next = battingOrder.find(p => !inn.bat[p.id]) ?? battingXI.find(p => !inn.bat[p.id]);
      if (next) {
        const t = setTimeout(() => confirmBatterAuto(next.id), 300);
        return () => clearTimeout(t);
      }
    }
    if (phase === "needs_bowler" && engine) {
      const inn = engine.currentInnings === 1 ? engine.innings1 : engine.innings2!;
      const bowlingXI = engine.xi[inn.bowlingTeam] as PlayerLite[];
      const candidates = bowlingXI.filter(p => p.id !== inn.bowlerId);
      const overCap = engine.oversPerInnings <= 5 ? 1 : 4;
      const ranked = candidates.map(p => {
        const overs = (inn.bowl[p.id]?.balls ?? 0) / 6;
        const valid = overs < overCap;
        const roleBoost = p.role === "BOWL" ? 25 : p.role === "AR" ? 12 : 0;
        return { p, score: valid ? p.rating + roleBoost - overs * 4 : -1 };
      }).filter(r => r.score >= 0).sort((a,b) => b.score - a.score);
      const next = ranked[0]?.p ?? candidates[0];
      if (next) {
        const t = setTimeout(() => confirmBowlerAuto(next.id), 300);
        return () => clearTimeout(t);
      }
    }
    if (phase === "innings_break" && engine) {
      const battingTeam = engine.innings1.bowlingTeam;
      const bowlingTeam = engine.innings1.battingTeam;
      const bxi = engine.xi[battingTeam];
      const bowlxi = engine.xi[bowlingTeam];
      const ordered = pickBattingOrder(bxi, squads[battingTeam] ?? []);
      const bowler = [...bowlxi].sort((a,b) => {
        const aw = a.role === "BOWL" ? 100 : a.role === "AR" ? 70 : 30;
        const bw = b.role === "BOWL" ? 100 : b.role === "AR" ? 70 : 30;
        return (bw + b.rating) - (aw + a.rating);
      })[0];
      const t = setTimeout(() => startInnings2Auto([ordered[0].id, ordered[1].id], bowler.id), 600);
      return () => clearTimeout(t);
    }
    if (phase === "live" && !autoPlay) {
      setAutoPlay(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMatch, phase, toss, match, league, squads, xi, engine]);

  // ---------- TOSS ----------
  function doToss() {
    if (!match) return;
    const winner = Math.random() < 0.5 ? match.team_a : match.team_b;
    const decision: "bat" | "bowl" = Math.random() < 0.55 ? "bowl" : "bat";
    setToss({ winner, decision });
    supabase.from("matches").update({ toss_winner: winner, toss_decision: decision, status: "live" }).eq("id", matchId);
    const cap = squads[winner]?.find(s => s.is_captain)?.name ?? "Captain";
    setCommentary(c => [
      `🎤 ${cap}: "We'd like to ${decision} first. The pitch looks good and we want to put runs on the board." 🏏`,
      `🪙 ${winner} won the toss and chose to ${decision} first.`,
      ...c,
    ]);
  }

  // ---------- XI confirm ----------
  function onXIConfirm(xiA: PlayerLite[], xiB: PlayerLite[]) {
    if (!match) return;
    setXi({ [match.team_a]: xiA, [match.team_b]: xiB });
    setPhase("openers");
  }

  // ---------- Openers + opening bowler ----------
  function startMatchEngine(openerIds: [string,string], bowlerId: string) {
    if (!match || !toss || !league) return;
    const battingFirst = toss.decision === "bat" ? toss.winner : (toss.winner === match.team_a ? match.team_b : match.team_a);
    const bowlingFirst = battingFirst === match.team_a ? match.team_b : match.team_a;
    const battingXI = xi[battingFirst];
    const bowlingXI = xi[bowlingFirst];
    const op1 = battingXI.find(p => p.id === openerIds[0])!;
    const op2 = battingXI.find(p => p.id === openerIds[1])!;
    const bw = bowlingXI.find(p => p.id === bowlerId)!;
    const inn1 = startInnings({
      battingTeam: battingFirst, bowlingTeam: bowlingFirst,
      openers: [op1, op2], bowler: bw, battingXI,
    });
    const eng: MatchEngineState = {
      matchId: match.id,
      oversPerInnings: league.settings.oversPerInnings,
      allOutWickets: league.settings.allOutWickets,
      playingXI: league.settings.playingXI,
      powerplayOvers: league.settings.powerplayEnabled ? (league.settings.powerplayOvers ?? 1) : 0,
      teamA: match.team_a, teamB: match.team_b,
      battingFirst,
      innings1: inn1,
      currentInnings: 1,
      xi,
    };
    setEngine(eng);
    setPhase("live");
    const ppNote = (league.settings.powerplayEnabled && (league.settings.powerplayOvers ?? 0) > 0)
      ? ` ⚡ Powerplay: first ${league.settings.powerplayOvers} over${(league.settings.powerplayOvers ?? 1) > 1 ? "s" : ""}.` : "";
    setCommentary(c => [
      `🏏 ${battingFirst} are off! ${op1.name} & ${op2.name} open the batting. ${bw.name} with the new ball.${ppNote}`,
      ...c,
    ]);
  }

  // ---------- Process a ball ----------
  function processBallEvent(ev: BallEvent, customCommentary?: string) {
    if (!engine) return;
    const inn = engine.currentInnings === 1 ? engine.innings1 : engine.innings2!;
    const battingXI = engine.xi[inn.battingTeam];
    const wasPP = isPowerplayBall(engine, inn.legalBalls);
    const result = applyBall(engine, ev, battingXI);
    setEngine({ ...engine });

    const ballLabel = `Ov ${ballsToOvers(inn.legalBalls)}${wasPP ? " ⚡" : ""}`;
    setCommentary(c => [
      `${ballLabel} — ${customCommentary ?? result.commentary}`,
      ...c,
    ].slice(0, 300));

    if (result.events.isFour) setRecentBigEvent({ kind: "FOUR", text: wasPP ? "FOUR! ⚡💥" : "FOUR! 💥" });
    else if (result.events.isSix) setRecentBigEvent({ kind: "SIX", text: wasPP ? "SIX!! ⚡🚀" : "SIX!! 🚀" });
    else if (result.events.isWicket) setRecentBigEvent({ kind: "WICKET", text: "WICKET!! 🎯" });
    if (result.events.isFour || result.events.isSix || result.events.isWicket) {
      setTimeout(() => setRecentBigEvent(null), 1800);
    }

    if (inn.done) {
      setAutoPlay(false);
      if (engine.currentInnings === 1) {
        setEngine(eg => eg ? { ...eg, target: eg.innings1.runs + 1 } : eg);
        setPhase("innings_break");
        setCommentary(c => [`⏸️ End of 1st innings. ${inn.battingTeam} ${inn.runs}/${inn.wickets}. Target: ${inn.runs + 1}.`, ...c]);
      } else {
        finishMatch();
      }
      return;
    }
    if (result.needsBatter) { setAutoPlay(false); setPhase("needs_batter"); setPendingBatter(""); return; }
    if (result.needsBowler) { setAutoPlay(false); setPhase("needs_bowler"); setPendingBowler(""); return; }
  }

  // Map wheel label → BallEvent
  function fromWheel(label: string) {
    if (label === "W") {
      processBallEvent({ kind: "wicket", how: "Caught" });
    } else if (label === "WD") processBallEvent({ kind: "wide" });
    else if (label === "NB") processBallEvent({ kind: "nb" });
    else processBallEvent({ kind: "run", runs: Number(label) as 0|1|2|3|4|6 });
  }

  // ---------- AI Sim "Next Ball" ----------
  function aiNextBall() {
    if (!engine || phase !== "live") return;
    const inn = engine.currentInnings === 1 ? engine.innings1 : engine.innings2!;
    const battingXI = engine.xi[inn.battingTeam] as SquadMember[];
    const bowlingXI = engine.xi[inn.bowlingTeam] as SquadMember[];
    const striker = battingXI.find(p => p.id === inn.strikerId);
    const bowler = bowlingXI.find(p => p.id === inn.bowlerId);
    if (!striker || !bowler) return;

    const sAttrs = striker.attrs ?? deriveAttrs(striker.rating, striker.role, striker.name);
    const bAttrs = bowler.attrs ?? deriveAttrs(bowler.rating, bowler.role, bowler.name);
    const batStat = inn.bat[striker.id];
    const battingCap = battingXI.find(p => (p as any).is_captain);
    const bowlingCap = bowlingXI.find(p => (p as any).is_captain);

    const pressure = computePressure({
      innings: engine.currentInnings,
      runs: inn.runs, wickets: inn.wickets, legalBalls: inn.legalBalls,
      oversTotal: engine.oversPerInnings, allOutWkts: engine.allOutWickets,
      target: engine.target,
    });
    // 20-over format: death is last 5 overs; 2-over format: last over
    const deathStartBall = engine.oversPerInnings >= 10
      ? (engine.oversPerInnings - 5) * 6
      : (engine.oversPerInnings - 1) * 6;
    const isDeath = inn.legalBalls >= deathStartBall;
    const isPowerplay = isPowerplayBall(engine, inn.legalBalls);

    const ctx: SimContext = {
      batPower: sAttrs.power, batTiming: sAttrs.timing, batConsistency: sAttrs.consistency, batFinishing: sAttrs.finishing,
      batPersonality: (striker.personality as any) ?? "anchor",
      batterRuns: batStat?.runs ?? 0, batterBalls: batStat?.balls ?? 0,
      bowlPace: bAttrs.pace, bowlSpin: bAttrs.spin, bowlControl: bAttrs.control, bowlDeath: bAttrs.death,
      bowlPersonality: (bowler.personality as any) ?? "workhorse",
      isDeath, isPowerplay, pressure,
      difficulty: aiDifficulty,
      isFreeHit: false,
      scoreProfile: (matchProfile ?? (league?.settings.scoreProfile as any) ?? "200+"),
      battingCaptaincy: battingCap?.rating,
      bowlingCaptaincy: bowlingCap?.rating,
    };
    const probs = buildProbs(ctx);
    const { event, label } = sampleOutcome(probs);
    const runs = event.kind === "run" ? event.runs : event.kind === "nb" ? (event.offBat ?? 0) : 0;
    const text = aiCommentary({
      outcome: label, batter: striker.name, bowler: bowler.name,
      runs, isWicket: event.kind === "wicket", isExtra: event.kind === "wide" || event.kind === "nb",
      isPowerplay, style: aiStyle,
    });
    processBallEvent(event, text);
  }

  // ---------- New batter / bowler ----------
  function confirmBatter() {
    if (!engine || !pendingBatter) return;
    const inn = engine.currentInnings === 1 ? engine.innings1 : engine.innings2!;
    const battingXI = engine.xi[inn.battingTeam];
    const p = battingXI.find(x => x.id === pendingBatter);
    if (!p) return;
    if (inn.bat[pendingBatter]) { toast.error("That batter is already in"); return; }
    inn.bat[pendingBatter] = { player_id: p.id, name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
    inn.battingOrder.push(pendingBatter);
    inn.strikerId = pendingBatter;
    inn.nextBatterIdx = battingXI.findIndex(x => x.id === pendingBatter) + 1;
    setEngine({ ...engine });
    setCommentary(c => [`🆕 ${p.name} walks in to bat.`, ...c]);
    setPhase("live");
  }

  function confirmBowler() {
    if (!engine || !pendingBowler) return;
    const inn = engine.currentInnings === 1 ? engine.innings1 : engine.innings2!;
    if (pendingBowler === inn.bowlerId) { toast.error("Same bowler can't bowl consecutive overs"); return; }
    const bowlingXI = engine.xi[inn.bowlingTeam];
    const p = bowlingXI.find(x => x.id === pendingBowler);
    if (!p) return;
    if (!inn.bowl[pendingBowler]) {
      inn.bowl[pendingBowler] = { player_id: p.id, name: p.name, balls: 0, runs: 0, wickets: 0, fours: 0, sixes: 0, wides: 0, noBalls: 0, dots: 0 };
    }
    inn.bowlerId = pendingBowler;
    setEngine({ ...engine });
    setCommentary(c => [`🎯 ${p.name} into the attack.`, ...c]);
    setPhase("live");
  }

  // Auto-mode helpers — bypass the pending* state and act on a passed id directly.
  function confirmBatterAuto(id: string) {
    if (!engine) return;
    const inn = engine.currentInnings === 1 ? engine.innings1 : engine.innings2!;
    const battingXI = engine.xi[inn.battingTeam];
    const p = battingXI.find(x => x.id === id);
    if (!p || inn.bat[id]) return;
    inn.bat[id] = { player_id: p.id, name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
    inn.battingOrder.push(id);
    inn.strikerId = id;
    inn.nextBatterIdx = battingXI.findIndex(x => x.id === id) + 1;
    setEngine({ ...engine });
    setCommentary(c => [`🆕 ${p.name} walks in to bat.`, ...c]);
    setPhase("live");
  }

  function confirmBowlerAuto(id: string) {
    if (!engine) return;
    const inn = engine.currentInnings === 1 ? engine.innings1 : engine.innings2!;
    if (id === inn.bowlerId) return;
    const bowlingXI = engine.xi[inn.bowlingTeam];
    const p = bowlingXI.find(x => x.id === id);
    if (!p) return;
    if (!inn.bowl[id]) {
      inn.bowl[id] = { player_id: p.id, name: p.name, balls: 0, runs: 0, wickets: 0, fours: 0, sixes: 0, wides: 0, noBalls: 0, dots: 0 };
    }
    inn.bowlerId = id;
    setEngine({ ...engine });
    setCommentary(c => [`🎯 ${p.name} into the attack.`, ...c]);
    setPhase("live");
  }

  function startInnings2Auto(openerIds: [string, string], bowlerId: string) {
    if (!engine) return;
    const battingTeam = engine.innings1.bowlingTeam;
    const bowlingTeam = engine.innings1.battingTeam;
    const battingXI = engine.xi[battingTeam];
    const bowlingXI = engine.xi[bowlingTeam];
    const op1 = battingXI.find(p => p.id === openerIds[0])!;
    const op2 = battingXI.find(p => p.id === openerIds[1])!;
    const bw = bowlingXI.find(p => p.id === bowlerId)!;
    const inn2 = startInnings({ battingTeam, bowlingTeam, openers: [op1, op2], bowler: bw, battingXI });
    setEngine({ ...engine, currentInnings: 2, innings2: inn2 });
    setPhase("live");
    setCommentary(c => [`🏏 2nd innings begins! ${battingTeam} need ${engine.innings1.runs + 1} to win. ${op1.name} & ${op2.name} open.`, ...c]);
  }

  // ---------- Innings break → start innings 2 ----------
  function startInnings2() {
    if (!engine) return;
    const battingTeam = engine.innings1.bowlingTeam;
    const bowlingTeam = engine.innings1.battingTeam;
    if (!secondInnSetup.openers || !secondInnSetup.bowler) { toast.error("Pick openers and opening bowler"); return; }
    const battingXI = engine.xi[battingTeam];
    const bowlingXI = engine.xi[bowlingTeam];
    const op1 = battingXI.find(p => p.id === secondInnSetup.openers![0])!;
    const op2 = battingXI.find(p => p.id === secondInnSetup.openers![1])!;
    const bw = bowlingXI.find(p => p.id === secondInnSetup.bowler!)!;
    const inn2 = startInnings({ battingTeam, bowlingTeam, openers: [op1, op2], bowler: bw, battingXI });
    setEngine({ ...engine, currentInnings: 2, innings2: inn2 });
    setPhase("live");
    setCommentary(c => [`🏏 2nd innings begins! ${battingTeam} need ${engine.innings1.runs + 1} to win. ${op1.name} & ${op2.name} open.`, ...c]);
  }

  // ---------- Match end ----------
  async function finishMatch() {
    if (!engine || !match || !league) return;
    const i1 = engine.innings1, i2 = engine.innings2!;
    let winner: string | null = null;
    let text = "";
    if (i2.runs > i1.runs) {
      winner = i2.battingTeam;
      const wktsLeft = engine.allOutWickets - i2.wickets;
      text = `${winner} won by ${wktsLeft} wicket${wktsLeft===1?"":"s"}`;
    } else if (i1.runs > i2.runs) {
      winner = i1.battingTeam;
      const margin = i1.runs - i2.runs;
      text = `${winner} won by ${margin} run${margin===1?"":"s"}`;
    } else {
      text = "Match Tied";
    }
    // Player of match: winning side only (real IPL convention). If tied, allow all.
    const winningTeam = winner;
    const sideFilter = (b: any) => !winningTeam || b.team === winningTeam;
    // Tag bat/bowl entries with team for filtering
    const tagged = {
      bat: [
        ...Object.values(i1.bat).map((b: any) => ({ ...b, team: i1.battingTeam })),
        ...Object.values(i2.bat).map((b: any) => ({ ...b, team: i2.battingTeam })),
      ],
      bowl: [
        ...Object.values(i1.bowl).map((b: any) => ({ ...b, team: i1.bowlingTeam })),
        ...Object.values(i2.bowl).map((b: any) => ({ ...b, team: i2.bowlingTeam })),
      ],
    };
    const eligibleBat = tagged.bat.filter(sideFilter);
    const eligibleBowl = tagged.bowl.filter(sideFilter);
    const potm = [
      ...eligibleBat.map((b: any) => ({ id: b.player_id, name: b.name, team: b.team, score: b.runs + b.fours * 1 + b.sixes * 2 })),
      ...eligibleBowl.map((b: any) => ({ id: b.player_id, name: b.name, team: b.team, score: b.wickets * 14 - b.runs * 0.4 + (b.balls > 0 ? Math.max(0, 6 - (b.runs / b.balls) * 6) * 2 : 0) })),
    ].sort((a, b) => b.score - a.score)[0];
    // Top performers across both sides for social posts
    const topScorer = tagged.bat.sort((a: any, b: any) => b.runs - a.runs)[0];
    const topBowler = tagged.bowl.sort((a: any, b: any) => b.wickets - a.wickets || a.runs - b.runs)[0];

    if (potm?.name) setPotmName(potm.name);
    setPhase("done");
    setCommentary(c => [`🏆 ${text}. Player of the Match: ${potm?.name ?? "—"}`, ...c]);

    const scorecard = { innings1: i1, innings2: i2, team_a: match.team_a, team_b: match.team_b, winner };
    await supabase.from("matches").update({
      status: "done", winner, result_text: text, player_of_match: potm?.id ?? null,
      scorecard: scorecard as never, state: engine as never,
    }).eq("id", match.id);

    // Records (built-in + chairman-defined)
    await processRecords({ league_id: league.id, season_number: seasonNum, match_id: match.id }, scorecard as any);
    await evaluateCustomRecords({ league_id: league.id, season_number: seasonNum, match_id: match.id }, scorecard as any);
    try {
      const { processMilestones } = await import("@/lib/milestones");
      await processMilestones({ league_id: league.id, season_number: seasonNum, match_id: match.id });
    } catch (e) { console.warn("milestones failed", e); }

    // 🔥 Social autopilot — fan-frenzy after every match (with photos)
    try {
      const { ensureSocialAccounts, generateMatchPosts } = await import("@/lib/social");
      await ensureSocialAccounts(league.id, { fans: 80 });
      await generateMatchPosts(league.id, {
        matchId: match.id,
        seasonNumber: seasonNum,
        winner,
        loser: winner ? (winner === match.team_a ? match.team_b : match.team_a) : null,
        resultText: text,
        potmName: potm?.name,
        topScorer: topScorer ? { name: topScorer.name, runs: topScorer.runs, team: topScorer.team } : null,
        topBowler: topBowler && topBowler.wickets > 0 ? { name: topBowler.name, wkts: topBowler.wickets, team: topBowler.team } : null,
        total1: i1.runs, total2: i2.runs,
      });
    } catch (e) { console.warn("social autopilot failed", e); }

    // 🏆 Wire next playoff stage after a Q1/Elim/Q2 result
    if (["qualifier1", "eliminator", "qualifier2"].includes(match.stage)) {
      try {
        const { wirePlayoffDependencies } = await import("@/lib/playoffs");
        await wirePlayoffDependencies(match.season_id);
      } catch (e) { console.warn("playoff wiring failed", e); }
    }

    // If final, mark season done, crown champion + award trophies
    if (match.stage === "final" && winner) {
      const loser = winner === match.team_a ? match.team_b : match.team_a;
      await supabase.from("seasons").update({ status: "done", champion_team_id: winner }).eq("id", match.season_id);

      // Aggregate season stats for caps & MVP
      const { data: seasonMatches } = await supabase.from("matches").select("scorecard").eq("season_id", match.season_id).eq("status","done");
      const batMap = new Map<string, { name: string; team: string; runs: number }>();
      const bowlMap = new Map<string, { name: string; team: string; wkts: number }>();
      (seasonMatches ?? []).forEach((m: any) => {
        const sc = m.scorecard; if (!sc) return;
        ["innings1","innings2"].forEach(ik => {
          const inn = sc[ik]; if (!inn) return;
          Object.values(inn.bat as Record<string, any>).forEach((b: any) => {
            const c = batMap.get(b.player_id) ?? { name: b.name, team: inn.battingTeam, runs: 0 };
            c.runs += b.runs; batMap.set(b.player_id, c);
          });
          Object.values(inn.bowl as Record<string, any>).forEach((b: any) => {
            const c = bowlMap.get(b.player_id) ?? { name: b.name, team: inn.bowlingTeam, wkts: 0 };
            c.wkts += b.wickets; bowlMap.set(b.player_id, c);
          });
        });
      });
      const orange = [...batMap.entries()].sort((a,b) => b[1].runs - a[1].runs)[0];
      const purple = [...bowlMap.entries()].sort((a,b) => b[1].wkts - a[1].wkts)[0];
      const trophyRows: any[] = [
        { league_id: league.id, season_number: seasonNum, award: "champion", team_id: winner },
        { league_id: league.id, season_number: seasonNum, award: "runnerup", team_id: loser },
      ];
      if (orange) trophyRows.push({ league_id: league.id, season_number: seasonNum, award: "orange_cap", player_id: orange[0], player_name: orange[1].name, team_id: orange[1].team, value: orange[1].runs });
      if (purple) trophyRows.push({ league_id: league.id, season_number: seasonNum, award: "purple_cap", player_id: purple[0], player_name: purple[1].name, team_id: purple[1].team, value: purple[1].wkts });
      if (potm) trophyRows.push({ league_id: league.id, season_number: seasonNum, award: "mvp", player_id: potm.id, player_name: potm.name, team_id: winner });
      await supabase.from("trophies").insert(trophyRows);
      toast.success(`🏆 ${winner} crowned IPL T20 Season ${seasonNum} Champions!`);

      // 📈 Subtle rating evolution based on the season just played
      try {
        const { applySeasonRatingEvolution } = await import("@/lib/ratingEvolution");
        await applySeasonRatingEvolution(league.id, match.season_id, seasonNum);
      } catch (e) { console.warn("rating evolution failed", e); }

      // 🎉 Push user to the trophy ceremony page
      setTimeout(() => nav(`/ceremony?season=${match.season_id}`), 1800);
    }
  }

  // ---------- RENDER ----------
  if (phase === "loading" || !league || !match) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  const headBlock = (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <div className="text-xs tracking-[0.3em] text-primary/80">SEASON {seasonNum} • MATCH {match.match_number}{match.stage === "final" && " • FINAL"}</div>
        <div className="font-display text-3xl md:text-4xl tracking-wider">
          <span style={{ color: tcolor(match.team_a) }}>{match.team_a}</span>
          <span className="text-muted-foreground mx-2">vs</span>
          <span style={{ color: tcolor(match.team_b) }}>{match.team_b}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant={autoMatch ? "default" : "outline"}
          size="sm"
          onClick={() => setAutoMatch(v => !v)}
          className={autoMatch ? "gradient-primary text-primary-foreground" : ""}
          title="Auto-pick XI / openers / bowlers and play every ball with AI"
        >
          🤖 {autoMatch ? "AI Match: ON" : "AI Match"}
        </Button>
        {engine && (engine.innings1.legalBalls > 0 || (engine.innings2?.legalBalls ?? 0) > 0) && (
          <ExportButtons engine={engine} match={match} seasonNum={seasonNum} commentary={commentary} potmName={potmName} />
        )}
        <Button variant="ghost" size="sm" onClick={() => nav("/schedule")}>← Back to Fixtures</Button>
      </div>
    </div>
  );

  // ---- TOSS ----
  if (phase === "toss") {
    return (
      <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
        {headBlock}
        <Card className="p-10 text-center gradient-card border-primary/30 glow-primary">
          {!toss ? (
            <>
              <Coins className="w-16 h-16 mx-auto text-primary mb-3 animate-pulse" />
              <div className="font-display text-3xl mb-4">It's Toss Time</div>
              <Button size="lg" onClick={doToss} className="gradient-primary text-primary-foreground font-display tracking-wider text-lg">
                Flip the Coin
              </Button>
            </>
          ) : (
            <>
              <div className="text-xs uppercase tracking-[0.3em] text-primary mb-2">Toss Winner</div>
              <div className="font-display text-5xl mb-2" style={{ color: tcolor(toss.winner) }}>{toss.winner}</div>
              <div className="text-lg text-muted-foreground mb-6">elected to <span className="text-primary font-semibold">{toss.decision} first</span></div>
              <Button size="lg" onClick={() => setPhase("xi")} className="gradient-primary text-primary-foreground">Pick Playing XI <ArrowRight className="ml-2 w-4 h-4" /></Button>
            </>
          )}
        </Card>
      </div>
    );
  }

  // ---- XI ----
  if (phase === "xi") {
    return (
      <div className="space-y-6 animate-fade-in">
        {headBlock}
        <PlayingXIPicker
          teamA={match.team_a} teamB={match.team_b}
          squadA={squads[match.team_a] ?? []} squadB={squads[match.team_b] ?? []}
          playingXISize={league.settings.playingXI}
          teamColorFn={tcolor}
          onConfirm={onXIConfirm}
        />
      </div>
    );
  }

  // ---- Openers + first bowler ----
  if (phase === "openers" && toss) {
    const battingFirst = toss.decision === "bat" ? toss.winner : (toss.winner === match.team_a ? match.team_b : match.team_a);
    const bowlingFirst = battingFirst === match.team_a ? match.team_b : match.team_a;
    return (
      <div className="space-y-6 animate-fade-in max-w-3xl">
        {headBlock}
        <OpenersAndBowlerForm
          battingTeam={battingFirst} bowlingTeam={bowlingFirst}
          battingXI={xi[battingFirst]} bowlingXI={xi[bowlingFirst]}
          teamColorFn={tcolor}
          onSubmit={(openers, bowlerId) => startMatchEngine(openers, bowlerId)}
        />
      </div>
    );
  }

  // ---- INNINGS BREAK ----
  if (phase === "innings_break" && engine) {
    const battingTeam = engine.innings1.bowlingTeam;
    const bowlingTeam = engine.innings1.battingTeam;
    return (
      <div className="space-y-6 animate-fade-in">
        {headBlock}
        <Card className="p-6 gradient-card border-primary/40 glow-primary text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-primary">Innings Break</div>
          <div className="font-display text-4xl mt-2" style={{color: tcolor(engine.innings1.battingTeam)}}>
            {engine.innings1.battingTeam} {engine.innings1.runs}/{engine.innings1.wickets}
          </div>
          <div className="text-lg text-muted-foreground mt-2">Target for <span style={{color:tcolor(battingTeam)}} className="font-display">{battingTeam}</span>: <b className="text-primary text-2xl">{engine.innings1.runs + 1}</b></div>
        </Card>
        <Card className="p-4 gradient-card border-border/60">
          <div className="font-display text-lg mb-3">2nd Innings Setup — {battingTeam}</div>
          <OpenersAndBowlerForm
            battingTeam={battingTeam} bowlingTeam={bowlingTeam}
            battingXI={engine.xi[battingTeam]} bowlingXI={engine.xi[bowlingTeam]}
            teamColorFn={tcolor}
            embedded
            onChange={(o, b) => setSecondInnSetup({ openers: o, bowler: b })}
          />
          <Button size="lg" className="gradient-primary text-primary-foreground mt-4 w-full"
            disabled={!secondInnSetup.openers || !secondInnSetup.bowler}
            onClick={startInnings2}>
            Start 2nd Innings <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </Card>
        <FullScorecard state={engine} teamColorFn={tcolor} />
      </div>
    );
  }

  // ---- LIVE / TRANSITIONS / DONE ----
  if (engine) {
    const inn = engine.currentInnings === 1 ? engine.innings1 : engine.innings2!;
    const battingXI = engine.xi[inn.battingTeam];
    const bowlingXI = engine.xi[inn.bowlingTeam];
    const liveDisabled = phase !== "live";

    return (
      <div className="space-y-4 animate-fade-in">
        {headBlock}

        {/* Big event flash */}
        {recentBigEvent && (
          <div className={`fixed inset-x-0 top-20 z-40 flex justify-center pointer-events-none animate-scale-in`}>
            <div className={`px-8 py-3 rounded-full font-display text-3xl tracking-widest shadow-2xl
              ${recentBigEvent.kind === "SIX" ? "gradient-six text-foreground" :
                recentBigEvent.kind === "FOUR" ? "gradient-four text-background" :
                "gradient-wicket text-foreground"}`}>
              {recentBigEvent.text}
            </div>
          </div>
        )}

        {/* Match done banner */}
        {phase === "done" && (
          <Card className="p-6 gradient-card border-primary glow-primary text-center animate-scale-in">
            <Trophy className="w-12 h-12 mx-auto text-primary" />
            <div className="font-display text-4xl mt-2" style={{ color: tcolor(match.winner ?? "") }}>
              {match.result_text ?? "Match Complete"}
            </div>
            <div className="flex gap-2 justify-center mt-4">
              <Button onClick={() => nav("/schedule")} className="gradient-primary text-primary-foreground">Back to Fixtures</Button>
              <Button variant="outline" onClick={() => nav("/records")}>View Records</Button>
            </div>
          </Card>
        )}

        {/* Needs batter overlay */}
        {phase === "needs_batter" && (
          <Card className="p-4 gradient-card border-[hsl(var(--wicket))]/40 animate-fade-in">
            <div className="font-display text-lg mb-2">🆕 New batter needed</div>
            <div className="flex gap-2 items-center">
              <Select value={pendingBatter} onValueChange={setPendingBatter}>
                <SelectTrigger className="w-72"><SelectValue placeholder="Pick incoming batter" /></SelectTrigger>
                <SelectContent>
                  {battingXI.filter(p => !inn.bat[p.id]).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.role}) — {p.rating}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={confirmBatter} disabled={!pendingBatter} className="gradient-primary text-primary-foreground">Send In</Button>
            </div>
          </Card>
        )}

        {/* Needs bowler */}
        {phase === "needs_bowler" && (
          <Card className="p-4 gradient-card border-primary/40 animate-fade-in">
            <div className="font-display text-lg mb-2 flex items-center gap-2"><Repeat className="w-4 h-4"/>New bowler for next over</div>
            <div className="flex gap-2 items-center">
              <Select value={pendingBowler} onValueChange={setPendingBowler}>
                <SelectTrigger className="w-72"><SelectValue placeholder="Pick bowler" /></SelectTrigger>
                <SelectContent>
                  {bowlingXI.filter(p => p.id !== inn.bowlerId).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.role}) — {p.rating}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={confirmBowler} disabled={!pendingBowler} className="gradient-primary text-primary-foreground">Confirm</Button>
            </div>
          </Card>
        )}

        <LiveScorecard state={engine} teamColorFn={tcolor} />
        <WinProbBar state={engine} teamColorFn={tcolor} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT: ball input */}
          <Card className="p-4 gradient-card border-border/60 lg:col-span-1">
            <Tabs value={inputMode} onValueChange={v => setInputMode(v as any)}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Ball Input</div>
                <TabsList className="h-7">
                  <TabsTrigger value="buttons" className="text-xs">Buttons</TabsTrigger>
                  <TabsTrigger value="wheel" className="text-xs">🎡 Wheel</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="buttons"><BallButtons onBall={processBallEvent} disabled={liveDisabled} /></TabsContent>
              <TabsContent value="wheel"><SpinWheel onResult={fromWheel} disabled={liveDisabled} /></TabsContent>
            </Tabs>
            <AiSimPanel
              onNextBall={aiNextBall}
              disabled={liveDisabled}
              style={aiStyle} onStyleChange={setAiStyle}
              difficulty={aiDifficulty} onDifficultyChange={setAiDifficulty}
              autoPlay={autoPlay} onAutoPlayChange={setAutoPlay}
              autoMatch={autoMatch} onAutoMatchChange={setAutoMatch}
              speedMs={aiSpeedMs} onSpeedChange={setAiSpeedMs}
            />
            {engine.powerplayOvers && engine.powerplayOvers > 0 && (
              <div className="mt-3 p-2 rounded border border-primary/30 bg-primary/5 text-[11px] text-primary text-center">
                ⚡ Powerplay: overs 1–{engine.powerplayOvers}
                {(() => {
                  const inn = engine.currentInnings === 1 ? engine.innings1 : engine.innings2!;
                  return isPowerplayBall(engine, inn.legalBalls)
                    ? <span className="ml-1 font-display tracking-wider">· ACTIVE</span>
                    : <span className="ml-1 text-muted-foreground">· complete</span>;
                })()}
              </div>
            )}
          </Card>

          {/* MIDDLE: tabs for stats */}
          <Card className="p-4 gradient-card border-border/60 lg:col-span-2">
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="commentary">Commentary</TabsTrigger>
                <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
                <TabsTrigger value="caps">Caps</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-3 mt-3">
                <OverTimeline state={engine} />
                <CapsRace state={engine} teamColorFn={tcolor} />
              </TabsContent>
              <TabsContent value="commentary" className="mt-3">
                <div ref={commentaryRef} className="max-h-[460px] overflow-auto space-y-1.5">
                  {commentary.map((c, i) => (
                    <div key={i} className="text-sm py-1.5 px-2 border-l-2 border-primary/40 bg-secondary/20 rounded-r animate-fade-in">{c}</div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="scorecard" className="mt-3">
                <FullScorecard state={engine} teamColorFn={tcolor} />
              </TabsContent>
              <TabsContent value="caps" className="mt-3">
                <CapsRace state={engine} teamColorFn={tcolor} />
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        <PowerplayBreakdown state={engine} teamColorFn={tcolor} />
        {phase === "done" && engine.innings2 && <PostMatchPresentation engine={engine} match={match} teamColorFn={tcolor} />}
        {phase === "done" && engine.innings2 && <SuperSixes state={engine} teamColorFn={tcolor} />}
      </div>
    );
  }

  return null;
}

// =================== Helpers ===================

function OpenersAndBowlerForm({
  battingTeam, bowlingTeam, battingXI, bowlingXI, teamColorFn, onSubmit, embedded, onChange,
}: {
  battingTeam: string; bowlingTeam: string;
  battingXI: PlayerLite[]; bowlingXI: PlayerLite[];
  teamColorFn: (id: string) => string;
  onSubmit?: (openers: [string,string], bowlerId: string) => void;
  embedded?: boolean;
  onChange?: (openers: [string,string] | undefined, bowlerId: string | undefined) => void;
}) {
  const [op1, setOp1] = useState("");
  const [op2, setOp2] = useState("");
  const [bw, setBw] = useState("");

  useEffect(() => {
    if (op1 && op2 && op1 !== op2 && bw) onChange?.([op1, op2], bw);
    else onChange?.(undefined, undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op1, op2, bw]);

  const ready = op1 && op2 && op1 !== op2 && bw;

  const Wrap: any = embedded ? "div" : Card;
  return (
    <Wrap className={embedded ? "space-y-3" : "p-5 gradient-card border-border/60 space-y-3"}>
      {!embedded && <div className="font-display text-xl">Openers & Opening Bowler</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground" style={{ color: teamColorFn(battingTeam) }}>Striker</label>
          <Select value={op1} onValueChange={setOp1}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Pick" /></SelectTrigger>
            <SelectContent>{battingXI.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.role})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground" style={{ color: teamColorFn(battingTeam) }}>Non-striker</label>
          <Select value={op2} onValueChange={setOp2}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Pick" /></SelectTrigger>
            <SelectContent>{battingXI.filter(p=>p.id!==op1).map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.role})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground" style={{ color: teamColorFn(bowlingTeam) }}>Opening bowler</label>
          <Select value={bw} onValueChange={setBw}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Pick" /></SelectTrigger>
            <SelectContent>{bowlingXI.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.role})</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {!embedded && (
        <Button size="lg" disabled={!ready} onClick={() => ready && onSubmit?.([op1, op2], bw)} className="gradient-primary text-primary-foreground w-full">
          <Sparkles className="w-4 h-4 mr-2" />Start Innings
        </Button>
      )}
    </Wrap>
  );
}

function PostMatchPresentation({ engine, match, teamColorFn }: { engine: MatchEngineState; match: any; teamColorFn: (id: string) => string }) {
  // Gather highlights
  const innings = [engine.innings1, engine.innings2!];
  let mostFours = { name: "—", count: 0 };
  let mostSixes = { name: "—", count: 0 };
  let bestEcon = { name: "—", econ: Infinity, balls: 0, runs: 0 };
  let topRun = { name: "—", runs: 0 };
  let topWkt = { name: "—", wickets: 0, runs: 0 };

  innings.forEach(inn => {
    Object.values(inn.bat).forEach((b: any) => {
      if (b.fours > mostFours.count) mostFours = { name: b.name, count: b.fours };
      if (b.sixes > mostSixes.count) mostSixes = { name: b.name, count: b.sixes };
      if (b.runs > topRun.runs) topRun = { name: b.name, runs: b.runs };
    });
    Object.values(inn.bowl).forEach((b: any) => {
      if (b.balls >= 6) {
        const e = (b.runs / b.balls) * 6;
        if (e < bestEcon.econ) bestEcon = { name: b.name, econ: e, balls: b.balls, runs: b.runs };
      }
      if (b.wickets > topWkt.wickets || (b.wickets === topWkt.wickets && b.runs < topWkt.runs)) {
        topWkt = { name: b.name, wickets: b.wickets, runs: b.runs };
      }
    });
  });

  return (
    <Card className="p-6 gradient-card border-primary/40 glow-primary animate-fade-in">
      <div className="text-xs uppercase tracking-[0.3em] text-primary mb-1">Post-Match Presentation</div>
      <div className="font-display text-3xl mb-4" style={{ color: teamColorFn(match.winner) }}>{match.result_text}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Highlight title="Top Scorer" main={`${topRun.runs}`} sub={topRun.name} />
        <Highlight title="Top Wkt-taker" main={`${topWkt.wickets}/${topWkt.runs}`} sub={topWkt.name} />
        <Highlight title="Most 4s" main={`${mostFours.count}`} sub={mostFours.name} />
        <Highlight title="Most 6s" main={`${mostSixes.count}`} sub={mostSixes.name} />
        <Highlight title="Best Econ" main={bestEcon.econ === Infinity ? "—" : bestEcon.econ.toFixed(2)} sub={bestEcon.name} />
      </div>
    </Card>
  );
}

function Highlight({ title, main, sub }: { title: string; main: string; sub: string }) {
  return (
    <div className="p-3 rounded-lg bg-secondary/40 border border-border/60">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="font-display text-2xl mt-0.5">{main}</div>
      <div className="text-xs text-muted-foreground truncate">{sub}</div>
    </div>
  );
}

function ExportButtons({ engine, match, seasonNum, commentary, potmName }: {
  engine: MatchEngineState; match: any; seasonNum: number; commentary: string[]; potmName: string;
}) {
  const meta: ExportMeta = {
    matchNumber: match.match_number,
    stage: match.stage,
    seasonNumber: seasonNum,
    teamA: match.team_a,
    teamB: match.team_b,
    tossWinner: match.toss_winner ?? undefined,
    tossDecision: match.toss_decision ?? undefined,
    resultText: match.result_text ?? undefined,
    winner: match.winner ?? null,
    potmName: potmName || undefined,
  };
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" onClick={() => { downloadPDF(meta, engine, commentary); toast.success("📄 PDF downloaded"); }} title="Export as PDF">
        <FileText className="w-3.5 h-3.5 mr-1" /> PDF
      </Button>
      <Button size="sm" variant="outline" onClick={() => { downloadJSON(meta, engine, commentary); toast.success("💾 JSON downloaded"); }} title="Export as JSON">
        <FileJson className="w-3.5 h-3.5 mr-1" /> JSON
      </Button>
    </div>
  );
}
