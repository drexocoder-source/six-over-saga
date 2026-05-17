// IPL Social Media simulator — accounts, posts, likes, follows
// PFPs via DiceBear (deterministic, free, no key). Photo posts via Picsum (seeded).
import { supabase } from "@/integrations/supabase/client";

export type AccountType = "team" | "player" | "fan" | "media" | "official";
export interface SocialAccount {
  id: string;
  league_id: string;
  handle: string;
  display_name: string;
  account_type: AccountType;
  team_id: string | null;
  player_id: string | null;
  bio: string | null;
  pfp_url: string | null;
  pfp_seed: string | null;
  followers: number;
  following: number;
  verified: boolean;
}

export interface SocialPost {
  id: string;
  league_id: string;
  account_id: string;
  content: string;
  post_type: "text" | "meme" | "photo" | "highlight" | "announcement";
  image_url: string | null;
  match_id: string | null;
  season_number: number | null;
  likes: number;
  reposts: number;
  replies: number;
  hashtags: string[];
  created_at: string;
}

export function pfpFor(seed: string, style: "avataaars" | "bottts" | "lorelei" | "shapes" | "thumbs" = "avataaars"): string {
  // DiceBear v9 — free, public, deterministic
  const url = new URL(`https://api.dicebear.com/9.x/${style}/svg`);
  url.searchParams.set("seed", seed);
  url.searchParams.set("backgroundType", "gradientLinear,solid");
  return url.toString();
}

export function teamLogoFor(teamId: string, primary?: string): string {
  // Use shapes avatar style with team id as seed for a "logo-ish" feel
  const url = new URL(`https://api.dicebear.com/9.x/shapes/svg`);
  url.searchParams.set("seed", teamId);
  if (primary) url.searchParams.set("backgroundColor", primary.replace("#",""));
  return url.toString();
}

export function photoFor(seed: string, w = 600, h = 400): string {
  // Picsum seeded photo — free
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

const FAN_FIRST = ["Aarav","Vivaan","Aditya","Vihaan","Arjun","Sai","Reyansh","Mohammed","Krishna","Ishaan","Ananya","Diya","Saanvi","Aanya","Pari","Anika","Kavya","Ira","Riya","Sara","Rohan","Karan","Nikhil","Yash","Dev","Shaan","Aryan","Kabir","Veer","Nisha","Tara","Meera","Maya","Zoya","Kiara","Ayaan","Rehan","Ranveer","Siddharth","Tanvi","Pooja","Neha","Priya","Akhil","Manav","Rishabh","Harshit","Tanmay","Aakash","Bhavya"];
const FAN_LAST = ["Sharma","Verma","Iyer","Patel","Reddy","Khan","Singh","Gupta","Das","Nair","Pillai","Rao","Mehta","Joshi","Kapoor","Bose","Banerjee","Mukherjee","Chakraborty","Yadav","Choudhary","Bhatia","Malhotra","Saxena","Dubey","Tiwari","Kulkarni","Shetty","Goswami","Pandey","Trivedi"];
const MEDIA_OUTLETS = [
  { name: "CricBuzz Live", handle: "cricbuzz_live", bio: "Live scores, news & analysis." },
  { name: "ESPN Cricinfo", handle: "espn_cric", bio: "The home of cricket." },
  { name: "Wisden", handle: "wisden_official", bio: "Cricket's almanack since 1864." },
  { name: "T20 Daily", handle: "t20_daily", bio: "Everything T20 in one feed." },
  { name: "Yorker Pod", handle: "yorker_pod", bio: "Two overs. One winner. Endless takes." },
];
const OFFICIAL = [
  { name: "IPL T20", handle: "ipl_t2", bio: "Official handle of the IPL T20 league.", verified: true },
  { name: "Match Centre", handle: "match_centre", bio: "Live score updates from every match.", verified: true },
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rng(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/**
 * Ensure baseline accounts exist for league: official, media, team handles, player handles, fan accounts.
 * Idempotent — only inserts what's missing.
 */
export async function ensureSocialAccounts(leagueId: string, opts: { fans?: number } = {}) {
  const fans = opts.fans ?? 80;
  const { data: existing } = await supabase.from("social_accounts").select("handle, account_type").eq("league_id", leagueId);
  const have = new Set((existing ?? []).map(a => a.handle));

  const toInsert: any[] = [];

  // Official
  for (const o of OFFICIAL) {
    if (have.has(o.handle)) continue;
    toInsert.push({
      league_id: leagueId, handle: o.handle, display_name: o.name, account_type: "official",
      bio: o.bio, verified: true, pfp_seed: o.handle,
      pfp_url: pfpFor(o.handle, "shapes"),
      followers: rng(50000, 200000),
    });
  }

  // Media
  for (const m of MEDIA_OUTLETS) {
    if (have.has(m.handle)) continue;
    toInsert.push({
      league_id: leagueId, handle: m.handle, display_name: m.name, account_type: "media",
      bio: m.bio, verified: true, pfp_seed: m.handle, pfp_url: pfpFor(m.handle, "thumbs"),
      followers: rng(20000, 90000),
    });
  }

  // Teams
  const { data: league } = await supabase.from("leagues").select("teams").eq("id", leagueId).maybeSingle();
  const teams = (league?.teams as any[]) ?? [];
  for (const t of teams) {
    const handle = `${t.id.toLowerCase()}_official`;
    if (have.has(handle)) continue;
    toInsert.push({
      league_id: leagueId, handle, display_name: t.fullName, account_type: "team",
      team_id: t.id, bio: `Official handle of ${t.fullName}. #PlayBold`, verified: true,
      pfp_seed: t.id, pfp_url: teamLogoFor(t.id),
      followers: rng(80000, 300000),
    });
  }

  // Players
  const { data: players } = await supabase.from("players").select("id, name, role, rating").eq("league_id", leagueId);
  for (const p of players ?? []) {
    const handle = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_") + "_real";
    if (have.has(handle)) continue;
    const verified = (p.rating ?? 0) >= 80;
    toInsert.push({
      league_id: leagueId, handle, display_name: p.name, account_type: "player",
      player_id: p.id, bio: `${p.role} • Living the dream 🏏`, verified,
      pfp_seed: p.name, pfp_url: pfpFor(p.name, "avataaars"),
      followers: verified ? rng(40000, 250000) : rng(2000, 30000),
    });
  }

  // Fans
  let fanCount = (existing ?? []).filter(a => a.account_type === "fan").length;
  while (fanCount < fans) {
    const f = pick(FAN_FIRST), l = pick(FAN_LAST);
    const handle = `${f.toLowerCase()}.${l.toLowerCase()}${rng(1, 999)}`;
    if (have.has(handle)) { fanCount++; continue; }
    have.add(handle);
    const fav = teams.length ? pick(teams) : null;
    toInsert.push({
      league_id: leagueId, handle, display_name: `${f} ${l}`, account_type: "fan",
      team_id: fav?.id ?? null,
      bio: fav ? `Die-hard ${fav.id} fan 🔥` : `Cricket > Everything 🏏`,
      pfp_seed: handle,
      pfp_url: pfpFor(handle, pick(["avataaars","bottts","lorelei"]) as any),
      followers: rng(5, 1500),
      following: rng(20, 400),
    });
    fanCount++;
  }

  if (toInsert.length) await supabase.from("social_accounts").insert(toInsert);
  return toInsert.length;
}

// ───────────────── Post generator ─────────────────

const TEAM_TEMPLATES = [
  "💪 Boys are gearing up for the next clash. Bring the noise! #{TEAM}",
  "🏆 Training day. Eyes on the prize. #{TEAM}Army",
  "🎟️ Match day energy is unmatched. Let's go! #{TEAM} #IPLT2",
  "Skipper had a few words for the squad today. Fire incoming. 🔥",
  "Throwback to that last-ball six. Still can't believe it. #IPLT2",
  "Fans, you are our 12th player. Show up loud tonight! ❤️",
];
const PLAYER_TEMPLATES = [
  "Long net session done ✅ Felt the bat swinging well today.",
  "Grateful for the support. The work continues. 🙏",
  "Two overs is all we get. Make every ball count.",
  "Family time before the next match. Recharged. ❤️",
  "Big game tomorrow. Trust the process. 🏏",
];
const FAN_TEMPLATES = [
  "Bro {TEAM} better win today or I'm uninstalling the app 😭",
  "{PLAYER} is built different. Period. 🐐",
  "I left the room for ONE ball and we lost a wicket. Never again 😤",
  "T2 cricket >>> regular T20. Fight me. 🔥",
  "If {TEAM} doesn't make playoffs I'm done with this league fr",
  "Bowling that to {PLAYER}? Brave man. RIP boundary count.",
  "POV: It's the last ball, 6 needed, you're {PLAYER}. Don't choke. 💀",
  "The way {TEAM} fans go silent after 1 wicket is hilarious 😂",
  "Why is the toss decision ALWAYS wrong man 🤡",
  "Every season my team breaks my heart. Why do I keep coming back 😭",
];
const MEME_TEMPLATES = [
  "POV: You promised your boss you'd work late but {TEAM} match is on 💀",
  "Me explaining to mom why I can't have dinner during powerplay 🤡",
  "Nobody:\nAbsolutely nobody:\nUmpire: *signals wide on a perfect ball* 😭",
  "{PLAYER} when the bowler tries a slower one: 😏🏏💥",
  "When your team scores 30 in the first over but still loses 🥲",
];
const MEDIA_TEMPLATES = [
  "BREAKING: {TEAM} confirm changes ahead of next fixture. Full story incoming.",
  "Stat alert 📊 — {PLAYER} now has the highest strike rate this season.",
  "Tonight's game features two in-form sides. Could be a classic.",
  "ANALYSIS: How {TEAM}'s death overs are quietly winning them games.",
];
const OFFICIAL_TEMPLATES = [
  "📢 Match {N} schedule confirmed. Get your tickets early!",
  "🏟️ Stadium gates open in 1 hour. Drive safe & arrive early.",
  "🎉 What a season we're having. Thanks for the love, fans!",
];

const HASHTAGS = ["IPLT2","TwoOverThunder","CricketTwitter","MatchDay","T2Live","BleedBlue","WhistlePodu","HallaBol","PlayBold"];

// ─── Drama / Leaks templates ────────────────────────────────────────────────

const LEAK_TEMPLATES = [
  "🚨 SOURCES CLAIM: Star batter unhappy with captaincy decisions. Dressing-room tension at an all-time high.",
  "💥 LEAKED: Senior player reportedly asked the team management for a trade before the next auction.",
  "🔴 BREAKING EXCLUSIVE: Coach and captain had heated exchange after last loss. Staff divided.",
  "📲 INSIDER: Mystery player seen with rival franchise's scouts. Loyalties in question.",
  "⚠️ RUMOUR MILL: {PLAYER} told teammates he might retire if team misses playoffs this season.",
  "🎯 DRESSING-ROOM LEAK: Team WhatsApp group went silent for 48 hours after dressing-room bust-up.",
  "🤫 WHISPERS: Junior player snubbed by captain in training session sparks morale crisis.",
  "💔 EXCLUSIVE: {PLAYER} skipped optional practice — 'personal reasons' cited by management.",
  "🏏 SHOCK CLAIM: Ex-captain still has influence over squad selection. Current skipper frustrated.",
  "🌡️ TEMP RISING: {TEAM} camp on edge as overseas signings demand more batting slots.",
  "📸 PAPARAZZI SNAP: {PLAYER} spotted at {TEAM} team dinner — transfer? Friendship? Espionage?",
  "💸 SALARY DRAMA: Three {TEAM} players unhappy with contract renegotiation offers.",
];

const CONTROVERSY_TEMPLATES = [
  "HOT TAKE 🔥 {PLAYER} shouldn't be captain. The numbers don't lie. The whole internet agrees.",
  "Unpopular opinion: {TEAM} should blow up the squad and start fresh. Change everything.",
  "Is {PLAYER} overrated? Scored 0 in the last clutch game. We need to talk.",
  "The captaincy debate is BACK. {PLAYER} vs the world. Comment your pick 👇",
  "Bold prediction: {TEAM} finishes bottom half this season. Their auction was a disaster.",
  "Why does {TEAM} keep bowling {PLAYER} at death? Someone needs to be held accountable.",
  "PSA: Cricket fans need to stop worshipping {PLAYER}. Average stats, average player.",
  "Not me crying at {TEAM} collapses every single match. It's not love anymore, it's trauma 😭",
];

const RETIREMENT_TEMPLATES = [
  "💔 Hearing whispers {PLAYER} might announce retirement before the next season. A legend's final chapter.",
  "'{PLAYER} looks different this season. Something in the eyes.' — team insider. We're not ready.",
  "Imagine if {PLAYER} played one final IPL season. Would cry honestly. The GOAT deserves a trophy exit.",
  "They said he was done three years ago. {PLAYER} keeps proving everyone wrong. Last dance incoming?",
];

const TRANSFER_TEMPLATES = [
  "TRANSFER ALERT 🚨 Big name reportedly unhappy at {TEAM}. Auction fee might not be enough to retain.",
  "The {PLAYER}-to-{TEAM2} rumors refuse to die. Both teams declining to comment speaks volumes.",
  "Agent of {PLAYER} seen in conversation with {TEAM} scouts. Something is brewing.",
  "Franchise sources: 'We're always open to the right deal.' Translation: {PLAYER} is available.",
];

const MEMER_HANDLES = [
  { handle: "boundary_bro_official", name: "Boundary Bro 🏏", bio: "Every 4 hits me different 🚀 Cricket memes 24/7" },
  { handle: "wicket_watchers", name: "Wicket Watchers", bio: "We document every collapse. There are MANY 👀" },
  { handle: "drs_dad", name: "DRS Dad", bio: "Always reviewing. Always wrong. Always loud 📺" },
  { handle: "powerplay_police", name: "Powerplay Police 🚓", bio: "Holding teams accountable for wasting powerplay since forever" },
  { handle: "noball_narrator", name: "No-Ball Narrator", bio: "No-balls cost matches. I keep receipts 📋" },
  { handle: "slow_over_rate_watcher", name: "Over-Rate Oracle", bio: "They NEVER bowl on time. Where's the fine 😤" },
  { handle: "yorker_enthusiast", name: "Yorker Fan Club", bio: "Clean bowled. Perfect length. I'm in tears 😭🎯" },
  { handle: "slog_sweep_king", name: "Slog Sweep Connoisseur", bio: "Any shot that's technically wrong but goes for 6 = art 🎨" },
  { handle: "caught_in_the_deep", name: "Deep Square Stan", bio: "Longest running fan of the deep square leg fielder 🤝" },
  { handle: "umpire_truther", name: "Umpire Truther 👁️", bio: "The umpire is never wrong. Except always. 📢" },
  { handle: "cricket_conspiracy_acc", name: "Cricket Conspiracy Acc", bio: "The pitches are doctored. The toss is rigged. Wake up 👁️" },
  { handle: "dot_ball_diaries", name: "Dot Ball Diaries", bio: "A tribute to the most underrated ball in cricket 🟫" },
];

/** Seed memer accounts into the league */
export async function ensureMemerAccounts(leagueId: string) {
  const { data: existing } = await supabase.from("social_accounts").select("handle").eq("league_id", leagueId);
  const have = new Set((existing ?? []).map(a => a.handle));
  const toInsert = MEMER_HANDLES
    .filter(m => !have.has(m.handle))
    .map(m => ({
      league_id: leagueId, handle: m.handle, display_name: m.name, account_type: "fan" as const,
      bio: m.bio, pfp_seed: m.handle, pfp_url: pfpFor(m.handle, pick(["bottts","lorelei","thumbs"]) as any),
      followers: rng(8000, 120000), following: rng(100, 500), verified: false,
    }));
  if (toInsert.length) await supabase.from("social_accounts").insert(toInsert);
  return toInsert.length;
}

/**
 * Generate dressing-room leaks, controversies, transfer rumours, and retirement hints.
 * Call this at any time — no match context needed.
 */
export async function generateDramaLeaks(leagueId: string, count = 12) {
  const { data: accs } = await supabase.from("social_accounts").select("*").eq("league_id", leagueId);
  if (!accs?.length) return 0;
  const teamsRow = await supabase.from("leagues").select("teams").eq("id", leagueId).maybeSingle();
  const teams = (teamsRow.data?.teams as any[]) ?? [];
  const { data: players } = await supabase.from("players").select("name").eq("league_id", leagueId).order("rating", { ascending: false }).limit(30);
  const playerNames = (players ?? []).map(p => p.name);

  const mediaAccs = accs.filter(a => a.account_type === "media");
  const fanAccs   = accs.filter(a => a.account_type === "fan");
  const fill = (tpl: string) => {
    const t1 = teams.length ? pick(teams) : { id: "RCB" };
    const t2 = teams.filter(t => t.id !== t1.id).length ? pick(teams.filter(t => t.id !== t1.id)) : { id: "CSK" };
    return tpl
      .replace(/\{PLAYER\}/g, playerNames.length ? pick(playerNames) : "the star")
      .replace(/\{TEAM\}/g, t1.id ?? "the team")
      .replace(/\{TEAM2\}/g, t2.id ?? "rivals");
  };

  const posts: any[] = [];
  for (let i = 0; i < count; i++) {
    const dice = Math.random();
    let content: string, acc: any;
    if (dice < 0.35) {
      content = fill(pick(LEAK_TEMPLATES));
      acc = mediaAccs.length ? pick(mediaAccs) : pick(accs);
    } else if (dice < 0.55) {
      content = fill(pick(CONTROVERSY_TEMPLATES));
      acc = fanAccs.length ? pick(fanAccs) : pick(accs);
    } else if (dice < 0.75) {
      content = fill(pick(TRANSFER_TEMPLATES));
      acc = mediaAccs.length ? pick(mediaAccs) : pick(accs);
    } else {
      content = fill(pick(RETIREMENT_TEMPLATES));
      acc = fanAccs.length ? pick(fanAccs) : pick(accs);
    }

    posts.push({
      league_id: leagueId, account_id: acc.id, content,
      post_type: "announcement",
      image_url: Math.random() < 0.4 ? photoFor(`drama-${i}-${Date.now()}`, 700, 400) : null,
      hashtags: pick([["DressingRoomLeak","IPLT2"],["TransferRumour","Cricket"],["RetirementWatch","IPLT2"],["CaptaincyDebate","HotTake"]]),
      likes: rng(500, 25000), reposts: rng(100, 3000), replies: rng(50, 800),
    });
  }
  if (posts.length) await supabase.from("social_posts").insert(posts);
  return posts.length;
}

function pickTeam(teams: any[]) { return teams.length ? pick(teams) : { id: "RCB", fullName: "RCB" }; }

export async function generateRandomPosts(leagueId: string, count = 30, opts?: { matchId?: string; seasonNumber?: number; context?: string }) {
  const { data: accs } = await supabase.from("social_accounts").select("*").eq("league_id", leagueId);
  if (!accs || !accs.length) return 0;
  const teamsRow = await supabase.from("leagues").select("teams").eq("id", leagueId).maybeSingle();
  const teams = (teamsRow.data?.teams as any[]) ?? [];
  const { data: players } = await supabase.from("players").select("id, name").eq("league_id", leagueId);
  const playerNames = (players ?? []).map(p => p.name);

  const teamAccs = accs.filter(a => a.account_type === "team");
  const playerAccs = accs.filter(a => a.account_type === "player");
  const fanAccs = accs.filter(a => a.account_type === "fan");
  const mediaAccs = accs.filter(a => a.account_type === "media");
  const officialAccs = accs.filter(a => a.account_type === "official");

  const fill = (tpl: string) => tpl
    .replace(/\{TEAM\}/g, pickTeam(teams).id)
    .replace(/\{PLAYER\}/g, playerNames.length ? pick(playerNames) : "the GOAT")
    .replace(/\{N\}/g, String(rng(1, 14)));

  const posts: any[] = [];
  for (let i = 0; i < count; i++) {
    const dice = Math.random();
    let acc: any, content: string, type: SocialPost["post_type"] = "text", image_url: string | null = null;

    if (dice < 0.18 && teamAccs.length) {
      acc = pick(teamAccs);
      const t = teams.find((tt: any) => tt.id === acc.team_id);
      content = fill(pick(TEAM_TEMPLATES)).replace("#{TEAM}", `#${acc.team_id}`).replace("#{TEAM}Army", `#${acc.team_id}Army`);
      if (Math.random() < 0.55) { type = "photo"; image_url = photoFor(`${acc.team_id}-${Date.now()}-${i}`, 800, 500); }
    } else if (dice < 0.32 && playerAccs.length) {
      acc = pick(playerAccs);
      content = fill(pick(PLAYER_TEMPLATES));
      if (Math.random() < 0.5) { type = "photo"; image_url = photoFor(`${acc.handle}-${i}`, 700, 700); }
    } else if (dice < 0.40 && mediaAccs.length) {
      acc = pick(mediaAccs);
      content = fill(pick(MEDIA_TEMPLATES));
      type = "announcement";
    } else if (dice < 0.45 && officialAccs.length) {
      acc = pick(officialAccs);
      content = fill(pick(OFFICIAL_TEMPLATES));
      type = "announcement";
    } else if (dice < 0.65 && fanAccs.length) {
      acc = pick(fanAccs);
      content = fill(pick(MEME_TEMPLATES));
      type = "meme";
      if (Math.random() < 0.7) image_url = photoFor(`meme-${acc.handle}-${i}`, 500, 500);
    } else {
      acc = fanAccs.length ? pick(fanAccs) : pick(accs);
      content = fill(pick(FAN_TEMPLATES));
    }

    if (opts?.context && Math.random() < 0.3) content = `${opts.context} — ${content}`;

    const tagCount = rng(0, 3);
    const tags = Array.from(new Set(Array.from({ length: tagCount }, () => pick(HASHTAGS))));

    posts.push({
      league_id: leagueId, account_id: acc.id, content,
      post_type: type, image_url,
      match_id: opts?.matchId ?? null, season_number: opts?.seasonNumber ?? null,
      hashtags: tags,
      likes: type === "meme" ? rng(50, 5000) : (acc.account_type === "team" || acc.account_type === "official" ? rng(200, 8000) : rng(0, 300)),
      reposts: rng(0, 200),
      replies: rng(0, 80),
    });
  }

  await supabase.from("social_posts").insert(posts);
  return posts.length;
}

export async function getFeed(leagueId: string, opts: { limit?: number; type?: string; accountId?: string } = {}) {
  let q = supabase.from("social_posts").select("*, social_accounts(*)").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(opts.limit ?? 50);
  if (opts.type && opts.type !== "all") q = q.eq("post_type", opts.type);
  if (opts.accountId) q = q.eq("account_id", opts.accountId);
  const { data } = await q;
  return data ?? [];
}

export async function listAccounts(leagueId: string, type?: AccountType) {
  let q = supabase.from("social_accounts").select("*").eq("league_id", leagueId).order("followers", { ascending: false });
  if (type) q = q.eq("account_type", type);
  const { data } = await q;
  return (data ?? []) as unknown as SocialAccount[];
}

export async function likePost(postId: string, accountId: string, leagueId: string) {
  const { error } = await supabase.from("social_likes").insert({ post_id: postId, account_id: accountId, league_id: leagueId });
  if (!error) {
    const { data } = await supabase.from("social_posts").select("likes").eq("id", postId).maybeSingle();
    await supabase.from("social_posts").update({ likes: (data?.likes ?? 0) + 1 }).eq("id", postId);
  }
}

export async function followAccount(followerId: string, followeeId: string, leagueId: string) {
  const { error } = await supabase.from("social_follows").insert({ follower_id: followerId, followee_id: followeeId, league_id: leagueId });
  if (!error) {
    const fr = await supabase.from("social_accounts").select("following").eq("id", followerId).maybeSingle();
    const fe = await supabase.from("social_accounts").select("followers").eq("id", followeeId).maybeSingle();
    await supabase.from("social_accounts").update({ following: (fr.data?.following ?? 0) + 1 }).eq("id", followerId);
    await supabase.from("social_accounts").update({ followers: (fe.data?.followers ?? 0) + 1 }).eq("id", followeeId);
  }
}

export async function createPost(leagueId: string, accountId: string, content: string, opts: { type?: SocialPost["post_type"]; imageUrl?: string; tags?: string[] } = {}) {
  const { data } = await supabase.from("social_posts").insert({
    league_id: leagueId, account_id: accountId, content,
    post_type: opts.type ?? "text",
    image_url: opts.imageUrl ?? null,
    hashtags: opts.tags ?? [],
  }).select().single();
  return data;
}

/**
 * Generate a flurry of post-match social posts: teams, players, fans & memers all chime in.
 * Many include photos. Designed to feel like cricket twitter exploding after a result.
 */
export async function generateMatchPosts(
  leagueId: string,
  ctx: { matchId: string; seasonNumber: number; winner: string | null; loser: string | null; resultText: string; potmName?: string; topScorer?: { name: string; runs: number; team: string } | null; topBowler?: { name: string; wkts: number; team: string } | null; total1: number; total2: number; }
) {
  const { data: accs } = await supabase.from("social_accounts").select("*").eq("league_id", leagueId);
  if (!accs?.length) return 0;

  const teamAccs = accs.filter(a => a.account_type === "team");
  const playerAccs = accs.filter(a => a.account_type === "player");
  const fanAccs = accs.filter(a => a.account_type === "fan");
  const mediaAccs = accs.filter(a => a.account_type === "media");
  const officialAccs = accs.filter(a => a.account_type === "official");

  const posts: any[] = [];
  const W = ctx.winner, L = ctx.loser;

  // Winning team — celebration with photo
  if (W) {
    const acc = teamAccs.find(a => a.team_id === W);
    if (acc) posts.push({
      league_id: leagueId, account_id: acc.id,
      content: `🏆 WHAT A WIN! ${ctx.resultText}. ${ctx.potmName ? `Take a bow ${ctx.potmName}! ` : ""}Onwards. 💪 #${W}Army`,
      post_type: "photo", image_url: photoFor(`${W}-celebration-${ctx.matchId}`, 900, 560),
      match_id: ctx.matchId, season_number: ctx.seasonNumber,
      hashtags: [`${W}Army`, "IPLT2", "MatchDay"],
      likes: rng(2000, 18000), reposts: rng(200, 1500), replies: rng(50, 600),
    });
  }
  // Losing team — graceful
  if (L) {
    const acc = teamAccs.find(a => a.team_id === L);
    if (acc) posts.push({
      league_id: leagueId, account_id: acc.id,
      content: `Tough night at the office. We'll be back stronger. Thank you for the support. 💜 #${L}`,
      post_type: "photo", image_url: photoFor(`${L}-dressing-${ctx.matchId}`, 900, 560),
      match_id: ctx.matchId, season_number: ctx.seasonNumber,
      hashtags: [L, "IPLT2"],
      likes: rng(800, 6000), reposts: rng(50, 400), replies: rng(30, 250),
    });
  }
  // POTM player tweet
  if (ctx.potmName) {
    const acc = playerAccs.find(a => a.display_name === ctx.potmName);
    if (acc) posts.push({
      league_id: leagueId, account_id: acc.id,
      content: `Player of the Match 🏆 Grateful to my teammates and the fans. This one's for you. 🙏`,
      post_type: "photo", image_url: photoFor(`potm-${acc.handle}-${ctx.matchId}`, 700, 700),
      match_id: ctx.matchId, season_number: ctx.seasonNumber,
      hashtags: ["POTM", "IPLT2", W ?? ""].filter(Boolean) as string[],
      likes: rng(5000, 40000), reposts: rng(300, 2500), replies: rng(100, 1200),
    });
  }
  // Top scorer brag
  if (ctx.topScorer) {
    const acc = playerAccs.find(a => a.display_name === ctx.topScorer!.name);
    if (acc) posts.push({
      league_id: leagueId, account_id: acc.id,
      content: `${ctx.topScorer.runs} off the bat tonight. The work in the nets is paying off. 🏏🔥`,
      post_type: Math.random() < 0.6 ? "photo" : "text",
      image_url: Math.random() < 0.6 ? photoFor(`bat-${acc.handle}-${ctx.matchId}`, 700, 500) : null,
      match_id: ctx.matchId, season_number: ctx.seasonNumber,
      hashtags: ["RunMachine", ctx.topScorer.team],
      likes: rng(3000, 25000), reposts: rng(200, 1500), replies: rng(80, 700),
    });
  }
  // Top bowler shoutout
  if (ctx.topBowler) {
    const acc = playerAccs.find(a => a.display_name === ctx.topBowler!.name);
    if (acc) posts.push({
      league_id: leagueId, account_id: acc.id,
      content: `${ctx.topBowler.wkts}-fer 🎯 Thanks to the captain for the trust at the death. ${W === ctx.topBowler.team ? "On to the next!" : "Took the wickets, lost the match. We go again."}`,
      post_type: "photo", image_url: photoFor(`bowl-${acc.handle}-${ctx.matchId}`, 700, 500),
      match_id: ctx.matchId, season_number: ctx.seasonNumber,
      hashtags: ["Wickets", ctx.topBowler.team],
      likes: rng(2000, 18000), reposts: rng(100, 1100), replies: rng(50, 500),
    });
  }
  // Match Centre — official score post
  if (officialAccs.length) {
    const acc = pick(officialAccs);
    posts.push({
      league_id: leagueId, account_id: acc.id,
      content: `📊 FT — ${ctx.resultText}. (${ctx.total1}/${ctx.total2}). ${ctx.potmName ? `POTM: ${ctx.potmName}.` : ""}`,
      post_type: "announcement", image_url: photoFor(`scorecard-${ctx.matchId}`, 800, 450),
      match_id: ctx.matchId, season_number: ctx.seasonNumber,
      hashtags: ["IPLT2", "Scorecard"],
      likes: rng(1500, 9000), reposts: rng(150, 900), replies: rng(40, 400),
    });
  }
  // Media analyses (2)
  for (let i = 0; i < Math.min(2, mediaAccs.length); i++) {
    const acc = mediaAccs[i];
    const tpl = i === 0
      ? `STAT 📈 ${W ?? "—"} have now won ${rng(2,6)} of their last ${rng(5,8)}. Form is real.`
      : `ANALYSIS: How ${ctx.potmName ?? "the difference-maker"} swung the contest in the middle overs.`;
    posts.push({
      league_id: leagueId, account_id: acc.id, content: tpl,
      post_type: "announcement", image_url: i === 0 ? photoFor(`stat-${ctx.matchId}-${i}`, 700, 400) : null,
      match_id: ctx.matchId, season_number: ctx.seasonNumber,
      hashtags: ["Analysis", "IPLT2"],
      likes: rng(500, 5000), reposts: rng(50, 600), replies: rng(20, 200),
    });
  }
  // Fans + memers — 8-12 of them
  const fanCount = rng(8, 12);
  const winFanTpls = [
    `LET'S GOOOOO ${W} 🔥🔥🔥 KNEW IT FROM BALL ONE`,
    `${ctx.potmName ?? "Our boy"} is HIM. Bow down. 🐐`,
    `Mom said no screens after 11. Mom didn't see ${W} play tonight. 😤`,
    `Anyone else's heart still racing? ${ctx.resultText} INSANEEE`,
  ];
  const loseFanTpls = [
    `Bro how do you LOSE that 😭😭 ${L} I beg`,
    `Already grieving. See you next match ${L}. 💔`,
    `${L} fans we are NOT okay. Reply with strength 🥲`,
    `If ${L} doesn't fix the death overs I'm switching teams fr`,
  ];
  const memeTpls = [
    `POV: You promised your boss you'd work late but ${W ?? "the match"} happened 💀`,
    `Nobody:\n${L ?? "That team"} fans at 8pm: silent\n${L ?? "That team"} fans now: SILENTER 🤡`,
    `Me explaining ${ctx.resultText} to my mom for the 4th time tonight 📢`,
    `${ctx.topScorer?.name ?? "The batter"} when the bowler tries a slower one: 😏🏏💥`,
  ];
  for (let i = 0; i < fanCount && fanAccs.length; i++) {
    const acc = pick(fanAccs);
    const isMeme = Math.random() < 0.4;
    const isLoseFan = !isMeme && L && Math.random() < 0.4;
    const content = isMeme ? pick(memeTpls) : isLoseFan ? pick(loseFanTpls) : pick(winFanTpls);
    const withImage = isMeme ? Math.random() < 0.7 : Math.random() < 0.25;
    posts.push({
      league_id: leagueId, account_id: acc.id, content,
      post_type: isMeme ? "meme" : "text",
      image_url: withImage ? photoFor(`fan-${acc.handle}-${ctx.matchId}-${i}`, 500, 500) : null,
      match_id: ctx.matchId, season_number: ctx.seasonNumber,
      hashtags: [W ?? "IPLT2", isMeme ? "Memes" : "MatchDay"].filter(Boolean) as string[],
      likes: isMeme ? rng(100, 8000) : rng(0, 800),
      reposts: rng(0, 300), replies: rng(0, 120),
    });
  }

  if (posts.length) await supabase.from("social_posts").insert(posts);
  return posts.length;
}
