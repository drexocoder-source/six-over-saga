
-- League: one per device (no auth, keyed by device_id)
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'IPL T2',
  teams JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{"oversPerInnings":2,"allOutWickets":5,"squadMin":6,"squadMax":9,"playingXI":6,"startingPurse":100}'::jsonb,
  current_season INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Master player pool (per league)
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('BAT','BOWL','AR','WK')),
  base_price NUMERIC NOT NULL DEFAULT 1,
  nationality TEXT DEFAULT 'IND',
  rating INT NOT NULL DEFAULT 75,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_players_league ON public.players(league_id);

-- Seasons
CREATE TABLE public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_number INT NOT NULL,
  year INT NOT NULL,
  auction_status TEXT NOT NULL DEFAULT 'pending' CHECK (auction_status IN ('pending','in_progress','done')),
  status TEXT NOT NULL DEFAULT 'auction' CHECK (status IN ('auction','league','playoffs','final','done')),
  champion_team_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, season_number)
);
CREATE INDEX idx_seasons_league ON public.seasons(league_id);

-- Squad assignments per season
CREATE TABLE public.squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL DEFAULT 0,
  is_captain BOOLEAN NOT NULL DEFAULT false,
  is_vice_captain BOOLEAN NOT NULL DEFAULT false,
  retained BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(season_id, player_id)
);
CREATE INDEX idx_squads_season ON public.squads(season_id);
CREATE INDEX idx_squads_team ON public.squads(season_id, team_id);

-- Matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  match_number INT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'league' CHECK (stage IN ('league','qualifier','eliminator','final')),
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  toss_winner TEXT,
  toss_decision TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','done')),
  winner TEXT,
  result_text TEXT,
  player_of_match UUID,
  scorecard JSONB,
  state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_matches_season ON public.matches(season_id);

-- Balls (full delivery log)
CREATE TABLE public.balls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  innings INT NOT NULL,
  over_num INT NOT NULL,
  ball_in_over INT NOT NULL,
  bowler_id UUID,
  striker_id UUID,
  non_striker_id UUID,
  runs INT NOT NULL DEFAULT 0,
  extras INT NOT NULL DEFAULT 0,
  extra_type TEXT,
  is_wicket BOOLEAN NOT NULL DEFAULT false,
  wicket_type TEXT,
  out_player_id UUID,
  commentary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_balls_match ON public.balls(match_id);

-- Records (tournament-wide milestones)
CREATE TABLE public.records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  record_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value NUMERIC,
  player_id UUID,
  player_name TEXT,
  team_id TEXT,
  season_number INT,
  match_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_records_league ON public.records(league_id);

-- Enable RLS
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

-- Public single-player app: open policies on all tables
CREATE POLICY "open_all" ON public.leagues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.seasons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.squads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.balls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.records FOR ALL USING (true) WITH CHECK (true);
