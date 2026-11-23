import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/painel-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getMercadoPagoConfig, saveMercadoPagoConfig, removeMercadoPagoConfig } from "@/lib/checkout.functions";

const configQuery = queryOptions({ queryKey: ["mercadopago-config"], queryFn: () => getMercadoPagoConfig() });
export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [
    { title: "Checkout Pix — Painel IPTV" }, { name: "description", content: "Configure sua conta Mercado Pago para receber pagamentos Pix dos seus clientes." },
    { property: "og:title", content: "Checkout Pix — Painel IPTV" }, { property: "og:description", content: "Configuração privada de recebimentos Pix no Painel IPTV." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(configQuery), component: CheckoutConfig,
});

function CheckoutConfig() {
  const { data: config } = useSuspenseQuery(configQuery);
  const qc = useQueryClient();
  const save = useServerFn(saveMercadoPagoConfig);
  const remove = useServerFn(removeMercadoPagoConfig);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await save({ data: { key } }); setKey(""); await qc.invalidateQueries({ queryKey: ["mercadopago-config"] }); toast.success("Chave validada e salva com segurança."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar a chave."); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true);
    try { await remove(); await qc.invalidateQueries({ queryKey: ["mercadopago-config"] }); toast.success("Chave removida."); }
    catch { toast.error("Não foi possível remover a chave."); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen pb-16"><AppHeader />
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="flex items-center gap-3 text-2xl font-extrabold"><KeyRound className="text-primary" />Checkout Pix</h1>
      <section className="mt-8 space-y-6 border-t pt-6">
        <h2 className="text-lg font-bold">Mercado Pago</h2>
        <div role="status" className={`flex items-center gap-2 rounded-lg p-3 text-sm ${config.configured ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>
          <ShieldCheck className="h-5 w-5 shrink-0" />{config.configured ? "Chave cadastrada com segurança" : "Nenhuma chave cadastrada"}
        </div>
        {config.isTest && <p className="text-sm text-warning">Conta de teste: o Pix não pode ser pago por um aplicativo bancário.</p>}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="mp-key">{config.configured ? "Nova chave API (Access Token)" : "Chave API (Access Token)"}</Label>
            <Input id="mp-key" name="mp-key" type="password" autoComplete="off" spellCheck={false} required minLength={20} maxLength={4096} value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {config.configured && <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmRemove(true)}><Trash2 />Remover chave</Button>}
            <Button type="submit" disabled={busy || !key.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Save />}{config.configured ? "Substituir chave" : "Salvar chave"}</Button>
          </div>
        </form>
      </section>
    </main>
    <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Remover a chave do Mercado Pago?</AlertDialogTitle><AlertDialogDescription>Novos pagamentos e confirmações ficarão indisponíveis até cadastrar a chave novamente. O histórico será mantido.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={disconnect}>Remover chave</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </div>;
}
