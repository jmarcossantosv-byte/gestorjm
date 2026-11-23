import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Copy, Loader2, QrCode, ShieldCheck, Tv, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brlCheckout } from "@/lib/checkout";
import { getPublicCheckout, createPublicPix, checkPublicPayment } from "@/lib/checkout.functions";

const checkoutQuery = (token: string) => queryOptions({ queryKey: ["public-checkout", token], queryFn: () => getPublicCheckout({ data: { token } }), retry: false });
export const Route = createFileRoute("/pagar/$token")({
  head: () => ({ meta: [
    { title: "Pagamento Pix — JM Play" }, { name: "description", content: "Pagamento seguro da sua renovação com Pix pelo Mercado Pago." },
    { property: "og:title", content: "Pagamento Pix — JM Play" }, { property: "og:description", content: "Pague sua renovação com Pix pelo Mercado Pago." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" },
    { name: "referrer", content: "no-referrer" },
  ] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(checkoutQuery(params.token)),
  component: PaymentPage,
  errorComponent: () => <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6"><QrCode className="h-10 w-10 text-muted-foreground" /><h1 className="text-2xl font-bold">Link indisponível</h1><p className="text-muted-foreground">Peça um novo link de pagamento ao administrador.</p></main>,
});
const dateLabel = (value: string | null) => value ? value.split("-").reverse().join("/") : "—";
function PaymentPage() {
  const { token } = Route.useParams();
  const { data: order } = useSuspenseQuery(checkoutQuery(token));
  const qc = useQueryClient();
  const createPix = useServerFn(createPublicPix);
  const check = useServerFn(checkPublicPayment);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const queryKey = checkoutQuery(token).queryKey;
  const seconds = Math.max(0, Math.ceil(((order.pixExpiresAt ? new Date(order.pixExpiresAt).getTime() : 0) - now) / 1000));
  const hasQr = !!order.qrCode && !!order.qrBase64;
  async function verify(manual = true) {
    setChecking(true);
    try {
      const result = await check({ data: { token } }); qc.setQueryData(queryKey, result); setError("");
      if (manual && result.status === "pending") toast.info("Pagamento ainda não confirmado pelo Mercado Pago.");
    } catch (e) { if (manual) setError(e instanceof Error ? e.message : "Não foi possível verificar o pagamento."); }
    finally { setChecking(false); }
  }
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);
  useEffect(() => {
    if (order.status !== "pending" || !hasQr) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        try { const result = await check({ data: { token } }); if (!cancelled) qc.setQueryData(["public-checkout", token], result); } catch { /* Manual check remains available. */ }
      }
      if (!cancelled) timer = setTimeout(poll, 10000);
    }
    timer = setTimeout(poll, 10000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [order.status, hasQr, check, qc, token]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { const result = await createPix({ data: { token, email } }); qc.setQueryData(queryKey, result); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível gerar o Pix."); }
    finally { setBusy(false); }
  }
  const paid = order.status === "paid";
  return <div className="min-h-screen bg-background">
    <main className="mx-auto max-w-md px-5 py-8 sm:py-14">
      <header className="flex items-center gap-3 border-b pb-6">
        {order.logo ? <img src={order.logo} alt={order.brand} className="h-14 w-14 object-contain" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Tv className="h-7 w-7" /></div>}
        <div className="min-w-0"><h1 className="break-words text-2xl font-extrabold">{order.brand}</h1><p className="text-sm text-muted-foreground">Renovação da assinatura</p></div>
      </header>
      <section className="space-y-4 py-6">
        <p className="text-lg font-bold">Olá, {order.name}</p>
        <dl className="space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Plano</dt><dd className="text-right font-semibold">{order.plan}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Vencimento</dt><dd>{dateLabel(order.dueDate)}</dd></div></dl>
        <p className="border-t pt-5 text-4xl font-extrabold">{brlCheckout(order.amount)}</p>
      </section>
      {paid ? <section role="status" className="space-y-3 border-t py-6 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-success" /><h2 className="text-xl font-bold">Pagamento confirmado!</h2><p className="text-muted-foreground">Assinatura ativa até <strong className="text-foreground">{dateLabel(order.renewedUntil)}</strong>.</p></section>
        : order.status !== "pending" ? <p role="status" className="border-t py-6 text-muted-foreground">{order.status === "refunded" ? "Pagamento reembolsado." : order.status === "charged_back" ? "Pagamento contestado." : "Cobrança encerrada. Peça um novo link ao administrador."}</p>
        : order.expired ? <p role="alert" className="border-t py-6 text-destructive">Link expirado. Peça um novo link ao administrador.</p>
        : !order.configured ? <p role="status" className="border-t py-6 text-muted-foreground">Pagamento temporariamente indisponível. Entre em contato com o administrador.</p>
        : <section className="space-y-4 border-t py-6">
          {order.isTest && <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">Ambiente de teste. Não pague este Pix pelo aplicativo do banco.</p>}
          {hasQr && seconds > 0 ? <>
            <div className="mx-auto w-64 max-w-full rounded-lg border bg-card p-3"><img src={`data:image/png;base64,${order.qrBase64}`} alt="QR Code Pix" className="aspect-square w-full" /></div>
            <p className="text-center text-sm text-muted-foreground">Expira em {Math.floor(seconds / 60).toString().padStart(2, "0")}:{(seconds % 60).toString().padStart(2, "0")}</p>
            <div className="space-y-2"><Label htmlFor="pix-code">Pix Copia e Cola</Label><Input id="pix-code" readOnly value={order.qrCode ?? ""} onFocus={(e) => e.target.select()} /></div>
            <Button className="w-full" onClick={async () => { try { await navigator.clipboard.writeText(order.qrCode ?? ""); toast.success("Código Pix copiado."); } catch { toast.error("Selecione o código para copiar."); } }}><Copy />Copiar código Pix</Button>
          </> : <form onSubmit={submit} className="space-y-4">
            {hasQr && <p className="text-sm text-warning">Este código expirou. Gere um novo Pix.</p>}
            <div className="space-y-2"><Label htmlFor="payer-email">Seu e-mail</Label><Input id="payer-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <Button type="submit" disabled={busy} className="w-full">{busy ? <Loader2 className="animate-spin" /> : <QrCode />}{hasQr ? "Gerar novo Pix" : "Pagar com Pix"}</Button>
          </form>}
          {hasQr && <Button variant="outline" disabled={checking || busy} className="w-full" onClick={() => verify()}>{checking ? <Loader2 className="animate-spin" /> : <RefreshCw />}Já paguei</Button>}
        </section>}
      {error && <p role="alert" className="mb-5 break-words rounded-lg bg-danger-soft p-3 text-sm text-destructive">{error}</p>}
      <footer className="space-y-3 border-t pt-5 text-center text-xs text-muted-foreground"><p className="flex items-center justify-center gap-1.5"><ShieldCheck className="h-4 w-4" />Pix processado pelo Mercado Pago</p>{order.contact && <p className="break-words">{order.contact}</p>}</footer>
    </main>
  </div>;
}