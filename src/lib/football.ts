import { z } from "zod";

export const CACHE_HOURS = 6;
export const teamSchema = z.object({ id: z.number().int().positive(), nome: z.string(), escudo: z.string().nullable() });
export const leagueSchema = z.object({ id: z.number().int().positive(), nome: z.string(), pais: z.string().nullable(), logo: z.string().nullable(), cruzada: z.boolean() });
export type FootballLeague = z.infer<typeof leagueSchema>;
// Cross-year leagues (e.g. Europe, Aug-May) use the starting year as season.
export function leagueSeason(date: string, crossYear: boolean) {
  const year = Number(date.slice(0, 4)); const month = Number(date.slice(5, 7));
  return crossYear && month < 7 ? year - 1 : year;
}
export type FootballTeam = z.infer<typeof teamSchema>;
export const gameSchema = z.object({
  fixtureId: z.number().int().positive(), campeonato: z.string(), casa: z.string(), visitante: z.string(),
  horario: z.string(), canal: z.string(), escudoCasa: z.string().optional(), escudoVisitante: z.string().optional(),
});
export type FootballGame = z.infer<typeof gameSchema>;
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const date = new Date(v + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
}, "Data inválida");

export function cacheFresh(fetchedAt: string, now = Date.now()) {
  const age = now - Date.parse(fetchedAt);
  return age >= 0 && age < CACHE_HOURS * 60 * 60 * 1000;
}

export function brasiliaTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(date));
}

export function uniqueGames(games: FootballGame[]) {
  return [...new Map(games.map((game) => [game.fixtureId, game])).values()];
}

// Keep manual games and channels; updating an imported fixture must not duplicate it.
export function mergeGames<T extends { id: string; fixtureId?: number; canal: string }>(existing: T[], incoming: (T & { fixtureId: number })[], max = 10) {
  const updates = new Map(incoming.map((game) => [game.fixtureId, game]));
  const result = existing.map((game) => {
    const update = game.fixtureId ? updates.get(game.fixtureId) : undefined;
    if (!update) return game;
    updates.delete(update.fixtureId);
    return { ...update, id: game.id, canal: game.canal };
  });
  const total = result.length + updates.size;
  return { games: [...result, ...updates.values()].slice(0, max), omitted: Math.max(0, total - max) };
}