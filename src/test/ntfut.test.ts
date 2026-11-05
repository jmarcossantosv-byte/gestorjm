import { describe, expect, it } from "vitest";
import { gameId, isFootball } from "@/lib/ntfut";

describe("filtro de futebol do ntfut", () => {
  it("mantém campeonatos de futebol", () => {
    expect(isFootball("Brasil, Brasileirão - Série A")).toBe(true);
    expect(isFootball("Europa, Liga dos Campeões")).toBe(true);
  });
  it("remove outros esportes", () => {
    for (const c of ["EUA, NBA", "Brasil, NBB", "EUA, NHL", "EUA, NFL", "ATP, Paris, Piso duro", "WTA, Hong Kong", "Europa, Euroliga ", "EUA, NCAAB D-I"]) expect(isFootball(c)).toBe(false);
  });
  it("gera o mesmo ID para o mesmo jogo", () => {
    expect(gameId("2026-11-05", "Flamengo", "Vasco")).toBe(gameId("2026-11-05", "Flamengo", "Vasco"));
    expect(gameId("2026-11-05", "Flamengo", "Vasco")).not.toBe(gameId("2026-11-06", "Flamengo", "Vasco"));
  });
});
