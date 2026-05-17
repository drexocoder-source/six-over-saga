import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getOrCreateLeague, type League } from "@/lib/league";
import {
  ensureSocialAccounts, ensureMemerAccounts, generateRandomPosts, generateDramaLeaks,
  getFeed, listAccounts, likePost, followAccount, createPost,
  pfpFor, type SocialAccount,
} from "@/lib/social";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Heart, MessageCircle, Repeat2, Sparkles, BadgeCheck, Send, TrendingUp, Users, Search, Flame, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export default function Social() {
  const [league, setLeague] = useState<League | null>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [me, setMe] = useState<SocialAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [composer, setComposer] = useState("");
  const [newAccountHandle, setNewAccountHandle] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SocialAccount[]>([]);

  useEffect(() => { (async () => {
    const lg = await getOrCreateLeague(); setLeague(lg);
    const created = await ensureSocialAccounts(lg.id, { fans: 80 });
    await ensureMemerAccounts(lg.id);
    if (created > 0) {
      // first time → seed initial posts
      await generateRandomPosts(lg.id, 40);
      await generateDramaLeaks(lg.id, 8);
    }
    await refresh(lg.id);
    setLoading(false);
  })(); }, []);

  async function refresh(lid?: string) {
    const id = lid ?? league?.id; if (!id) return;
    const [fd, accs] = await Promise.all([getFeed(id, { limit: 60, type: filter }), listAccounts(id)]);
    setFeed(fd); setAccounts(accs);
    if (!me) {
      // pick or create a personal "you" account
      const youHandle = "you";
      let you = accs.find(a => a.handle === youHandle);
      if (!you) {
        const { data } = await supabase.from("social_accounts").insert({
          league_id: id, handle: youHandle, display_name: "You", account_type: "fan",
          bio: "Just a cricket maniac watching IPL T20 🏏", pfp_seed: youHandle,
          pfp_url: pfpFor(youHandle, "avataaars"), followers: 0, following: 0, verified: false,
        }).select().single();
        if (data) { setMe(data as any); setAccounts([data as any, ...accs]); return; }
        setMe(accs[0] ?? null);
      } else setMe(you as any);
    }
  }

  useEffect(() => { if (league) refresh(league.id); /* eslint-disable-next-line */ }, [filter]);

  useEffect(() => {
    if (!league || !search.trim()) { setSearchResults([]); return; }
    const q = search.trim().toLowerCase();
    const t = setTimeout(async () => {
      const { data } = await supabase.from("social_accounts").select("*").eq("league_id", league.id)
        .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
        .order("followers", { ascending: false }).limit(12);
      setSearchResults((data ?? []) as any);
    }, 200);
    return () => clearTimeout(t);
  }, [search, league]);

  async function genMore() {
    if (!league) return;
    setBusy(true);
    await generateRandomPosts(league.id, 25);
    await refresh(league.id);
    setBusy(false);
    toast.success("Fresh posts loaded");
  }

  async function genDrama() {
    if (!league) return;
    setBusy(true);
    await generateDramaLeaks(league.id, 10);
    await refresh(league.id);
    setBusy(false);
    toast.success("Dressing-room drama incoming 🔥");
  }

  async function postNow() {
    if (!league || !me || !composer.trim()) return;
    await createPost(league.id, me.id, composer.trim(), { type: "text" });
    setComposer("");
    await refresh(league.id);
    toast.success("Posted!");
  }

  async function addAccount() {
    if (!league || !newAccountHandle.trim()) return;
    const handle = newAccountHandle.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "_");
    
    const { error } = await supabase.from("social_accounts").insert({
      league_id: league.id, handle, display_name: newAccountHandle.trim(),
      account_type: "fan", pfp_seed: handle, pfp_url: pfpFor(handle, "avataaars"),
      followers: 0, following: 0,
    });
    if (error) toast.error("Handle already taken");
    else { toast.success(`@${handle} created`); setNewAccountHandle(""); await refresh(); }
  }

  const trending = useMemo(() => {
    const tagCount = new Map<string, number>();
    feed.forEach(p => (p.hashtags ?? []).forEach((t: string) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)));
    return Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [feed]);

  const topAccounts = useMemo(() => [...accounts].sort((a,b) => b.followers - a.followers).slice(0, 12), [accounts]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs tracking-[0.3em] text-primary/80">FANTOK / CRICKET TWITTER</div>
          <h1 className="font-display text-4xl tracking-wider">IPL Social</h1>
          <p className="text-sm text-muted-foreground mt-1">Where fans, players and teams talk smack about every match.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={genMore} disabled={busy} variant="outline" className="border-primary/40 text-primary">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Sparkles className="w-4 h-4 mr-2"/>}
            Generate Posts
          </Button>
          <Button onClick={genDrama} disabled={busy} variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Flame className="w-4 h-4 mr-2"/>}
            Drop Drama
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xl">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
        <Input
          placeholder="Search any handle or name (e.g. virat, rcb_official, cricbuzz)…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-secondary/30 border-border/40"
        />
        {search && searchResults.length > 0 && (
          <Card className="absolute z-30 top-full mt-1 left-0 right-0 max-h-80 overflow-auto p-2 gradient-card border-border/60">
            {searchResults.map(r => (
              <Link key={r.id} to={`/social/${r.handle}`} onClick={() => setSearch("")}
                className="flex items-center gap-2 p-2 rounded hover:bg-secondary/60 transition-colors">
                <img src={r.pfp_url ?? ""} alt="" className="w-9 h-9 rounded-full bg-secondary"/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-sm"><b className="truncate">{r.display_name}</b>{r.verified && <BadgeCheck className="w-3.5 h-3.5 text-primary"/>}</div>
                  <div className="text-[11px] text-muted-foreground truncate">@{r.handle} · {fmt(r.followers)} followers</div>
                </div>
                <Badge variant="outline" className="text-[9px] uppercase">{r.account_type}</Badge>
              </Link>
            ))}
          </Card>
        )}
        {search && searchResults.length === 0 && (
          <div className="text-xs text-muted-foreground mt-1 ml-2">No matches.</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Feed */}
        <div className="space-y-4">
          {/* Composer */}
          {me && (
            <Card className="p-4 gradient-card border-border/60">
              <div className="flex gap-3">
                <img src={me.pfp_url ?? ""} alt="" className="w-10 h-10 rounded-full bg-secondary"/>
                <div className="flex-1">
                  <Textarea value={composer} onChange={e => setComposer(e.target.value)} placeholder="What's the take? 🏏" className="bg-secondary/30 border-border/40 resize-none" rows={2}/>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-muted-foreground">Posting as <b>@{me.handle}</b></span>
                    <Button size="sm" onClick={postNow} disabled={!composer.trim()} className="gradient-primary text-primary-foreground"><Send className="w-3.5 h-3.5 mr-1.5"/>Post</Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="bg-secondary/40 flex-wrap h-auto">
              <TabsTrigger value="all">For You</TabsTrigger>
              <TabsTrigger value="meme">Memes</TabsTrigger>
              <TabsTrigger value="photo">Photos</TabsTrigger>
              <TabsTrigger value="announcement">
                <Zap className="w-3 h-3 mr-1"/>News & Leaks
              </TabsTrigger>
              <TabsTrigger value="text">Text</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-3">
            {feed.length === 0 ? (
              <Card className="p-12 text-center gradient-card border-border/60 text-muted-foreground">No posts yet. Hit Generate Posts!</Card>
            ) : feed.map(p => (
              <PostCard key={p.id} post={p} me={me} onLike={async () => { if (me) { await likePost(p.id, me.id, league!.id); refresh(league!.id); }}} onFollow={async () => { if (me && p.account_id !== me.id) { await followAccount(me.id, p.account_id, league!.id); toast.success(`Following @${p.social_accounts?.handle}`); refresh(league!.id); }}}/>
            ))}
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4 order-first lg:order-last">
          {/* Trending */}
          <Card className="p-4 gradient-card border-border/60">
            <div className="flex items-center gap-2 text-xs tracking-widest text-primary mb-2"><TrendingUp className="w-4 h-4"/> TRENDING</div>
            <div className="space-y-1.5">
              {trending.length === 0 ? <div className="text-xs text-muted-foreground">No trends yet.</div> :
                trending.map(([tag, n]) => (
                  <div key={tag} className="flex justify-between text-sm">
                    <span className="text-foreground">#{tag}</span>
                    <span className="text-[10px] text-muted-foreground">{n} posts</span>
                  </div>
                ))}
            </div>
          </Card>

          {/* Top accounts */}
          <Card className="p-4 gradient-card border-border/60">
            <div className="flex items-center gap-2 text-xs tracking-widest text-primary mb-3"><Users className="w-4 h-4"/> TOP ACCOUNTS</div>
            <div className="space-y-2">
              {topAccounts.map(a => (
                <Link key={a.id} to={`/social/${a.handle}`} className="flex items-center gap-2 hover:bg-secondary/40 p-1 -mx-1 rounded transition-colors">
                  <img src={a.pfp_url ?? ""} alt="" className="w-8 h-8 rounded-full bg-secondary flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs flex items-center gap-1 truncate">
                      <b className="truncate">{a.display_name}</b>
                      {a.verified && <BadgeCheck className="w-3 h-3 text-primary flex-shrink-0"/>}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">@{a.handle} · {fmt(a.followers)} followers</div>
                  </div>
                  <Badge variant="outline" className="text-[9px] uppercase">{a.account_type}</Badge>
                </Link>
              ))}
            </div>
          </Card>

          {/* Create account */}
          <Card className="p-4 gradient-card border-border/60">
            <div className="text-xs tracking-widest text-primary mb-2">+ NEW HANDLE</div>
            <div className="flex gap-2">
              <Input placeholder="display name" value={newAccountHandle} onChange={e => setNewAccountHandle(e.target.value)} className="bg-secondary/30 border-border/40 text-sm"/>
              <Button size="sm" onClick={addAccount} variant="outline">Add</Button>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Spawn extra fan handles for variety.</div>
          </Card>

          {/* Stats */}
          <Card className="p-4 gradient-card border-border/60 grid grid-cols-2 gap-3 text-center">
            <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Accounts</div><div className="font-display text-xl text-primary">{accounts.length}</div></div>
            <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Posts</div><div className="font-display text-xl text-primary">{feed.length}</div></div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n/1_000).toFixed(1) + "K";
  return String(n);
}

function PostCard({ post, me, onLike, onFollow }: { post: any; me: SocialAccount | null; onLike: () => void; onFollow: () => void }) {
  const a = post.social_accounts ?? {};
  const isMe = me && a.id === me.id;
  return (
    <Card className="p-4 gradient-card border-border/60 hover:border-primary/30 transition-colors">
      <div className="flex gap-3">
        <Link to={`/social/${a.handle}`} className="flex-shrink-0">
          <img src={a.pfp_url ?? ""} alt="" className="w-11 h-11 rounded-full bg-secondary hover:ring-2 hover:ring-primary/40 transition"/>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-sm flex-wrap">
              <Link to={`/social/${a.handle}`} className="hover:underline"><b className="truncate">{a.display_name}</b></Link>
              {a.verified && <BadgeCheck className="w-3.5 h-3.5 text-primary"/>}
              <Link to={`/social/${a.handle}`} className="text-muted-foreground text-xs hover:underline">@{a.handle}</Link>
              <span className="text-muted-foreground text-xs">· {timeAgo(post.created_at)}</span>
              <Badge variant="outline" className="text-[9px] uppercase ml-1">{a.account_type}</Badge>
              {post.post_type === "meme" && <Badge className="text-[9px] bg-accent/20 text-accent border-accent/30">meme</Badge>}
              {post.post_type === "announcement" && <Badge className="text-[9px] bg-primary/15 text-primary border-primary/30">news</Badge>}
            </div>
            {!isMe && me && (
              <Button size="sm" variant="ghost" onClick={onFollow} className="h-7 text-[10px]">+ Follow</Button>
            )}
          </div>
          <div className="text-sm whitespace-pre-wrap mt-1">{post.content}</div>
          {post.image_url && (
            <div className="mt-3 rounded-lg overflow-hidden border border-border/40 bg-black/30">
              <img src={post.image_url} alt="" className="w-full h-auto max-h-[420px] object-cover"/>
            </div>
          )}
          {(post.hashtags ?? []).length > 0 && (
            <div className="mt-2 text-xs text-primary/80 space-x-1.5">
              {post.hashtags.map((t: string) => <span key={t}>#{t}</span>)}
            </div>
          )}
          <div className="mt-3 flex items-center gap-5 text-xs text-muted-foreground">
            <button onClick={onLike} className="flex items-center gap-1 hover:text-destructive transition-colors">
              <Heart className="w-3.5 h-3.5"/> {fmt(post.likes ?? 0)}
            </button>
            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5"/> {fmt(post.replies ?? 0)}</span>
            <span className="flex items-center gap-1"><Repeat2 className="w-3.5 h-3.5"/> {fmt(post.reposts ?? 0)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function timeAgo(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: false }); } catch { return ""; }
}
