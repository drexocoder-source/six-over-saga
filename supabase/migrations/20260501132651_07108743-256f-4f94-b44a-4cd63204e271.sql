ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS venue text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_date timestamp with time zone;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS home_team text;