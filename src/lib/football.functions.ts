import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cacheFresh, dateSchema, gameSchema, teamSchema, brasiliaTime, uniqueGames } from "./football";
import { footballRequest, providerTeam, providerFixture, crestData } from "./football.server";

export const searchFootballTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ search: z.string().trim().min(3).max(80) }))
  .handler(async ({ data, context }) => {
    const cacheKey = `teams:${data.search.toLocaleLowerCase("pt-BR")}`;
    try {
      const { data: cache, error } = await context.supabase.from("football_cache").select("resultado,fetched_at").eq("user_id", context.userId).eq("cache_key", cacheKey).maybeSingle();
      if (error) throw new Error("Não foi possível carregar os times. Tente novamente.");
      if (cache && cacheFresh(cache.fetched_at)) return { teams: z.array(teamSchema).parse(cache.resultado), error: null };
      const key = process.env['API_FOOTBALL_KEY'];
      if (!key) return { teams: [], error: "A busca automática ainda não está configurada. Continue preenchendo manualmente." };
      const rows = z.array(z.object({ team: providerTeam })).parse(await footballRequest("/teams", { search: data.search }, key));
      const teams = await Promise.all(rows.map(async ({ team }) => ({ id: team.id, nome: team.name, escudo: (await crestData(team.logo)) ?? null })));
      // Auth was verified above. Privileged access writes only provider cache for this caller.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: writeError } = await supabaseAdmin.from("football_cache").upsert({ user_id: context.userId, cache_key: cacheKey, resultado: teams, fetched_at: new Date().toISOString() });
      if (writeError) return { teams, error: "Times encontrados, mas não foi possível guardar a consulta. Tente novamente mais tarde." };
      return { teams, error: null };
    } catch (error) {
      return { teams: [], error: error instanceof Error ? error.message : "Não foi possível buscar os times. Continue preenchendo manualmente." };
    }
  });

export const fetchFootballGames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ date: dateSchema }))
  .handler(async ({ data, context }) => {
    const { data: favorites, error: teamsError } = await context.supabase.from("football_teams").select("team_id").eq("user_id", context.userId);
    if (teamsError) return { games: [], error: "Não foi possível carregar seus times. Tente novamente.", cached: 0 };
    if (!favorites?.length) return { games: [], error: "Adicione um time em Meus times antes de buscar.", cached: 0 };
    const games: z.infer<typeof gameSchema>[] = [];
    let cached = 0;
    let failure: string | null = null;
    const key = process.env['API_FOOTBALL_KEY'];
    const logos = new Map<number, string | undefined>();
    for (const team of favorites) {
      const cacheKey = `fixtures:${data.date}:${team.team_id}`;
      const { data: cache, error } = await context.supabase.from("football_cache").select("resultado,fetched_at").eq("user_id", context.userId).eq("cache_key", cacheKey).maybeSingle();
      if (error) { failure = "Não foi possível carregar as consultas salvas. Continue preenchendo manualmente."; break; }
      if (cache && cacheFresh(cache.fetched_at)) { games.push(...z.array(gameSchema).parse(cache.resultado)); cached++; continue; }
      if (!key) { failure = "A busca automática ainda não está configurada. Continue preenchendo manualmente."; break; }
      try {
        const fixtures = z.array(providerFixture).parse(await footballRequest("/fixtures", { date: data.date, team: String(team.team_id), timezone: "America/Sao_Paulo" }, key));
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
        failure = error instanceof Error ? error.message : "Não foi possível consultar a API. Continue preenchendo manualmente.";
        break; // Never burn the remaining quota after a provider failure.
      }
    }
    return { games: uniqueGames(games).sort((a, b) => a.horario.localeCompare(b.horario)), error: failure, cached };
  });