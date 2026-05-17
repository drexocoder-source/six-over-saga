
REVOKE EXECUTE ON FUNCTION public.user_owns_league(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_owns_season(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_owns_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_owns_league(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_season(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_match(uuid) TO authenticated, anon;
