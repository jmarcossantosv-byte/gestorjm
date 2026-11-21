import { describe, expect, it } from "vitest";
import { bannerWeekday, canAddGame, GAMES_PER_PAGE, paginateGames } from "@/lib/banner-pages";
import { mergeGames } from "@/lib/football";

describe("páginas do banner", () => {
  it("limita cada página a 5 jogos sem perder excedentes", () => {
    const games = Array.from({ length: 12 }, (_, i) => ({ horario: `${String(i + 10).padStart(2, "0")}:00` }));
    expect(GAMES_PER_PAGE).toBe(5);
    const pages = paginateGames(games);
    expect(pages.map(p => p.length)).toEqual([5, 5, 2]);
    expect(pages.flat()).toEqual(games);
  });
  it("bloqueia cadastro manual ao atingir 5", () => {
    expect(canAddGame(4)).toBe(true);
    expect(canAddGame(5)).toBe(false);
    expect(canAddGame(6)).toBe(false);
  });
  it("ordena por horário antes de dividir e não modifica a lista original", () => {
    const games = ["22:00", "14:00", "19:30", "09:00", "20:00", "16:00"].map(horario => ({ horario }));
    const pages = paginateGames(games);
    expect(pages[0]?.map(g => g.horario)).toEqual(["09:00", "14:00", "16:00", "19:30", "20:00"]);
    expect(pages[1]?.[0]?.horario).toBe("22:00");
    expect(games[0]?.horario).toBe("22:00");
  });
  it("gera SÁBADO pela data escolhida", () => expect(bannerWeekday("2026-11-21")).toBe("SÁBADO"));
  it("não trunca importações acima de 10 jogos", () => {
    const games = Array.from({ length: 12 }, (_, i) => ({ id: String(i), fixtureId: i + 1, canal: "", horario: "18:00" }));
    const result = mergeGames<(typeof games)[number]>([], games, Infinity);
    expect(result.games).toHaveLength(12);
    expect(paginateGames(result.games).map(p => p.length)).toEqual([5, 5, 2]);
  });
});