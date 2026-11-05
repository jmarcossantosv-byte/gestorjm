import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dateSchema, gameSchema } from "./football";
import { cleanCompetition, gameId, isFootball, ntfutGameSchema, type NtfutGame } from "./ntfut";

const feedItem = z.object({
  competicao: z.string(), horario: z.string(), time1: z.string(), time2: z.string(),
  img_time1_url: z.string().nullable().optional(), img_time2_url: z.string().nullable().optional(),
  canal: z.string().nullable().optional(), data_filtro: z.string(),
});

function allowedCrest(src: string | null | undefined) {
  if (!src) return null;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname === "imagecache.365scores.com" && /^\/image\/upload\/[^/]+\/v1\/Competitors\/\d+$/.test(url.pathname) ? url.toString() : null;
  } catch { return null; }
}

export const listNtfutGames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ date: dateSchema }))
  .handler(async ({ data }) => {
    try {
      const response = await fetch("https://ntfut.com/proxy.php?url=ntfut", { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) return { games: [] as NtfutGame[], error: "Não foi possível buscar os jogos agora. Você pode preencher manualmente." };
      const raw = z.array(z.unknown()).parse(await response.json());
      const games: NtfutGame[] = [];
      for (const entry of raw) {
        const item = feedItem.safeParse(entry);
        if (!item.success || item.data.data_filtro !== data.date || !isFootball(item.data.competicao)) continue;
        const g = item.data;
        games.push({ fixtureId: gameId(g.data_filtro, g.time1, g.time2), campeonato: cleanCompetition(g.competicao), casa: g.time1, visitante: g.time2,
          horario: g.horario, canal: g.canal ?? "", escudoCasaUrl: allowedCrest(g.img_time1_url), escudoVisitanteUrl: allowedCrest(g.img_time2_url) });
      }
      games.sort((a, b) => a.horario.localeCompare(b.horario));
      return { games, error: null };
    } catch {
      return { games: [] as NtfutGame[], error: "Não foi possível buscar os jogos agora. Você pode preencher manualmente." };
    }
  });

// Crests become data URLs server-side so the banner canvas stays exportable.
async function crest(src: string | null) {
  const url = allowedCrest(src);
  if (!url) return undefined;
  try {
    const r = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(7000) });
    if (!r.ok || !r.headers.get("content-type")?.startsWith("image/")) return undefined;
    const buf = await r.arrayBuffer();
    if (buf.byteLength > 512000) return undefined;
    return `data:${r.headers.get("content-type")};base64,${Buffer.from(buf).toString("base64")}`;
  } catch { return undefined; }
}

export const prepareNtfutGames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ games: z.array(ntfutGameSchema).max(10) }))
  .handler(async ({ data }) => {
    const games: z.infer<typeof gameSchema>[] = await Promise.all(data.games.map(async (g) => ({
      fixtureId: g.fixtureId, campeonato: g.campeonato, casa: g.casa, visitante: g.visitante, horario: g.horario, canal: g.canal,
      escudoCasa: await crest(g.escudoCasaUrl), escudoVisitante: await crest(g.escudoVisitanteUrl),
    })));
    return { games };
  });
