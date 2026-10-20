CREATE TABLE public.football_teams (
 user_id uuid NOT NULL DEFAULT auth.uid(),
 team_id integer NOT NULL CHECK (team_id > 0),
 nome text NOT NULL,
 escudo text,
 PRIMARY KEY (user_id, team_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.football_teams TO authenticated;
GRANT ALL ON public.football_teams TO service_role;
ALTER TABLE public.football_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams own" ON public.football_teams FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TABLE public.football_cache (
 user_id uuid NOT NULL DEFAULT auth.uid(),
 cache_key text NOT NULL,
 resultado jsonb NOT NULL DEFAULT '[]'::jsonb,
 fetched_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id, cache_key)
);
GRANT SELECT ON public.football_cache TO authenticated;
GRANT ALL ON public.football_cache TO service_role;
ALTER TABLE public.football_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "football cache read own" ON public.football_cache FOR SELECT TO authenticated USING (user_id = auth.uid());
COMMENT ON TABLE public.football_cache IS 'Server-written provider cache. Keys fixtures:YYYY-MM-DD:team-id and teams:search-term. Successful empty results cached too.';