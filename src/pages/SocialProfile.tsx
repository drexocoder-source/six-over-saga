import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateLeague, type League } from "@/lib/league";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BadgeCheck, Heart, MessageCircle, Repeat2, Search, Loader2, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { SocialAccount } from "@/lib/social";

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
function timeAgo(iso: string) { try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; } }

export default function SocialProfile() {
  const { handle } = useParams<{ handle: string }>();
  const nav = useNavigate();
  const [league, setLeague] = useState<League | null>(null);
  const [acc, setAcc] = useState<SocialAccount | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SocialAccount[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { (async () => {
    setLoading(true);
    const lg = await getOrCreateLeague();
    setLeague(lg);
    if (!handle) { setLoading(false); return; }
    const { data } = await supabase.from("social_accounts").select("*").eq("league_id", lg.id).eq("handle", handle).maybeSingle();
    setAcc((data as any) ?? null);
    if (data) {
      const { data: ps } = await supabase.from("social_posts").select("*, social_accounts(*)").eq("league_id", lg.id).eq("account_id", (data as any).id).order("created_at", { ascending: false }).limit(40);
      setPosts(ps ?? []);
    }
    setLoading(false);
  })(); }, [handle]);

  useEffect(() => {
    if (!league || !search.trim()) { setResults([]); return; }
    setSearching(true);
    const q = search.trim().toLowerCase();
    const t = setTimeout(async () => {
      const { data } = await supabase.from("social_accounts").select("*").eq("league_id", league.id)
        .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
        .order("followers", { ascending: false }).limit(15);
      setResults((data ?? []) as any);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search, league]);

  const stats = useMemo(() => {
    const totalLikes = posts.reduce((s, p) => s + (p.likes ?? 0), 0);
    return { posts: posts.length, totalLikes };
  }, [posts]);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin text-primary"/></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => nav("/social")}><ArrowLeft className="w-4 h-4 mr-1"/>Feed</Button>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input placeholder="Search any handle or name…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/30 border-border/40"/>
          {search && (results.length > 0 || searching) && (
            <Card className="absolute z-20 top-full mt-1 left-0 right-0 max-h-80 overflow-auto p-2 gradient-card border-border/60">
              {searching && <div className="text-xs text-muted-foreground p-2">Searching…</div>}
              {results.map(r => (
                <Link key={r.id} to={`/social/${r.handle}`} onClick={() => { setSearch(""); setResults([]); }}
                  className="flex items-center gap-2 p-2 rounded hover:bg-secondary/60 transition-colors">
                  <img src={r.pfp_url ?? ""} alt="" className="w-8 h-8 rounded-full bg-secondary"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-xs"><b className="truncate">{r.display_name}</b>{r.verified && <BadgeCheck className="w-3 h-3 text-primary"/>}</div>
                    <div className="text-[10px] text-muted-foreground truncate">@{r.handle} · {fmt(r.followers)} followers</div>
                  </div>
                  <Badge variant="outline" className="text-[9px] uppercase">{r.account_type}</Badge>
                </Link>
              ))}
              {!searching && results.length === 0 && <div className="text-xs text-muted-foreground p-2">No matches.</div>}
            </Card>
          )}
        </div>
      </div>

      {!acc ? (
        <Card className="p-12 text-center gradient-card border-border/60 text-muted-foreground">
          Account <b>@{handle}</b> not found. Try the search above.
        </Card>
      ) : (
        <>
          <Card className="p-6 gradient-card border-border/60">
            <div className="flex items-start gap-4 flex-wrap">
              <img src={acc.pfp_url ?? ""} alt="" className="w-24 h-24 rounded-full bg-secondary border-2 border-primary/40"/>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-3xl">{acc.display_name}</h1>
                  {acc.verified && <BadgeCheck className="w-5 h-5 text-primary"/>}
                  <Badge variant="outline" className="text-[10px] uppercase">{acc.account_type}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">@{acc.handle}</div>
                {acc.bio && <p className="text-sm mt-2">{acc.bio}</p>}
                <div className="flex gap-5 mt-3 text-sm">
                  <div><b className="font-display text-lg">{fmt(acc.followers)}</b> <span className="text-muted-foreground text-xs">followers</span></div>
                  <div><b className="font-display text-lg">{fmt(acc.following)}</b> <span className="text-muted-foreground text-xs">following</span></div>
                  <div><b className="font-display text-lg">{stats.posts}</b> <span className="text-muted-foreground text-xs">posts</span></div>
                  <div><b className="font-display text-lg">{fmt(stats.totalLikes)}</b> <span className="text-muted-foreground text-xs">likes</span></div>
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary"><Users className="w-3.5 h-3.5"/>Posts</div>
            {posts.length === 0 ? (
              <Card className="p-12 text-center gradient-card border-border/60 text-muted-foreground">No posts yet.</Card>
            ) : posts.map(p => (
              <Card key={p.id} className="p-4 gradient-card border-border/60">
                <div className="text-[10px] text-muted-foreground mb-1">{timeAgo(p.created_at)}</div>
                <div className="text-sm whitespace-pre-wrap">{p.content}</div>
                {p.image_url && <div className="mt-3 rounded-lg overflow-hidden border border-border/40 bg-black/30"><img src={p.image_url} alt="" className="w-full max-h-[420px] object-cover"/></div>}
                {(p.hashtags ?? []).length > 0 && <div className="mt-2 text-xs text-primary/80 space-x-1.5">{p.hashtags.map((t: string) => <span key={t}>#{t}</span>)}</div>}
                <div className="mt-3 flex items-center gap-5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5"/>{fmt(p.likes ?? 0)}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5"/>{fmt(p.replies ?? 0)}</span>
                  <span className="flex items-center gap-1"><Repeat2 className="w-3.5 h-3.5"/>{fmt(p.reposts ?? 0)}</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
