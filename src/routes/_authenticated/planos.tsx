import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, Loader2, MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppHeader, Field, brl, parseValor, type Plano } from "@/components/painel-shared";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos — Painel IPTV" },
      { name: "description", content: "Cadastre e gerencie os planos do seu serviço de IPTV." },
      { property: "og:title", content: "Planos — Painel IPTV" },
      { property: "og:description", content: "Cadastre e gerencie os planos do seu serviço de IPTV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Planos,
});

function Planos() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plano | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Plano | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: planos = [], isLoading } = useQuery({
    queryKey: ["planos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("planos").select("*").order("valor");
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plano excluído"); qc.invalidateQueries({ queryKey: ["planos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      nome: String(f.get("nome")).trim(),
      valor: parseValor(f.get("valor")),
      duracao_dias: Math.max(1, parseInt(String(f.get("duracao_dias"))) || 30),
      numero_telas: Math.max(1, parseInt(String(f.get("numero_telas"))) || 1),
    };
    if (!payload.nome) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const { error } = editing
      ? await supabase.from("planos").update(payload).eq("id", editing.id)
      : await supabase.from("planos").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Plano atualizado" : "Plano adicionado");
    qc.invalidateQueries({ queryKey: ["planos"] });
    setFormOpen(false);
  }

  const novo = () => { setEditing(null); setFormOpen(true); };

  return (
    <div className="min-h-screen pb-24">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">Planos</h2>
          <Button onClick={novo}><Plus /> Novo plano</Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : planos.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card py-14 text-center text-sm text-muted-foreground">Nenhum plano cadastrado ainda.</div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {planos.map((p) => (
              <li key={p.id} className="rounded-2xl border bg-card p-4 shadow-soft">
                <p className="font-bold">{p.nome}</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight">{brl(Number(p.valor))}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MonitorPlay className="h-4 w-4" /> {p.duracao_dias} dias · {p.numero_telas} {p.numero_telas === 1 ? "tela" : "telas"}
                </p>
                <div className="mt-3 flex justify-end gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" onClick={() => { setEditing(p); setFormOpen(true); }}><Pencil /> Editar</Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToDelete(p)}><Trash2 /> Excluir</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
          <form key={`${editing?.id ?? "novo"}-${formOpen}`} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2"><Input name="nome" required placeholder="Ex.: Mensal" defaultValue={editing?.nome} /></Field>
            <Field label="Valor (R$)"><Input name="valor" inputMode="decimal" placeholder="0,00" defaultValue={editing ? String(editing.valor).replace(".", ",") : ""} /></Field>
            <Field label="Duração (dias)"><Input name="duracao_dias" type="number" min={1} required defaultValue={editing?.duracao_dias ?? 30} /></Field>
            <Field label="Número de telas"><Input name="numero_telas" type="number" min={1} required defaultValue={editing?.numero_telas ?? 1} /></Field>
            <DialogFooter className="gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>{toDelete?.nome} será removido. Clientes com este plano ficarão sem plano.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toDelete && del.mutate(toDelete.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
