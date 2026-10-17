import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, BellRing } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AppHeader, Field, fmtDate, todayISO } from "@/components/painel-shared";
import { MENSAGEM_PADRAO, deveAvisar, preencherMensagem } from "@/lib/cobranca";

export const Route = createFileRoute("/_authenticated/cobranca")({
  head: () => ({
    meta: [
      { title: "Cobrança automática — Painel IPTV" },
      { name: "description", content: "Configure os avisos de vencimento e veja quem receberia hoje." },
      { property: "og:title", content: "Cobrança automática — Painel IPTV" },
      { property: "og:description", content: "Configure os avisos de vencimento e veja quem receberia hoje." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cobranca,
});

function Cobranca() {
  const qc = useQueryClient();
  const hoje = todayISO();
  const [saving, setSaving] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const [mensagem, setMensagem] = useState(MENSAGEM_PADRAO);
  const [diasAntes, setDiasAntes] = useState("2");
  const [noDia, setNoDia] = useState(true);
  const [vencidos, setVencidos] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["cobranca_config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cobranca_config").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!config) return;
    setAtivo(config.ativo); setMensagem(config.mensagem); setDiasAntes(String(config.dias_antes));
    setNoDia(config.avisar_no_dia); setVencidos(config.avisar_vencidos);
  }, [config]);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-aviso"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*, planos(nome)").order("nome");
      if (error) throw error;
      return data;
    },
  });
  const { data: avisadosHoje = [] } = useQuery({
    queryKey: ["avisos_enviados", hoje],
    queryFn: async () => {
      const { data, error } = await supabase.from("avisos_enviados").select("cliente_id").eq("data", hoje);
      if (error) throw error;
      return data;
    },
  });

  const regra = { dias_antes: Math.max(0, parseInt(diasAntes) || 0), avisar_no_dia: noDia, avisar_vencidos: vencidos };
  const previa = useMemo(() => {
    const ja = new Set(avisadosHoje.map((a) => a.cliente_id));
    return clientes
      .filter((c) => deveAvisar({ ...c, valor: Number(c.valor) }, regra, hoje, ja))
      .map((c) => ({
        c,
        texto: preencherMensagem(mensagem, { nome: c.nome, plano: c.planos?.nome ?? c.plano ?? "—", valor: Number(c.valor), data_vencimento: c.data_vencimento }),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, avisadosHoje, mensagem, diasAntes, noDia, vencidos, hoje]);

  async function salvar() {
    if (!mensagem.trim()) { toast.error("Escreva a mensagem"); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("cobranca_config").upsert({
      user_id: u.user!.id, ativo, mensagem, dias_antes: regra.dias_antes, avisar_no_dia: noDia, avisar_vencidos: vencidos,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Configuração salva");
    qc.invalidateQueries({ queryKey: ["cobranca_config"] });
  }

  return (
    <div className="min-h-screen pb-24">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <h2 className="text-xl font-bold tracking-tight">Cobrança automática</h2>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-soft">
            <label className="flex items-center justify-between gap-3">
              <span className="font-semibold">Cobrança automática {ativo ? "ligada" : "desligada"}</span>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </label>
            <p className="text-xs text-muted-foreground">Por enquanto nenhuma mensagem é enviada — apenas a prévia abaixo.</p>
            <Field label="Mensagem">
              <Textarea rows={5} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            </Field>
            <p className="text-xs text-muted-foreground">Variáveis: {"{nome}"}, {"{plano}"}, {"{valor}"}, {"{data_vencimento}"}</p>
            <Field label="Avisar quantos dias antes do vencimento">
              <Input type="number" min={0} value={diasAntes} onChange={(e) => setDiasAntes(e.target.value)} className="w-28" />
            </Field>
            <label className="flex items-center justify-between gap-3 text-sm">
              Avisar no dia do vencimento <Switch checked={noDia} onCheckedChange={setNoDia} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              Avisar clientes já vencidos <Switch checked={vencidos} onCheckedChange={setVencidos} />
            </label>
            <div className="flex justify-end border-t pt-3">
              <Button onClick={salvar} disabled={saving}>{saving && <Loader2 className="animate-spin" />}Salvar</Button>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight"><BellRing className="h-5 w-5" /> Receberiam aviso hoje ({previa.length})</h3>
          {previa.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">Nenhum cliente receberia aviso hoje.</div>
          ) : (
            <ul className="space-y-3">
              {previa.map(({ c, texto }) => (
                <li key={c.id} className="rounded-2xl border bg-card p-4 shadow-soft">
                  <div className="flex justify-between gap-2">
                    <p className="font-bold">{c.nome}</p>
                    <span className="text-sm text-muted-foreground">Vence {fmtDate(c.data_vencimento)}</span>
                  </div>
                  {!c.whatsapp && <p className="text-xs text-destructive">Sem WhatsApp cadastrado</p>}
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">{texto}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
