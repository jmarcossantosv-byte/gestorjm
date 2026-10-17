import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { Tv, LogOut, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export type Cliente = Database["public"]["Tables"]["clientes"]["Row"];
export type Plano = Database["public"]["Tables"]["planos"]["Row"];
export type Pagamento = Database["public"]["Tables"]["pagamentos"]["Row"];
export type Forma = Database["public"]["Enums"]["forma_pagamento"];

export const FORMA_LABEL: Record<Forma, string> = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão", outro: "Outro" };

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const parseValor = (v: FormDataEntryValue | null) => Number(String(v || "0").replace(",", ".")) || 0;

export function precisaCobrar(c: Cliente) {
  if (c.status === "suspenso") return false;
  if (c.status === "vencido") return true;
  return !!c.data_vencimento && c.data_vencimento <= addDays(todayISO(), 7);
}

export function linkCobranca(c: Cliente) {
  const numero = (c.whatsapp ?? "").replace(/\D/g, "");
  const full = numero.length <= 11 ? `55${numero}` : numero;
  const vencido = c.status === "vencido" || (!!c.data_vencimento && c.data_vencimento < todayISO());
  const msg = `Olá, ${c.nome}! Sua assinatura de IPTV no valor de ${brl(Number(c.valor))} ${vencido ? "venceu" : "vence"} em ${fmtDate(c.data_vencimento)}. Para continuar assistindo sem interrupções, é só realizar o pagamento. Qualquer dúvida, estou à disposição!`;
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
}

export function CobrarButton({ cliente }: { cliente: Cliente }) {
  if (!precisaCobrar(cliente)) return null;
  if (!cliente.whatsapp) {
    return (
      <Button variant="outline" size="sm" onClick={() => toast.error("Cliente sem WhatsApp cadastrado")}>
        <MessageCircle /> Cobrar
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="sm" className="text-success">
      <a href={linkCobranca(cliente)} target="_blank" rel="noreferrer"><MessageCircle /> Cobrar</a>
    </Button>
  );
}

export function AppHeader() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const linkCls = "rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground";
  return (
    <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2.5">
          <div className="bg-brand flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground">
            <Tv className="h-5 w-5" />
          </div>
          <span className="hidden text-lg font-extrabold tracking-tight sm:inline">Painel IPTV</span>
        </div>
        <nav className="flex items-center gap-1">
          <Link to="/painel" className={linkCls} activeProps={{ className: "bg-accent !text-accent-foreground" }}>Clientes</Link>
          <Link to="/planos" className={linkCls} activeProps={{ className: "bg-accent !text-accent-foreground" }}>Planos</Link>
          <Link to="/cobranca" className={linkCls} activeProps={{ className: "bg-accent !text-accent-foreground" }}>Cobrança</Link>
          <Button variant="ghost" size="sm" onClick={sair}><LogOut /> <span className="hidden sm:inline">Sair</span></Button>
        </nav>
      </div>
    </header>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function PagamentoDialog({ cliente, onOpenChange }: { cliente: Cliente | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cliente) return;
    const f = new FormData(e.currentTarget);
    setSaving(true);
    const { data, error } = await supabase.rpc("registrar_pagamento", {
      _cliente_id: cliente.id,
      _valor: parseValor(f.get("valor")),
      _data_pagamento: String(f.get("data_pagamento") || todayISO()),
      _forma: (f.get("forma") as Forma) || "pix",
      _observacao: String(f.get("observacao") || "") || null,
    } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Pagamento registrado. Novo vencimento: ${fmtDate(data as string)}`);
    qc.invalidateQueries({ queryKey: ["clientes"] });
    qc.invalidateQueries({ queryKey: ["cliente", cliente.id] });
    qc.invalidateQueries({ queryKey: ["pagamentos", cliente.id] });
    onOpenChange(false);
  }

  return (
    <Dialog open={!!cliente} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {cliente?.nome} — a duração do plano será somada ao vencimento e o status ficará ativo.
          </DialogDescription>
        </DialogHeader>
        <form key={cliente?.id} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor (R$)"><Input name="valor" inputMode="decimal" required defaultValue={cliente ? String(cliente.valor).replace(".", ",") : ""} /></Field>
          <Field label="Data"><Input name="data_pagamento" type="date" required defaultValue={todayISO()} /></Field>
          <Field label="Forma" className="sm:col-span-2">
            <Select name="forma" defaultValue="pix">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FORMA_LABEL) as Forma[]).map((k) => <SelectItem key={k} value={k}>{FORMA_LABEL[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Observação" className="sm:col-span-2"><Textarea name="observacao" rows={2} /></Field>
          <DialogFooter className="gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}Confirmar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
