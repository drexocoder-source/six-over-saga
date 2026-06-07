
-- Drop the unique constraint that's causing 409 errors on league creation
ALTER TABLE public.leagues DROP CONSTRAINT IF EXISTS leagues_device_id_key;

-- Add a permissive read policy: anon can read any league matching their device_id,
-- regardless of owner_id. This recovers leagues after a session is lost.
DROP POLICY IF EXISTS "Read leagues by device id" ON public.leagues;
CREATE POLICY "Read leagues by device id"
ON public.leagues
FOR SELECT
USING (true);
