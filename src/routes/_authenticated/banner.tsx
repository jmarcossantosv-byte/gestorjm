import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Download, Copy, CalendarClock, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AppHeader, Field, addDays, fmtDate, todayISO } from "@/components/painel-shared";
import { BannerFootball } from "@/components/banner-football";
import { mergeGames, type FootballGame } from "@/lib/football";

export const Route = createFileRoute("/_authenticated/banner")({
  head: () => ({
    meta: [
      { title: "Gerador de Banner — Painel IPTV" },
      { name: "description", content: "Crie banners de jogos do dia para Story, Feed e Paisagem." },
      { property: "og:title", content: "Gerador de Banner — Painel IPTV" },
      { property: "og:description", content: "Crie banners de jogos do dia para Story, Feed e Paisagem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Banner,
});

type Jogo = { id: string; fixtureId?: number; campeonato: string; casa: string; visitante: string; horario: string; canal: string; escudoCasa?: string | undefined; escudoVisitante?: string | undefined };
type Config = { titulo: string; logo?: string | undefined; fundo?: string | undefined; cor: string; rodape: string };

const FORMATOS = {
  story: { label: "Story/Status", w: 1080, h: 1920 },
  feed: { label: "Feed quadrado", w: 1080, h: 1080 },
  paisagem: { label: "Paisagem", w: 1920, h: 1080 },
} as const;
type Formato = keyof typeof FORMATOS;

const CFG_KEY = "banner-config";
const jogosKey = (d: string) => `banner-jogos-${d}`;

function load<T>(k: string, fb: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb; } catch { return fb; }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast.error("Armazenamento cheio. Use imagens menores."); }
}

function lerImagem(file: File, max: number): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const ctx = c.getContext("2d");
        if (!ctx) { rej(new Error("Canvas indisponível")); return; }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        res(file.type === "image/jpeg" ? c.toDataURL("image/jpeg", 0.85) : c.toDataURL("image/png"));
      };
      img.onerror = rej;
      img.src = String(r.result);
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function carregar(src?: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 800) {
  let s = size;
  do { ctx.font = `${weight} ${s}px Manrope, sans-serif`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 10);
}

async function desenhar(canvas: HTMLCanvasElement, fmt: Formato, data: string, cfg: Config, jogos: Jogo[]) {
  const { w, h } = FORMATOS[fmt];
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const [fundo, logo, ...escudos] = await Promise.all([
    carregar(cfg.fundo), carregar(cfg.logo),
    ...jogos.flatMap((j) => [carregar(j.escudoCasa), carregar(j.escudoVisitante)]),
  ]);
  const cor = cfg.cor || "#16a34a";

  const W = (s: number) => Math.round(s);
  const temFundo = !!fundo;
  // fundo
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#0a1526"); g.addColorStop(1, "#03060c");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (fundo) {
    const s = Math.max(w / fundo.width, h / fundo.height);
    ctx.drawImage(fundo, (w - fundo.width * s) / 2, (h - fundo.height * s) / 2, fundo.width * s, fundo.height * s);
    const ov = ctx.createLinearGradient(0, 0, w, 0);
    ov.addColorStop(0, "rgba(3,6,12,0.15)"); ov.addColorStop(0.45, "rgba(3,6,12,0.55)"); ov.addColorStop(1, "rgba(3,6,12,0.85)");
    ctx.fillStyle = ov; ctx.fillRect(0, 0, w, h);
  }
  const vg = ctx.createLinearGradient(0, h * 0.75, 0, h);
  vg.addColorStop(0, "rgba(3,6,12,0)"); vg.addColorStop(1, "rgba(3,6,12,0.9)");
  ctx.fillStyle = vg; ctx.fillRect(0, h * 0.75, w, h * 0.25);

  const pad = Math.round(Math.min(w, h) * 0.04);
  const colX = temFundo && fmt !== "feed" ? w * (fmt === "paisagem" ? 0.36 : 0.42) : pad;
  const colR = w - pad;
  const colWAll = colR - colX;
  const ccx = colX + colWAll / 2;
  let y = pad;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";

  // logo
  if (logo) {
    const lh = Math.min(h * 0.07, 140);
    const lw = Math.min((logo.width / logo.height) * lh, colWAll * 0.7);
    ctx.drawImage(logo, ccx - lw / 2, y, lw, (logo.height / logo.width) * lw);
    y += lh + pad * 0.4;
  }

  // bloco de data
  const [, mm = "", dd = ""] = data.split("-");
  const dias = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
  const dia = dias[new Date(data + "T12:00:00").getDay()] ?? "";
  const bh = Math.min(h * 0.075, colWAll * 0.2);
  const bw = Math.min(colWAll * 0.75, bh * 4.2);
  const bx = ccx - bw / 2;
  ctx.fillStyle = cor;
  ctx.beginPath(); ctx.roundRect(bx + bh * 0.6, y + bh * 0.08, bw - bh * 0.6, bh * 0.84, bh * 0.42); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = bh * 0.2;
  ctx.beginPath(); ctx.roundRect(bx, y, bh * 1.05, bh, bh * 0.15); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0a0a0a"; ctx.font = `900 ${W(bh * 0.4)}px Manrope, sans-serif`;
  ctx.fillText(dd, bx + bh * 0.525, y + bh * 0.3); ctx.fillText(mm, bx + bh * 0.525, y + bh * 0.72);
  ctx.fillStyle = "#ffffff";
  const titulo = (cfg.titulo && cfg.titulo !== "JOGOS DE HOJE" ? cfg.titulo : dia).toUpperCase();
  fit(ctx, titulo, bw - bh * 1.4, bh * 0.55, 900);
  ctx.fillText(titulo, bx + bh * 1.05 + (bw - bh * 1.05) / 2, y + bh * 0.52);
  y += bh + pad * 0.7;

  // rodapé
  const fSize = Math.round(Math.min(w, h) * 0.03);
  const footerH = cfg.rodape ? fSize * 2.6 : 0;
  const bottom = h - pad - footerH;
  if (cfg.rodape) {
    ctx.font = `800 ${fSize}px Manrope, sans-serif`;
    const tw = Math.min(ctx.measureText(cfg.rodape.toUpperCase()).width + fSize * 3, w - pad * 2);
    const fy = h - pad - fSize * 2;
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.strokeStyle = cor; ctx.lineWidth = Math.max(2, fSize * 0.1);
    ctx.beginPath(); ctx.roundRect(w / 2 - tw / 2, fy, tw, fSize * 2, fSize); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffffff"; fit(ctx, cfg.rodape.toUpperCase(), tw - fSize * 2, fSize, 800);
    ctx.fillText(cfg.rodape.toUpperCase(), w / 2, fy + fSize);
  }

  // jogos
  const n = jogos.length;
  if (!n) {
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = `600 ${fSize}px Manrope, sans-serif`;
    ctx.fillText("Adicione jogos no editor", ccx, (y + bottom) / 2);
    return;
  }
  const cols = (fmt === "paisagem" && n > 4) || (fmt === "feed" && n > 5) ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const gap = Math.round(pad * 0.45);
  const colW = (colWAll - gap * (cols - 1)) / cols;
  const rowH = Math.min((bottom - y - gap * (rows - 1)) / rows, colW * 0.36, h * 0.15);
  const startY = y + Math.max(0, (bottom - y - (rowH * rows + gap * (rows - 1))) / 2);

  jogos.forEach((j, i) => {
    const c = cols === 2 ? i % 2 : 0;
    const r = cols === 2 ? Math.floor(i / 2) : i;
    const x = colX + c * (colW + gap);
    const ry = startY + r * (rowH + gap);
    const cardY = ry + rowH * 0.32;
    const cardH = rowH * 0.68;
    // card
    const cg = ctx.createLinearGradient(x, 0, x + colW, 0);
    cg.addColorStop(0, cor); cg.addColorStop(1, "rgba(255,255,255,0.05)");
    ctx.globalAlpha = 0.9; ctx.fillStyle = cor;
    ctx.beginPath(); ctx.roundRect(x, cardY, colW, cardH, cardH * 0.25); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.fillStyle = "#000000";
    ctx.beginPath(); ctx.roundRect(x, cardY, colW, cardH, cardH * 0.25); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = cg; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.roundRect(x, cardY, colW, cardH, cardH * 0.25); ctx.fill();
    ctx.globalAlpha = 1;

    // escudos
    const box = rowH * 0.66;
    const vsW = box * 0.35;
    const b1 = x + colW * 0.5 - vsW / 2 - box;
    const b2 = x + colW * 0.5 + vsW / 2;
    const eC = escudos[i * 2], eV = escudos[i * 2 + 1];
    const sigla = (nome: string) => nome.trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 3).toUpperCase();
    ([[b1, eC, j.casa], [b2, eV, j.visitante]] as [number, HTMLImageElement | null, string][]).forEach(([bxN, im, nome]) => {
      ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = box * 0.12; ctx.shadowOffsetY = box * 0.04;
      ctx.fillStyle = "#f4f6f8";
      ctx.beginPath(); ctx.roundRect(bxN, ry, box, box, box * 0.18); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      if (im) {
        const m = box * 0.72; const s = Math.min(m / im.width, m / im.height);
        ctx.drawImage(im, bxN + (box - im.width * s) / 2, ry + (box - im.height * s) / 2, im.width * s, im.height * s);
      } else if (nome.trim()) {
        ctx.fillStyle = "#0a1526";
        fit(ctx, sigla(nome), box * 0.8, box * 0.34, 900);
        ctx.fillText(sigla(nome), bxN + box / 2, ry + box / 2);
      }
    });
    ctx.fillStyle = "#ffffff"; ctx.font = `italic 900 ${W(box * 0.28)}px Manrope, sans-serif`;
    ctx.fillText("VS", x + colW / 2, ry + box * 0.55);

    // esquerda: campeonato + horário
    const leftW = b1 - x - rowH * 0.12;
    const lcx = x + leftW / 2 + rowH * 0.06;
    const midY = cardY + cardH * 0.38;
    ctx.fillStyle = "#ffffff";
    fit(ctx, (j.campeonato || "").toUpperCase(), leftW * 0.92, rowH * 0.1, 800);
    ctx.fillText((j.campeonato || "").toUpperCase(), lcx, midY - rowH * 0.12);
    fit(ctx, j.horario || "--:--", leftW * 0.92, rowH * 0.2, 900);
    ctx.fillText(j.horario || "--:--", lcx, midY + rowH * 0.06);

    // direita: canal
    const rightX = b2 + box + rowH * 0.06;
    const rightW = x + colW - rightX - rowH * 0.06;
    if (j.canal) {
      fit(ctx, j.canal.toUpperCase(), rightW * 0.95, rowH * 0.15, 900);
      ctx.font = ctx.font.replace(/^/, "italic ");
      ctx.fillText(j.canal.toUpperCase(), rightX + rightW / 2, midY);
    }

    // confronto
    const conf = `${j.casa || ""} X ${j.visitante || ""}`.toUpperCase();
    fit(ctx, conf, colW * 0.8, rowH * 0.12, 800);
    ctx.fillText(conf, x + colW / 2, cardY + cardH * 0.82);
  });
}

const vazio: Jogo = { id: "", campeonato: "", casa: "", visitante: "", horario: "", canal: "" };

function Banner() {
  const [data, setData] = useState(todayISO());
  const [cfg, setCfg] = useState<Config>({ titulo: "JOGOS DE HOJE", cor: "#16a34a", rodape: "" });
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [pronto, setPronto] = useState(false);
  const [fmt, setFmt] = useState<Formato>("story");
  const [edit, setEdit] = useState<Jogo | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { setCfg((c) => load(CFG_KEY, c)); setPronto(true); }, []);
  useEffect(() => { if (pronto) setJogos(load<Jogo[]>(jogosKey(data), [])); }, [data, pronto]);
  useEffect(() => { if (pronto) save(CFG_KEY, cfg); }, [cfg, pronto]);

  function salvarJogos(lista: Jogo[]) { setJogos(lista); save(jogosKey(data), lista); }

  useEffect(() => {
    if (!canvasRef.current) return;
    let ativo = true;
    const c = document.createElement("canvas");
    document.fonts?.ready.then(() => desenhar(c, fmt, data, cfg, jogos)).then(() => {
      const t = canvasRef.current;
      if (!ativo || !t) return;
      t.width = c.width; t.height = c.height; t.getContext("2d")?.drawImage(c, 0, 0);
    });
    return () => { ativo = false; };
  }, [fmt, data, cfg, jogos]);

  function duplicarOntem() {
    const ontem = load<Jogo[]>(jogosKey(addDays(data, -1)), []);
    if (!ontem.length) { toast.error("Nenhuma lista salva para ontem."); return; }
    salvarJogos(ontem.map((j) => ({ ...j, id: crypto.randomUUID() })));
    toast.success("Lista de ontem copiada.");
  }

  function importarJogos(incoming: FootballGame[], selectedDate: string) {
    const previous = selectedDate === data ? jogos : load<Jogo[]>(jogosKey(selectedDate), []);
    const merged = mergeGames<Jogo>(previous, incoming.map((game) => ({ ...game, id: crypto.randomUUID() })));
    save(jogosKey(selectedDate), merged.games);
    if (selectedDate === data) setJogos(merged.games);
    if (merged.omitted) toast.warning(`O banner comporta 10 jogos. ${merged.omitted} jogo(s) não foram incluídos.`);
    else toast.success("Jogos carregados.");
  }

  function baixar() {
    canvasRef.current?.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `banner-${fmt}-${data}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  }

  async function copiar() {
    try {
      const blob = await new Promise<Blob>((res, rej) => canvasRef.current?.toBlob((b) => (b ? res(b) : rej()), "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Imagem copiada.");
    } catch { toast.error("Seu navegador não permitiu copiar. Use Baixar PNG."); }
  }

  async function upload(file: File | undefined, max: number, cb: (v: string) => void) {
    if (!file) return;
    try { cb(await lerImagem(file, max)); } catch { toast.error("Não foi possível ler a imagem."); }
  }

  function salvarJogo() {
    if (!edit) return;
    if (!edit.casa || !edit.visitante) { toast.error("Preencha os dois times."); return; }
    if (edit.id) salvarJogos(jogos.map((j) => (j.id === edit.id ? edit : j)));
    else salvarJogos([...jogos, { ...edit, id: crypto.randomUUID() }]);
    setEdit(null);
  }

  const ImgField = ({ label, value, onChange, max }: { label: string; value?: string | undefined; onChange: (v?: string) => void; max: number }) => (
    <Field label={label}>
      <div className="flex items-center gap-2">
        {value && <img src={value} alt="" className="h-10 w-10 rounded-md border object-contain" />}
        <Button asChild variant="outline" size="sm"><label className="cursor-pointer"><Upload /> Enviar
          <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], max, onChange)} /></label></Button>
        {value && <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}><X /></Button>}
      </div>
    </Field>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight">Gerador de Banner</h1>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4">
            <BannerFootball date={data} onDate={setData} onGames={importarJogos} />
            <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value || todayISO())} /></Field>
                <Field label="Título"><Input value={cfg.titulo} onChange={(e) => setCfg({ ...cfg, titulo: e.target.value })} /></Field>
                <Field label="Cor principal"><Input type="color" value={cfg.cor} onChange={(e) => setCfg({ ...cfg, cor: e.target.value })} className="h-10 p-1" /></Field>
                <Field label="Rodapé"><Input value={cfg.rodape} placeholder="@suamarca • (11) 99999-9999" onChange={(e) => setCfg({ ...cfg, rodape: e.target.value })} /></Field>
                <ImgField label="Logo" value={cfg.logo} max={600} onChange={(v) => setCfg({ ...cfg, logo: v })} />
                <ImgField label="Imagem de fundo" value={cfg.fundo} max={1920} onChange={(v) => setCfg({ ...cfg, fundo: v })} />
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">Jogos ({jogos.length}/10)</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={duplicarOntem}><CalendarClock /> Duplicar de ontem</Button>
                  <Button size="sm" disabled={jogos.length >= 10} onClick={() => setEdit({ ...vazio })}><Plus /> Adicionar</Button>
                </div>
              </div>
              {!jogos.length && <p className="text-sm text-muted-foreground">Nenhum jogo nesta data.</p>}
              {jogos.map((j) => (
                <div key={j.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {j.escudoCasa && <img src={j.escudoCasa} alt="" className="h-6 w-6 shrink-0 object-contain" />}
                      <span className="truncate">{j.casa}</span>
                      <span className="shrink-0 text-muted-foreground">x</span>
                      {j.escudoVisitante && <img src={j.escudoVisitante} alt="" className="h-6 w-6 shrink-0 object-contain" />}
                      <span className="truncate">{j.visitante}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{[j.campeonato, j.horario, j.canal].filter(Boolean).join(" • ")}</p>
                  </div>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => setEdit(j)}><Pencil /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => salvarJogos(jogos.filter((x) => x.id !== j.id))}><Trash2 /></Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 lg:sticky lg:top-20 lg:self-start">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FORMATOS) as Formato[]).map((k) => (
                <Button key={k} size="sm" variant={fmt === k ? "default" : "outline"} onClick={() => setFmt(k)}>
                  {FORMATOS[k].label}
                </Button>
              ))}
            </div>
            <div className="flex justify-center rounded-2xl border bg-card p-3 shadow-soft">
              <canvas ref={canvasRef} className="h-auto max-h-[70vh] w-auto max-w-full rounded-lg" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={baixar}><Download /> Baixar PNG</Button>
              <Button className="flex-1" variant="outline" onClick={copiar}><Copy /> Copiar imagem</Button>
            </div>
          </section>
        </div>
      </main>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Editar jogo" : "Adicionar jogo"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Campeonato" className="sm:col-span-2"><Input value={edit.campeonato} onChange={(e) => setEdit({ ...edit, campeonato: e.target.value })} /></Field>
              <Field label="Time da casa"><Input value={edit.casa} onChange={(e) => setEdit({ ...edit, casa: e.target.value })} /></Field>
              <Field label="Time visitante"><Input value={edit.visitante} onChange={(e) => setEdit({ ...edit, visitante: e.target.value })} /></Field>
              <Field label="Horário"><Input type="time" value={edit.horario} onChange={(e) => setEdit({ ...edit, horario: e.target.value })} /></Field>
              <Field label="Canal"><Input value={edit.canal} onChange={(e) => setEdit({ ...edit, canal: e.target.value })} /></Field>
              <ImgField label="Escudo casa (opcional)" value={edit.escudoCasa} max={256} onChange={(v) => setEdit((x) => x && { ...x, escudoCasa: v })} />
              <ImgField label="Escudo visitante (opcional)" value={edit.escudoVisitante} max={256} onChange={(v) => setEdit((x) => x && { ...x, escudoVisitante: v })} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={salvarJogo}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
