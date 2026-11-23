import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Link as LinkIcon, Loader2, MessageCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createCheckoutLink } from "@/lib/checkout.functions";

export function CheckoutLinkButton({ clientId, whatsapp }: { clientId: string; whatsapp: string | null }) {
  const createLink = useServerFn(createCheckoutLink);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  async function generate() {
    setBusy(true);
    try { const result = await createLink({ data: { clientId } }); setUrl(result.url); setOpen(true); await qc.invalidateQueries({ queryKey: ["checkout-links"] }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar o link."); }
    finally { setBusy(false); }
  }
  const number = (whatsapp ?? "").replace(/\D/g, "");
  const fullNumber = number.length <= 11 ? `55${number}` : number;
  return <>
    <Button variant="outline" size="sm" disabled={busy} onClick={generate}>{busy ? <Loader2 className="animate-spin" /> : <LinkIcon />}Link de pagamento</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Pagamento com Pix</DialogTitle><DialogDescription>Link individual de pagamento do cliente.</DialogDescription></DialogHeader>
      <div className="space-y-2"><Label htmlFor="payment-link">Link de pagamento</Label><Input id="payment-link" readOnly value={url} onFocus={(e) => e.target.select()} /></div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success("Link copiado."); } catch { toast.error("Selecione o link para copiar."); } }}><Copy />Copiar</Button>
        <Button variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink />Abrir</a></Button>
        {number && <Button asChild><a href={`https://wa.me/${fullNumber}?text=${encodeURIComponent(`Olá! Você pode pagar sua renovação com Pix neste link: ${url}`)}`} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></Button>}
      </div>
    </DialogContent></Dialog>
  </>;
}
