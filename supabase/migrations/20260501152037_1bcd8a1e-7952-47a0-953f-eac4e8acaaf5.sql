
-- Player rating history (per season change)
CREATE TABLE IF NOT EXISTS public.rating_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id uuid NOT NULL,
  player_id uuid NOT NULL,
  season_number integer NOT NULL,
  old_rating integer NOT NULL,
  new_rating integer NOT NULL,
  delta integer NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all" ON public.rating_history FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_rating_history_league_player ON public.rating_history(league_id, player_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_season ON public.rating_history(league_id, season_number);

-- Injury / longevity tracking
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS injury_status text DEFAULT 'fit',
  ADD COLUMN IF NOT EXISTS injury_until_season integer,
  ADD COLUMN IF NOT EXISTS seasons_played integer NOT NULL DEFAULT 0;

-- Indexes for social profile queries
CREATE INDEX IF NOT EXISTS idx_social_posts_account ON public.social_posts(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_replies_post ON public.social_replies(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_social_follows_follower ON public.social_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_social_follows_followee ON public.social_follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_handle ON public.social_accounts(league_id, handle);
