CREATE TABLE public.football_leagues (
 user_id uuid NOT NULL DEFAULT auth.uid(),
 league_id integer NOT NULL CHECK (league_id > 0),
 nome text NOT NULL,
 pais text,
 logo text,
 temporada_cruzada boolean NOT NULL DEFAULT false,
 PRIMARY KEY (user_id, league_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.football_leagues TO authenticated;
GRANT ALL ON public.football_leagues TO service_role;
ALTER TABLE public.football_leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leagues own" ON public.football_leagues FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
COMMENT ON TABLE public.football_teams IS 'DEPRECATED: replaced by football_leagues';