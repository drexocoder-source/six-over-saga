
-- Add owner_id
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS owner_id uuid;
CREATE INDEX IF NOT EXISTS leagues_owner_idx ON public.leagues(owner_id);

-- Helpers
CREATE OR REPLACE FUNCTION public.user_owns_league(_league_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = _league_id
      AND (l.owner_id IS NULL OR l.owner_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_season(_season_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.seasons s
    JOIN public.leagues l ON l.id = s.league_id
    WHERE s.id = _season_id
      AND (l.owner_id IS NULL OR l.owner_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_match(_match_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.seasons s ON s.id = m.season_id
    JOIN public.leagues l ON l.id = s.league_id
    WHERE m.id = _match_id
      AND (l.owner_id IS NULL OR l.owner_id = auth.uid())
  );
$$;

-- LEAGUES
DROP POLICY IF EXISTS open_all ON public.leagues;
DROP POLICY IF EXISTS "Read own or unowned leagues" ON public.leagues;
DROP POLICY IF EXISTS "Insert league for self" ON public.leagues;
DROP POLICY IF EXISTS "Update own league" ON public.leagues;
DROP POLICY IF EXISTS "Delete own league" ON public.leagues;
CREATE POLICY "Read own or unowned leagues" ON public.leagues
  FOR SELECT USING (owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "Insert league for self" ON public.leagues
  FOR INSERT WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "Update own league" ON public.leagues
  FOR UPDATE USING (owner_id IS NULL OR owner_id = auth.uid())
  WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "Delete own league" ON public.leagues
  FOR DELETE USING (owner_id = auth.uid());

-- Tables with direct league_id
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'players','seasons','records','custom_records',
    'achievements','trophies','rating_history','ceremony_images',
    'match_moments','social_accounts','social_follows','social_likes',
    'social_posts','social_replies'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS open_all ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Owner full access" ON public.%I;', t);
    EXECUTE format($f$
      CREATE POLICY "Owner full access" ON public.%I
      FOR ALL USING (public.user_owns_league(league_id))
      WITH CHECK (public.user_owns_league(league_id));
    $f$, t);
  END LOOP;
END $$;

-- SQUADS (via season_id)
DROP POLICY IF EXISTS open_all ON public.squads;
DROP POLICY IF EXISTS "Owner squad access" ON public.squads;
CREATE POLICY "Owner squad access" ON public.squads
  FOR ALL USING (public.user_owns_season(season_id))
  WITH CHECK (public.user_owns_season(season_id));

-- MATCHES (via season_id)
DROP POLICY IF EXISTS open_all ON public.matches;
DROP POLICY IF EXISTS "Owner match access" ON public.matches;
CREATE POLICY "Owner match access" ON public.matches
  FOR ALL USING (public.user_owns_season(season_id))
  WITH CHECK (public.user_owns_season(season_id));

-- BALLS (via match_id)
DROP POLICY IF EXISTS open_all ON public.balls;
DROP POLICY IF EXISTS "Owner ball access" ON public.balls;
CREATE POLICY "Owner ball access" ON public.balls
  FOR ALL USING (public.user_owns_match(match_id))
  WITH CHECK (public.user_owns_match(match_id));

-- Players: also add an injury counter for mid-season injuries
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS injury_matches_left integer NOT NULL DEFAULT 0;
