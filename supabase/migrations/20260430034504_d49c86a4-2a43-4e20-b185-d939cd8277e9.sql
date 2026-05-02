-- Custom record templates defined by the chairman
CREATE TABLE public.custom_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL DEFAULT 'batting', -- batting | bowling | team | match
  metric TEXT NOT NULL DEFAULT 'runs',   -- runs | wickets | sixes | fours | sr | econ | total
  threshold NUMERIC,                      -- optional milestone threshold
  higher_is_better BOOLEAN NOT NULL DEFAULT true,
  emoji TEXT DEFAULT '🏆',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.custom_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all" ON public.custom_records FOR ALL USING (true) WITH CHECK (true);

-- Trophies cabinet (per season champions / awards)
CREATE TABLE public.trophies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL,
  season_number INTEGER NOT NULL,
  award TEXT NOT NULL,           -- champion | runnerup | orange_cap | purple_cap | mvp | emerging
  team_id TEXT,
  player_id UUID,
  player_name TEXT,
  value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.trophies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all" ON public.trophies FOR ALL USING (true) WITH CHECK (true);