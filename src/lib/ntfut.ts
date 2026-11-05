import { z } from "zod";

// Other sports in the ntfut feed, matched against the competition name.
const NOT_FOOTBALL = /\b(ATP|WTA|ITF|NBA|NBB|NHL|NFL|MLB|NCAA\w*|WNBA|Euroliga|EuroCup|ACB|UFC|F[óo]rmula|MotoGP|Basquete|T[êe]nis|V[ôo]lei|H[óo]quei|Handebol|Superliga|Copa Davis|Billie Jean)\b/i;

export function isFootball(competicao: string) {
  return !NOT_FOOTBALL.test(competicao);
}

export const ntfutGameSchema = z.object({
  fixtureId: z.number().int().positive(), campeonato: z.string(), casa: z.string(), visitante: z.string(),
  horario: z.string(), canal: z.string(), escudoCasaUrl: z.string().nullable(), escudoVisitanteUrl: z.string().nullable(),
});
export type NtfutGame = z.infer<typeof ntfutGameSchema>;

// Stable positive ID so re-importing the same match updates it instead of duplicating.
export function gameId(date: string, casa: string, visitante: string) {
  let h = 2166136261;
  for (const ch of `${date}|${casa}|${visitante}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) || 1;
}

export function cleanCompetition(name: string) {
  return name.replace(/^[^,]+,\s*/, "").trim();
}
