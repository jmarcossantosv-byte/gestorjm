import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CalendarSearch, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { listNtfutGames, prepareNtfutGames } from "@/lib/ntfut.functions";
import type { FootballGame } from "@/lib/football";
import type { NtfutGame } from "@/lib/ntfut";

const MAX = 10;

function isoDate(offset: number) {
  const d = new Date(Date.now() + offset * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

export function BannerFootball({ date, onDate, onGames }: { date: string; onDate: (date: string) => void; onGames: (games: FootballGame[], date: string) => void }) {
  const listFn = useServerFn(listNtfutGames);
  const prepareFn = useServerFn(prepareNtfutGames);
  const [games, setGames] = useState<NtfutGame[] | null>(null);
  const [gamesDate, setGamesDate] = useState(date);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const hoje = isoDate(0), amanha = isoDate(1);

  async function buscar(target: string) {
    onDate(target);
    setLoading(true); setNotice(null); setGames(null); setSelected(new Set()); setGamesDate(target);
    try {
      const r = await listFn({ data: { date: target } });
      setGames(r.games);
      if (r.error) setNotice(r.error);
      else if (!r.games.length) setNotice("Nenhum jogo encontrado para esta data");
    } catch { setNotice("Não foi possível buscar os jogos agora. Você pode preencher manualmente."); }
    finally { setLoading(false); }
  }

  function toggle(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else if (n.size < MAX) n.add(id);
      return n;
    });
  }

  async function adicionar() {
    if (!games) return;
    setAdding(true);
    try {
      const r = await prepareFn({ data: { games: games.filter((g) => selected.has(g.fixtureId)) } });
      onGames(r.games, gamesDate);
      setGames(null); setSelected(new Set());
    } catch { setNotice("Não foi possível adicionar os jogos. Tente novamente."); }
    finally { setAdding(false); }
  }

  const grupos = new Map<string, NtfutGame[]>();
  games?.forEach((g) => grupos.set(g.campeonato, [...(grupos.get(g.campeonato) ?? []), g]));

  const crest = (src: string | null, name: string) =>
    src ? <img src={src} alt="" title={name} className="h-6 w-6 shrink-0 object-contain" loading="lazy" /> : <Shield className="h-6 w-6 shrink-0 text-muted-foreground" />;

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft" aria-labelledby="buscar-jogos-title">
      <h2 id="buscar-jogos-title" className="font-bold">Buscar jogos de futebol</h2>
      <div className="flex flex-wrap gap-2">
        <Button variant={date === hoje ? "default" : "outline"} size="sm" disabled={loading} onClick={() => buscar(hoje)}>Hoje</Button>
        <Button variant={date === amanha ? "default" : "outline"} size="sm" disabled={loading} onClick={() => buscar(amanha)}>Amanhã</Button>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => buscar(date)}>
          {loading ? <Loader2 className="animate-spin" /> : <CalendarSearch />}Buscar na data escolhida
        </Button>
      </div>
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {!!games?.length && <>
        <p className="text-sm text-muted-foreground">Marque os jogos para o banner ({selected.size}/{MAX}).</p>
        <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
          {[...grupos].map(([camp, lista]) => <div key={camp}>
            <h3 className="mb-1 text-xs font-bold uppercase text-muted-foreground">{camp}</h3>
            <ul className="divide-y rounded-lg border">
              {lista.map((g) => {
                const marcado = selected.has(g.fixtureId);
                return <li key={g.fixtureId}>
                  <label className="flex cursor-pointer items-center gap-3 p-2 text-sm">
                    <Checkbox checked={marcado} disabled={!marcado && selected.size >= MAX} onCheckedChange={() => toggle(g.fixtureId)} />
                    <span className="w-11 shrink-0 font-semibold">{g.horario}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">{crest(g.escudoCasaUrl, g.casa)}<span className="truncate">{g.casa}</span></span>
                      <span className="flex items-center gap-1.5">{crest(g.escudoVisitanteUrl, g.visitante)}<span className="truncate">{g.visitante}</span></span>
                      {g.canal && <span className="block truncate text-xs text-muted-foreground">{g.canal}</span>}
                    </span>
                  </label>
                </li>;
              })}
            </ul>
          </div>)}
        </div>
        <Button className="w-full" disabled={!selected.size || adding} onClick={adicionar}>
          {adding && <Loader2 className="animate-spin" />}Adicionar {selected.size || ""} jogo(s) ao banner
        </Button>
      </>}
    </section>
  );
}
