import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Tv, LogOut, Plus, Search, Pencil, Trash2, Users, CheckCircle2, AlertCircle, Clock, Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Cliente = Database["public"]["Tables"]["clientes"]["Row"];
type Status = Database["public"]["Enums"]["cliente_status"];

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Clientes — Painel IPTV" },
      { name: "description", content: "Visão geral e lista de clientes do seu serviço de IPTV." },
      { property: "og:title", content: "Clientes — Painel IPTV" },
      { property: "og:description", content: "Visão geral e lista de clientes do seu serviço de IPTV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

const STATUS_LABEL: Record<Status, string> = { ativo: "Ativo", vencido: "Vencido", suspenso: "Suspenso" };
const STATUS_CLASS: Record<Status, string> = {
  ativo: "bg-success-soft text-success",
  vencido: "bg-danger-soft text-destructive",
  suspenso: "bg-muted text-muted-foreground",
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function Painel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | Status>("todos");
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Cliente | null>(null);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const hoje = todayISO();
    const limite = addDays(hoje, 7);
    return {
      total: clientes.length,
      ativos: clientes.filter((c) => c.status === "ativo").length,
      vencidos: clientes.filter((c) => c.status === "vencido").length,
      vencendo: clientes.filter(
        (c) => c.status === "ativo" && c.data_vencimento && c.data_vencimento >= hoje && c.data_vencimento <= limite,
      ).length,
    };
  }, [clientes]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes.filter(
      (c) => (filtro === "todos" || c.status === filtro) && (!q || c.nome.toLowerCase().includes(q)),
    );
  }, [clientes, busca, filtro]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente excluído");
      qc.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-brand flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground">
              <Tv className="h-5 w-5" />
            </div>
            <span className="text-lg font-extrabold tracking-tight">Painel IPTV</span>
          </div>
          <Button variant="ghost" size="sm" onClick={sair}>
            <LogOut /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Users} label="Total de clientes" value={stats.total} tone="bg-accent text-accent-foreground" />
          <StatCard icon={CheckCircle2} label="Ativos" value={stats.ativos} tone="bg-success-soft text-success" />
          <StatCard icon={AlertCircle} label="Vencidos" value={stats.vencidos} tone="bg-danger-soft text-destructive" />
          <StatCard icon={Clock} label="Vencem em 7 dias" value={stats.vencendo} tone="bg-warning-soft text-warning" />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold tracking-tight">Clientes</h2>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="hidden sm:inline-flex">
              <Plus /> Novo cliente
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} className="h-11 bg-card pl-9" />
            </div>
            <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
              <SelectTrigger className="h-11 bg-card sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
                <SelectItem value="suspenso">Suspensos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : lista.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card py-14 text-center text-sm text-muted-foreground">
              {clientes.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum cliente encontrado."}
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {lista.map((c) => (
                <li key={c.id} className="rounded-2xl border bg-card p-4 shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{c.nome}</p>
                      <p className="truncate text-sm text-muted-foreground">{c.plano || "Sem plano"} · {brl(Number(c.valor))}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>Vence: <strong className="text-foreground">{fmtDate(c.data_vencimento)}</strong></span>
                    {c.whatsapp && (
                      <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Phone className="h-3.5 w-3.5" />{c.whatsapp}
                      </a>
                    )}
                  </div>
                  {c.observacoes && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{c.observacoes}</p>}
                  <div className="mt-3 flex justify-end gap-2 border-t pt-3">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(c); setFormOpen(true); }}>
                      <Pencil /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToDelete(c)}>
                      <Trash2 /> Excluir
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Button
        size="icon"
        onClick={() => { setEditing(null); setFormOpen(true); }}
        className="fixed bottom-5 right-5 h-14 w-14 rounded-full shadow-soft sm:hidden"
        aria-label="Novo cliente"
      >
        <Plus className="!h-6 !w-6" />
      </Button>

      <ClienteForm open={formOpen} onOpenChange={setFormOpen} cliente={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.nome} será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && del.mutate(toDelete.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
    </div>
  );
}

function ClienteForm({ open, onOpenChange, cliente }: { open: boolean; onOpenChange: (o: boolean) => void; cliente: Cliente | null }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const key = `${cliente?.id ?? "novo"}-${open}`;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      nome: String(f.get("nome")).trim(),
      whatsapp: String(f.get("whatsapp") || "") || null,
      email: String(f.get("email") || "") || null,
      plano: String(f.get("plano") || "") || null,
      valor: Number(String(f.get("valor") || "0").replace(",", ".")) || 0,
      data_vencimento: String(f.get("data_vencimento") || "") || null,
      status: (f.get("status") as Status) || "ativo",
      observacoes: String(f.get("observacoes") || "") || null,
    };
    if (!payload.nome) return toast.error("Informe o nome");
    setSaving(true);
    const { error } = cliente
      ? await supabase.from("clientes").update(payload).eq("id", cliente.id)
      : await supabase.from("clientes").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(cliente ? "Cliente atualizado" : "Cliente adicionado");
    qc.invalidateQueries({ queryKey: ["clientes"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>
        <form key={key} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" className="sm:col-span-2">
            <Input name="nome" required defaultValue={cliente?.nome} />
          </Field>
          <Field label="WhatsApp"><Input name="whatsapp" type="tel" placeholder="(11) 99999-9999" defaultValue={cliente?.whatsapp ?? ""} /></Field>
          <Field label="E-mail"><Input name="email" type="email" defaultValue={cliente?.email ?? ""} /></Field>
          <Field label="Plano"><Input name="plano" placeholder="Ex.: Mensal" defaultValue={cliente?.plano ?? ""} /></Field>
          <Field label="Valor (R$)"><Input name="valor" inputMode="decimal" placeholder="0,00" defaultValue={cliente ? String(cliente.valor).replace(".", ",") : ""} /></Field>
          <Field label="Vencimento"><Input name="data_vencimento" type="date" defaultValue={cliente?.data_vencimento ?? ""} /></Field>
          <Field label="Status">
            <Select name="status" defaultValue={cliente?.status ?? "ativo"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="suspenso">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <Textarea name="observacoes" rows={3} defaultValue={cliente?.observacoes ?? ""} />
          </Field>
          <DialogFooter className="gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
