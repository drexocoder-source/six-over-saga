-- Social media simulator: accounts, posts, likes, follows
CREATE TABLE public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  handle text NOT NULL,
  display_name text NOT NULL,
  account_type text NOT NULL DEFAULT 'fan', -- 'team' | 'player' | 'fan' | 'media' | 'official'
  team_id text,
  player_id uuid,
  bio text,
  pfp_url text,
  pfp_seed text,
  followers integer NOT NULL DEFAULT 0,
  following integer NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_accounts_league ON public.social_accounts(league_id);
CREATE UNIQUE INDEX idx_social_accounts_handle ON public.social_accounts(league_id, handle);

CREATE TABLE public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  content text NOT NULL,
  post_type text NOT NULL DEFAULT 'text', -- 'text' | 'meme' | 'photo' | 'highlight' | 'announcement'
  image_url text,
  image_prompt text,
  match_id uuid,
  season_number integer,
  likes integer NOT NULL DEFAULT 0,
  reposts integer NOT NULL DEFAULT 0,
  replies integer NOT NULL DEFAULT 0,
  hashtags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_posts_league_time ON public.social_posts(league_id, created_at DESC);
CREATE INDEX idx_social_posts_account ON public.social_posts(account_id);

CREATE TABLE public.social_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  follower_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, followee_id)
);

CREATE TABLE public.social_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, post_id)
);

CREATE TABLE public.social_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  content text NOT NULL,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_replies_post ON public.social_replies(post_id);

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY open_all ON public.social_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY open_all ON public.social_posts    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY open_all ON public.social_follows  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY open_all ON public.social_likes    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY open_all ON public.social_replies  FOR ALL USING (true) WITH CHECK (true);