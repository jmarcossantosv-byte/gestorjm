import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cacheFresh, dateSchema, gameSchema, leagueSchema, leagueSeason, brasiliaTime, uniqueGames } from "./football";
import { footballRequest, providerLeague, providerFixture, crestData, FootballError } from "./football.server";

export const searchFootballLeagues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ search: z.string().trim().min(3).max(80) }))
  .handler(async ({ data, context }) => {
    const cacheKey = `leagues:${data.search.toLocaleLowerCase("pt-BR")}`;
    try {
      const { data: cache, error } = await context.supabase.from("football_cache").select("resultado,fetched_at").eq("user_id", context.userId).eq("cache_key", cacheKey).maybeSingle();
      if (error) throw new FootballError("Não foi possível carregar as competições. Tente novamente.");
      if (cache && cacheFresh(cache.fetched_at)) return { leagues: z.array(leagueSchema).parse(cache.resultado), error: null };
      const key = process.env['API_FOOTBALL_KEY'];
      if (!key) return { leagues: [], error: "A busca automática ainda não está configurada. Continue preenchendo manualmente." };
      const rows = z.array(providerLeague).parse(await footballRequest("/leagues", { search: data.search }, key)).slice(0, 20);
      const leagues = await Promise.all(rows.map(async (row) => {
        const season = row.seasons?.find((s) => s.current) ?? row.seasons?.at(-1);
        return { id: row.league.id, nome: row.league.name, pais: row.country?.name ?? null, logo: (await crestData(row.league.logo)) ?? null,
          cruzada: !!season && season.start.slice(0, 4) !== season.end.slice(0, 4) };
      }));
      // Auth was verified above. Privileged access writes only provider cache for this caller.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: writeError } = await supabaseAdmin.from("football_cache").upsert({ user_id: context.userId, cache_key: cacheKey, resultado: leagues, fetched_at: new Date().toISOString() });
      if (writeError) return { leagues, error: "Competições encontradas, mas não foi possível guardar a consulta." };
      return { leagues, error: null };
    } catch (error) {
      return { leagues: [], error: error instanceof FootballError ? error.message : "Não foi possível buscar as competições. Continue preenchendo manualmente." };
    }
  });

export const fetchFootballGames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ date: dateSchema }))
  .handler(async ({ data, context }) => {
    const { data: favorites, error: teamsError } = await context.supabase.from("football_leagues").select("league_id,temporada_cruzada").eq("user_id", context.userId);
    if (teamsError) return { games: [], error: "Não foi possível carregar suas competições. Tente novamente.", cached: 0 };
    if (!favorites?.length) return { games: [], error: "Adicione uma competição em Minhas competições antes de buscar.", cached: 0 };
    const games: z.infer<typeof gameSchema>[] = [];
    let cached = 0;
    let failure: string | null = null;
    const key = process.env['API_FOOTBALL_KEY'];
    const logos = new Map<number, string | undefined>();
    for (const league of favorites) {
      const season = leagueSeason(data.date, league.temporada_cruzada);
      const cacheKey = `fixtures-league:${data.date}:${league.league_id}:${season}`;
      const { data: cache, error } = await context.supabase.from("football_cache").select("resultado,fetched_at").eq("user_id", context.userId).eq("cache_key", cacheKey).maybeSingle();
      if (error) { failure = "Não foi possível carregar as consultas salvas. Continue preenchendo manualmente."; break; }
      if (cache && cacheFresh(cache.fetched_at)) { games.push(...z.array(gameSchema).parse(cache.resultado)); cached++; continue; }
      if (!key) { failure = "A busca automática ainda não está configurada. Continue preenchendo manualmente."; break; }
      try {
        const fixtures = z.array(providerFixture).parse(await footballRequest("/fixtures", { date: data.date, league: String(league.league_id), season: String(season), timezone: "America/Sao_Paulo" }, key));
        const result: z.infer<typeof gameSchema>[] = [];
        for (const row of fixtures) {
          for (const side of [row.teams.home, row.teams.away]) {
            if (!logos.has(side.id)) logos.set(side.id, await crestData(side.logo));
          }
          result.push({ fixtureId: row.fixture.id, campeonato: row.league.name, casa: row.teams.home.name, visitante: row.teams.away.name,
            horario: brasiliaTime(row.fixture.date), canal: "", escudoCasa: logos.get(row.teams.home.id), escudoVisitante: logos.get(row.teams.away.id) });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: writeError } = await supabaseAdmin.from("football_cache").upsert({ user_id: context.userId, cache_key: cacheKey, resultado: result, fetched_at: new Date().toISOString() });
        games.push(...result);
        if (writeError) { failure = "Jogos encontrados, mas não foi possível guardar a consulta. Tente novamente mais tarde."; break; }
      } catch (error) {
        failure = error instanceof FootballError ? error.message : "Não foi possível consultar a API. Continue preenchendo manualmente.";
        break; // Never burn the remaining quota after a provider failure.
      }
    }
    return { games: uniqueGames(games).sort((a, b) => a.horario.localeCompare(b.horario)), error: failure, cached };
  });