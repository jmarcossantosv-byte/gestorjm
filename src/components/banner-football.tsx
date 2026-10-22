import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Plus, Trash2, Loader2, CalendarSearch, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchFootballLeagues, fetchFootballGames } from "@/lib/football.functions";
import type { FootballLeague, FootballGame } from "@/lib/football";

export function BannerFootball({ date, onGames }: { date: string; onGames: (games: FootballGame[], date: string) => void }) {
  const onGamesRef = useRef(onGames);
  useEffect(() => { onGamesRef.current = onGames; }, [onGames]);
  const qc = useQueryClient();
  const searchFn = useServerFn(searchFootballLeagues);
  const gamesFn = useServerFn(fetchFootballGames);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FootballLeague[]>([]);
  const [searching, setSearching] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [changing, setChanging] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const favorites = useQuery({
    queryKey: ["football-leagues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("football_leagues").select("league_id,nome,pais,logo").order("nome");
      if (error) throw error;
      return data;
    },
  });

  async function findTeams() {
    if (search.trim().length < 3) return;
    setSearching(true); setNotice(null); setSearched(false);
    try {
      const result = await searchFn({ data: { search: search.trim() } });
      setResults(result.leagues); setSearched(true);
      if (result.error) setNotice(result.error);
    } catch { setNotice("Não foi possível buscar as competições. Você pode continuar preenchendo manualmente."); }
    finally { setSearching(false); }
  }

  async function addTeam(team: FootballLeague) {
    setChanging(team.id);
    try {
      const { error } = await supabase.from("football_leagues").upsert({ league_id: team.id, nome: team.nome, pais: team.pais, logo: team.logo, temporada_cruzada: team.cruzada });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["football-leagues"] });
      toast.success("Competição adicionada.");
    } catch { toast.error("Não foi possível salvar a competição. Tente novamente."); }
    finally { setChanging(null); }
  }

  async function removeTeam(id: number) {
    setChanging(id);
    try {
      const { error } = await supabase.from("football_leagues").delete().eq("league_id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["football-leagues"] });
    } catch { toast.error("Não foi possível remover a competição."); }
    finally { setChanging(null); }
  }

  async function findGames() {
    setFetching(true); setNotice(null);
    const selectedDate = date;
    try {
      const result = await gamesFn({ data: { date: selectedDate } });
      if (result.games.length) onGamesRef.current(result.games, selectedDate);
      if (result.error) setNotice(result.error);
      else if (!result.games.length) setNotice("Nenhum jogo encontrado para esta data");
    } catch { setNotice("Não foi possível buscar os jogos. Você pode continuar preenchendo manualmente."); }
    finally { setFetching(false); }
  }

  function crest(src: string | null, name: string) {
    return src ? <img src={src} alt={`Logo ${name}`} className="h-8 w-8 shrink-0 object-contain" /> : <Shield className="h-8 w-8 shrink-0 text-muted-foreground" />;
  }

  return (
    <section className="space-y-4 border-b pb-5" aria-labelledby="my-teams-title">
      <h2 id="my-teams-title" className="font-bold">Minhas competições</h2>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void findTeams(); }}>
        <Input aria-label="Buscar competição pelo nome" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex.: Brasileirão, Libertadores" minLength={3} maxLength={80} />
        <Button type="submit" variant="outline" disabled={searching || search.trim().length < 3} aria-label="Buscar competições" title="Buscar competições">
          {searching ? <Loader2 className="animate-spin" /> : <Search />}
        </Button>
      </form>
      {results.length > 0 && <ul className="max-h-56 divide-y overflow-y-auto">
        {results.map((team) => {
          const added = favorites.data?.some((item) => item.league_id === team.id);
          return <li key={team.id} className="flex items-center gap-3 py-2">
            {crest(team.logo, team.nome)}<span className="min-w-0 flex-1 break-words text-sm">{team.nome}{team.pais && <span className="block text-xs text-muted-foreground">{team.pais}</span>}</span>
            <Button size="sm" variant="outline" disabled={added || changing !== null} onClick={() => addTeam(team)} aria-label={`Adicionar ${team.nome}`}>
              {changing === team.id ? <Loader2 className="animate-spin" /> : <Plus />}{added ? "Adicionado" : "Adicionar"}
            </Button>
          </li>;
        })}
      </ul>}
      {searched && !results.length && !notice && <p className="text-sm text-muted-foreground">Nenhuma competição encontrada.</p>}
      {favorites.isPending && <Loader2 className="h-5 w-5 animate-spin" aria-label="Carregando minhas competições" />}
      {favorites.isError && <div className="flex items-center gap-2 text-sm text-destructive">Não foi possível carregar suas competições.<Button variant="outline" size="sm" onClick={() => favorites.refetch()}>Tentar novamente</Button></div>}
      {!favorites.isPending && !favorites.isError && !favorites.data?.length && <p className="text-sm text-muted-foreground">Nenhuma competição selecionada.</p>}
      {!!favorites.data?.length && <ul className="divide-y">
        {favorites.data.map((team) => <li key={team.league_id} className="flex items-center gap-3 py-2">
          {crest(team.logo, team.nome)}<span className="min-w-0 flex-1 break-words text-sm font-semibold">{team.nome}{team.pais && <span className="block text-xs font-normal text-muted-foreground">{team.pais}</span>}</span>
          <Button variant="ghost" size="icon" className="text-destructive" disabled={changing !== null || fetching} aria-label={`Remover ${team.nome}`} title={`Remover ${team.nome}`} onClick={() => removeTeam(team.league_id)}><Trash2 /></Button>
        </li>)}
      </ul>}
      <Button className="w-full" disabled={fetching || !favorites.data?.length || changing !== null} onClick={findGames}>
        {fetching ? <Loader2 className="animate-spin" /> : <CalendarSearch />}Buscar jogos do dia
      </Button>
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    </section>
  );
}