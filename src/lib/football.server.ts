import { z } from "zod";

export class FootballError extends Error {
  constructor(message: string, public readonly code: "date_restricted" | "provider_error" = "provider_error") {
    super(message);
  }
}

export const providerTeam = z.object({ id: z.number().int().positive(), name: z.string(), logo: z.string().nullable().optional() });
export const providerLeague = z.object({
  league: z.object({ id: z.number().int().positive(), name: z.string(), logo: z.string().nullable().optional() }),
  country: z.object({ name: z.string().nullable().optional() }).optional(),
  seasons: z.array(z.object({ year: z.number().int(), start: z.string(), end: z.string(), current: z.boolean() })).optional(),
});
export const providerFixture = z.object({
  fixture: z.object({ id: z.number().int().positive(), date: z.string().datetime({ offset: true }) }),
  league: z.object({ name: z.string() }),
  teams: z.object({ home: providerTeam, away: providerTeam }),
});

export async function footballRequest(path: string, params: Record<string, string>, key: string) {
  const url = new URL(path, "https://v3.football.api-sports.io");
  Object.entries(params).forEach(([k, value]) => url.searchParams.set(k, value));
  const response = await fetch(url, { headers: { "x-apisports-key": key }, signal: AbortSignal.timeout(15000) });
  if (response.status === 429) throw new FootballError("O limite de consultas da API foi atingido. Tente mais tarde ou preencha manualmente.");
  if (!response.ok) throw new FootballError("Não foi possível consultar os jogos agora. Você pode continuar preenchendo manualmente.");
  const body = z.object({ errors: z.union([z.array(z.unknown()), z.record(z.unknown())]), response: z.array(z.unknown()) }).parse(await response.json());
  const errors = Object.values(body.errors);
  if (errors.length) {
    const details = errors.map(String).join(" ");
    if (/season|historical|(?:date|data).*(?:available|allow|restrict|access)|(?:plan|subscription).*(?:date|access)/i.test(details)) {
      throw new FootballError("A API-Football bloqueou a consulta da data escolhida por uma restrição do seu plano. Não foi possível verificar se há jogos nessa data. Você pode adicionar e editar os jogos manualmente no banner.", "date_restricted");
    }
    if (/limit|quota|requests/i.test(details)) throw new FootballError("O limite de consultas da API foi atingido. Tente mais tarde ou preencha manualmente.");
    if (/key|token|auth/i.test(details)) throw new FootballError("A chave da API não foi aceita. Verifique sua conta API-Sports; a edição manual continua disponível.");
    throw new FootballError("A API não conseguiu concluir a consulta. Você pode continuar preenchendo manualmente.");
  }
  return body.response;
}

// Only provider PNG crests are fetched: never arbitrary user-supplied URLs.
// Data URLs keep the canvas exportable without depending on provider CORS.
export async function crestData(src: string | null | undefined): Promise<string | undefined> {
  if (!src) return undefined;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" || url.hostname !== "media.api-sports.io" || !/^\/football\/(?:teams|leagues)\/\d+\.png$/.test(url.pathname)) return undefined;
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(7000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png")) return undefined;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 512000) return undefined;
    return `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;
  } catch { return undefined; }
}