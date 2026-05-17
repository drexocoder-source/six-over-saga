-- Phase 1-8 mega-migration: skills, season cycle, ball-level stats, achievements, awards, retentions

-- 1. Player skill attributes (auto-derived from rating, editable)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS personality text,
  ADD COLUMN IF NOT EXISTS pfp_url text,
  ADD COLUMN IF NOT EXISTS debut_season int,
  ADD COLUMN IF NOT EXISTS form jsonb NOT NULL DEFAULT '[]'::jsonb;
-- attrs shape: { power, timing, consistency, finishing, pace, spin, control, death, reflex, catch, pressure }

-- 2. Season cycle (mega/mini) + retention
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS auction_type text NOT NULL DEFAULT 'mega',
  ADD COLUMN IF NOT EXISTS purse numeric NOT NULL DEFAULT 70;

ALTER TABLE public.squads
  ADD COLUMN IF NOT EXISTS retention_price numeric;

-- 3. Achievements
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  player_id uuid,
  player_name text,
  team_id text,
  achievement_key text NOT NULL,
  label text NOT NULL,
  emoji text DEFAULT '🏅',
  season_number int,
  match_id uuid,
  value numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS open_all ON public.achievements;
CREATE POLICY open_all ON public.achievements FOR ALL USING (true) WITH CHECK (true);

-- 4. League settings — add difficulty, commentary mode, season cycle config
-- (kept inside settings jsonb already; no schema change needed)

-- 5. Generated/cached ceremony images
CREATE TABLE IF NOT EXISTS public.ceremony_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  season_number int NOT NULL,
  award text NOT NULL,
  player_id uuid,
  team_id text,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ceremony_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS open_all ON public.ceremony_images;
CREATE POLICY open_all ON public.ceremony_images FOR ALL USING (true) WITH CHECK (true);

-- 6. Match moments (memorable ball-level images: hat-trick, big six, last-ball etc.)
CREATE TABLE IF NOT EXISTS public.match_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL,
  match_id uuid NOT NULL,
  season_number int,
  moment_type text NOT NULL,
  description text,
  player_id uuid,
  player_name text,
  team_id text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.match_moments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS open_all ON public.match_moments;
CREATE POLICY open_all ON public.match_moments FOR ALL USING (true) WITH CHECK (true);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_achievements_league ON public.achievements(league_id, season_number);
CREATE INDEX IF NOT EXISTS idx_match_moments_league ON public.match_moments(league_id, season_number);
CREATE INDEX IF NOT EXISTS idx_ceremony_league ON public.ceremony_images(league_id, season_number);
CREATE INDEX IF NOT EXISTS idx_trophies_league ON public.trophies(league_id, season_number);
CREATE INDEX IF NOT EXISTS idx_squads_season ON public.squads(season_id);
CREATE INDEX IF NOT EXISTS idx_matches_season ON public.matches(season_id);
