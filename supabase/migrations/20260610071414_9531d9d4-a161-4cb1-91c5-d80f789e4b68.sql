REVOKE EXECUTE ON FUNCTION public.user_owns_league(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_season(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_league(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_owns_season(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_owns_match(uuid) TO authenticated, service_role;