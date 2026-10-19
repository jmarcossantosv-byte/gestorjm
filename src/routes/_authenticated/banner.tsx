import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Download, Copy, CalendarClock, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AppHeader, Field, addDays, fmtDate, todayISO } from "@/components/painel-shared";

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

type Jogo = { id: string; campeonato: string; casa: string; visitante: string; horario: string; canal: string; escudoCasa?: string | undefined; escudoVisitante?: string | undefined };
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
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
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
  const ctx = canvas.getContext("2d")!;
  const [fundo, logo, ...escudos] = await Promise.all([
    carregar(cfg.fundo), carregar(cfg.logo),
    ...jogos.flatMap((j) => [carregar(j.escudoCasa), carregar(j.escudoVisitante)]),
  ]);
  const cor = cfg.cor || "#16a34a";

  // fundo
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#0b1220"); g.addColorStop(1, "#05070d");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (fundo) {
    const s = Math.max(w / fundo.width, h / fundo.height);
    ctx.drawImage(fundo, (w - fundo.width * s) / 2, (h - fundo.height * s) / 2, fundo.width * s, fundo.height * s);
    ctx.fillStyle = "rgba(5,7,13,0.72)"; ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = cor; ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.55, 0); ctx.lineTo(0, h * 0.35); ctx.fill();
  ctx.globalAlpha = 1;

  const pad = Math.round(Math.min(w, h) * 0.05);
  let y = pad;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";

  // logo
  if (logo) {
    const lh = Math.min(h * 0.08, 150);
    const lw = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, (w - lw) / 2, y, lw, lh);
    y += lh + pad * 0.4;
  }
  // título
  const tSize = Math.round(Math.min(w, h) * 0.085);
  fit(ctx, (cfg.titulo || "JOGOS DE HOJE").toUpperCase(), w - pad * 2, tSize, 900);
  ctx.fillStyle = "#ffffff";
  ctx.fillText((cfg.titulo || "JOGOS DE HOJE").toUpperCase(), w / 2, y + tSize / 2);
  y += tSize + pad * 0.3;
  // data
  const dSize = Math.round(tSize * 0.42);
  const dTxt = fmtDate(data);
  ctx.font = `800 ${dSize}px Manrope, sans-serif`;
  const dw = ctx.measureText(dTxt).width + dSize * 1.6;
  ctx.fillStyle = cor;
  ctx.beginPath(); ctx.roundRect((w - dw) / 2, y, dw, dSize * 1.6, dSize * 0.8); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.fillText(dTxt, w / 2, y + dSize * 0.8);
  y += dSize * 1.6 + pad * 0.6;

  // rodapé
  const fSize = Math.round(Math.min(w, h) * 0.032);
  const footerH = cfg.rodape ? fSize * 2.2 : 0;
  const bottom = h - pad - footerH;
  if (cfg.rodape) {
    ctx.fillStyle = "#ffffff"; ctx.font = `700 ${fSize}px Manrope, sans-serif`;
    ctx.fillText(cfg.rodape, w / 2, h - pad - fSize * 0.6);
  }

  // jogos
  const n = jogos.length;
  if (!n) {
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = `600 ${fSize}px Manrope, sans-serif`;
    ctx.fillText("Adicione jogos no editor", w / 2, (y + bottom) / 2);
    return;
  }
  const cols = (fmt === "paisagem" && n > 4) || (fmt === "feed" && n > 6) ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const gap = Math.round(pad * 0.3);
  const colW = (w - pad * 2 - gap * (cols - 1)) / cols;
  const rowH = Math.min((bottom - y - gap * (rows - 1)) / rows, h * 0.16);
  const startY = y + Math.max(0, (bottom - y - (rowH * rows + gap * (rows - 1))) / 2);

  jogos.forEach((j, i) => {
    const c = cols === 2 ? i % 2 : 0;
    const r = cols === 2 ? Math.floor(i / 2) : i;
    const x = pad + c * (colW + gap);
    const ry = startY + r * (rowH + gap);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath(); ctx.roundRect(x, ry, colW, rowH, rowH * 0.15); ctx.fill();
    ctx.fillStyle = cor; ctx.fillRect(x, ry + rowH * 0.15, Math.max(6, rowH * 0.05), rowH * 0.7);

    const base = rowH;
    const small = base * 0.17;
    const nameS = base * 0.24;
    const cx = x + colW / 2;
    // campeonato
    ctx.fillStyle = cor; fit(ctx, (j.campeonato || "").toUpperCase(), colW * 0.9, small, 800);
    ctx.fillText((j.campeonato || "").toUpperCase(), cx, ry + base * 0.16);
    // horário centro
    const tw = base * 0.9;
    ctx.fillStyle = "#ffffff"; fit(ctx, j.horario || "--:--", tw, base * 0.3, 900);
    ctx.fillText(j.horario || "--:--", cx, ry + base * 0.52);
    // escudos e nomes
    const crest = base * 0.38;
    const side = (colW - tw) / 2 - crest - base * 0.25;
    const eC = escudos[i * 2], eV = escudos[i * 2 + 1];
    const cyRow = ry + base * 0.52;
    const lx = x + base * 0.2;
    if (eC) ctx.drawImage(eC, lx, cyRow - crest / 2, crest, crest);
    const rx = x + colW - base * 0.2 - crest;
    if (eV) ctx.drawImage(eV, rx, cyRow - crest / 2, crest, crest);
    ctx.fillStyle = "#ffffff";
    fit(ctx, j.casa, side, nameS, 800);
    ctx.textAlign = "right"; ctx.fillText(j.casa, cx - tw / 2, cyRow);
    fit(ctx, j.visitante, side, nameS, 800);
    ctx.textAlign = "left"; ctx.fillText(j.visitante, cx + tw / 2, cyRow);
    ctx.textAlign = "center";
    // canal
    if (j.canal) {
      ctx.fillStyle = "rgba(255,255,255,0.75)"; fit(ctx, "📺 " + j.canal, colW * 0.9, small, 700);
      ctx.fillText("📺 " + j.canal, cx, ry + base * 0.86);
    }
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
      t.width = c.width; t.height = c.height; t.getContext("2d")!.drawImage(c, 0, 0);
    });
    return () => { ativo = false; };
  }, [fmt, data, cfg, jogos]);

  function duplicarOntem() {
    const ontem = load<Jogo[]>(jogosKey(addDays(data, -1)), []);
    if (!ontem.length) { toast.error("Nenhuma lista salva para ontem."); return; }
    salvarJogos(ontem.map((j) => ({ ...j, id: crypto.randomUUID() })));
    toast.success("Lista de ontem copiada.");
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
                    <p className="truncate font-semibold">{j.casa} x {j.visitante}</p>
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
