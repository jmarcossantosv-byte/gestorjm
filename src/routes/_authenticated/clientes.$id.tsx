import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, Wallet, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppHeader, CobrarButton, FORMA_LABEL, PagamentoDialog, brl, fmtDate, type Cliente } from "@/components/painel-shared";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Cliente — Painel IPTV" },
      { name: "description", content: "Detalhes e histórico de pagamentos do cliente." },
      { property: "og:title", content: "Cliente — Painel IPTV" },
      { property: "og:description", content: "Detalhes e histórico de pagamentos do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientePage,
});

const STATUS_LABEL = { ativo: "Ativo", vencido: "Vencido", suspenso: "Suspenso" } as const;

function ClientePage() {
  const { id } = Route.useParams();
  const [pagar, setPagar] = useState<Cliente | null>(null);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*, planos(nome, duracao_dias, numero_telas)").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos").select("*").eq("cliente_id", id).order("data_pagamento", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = pagamentos.reduce((s, p) => s + Number(p.valor), 0);

  return (
    <div className="min-h-screen pb-24">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <Link to="/painel" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !cliente ? (
          <div className="rounded-2xl border border-dashed bg-card py-14 text-center text-sm text-muted-foreground">Cliente não encontrado.</div>
        ) : (
          <>
            <section className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-extrabold tracking-tight">{cliente.nome}</h1>
                  <p className="text-sm text-muted-foreground">
                    {cliente.planos?.nome ?? cliente.plano ?? "Sem plano"} · {brl(Number(cliente.valor))}
                    {cliente.planos && ` · ${cliente.planos.duracao_dias} dias · ${cliente.planos.numero_telas} tela(s)`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">{STATUS_LABEL[cliente.status]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>Vence: <strong className="text-foreground">{fmtDate(cliente.data_vencimento)}</strong></span>
                {cliente.whatsapp && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{cliente.whatsapp}</span>}
                {cliente.email && <span>{cliente.email}</span>}
              </div>
              {cliente.observacoes && <p className="mt-2 text-sm text-muted-foreground">{cliente.observacoes}</p>}
              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-3">
                <CobrarButton cliente={cliente} />
                <Button size="sm" onClick={() => setPagar(cliente)}><Wallet /> Registrar pagamento</Button>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-bold tracking-tight">Histórico de pagamentos</h2>
                <span className="text-sm text-muted-foreground">Total: <strong className="text-foreground">{brl(total)}</strong></span>
              </div>
              {pagamentos.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-card py-10 text-center text-sm text-muted-foreground">Nenhum pagamento registrado.</div>
              ) : (
                <ul className="divide-y rounded-2xl border bg-card shadow-soft">
                  {pagamentos.map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-semibold">{fmtDate(p.data_pagamento)} · {FORMA_LABEL[p.forma]}</p>
                        {p.observacao && <p className="text-sm text-muted-foreground">{p.observacao}</p>}
                      </div>
                      <span className="shrink-0 font-bold">{brl(Number(p.valor))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <PagamentoDialog cliente={pagar} onOpenChange={(o) => !o && setPagar(null)} />
    </div>
  );
}
