import { describe, it, expect } from "vitest";
import { CACHE_HOURS, cacheFresh, brasiliaTime, uniqueGames, mergeGames } from "@/lib/football";

const game = { fixtureId: 42, campeonato: "Brasileirão", casa: "Flamengo", visitante: "Santos", horario: "21:00", canal: "" };
describe("jogos automáticos", () => {
  it("reutiliza resultados por 6 horas", () => {
    expect(CACHE_HOURS).toBe(6);
    expect(cacheFresh("2026-10-20T00:00:00Z", Date.parse("2026-10-20T05:59:59Z"))).toBe(true);
    expect(cacheFresh("2026-10-20T00:00:00Z", Date.parse("2026-10-20T06:00:00Z"))).toBe(false);
  });
  it("usa o horário de Brasília", () => expect(brasiliaTime("2026-10-21T00:00:00Z")).toBe("21:00"));
  it("não duplica jogo entre dois times favoritos", () => expect(uniqueGames([game, { ...game }])).toHaveLength(1));
  it("mantém canal manual ao atualizar jogo", () => {
    const result = mergeGames([{ ...game, id: "old", canal: "SporTV" }], [{ ...game, id: "new" }]);
    expect(result.games[0]?.canal).toBe("SporTV");
    expect(result.games[0]?.id).toBe("old");
  });
  it("preserva jogos adicionados à mão", () => {
    const result = mergeGames([{ id: "manual", canal: "Globo" }], [{ ...game, id: "new" }]);
    expect(result.games.map((g) => g.id)).toEqual(["manual", "new"]);
  });
  it("mantém limite de 10 jogos do banner", () => {
    const existing = Array.from({ length: 10 }, (_, i) => ({ id: String(i), canal: "" }));
    const result = mergeGames(existing, [{ ...game, id: "new" }]);
    expect(result.games).toHaveLength(10);
    expect(result.omitted).toBe(1);
  });
});
import { leagueSeason } from "@/lib/football";
describe("leagueSeason", () => {
  it("usa o ano da data em ligas de calendário anual", () => expect(leagueSeason("2026-03-10", false)).toBe(2026));
  it("usa o ano anterior em ligas europeias antes de julho", () => expect(leagueSeason("2027-03-10", true)).toBe(2026));
  it("usa o ano atual em ligas europeias a partir de julho", () => expect(leagueSeason("2026-10-21", true)).toBe(2026));
});
