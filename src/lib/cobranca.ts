export const MENSAGEM_PADRAO =
  "Olá {nome}, seu plano {plano} vence em {data_vencimento}. Valor: R$ {valor}. Para renovar, é só responder esta mensagem. Se não quiser mais receber avisos, responda SAIR.";

export type RegraAviso = { dias_antes: number; avisar_no_dia: boolean; avisar_vencidos: boolean };
export type ClienteAviso = {
  id: string;
  nome: string;
  valor: number;
  data_vencimento: string | null;
  status: "ativo" | "vencido" | "suspenso";
  nao_enviar_avisos: boolean;
};

const addDias = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Retorna se o cliente deve receber aviso em `hoje` (ISO yyyy-mm-dd). */
export function deveAvisar(c: ClienteAviso, regra: RegraAviso, hoje: string, jaAvisadosHoje: Set<string> = new Set()) {
  if (c.nao_enviar_avisos || c.status === "suspenso" || !c.data_vencimento) return false;
  if (jaAvisadosHoje.has(c.id)) return false;
  const v = c.data_vencimento;
  if (regra.dias_antes > 0 && v === addDias(hoje, regra.dias_antes)) return true;
  if (regra.avisar_no_dia && v === hoje) return true;
  if (regra.avisar_vencidos && v < hoje) return true;
  return false;
}

export function preencherMensagem(modelo: string, d: { nome: string; plano: string; valor: number; data_vencimento: string | null }) {
  const valor = d.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const data = d.data_vencimento ? d.data_vencimento.split("-").reverse().join("/") : "—";
  return modelo
    .replaceAll("{nome}", d.nome)
    .replaceAll("{plano}", d.plano)
    .replaceAll("{valor}", valor)
    .replaceAll("{data_vencimento}", data);
}
