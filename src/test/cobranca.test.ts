import { describe, it, expect } from "vitest";
import { deveAvisar, preencherMensagem, type ClienteAviso } from "@/lib/cobranca";

const regra = { dias_antes: 2, avisar_no_dia: true, avisar_vencidos: false };
const base: ClienteAviso = { id: "1", nome: "Ana", valor: 35, data_vencimento: "2026-10-19", status: "ativo", nao_enviar_avisos: false };
const hoje = "2026-10-17";

describe("cobrança automática", () => {
  it("avisa 2 dias antes do vencimento", () => expect(deveAvisar(base, regra, hoje)).toBe(true));
  it("avisa no dia do vencimento", () => expect(deveAvisar({ ...base, data_vencimento: hoje }, regra, hoje)).toBe(true));
  it("não avisa vencidos por padrão", () => expect(deveAvisar({ ...base, data_vencimento: "2026-10-10" }, regra, hoje)).toBe(false));
  it("avisa vencidos quando ligado", () =>
    expect(deveAvisar({ ...base, data_vencimento: "2026-10-10" }, { ...regra, avisar_vencidos: true }, hoje)).toBe(true));
  it("não avisa quem pediu SAIR", () => expect(deveAvisar({ ...base, nao_enviar_avisos: true }, regra, hoje)).toBe(false));
  it("não avisa duas vezes no mesmo dia", () => expect(deveAvisar(base, regra, hoje, new Set(["1"]))).toBe(false));
  it("preenche as variáveis", () =>
    expect(preencherMensagem("{nome}|{plano}|R$ {valor}|{data_vencimento}", { nome: "Ana", plano: "Mensal", valor: 35, data_vencimento: "2026-10-19" }))
      .toBe("Ana|Mensal|R$ 35,00|19/10/2026"));
});
