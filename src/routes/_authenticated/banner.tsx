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
import JSZip from "jszip";
import { bannerWeekday, canAddGame, downloadBanner, paginateGames } from "@/lib/banner-pages";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  return new Promise((res) => {
    const i = new Image();
    if (/^https?:/.test(src)) i.crossOrigin = "anonymous";
    i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
  });
}

const FONT = "Manrope, sans-serif";

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 800, family = FONT) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 1; } while (ctx.measureText(text).width > maxW && s > 8);
}

// Quebra o texto em até maxLines linhas, reduzindo a fonte até caber em largura e altura.
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, size: number, maxLines: number, weight = 800) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  for (let s = size; s > 8; s -= 1) {
    ctx.font = `${weight} ${s}px ${FONT}`;
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    const lh = s * 1.12;
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW) && lines.length * lh <= maxH) return { lines, size: s, lh };
  }
  ctx.font = `${weight} 8px ${FONT}`;
  return { lines: [text], size: 8, lh: 9 };
}

function drawLines(ctx: CanvasRenderingContext2D, r: { lines: string[]; lh: number }, cx: number, cy: number) {
  const top = cy - (r.lines.length * r.lh) / 2 + r.lh / 2;
  r.lines.forEach((l, i) => ctx.fillText(l, cx, top + i * r.lh));
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

// ===== Logos de canais (desenhadas em vetor) =====
type Box = { x: number; y: number; w: number; h: number };
function wordmark(ctx: CanvasRenderingContext2D, b: Box, text: string, color: string, weight = 900, italic = false, family = FONT) {
  ctx.fillStyle = color;
  fit(ctx, text, b.w, b.h * 0.8, weight, family);
  if (italic) ctx.font = "italic " + ctx.font;
  ctx.fillText(text, b.x + b.w / 2, b.y + b.h / 2);
}
function badge(ctx: CanvasRenderingContext2D, b: Box, text: string, bg: string, fg: string, italic = false) {
  ctx.font = `900 ${b.h * 0.5}px ${FONT}`;
  fit(ctx, text, b.w * 0.84, b.h * 0.5, 900);
  const tw = Math.min(b.w, ctx.measureText(text).width + b.h * 0.6);
  const bh = b.h * 0.72;
  ctx.fillStyle = bg; rr(ctx, b.x + (b.w - tw) / 2, b.y + (b.h - bh) / 2, tw, bh, bh * 0.18); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = Math.max(1.5, bh * 0.05); ctx.stroke();
  ctx.fillStyle = fg; if (italic) ctx.font = "italic " + ctx.font;
  ctx.fillText(text, b.x + b.w / 2, b.y + b.h / 2);
}

const CANAIS: { re: RegExp; draw: (ctx: CanvasRenderingContext2D, b: Box) => void }[] = [
  { re: /amazon|prime\s*video/i, draw: (ctx, b) => {
    wordmark(ctx, { x: b.x, y: b.y, w: b.w, h: b.h * 0.42 }, "amazon", "#ffffff", 800);
    wordmark(ctx, { x: b.x, y: b.y + b.h * 0.36, w: b.w * 0.8, h: b.h * 0.42 }, "prime", "#1ea7fd", 800);
    ctx.strokeStyle = "#1ea7fd"; ctx.lineWidth = b.h * 0.05; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(b.x + b.w * 0.25, b.y + b.h * 0.86);
    ctx.quadraticCurveTo(b.x + b.w * 0.5, b.y + b.h * 0.98, b.x + b.w * 0.75, b.y + b.h * 0.84); ctx.stroke();
  } },
  { re: /premiere/i, draw: (ctx, b) => badge(ctx, { x: b.x, y: b.y + b.h * 0.2, w: b.w, h: b.h * 0.6 }, "PREMIERE", "#0b8a3e", "#ffffff") },
  { re: /disney/i, draw: (ctx, b) => {
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = b.h * 0.035;
    ctx.beginPath(); ctx.ellipse(b.x + b.w * 0.55, b.y + b.h * 0.62, b.w * 0.42, b.h * 0.42, 0, Math.PI * 1.08, Math.PI * 1.9); ctx.stroke();
    wordmark(ctx, { x: b.x, y: b.y + b.h * 0.25, w: b.w, h: b.h * 0.6 }, "Disney+", "#ffffff", 700, true, "Georgia, serif");
  } },
  { re: /youtube/i, draw: (ctx, b) => {
    const ih = b.h * 0.42, iw = ih * 1.4, iy = b.y + (b.h - ih) / 2;
    ctx.font = `800 ${b.h * 0.42}px ${FONT}`; fit(ctx, "YouTube", b.w - iw * 1.15, b.h * 0.42, 800);
    const tw = ctx.measureText("YouTube").width; const sx = b.x + (b.w - (iw * 1.15 + tw)) / 2;
    ctx.fillStyle = "#ff0000"; rr(ctx, sx, iy, iw, ih, ih * 0.25); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(sx + iw * 0.4, iy + ih * 0.28); ctx.lineTo(sx + iw * 0.68, iy + ih / 2); ctx.lineTo(sx + iw * 0.4, iy + ih * 0.72); ctx.fill();
    ctx.textAlign = "left"; ctx.fillText("YouTube", sx + iw * 1.15, b.y + b.h / 2); ctx.textAlign = "center";
  } },
  { re: /cazé|caze/i, draw: (ctx, b) => badge(ctx, b, "CAZÉTV", "#111111", "#ffd400", true) },
  { re: /sportv/i, draw: (ctx, b) => badge(ctx, b, "sportv", "#00a651", "#ffffff", true) },
  { re: /ge\s*tv|getv/i, draw: (ctx, b) => badge(ctx, b, "getv", "#0f9d58", "#ffffff") },
  { re: /globoplay/i, draw: (ctx, b) => wordmark(ctx, b, "globoplay", "#ff3d3d", 800) },
  { re: /globo/i, draw: (ctx, b) => badge(ctx, b, "globo", "#0069ff", "#ffffff") },
  { re: /espn/i, draw: (ctx, b) => wordmark(ctx, b, "ESPN", "#ff1a1a", 900, true) },
  { re: /hbo|\bmax\b/i, draw: (ctx, b) => wordmark(ctx, b, "max", "#2f6bff", 900) },
  { re: /tnt/i, draw: (ctx, b) => badge(ctx, b, "TNT SPORTS", "#000000", "#ffffff") },
  { re: /paramount/i, draw: (ctx, b) => wordmark(ctx, b, "Paramount+", "#4aa3ff", 800) },
  { re: /star\s*\+|star plus/i, draw: (ctx, b) => wordmark(ctx, b, "star+", "#ffffff", 800, true) },
  { re: /dazn/i, draw: (ctx, b) => badge(ctx, b, "DAZN", "#0c0c0c", "#ffffff") },
  { re: /netflix/i, draw: (ctx, b) => wordmark(ctx, b, "NETFLIX", "#e50914", 900) },
  { re: /\bband\b|bandsports/i, draw: (ctx, b) => badge(ctx, b, "BAND", "#e4002b", "#ffffff") },
  { re: /record/i, draw: (ctx, b) => badge(ctx, b, "RECORD", "#1d4ed8", "#ffffff") },
  { re: /\bsbt\b/i, draw: (ctx, b) => badge(ctx, b, "SBT", "#ffffff", "#1d4ed8") },
  { re: /apple/i, draw: (ctx, b) => wordmark(ctx, b, "Apple TV", "#ffffff", 700) },
];

function desenharCanal(ctx: CanvasRenderingContext2D, canal: string, x: number, y: number, w: number, h: number) {
  const partes = canal.split(/\s*[,/|]\s*|\s+e\s+/i).map((p) => p.trim()).filter(Boolean);
  let logo: (typeof CANAIS)[number] | undefined; let usada = -1;
  partes.some((p, i) => { const c = CANAIS.find((k) => k.re.test(p)); if (c) { logo = c; usada = i; return true; } return false; });
  const resto = partes.filter((_, i) => i !== usada).join(" • ").toUpperCase();
  ctx.fillStyle = "#ffffff";
  if (logo) {
    const lh = resto ? h * 0.5 : h * 0.62;
    logo.draw(ctx, { x, y: y + (resto ? h * 0.02 : (h - lh) / 2), w, h: lh });
    if (resto) {
      ctx.fillStyle = "#ffffff";
      drawLines(ctx, wrap(ctx, resto, w, h * 0.42, h * 0.15, 2, 800), x + w / 2, y + h * 0.76);
    }
  } else {
    drawLines(ctx, wrap(ctx, canal.toUpperCase(), w, h * 0.8, h * 0.2, 3, 900), x + w / 2, y + h / 2);
  }
}

async function desenhar(canvas: HTMLCanvasElement, fmt: Formato, data: string, cfg: Config, jogos: Jogo[], page = 0, total = 1) {
  const { w, h } = FORMATOS[fmt];
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const [fundo, logo, ...escudos] = await Promise.all([
    carregar(cfg.fundo), carregar(cfg.logo),
    ...jogos.flatMap((j) => [carregar(j.escudoCasa), carregar(j.escudoVisitante)]),
  ]);
  const cor = cfg.cor || "#9333ea";
  const U = Math.min(w, h);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";

  // ===== fundo escuro com luzes neon =====
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#070b1e"); g.addColorStop(0.5, "#0b0f2a"); g.addColorStop(1, "#05071a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (fundo) {
    const s = Math.max(w / fundo.width, h / fundo.height);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(fundo, (w - fundo.width * s) / 2, (h - fundo.height * s) / 2, fundo.width * s, fundo.height * s);
    ctx.globalAlpha = 1;
  }
  const glow = (cx: number, cy: number, r: number, c: string, a: number) => {
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, c); rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = a; ctx.fillStyle = rg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); ctx.globalAlpha = 1;
  };
  glow(w * 0.5, h * 0.45, Math.max(w, h) * 0.55, cor, 0.28);
  glow(0, h, U * 0.7, "#1e90ff", 0.35);
  glow(w, 0, U * 0.7, "#1e90ff", 0.35);
  const streak = (x1: number, y1: number, x2: number, y2: number, c: string, lw: number) => {
    const lg = ctx.createLinearGradient(x1, y1, x2, y2);
    lg.addColorStop(0, "rgba(0,0,0,0)"); lg.addColorStop(0.5, c); lg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.strokeStyle = lg; ctx.lineWidth = lw; ctx.shadowColor = c; ctx.shadowBlur = lw * 4;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.shadowBlur = 0;
  };
  for (let i = 0; i < 3; i++) {
    streak(-U * 0.1, U * (0.32 - i * 0.07), U * (0.32 - i * 0.07), -U * 0.1, i ? cor : "#4fa8ff", U * 0.006);
    streak(w - U * (0.32 - i * 0.07), h + U * 0.1, w + U * 0.1, h - U * (0.32 - i * 0.07), i ? cor : "#4fa8ff", U * 0.006);
  }

  const pad = Math.round(U * 0.03);
  let y = pad;

  // ===== logo em círculo neon =====
  const lr = Math.min(h * 0.062, w * 0.11);
  const lcx = w / 2, lcy = y + lr;
  ctx.shadowColor = cor; ctx.shadowBlur = lr * 0.5;
  ctx.fillStyle = "#0a0a14"; ctx.beginPath(); ctx.arc(lcx, lcy, lr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = cor; ctx.lineWidth = lr * 0.06; ctx.stroke(); ctx.shadowBlur = 0;
  if (logo) {
    const m = lr * 1.55, s = Math.min(m / logo.width, m / logo.height);
    ctx.drawImage(logo, lcx - (logo.width * s) / 2, lcy - (logo.height * s) / 2, logo.width * s, logo.height * s);
  } else {
    ctx.fillStyle = "#ffffff"; fit(ctx, (cfg.titulo || "JOGOS").toUpperCase(), lr * 1.6, lr * 0.4, 900);
    ctx.fillText((cfg.titulo || "JOGOS").toUpperCase(), lcx, lcy);
  }
  y += lr * 2 + pad * 0.7;

  // ===== pílula da data =====
  const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const [, mm = "1", dd = ""] = data.split("-");
  const dia = bannerWeekday(data);
  const bh = Math.min(h * 0.075, w * 0.14);
  const bw = Math.min(w * 0.82, bh * 5.4);
  const bx = (w - bw) / 2;
  const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  pg.addColorStop(0, cor); pg.addColorStop(1, "#5b21b6");
  ctx.shadowColor = cor; ctx.shadowBlur = bh * 0.35;
  ctx.fillStyle = pg; rr(ctx, bx + bh * 0.5, y + bh * 0.1, bw - bh * 0.5, bh * 0.8, bh * 0.4); ctx.fill();
  ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,200,120,0.8)"; ctx.lineWidth = bh * 0.025; ctx.stroke();
  ctx.fillStyle = "#ffffff"; ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = bh * 0.2;
  rr(ctx, bx, y, bh * 1.15, bh, bh * 0.18); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = "#0a0a0a";
  fit(ctx, dd, bh * 0.95, bh * 0.5, 900); ctx.fillText(dd, bx + bh * 0.575, y + bh * 0.32);
  const mes = meses[Number(mm) - 1] ?? "";
  fit(ctx, mes, bh * 0.95, bh * 0.36, 900); ctx.fillText(mes, bx + bh * 0.575, y + bh * 0.73);
  ctx.fillStyle = "#ffffff";
  const titulo = dia;
  fit(ctx, titulo, bw - bh * 1.6, bh * 0.52, 900);
  ctx.fillText(titulo, bx + bh * 1.15 + (bw - bh * 1.15) / 2, y + bh * 0.52);
  y += bh + pad * 0.65;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  const subtitulo = (cfg.titulo === "JOGOS DE HOJE" ? "JOGOS DO DIA" : cfg.titulo || "JOGOS DO DIA").toUpperCase();
  fit(ctx, subtitulo, w - pad * 2, U * 0.024, 700);
  ctx.fillText(subtitulo, w / 2, y);
  y += U * 0.024 + pad * 0.75;
  if (total > 1) {
    ctx.save(); ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = `700 ${U * 0.023}px ${FONT}`;
    ctx.fillText(`${page + 1}/${total}`, w - pad, h - pad * 0.5);
    ctx.restore();
  }

  // ===== rodapé com WhatsApp =====
  const fs = Math.round(U * 0.036);
  const footerH = cfg.rodape ? fs * 2.6 + pad * 0.6 : 0;
  const bottom = h - pad - footerH;
  if (cfg.rodape) {
    const txt = cfg.rodape.toUpperCase();
    const fh = fs * 2.1;
    fit(ctx, txt, w * 0.62, fs, 900);
    const tw = Math.min(ctx.measureText(txt).width + fh * 1.9, w - pad * 2);
    const fx = (w - tw) / 2, fy = h - pad - fh;
    ctx.fillStyle = "rgba(5,7,26,0.85)"; ctx.strokeStyle = cor; ctx.lineWidth = fs * 0.12;
    ctx.shadowColor = cor; ctx.shadowBlur = fs * 0.6;
    rr(ctx, fx, fy, tw, fh, fh / 2); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    const ir = fh * 0.34, icx = fx + fh * 0.62, icy = fy + fh / 2;
    ctx.fillStyle = "#25d366"; ctx.beginPath(); ctx.arc(icx, icy, ir, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(icx - ir * 0.75, icy + ir * 0.55); ctx.lineTo(icx - ir * 1.05, icy + ir * 1.05); ctx.lineTo(icx - ir * 0.35, icy + ir * 0.85); ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = ir * 0.12; ctx.beginPath(); ctx.arc(icx, icy, ir * 0.68, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#ffffff"; rr(ctx, icx - ir * 0.3, icy - ir * 0.35, ir * 0.6, ir * 0.7, ir * 0.2); ctx.fill();
    fit(ctx, txt, tw - fh * 1.5, fs, 900);
    ctx.fillText(txt, fx + fh * 1.05 + (tw - fh * 1.05) / 2 - fh * 0.1, icy);
  }

  // ===== jogos =====
  const n = jogos.length;
  if (!n) {
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = `600 ${fs}px ${FONT}`;
    ctx.fillText("Adicione jogos no editor", w / 2, (y + bottom) / 2);
    return;
  }
  const cols = fmt === "paisagem" && n > 3 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const gap = Math.round(pad * (fmt === "story" ? 1.0 : 0.4));
  const areaX = pad * 0.8, areaW = w - pad * 1.6;
  const colW = (areaW - gap * (cols - 1)) / cols;
  const cardH = Math.min((bottom - y - gap * (rows - 1)) / rows, colW * 0.25);
  const startY = y + Math.max(0, (bottom - y - (cardH * rows + gap * (rows - 1))) / 2);
  const sigla = (nome: string) => nome.trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 3).toUpperCase();

  jogos.forEach((j, i) => {
    const c = cols === 2 ? i % 2 : 0;
    const r = cols === 2 ? Math.floor(i / 2) : i;
    const x = areaX + c * (colW + gap);
    const cy = startY + r * (cardH + gap);
    const rad = cardH * 0.13;

    // card roxo com borda neon
    const cg = ctx.createLinearGradient(x, cy, x + colW, cy + cardH);
    cg.addColorStop(0, "rgba(88,28,135,0.95)"); cg.addColorStop(0.5, "rgba(46,16,101,0.92)"); cg.addColorStop(1, "rgba(88,28,135,0.95)");
    ctx.shadowColor = cor; ctx.shadowBlur = cardH * 0.12;
    ctx.fillStyle = cg; rr(ctx, x, cy, colW, cardH, rad); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.fillStyle = cor; rr(ctx, x, cy, colW, cardH, rad); ctx.fill(); ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(216,180,254,0.9)"; ctx.lineWidth = Math.max(2, cardH * 0.012); rr(ctx, x, cy, colW, cardH, rad); ctx.stroke();

    const leftW = colW * 0.26, rightW = colW * 0.22, midX = x + leftW, midW = colW - leftW - rightW;
    const ip = cardH * 0.07;

    // esquerda: campeonato + linha dourada + horário
    const lcxx = x + leftW / 2 + ip * 0.3;
    ctx.fillStyle = "#ffffff";
    const camp = wrap(ctx, (j.campeonato || "").toUpperCase(), leftW - ip * 1.4, cardH * 0.31, cardH * 0.105, 3, 800);
    drawLines(ctx, camp, lcxx, cy + cardH * 0.23);
    const lgd = ctx.createLinearGradient(x + ip, 0, x + leftW - ip * 0.4, 0);
    lgd.addColorStop(0, "rgba(251,191,36,0)"); lgd.addColorStop(0.5, "#fbbf24"); lgd.addColorStop(1, "rgba(251,191,36,0)");
    ctx.fillStyle = lgd; ctx.fillRect(x + ip, cy + cardH * 0.42, leftW - ip * 1.4, Math.max(2, cardH * 0.012));
    ctx.fillStyle = "#ffffff";
    fit(ctx, j.horario || "--:--", leftW - ip * 1.4, cardH * 0.29, 900);
    ctx.fillText(j.horario || "--:--", lcxx, cy + cardH * 0.60);

    // divisórias
    const div = (dx: number) => {
      const dg = ctx.createLinearGradient(0, cy + cardH * 0.15, 0, cy + cardH * 0.7);
      dg.addColorStop(0, "rgba(251,191,36,0)"); dg.addColorStop(0.5, "#fbbf24"); dg.addColorStop(1, "rgba(251,191,36,0)");
      ctx.fillStyle = dg; ctx.fillRect(dx, cy + cardH * 0.15, Math.max(2, cardH * 0.01), cardH * 0.55);
    };
    div(x + colW - rightW);

    // Escudos em suportes brancos, preservando a proporção de cada imagem.
    const box = Math.min(cardH * 0.58, midW / 2.7);
    const mcx = midX + midW / 2;
    const xw = box * 0.55;
    const by = cy + cardH * 0.06;
    const positions = [mcx - xw / 2 - box, mcx + xw / 2];
    positions.forEach((ex, index) => {
      const im = escudos[i * 2 + index];
      const nome = index === 0 ? j.casa : j.visitante;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = box * 0.09; ctx.shadowOffsetY = box * 0.04;
      ctx.fillStyle = "#ffffff"; rr(ctx, ex, by, box, box, box * 0.12); ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      if (im) {
        const inner = box * 0.82;
        const scale = Math.min(inner / im.width, inner / im.height);
        ctx.drawImage(im, ex + (box - im.width * scale) / 2, by + (box - im.height * scale) / 2, im.width * scale, im.height * scale);
      } else if (nome.trim()) {
        ctx.fillStyle = "#351453"; fit(ctx, sigla(nome), box * 0.72, box * 0.3, 900);
        ctx.fillText(sigla(nome), ex + box / 2, by + box / 2);
      }
      ctx.restore();
    });
    ctx.save(); ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#d8b4fe"; ctx.shadowBlur = box * 0.08;
    fit(ctx, "VS", xw * 0.9, box * 0.29, 900); ctx.font = "italic " + ctx.font;
    ctx.fillText("VS", mcx, by + box / 2); ctx.restore();
    const conf = `${j.casa || ""} X ${j.visitante || ""}`.toUpperCase();
    const confW = colW - ip * 2;
    ctx.fillStyle = "#ffffff";
    const names = wrap(ctx, conf, confW, cardH * 0.22, cardH * 0.12, 2, 900);
    drawLines(ctx, names, x + colW / 2, cy + cardH * 0.85);

    // direita: logo do canal
    if (j.canal) desenharCanal(ctx, j.canal, x + colW - rightW + ip * 0.6, cy + cardH * 0.1, rightW - ip * 1.2, cardH * 0.62);
  });
}

const vazio: Jogo = { id: "", campeonato: "", casa: "", visitante: "", horario: "", canal: "" };

function Banner() {
  const [data, setData] = useState(todayISO());
  const [cfg, setCfg] = useState<Config>({ titulo: "JOGOS DE HOJE", cor: "#9333ea", rodape: "" });
  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [pronto, setPronto] = useState(false);
  const [fmt, setFmt] = useState<Formato>("story");
  const [edit, setEdit] = useState<Jogo | null>(null);
  const [page, setPage] = useState(0);
  const [exports, setExports] = useState<{ pngs: Blob[]; all: Blob } | null>(null);
  const pages = paginateGames(jogos);
  const currentPage = Math.min(page, pages.length - 1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { setCfg((c) => load(CFG_KEY, c)); setPronto(true); }, []);
  useEffect(() => { if (pronto) setJogos(load<Jogo[]>(jogosKey(data), [])); }, [data, pronto]);
  useEffect(() => { if (pronto) save(CFG_KEY, cfg); }, [cfg, pronto]);

  function salvarJogos(lista: Jogo[]) { setJogos(lista); save(jogosKey(data), lista); }

  useEffect(() => { setPage(0); }, [data]);

  useEffect(() => {
    let ativo = true;
    setExports(null);
    async function renderPages() {
      await document.fonts.ready;
      const groups = paginateGames(jogos);
      const pngs: Blob[] = [];
      for (const [index, games] of groups.entries()) {
        const c = document.createElement("canvas");
        await desenhar(c, fmt, data, cfg, games, index, groups.length);
        if (!ativo) return;
        if (index === currentPage) {
          const t = canvasRef.current;
          if (t) { t.width = c.width; t.height = c.height; t.getContext("2d")?.drawImage(c, 0, 0); }
        }
        pngs.push(await new Promise<Blob>((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(new Error("PNG indisponível")), "image/png")));
      }
      let all = pngs[0];
      if (!all) return;
      if (pngs.length > 1) {
        const zip = new JSZip();
        pngs.forEach((blob, index) => zip.file(`banner-${fmt}-${data}-pagina-${index + 1}.png`, blob));
        all = await zip.generateAsync({ type: "blob", compression: "STORE" });
      }
      if (ativo) setExports({ pngs, all });
    }
    renderPages().catch(() => { if (ativo) toast.error("Não foi possível preparar a imagem. Tente novamente."); });
    return () => { ativo = false; };
  }, [fmt, data, cfg, jogos, currentPage]);

  function duplicarOntem() {
    const ontem = load<Jogo[]>(jogosKey(addDays(data, -1)), []);
    if (!ontem.length) { toast.error("Nenhuma lista salva para ontem."); return; }
    salvarJogos(ontem.map((j) => ({ ...j, id: crypto.randomUUID() })));
    toast.success("Lista de ontem copiada.");
  }

  function importarJogos(incoming: FootballGame[], selectedDate: string) {
    const previous = selectedDate === data ? jogos : load<Jogo[]>(jogosKey(selectedDate), []);
    const merged = mergeGames<Jogo>(previous, incoming.map((game) => ({ ...game, id: crypto.randomUUID() })), Infinity);
    save(jogosKey(selectedDate), merged.games);
    if (selectedDate === data) setJogos(merged.games);
    toast.success("Jogos carregados.");
  }

  function baixar(all = false) {
    const blob = all ? exports?.all : exports?.pngs[currentPage];
    if (!blob) return;
    const extension = all && pages.length > 1 ? "zip" : "png";
    const suffix = all && pages.length > 1 ? "todas" : `pagina-${currentPage + 1}`;
    downloadBanner(blob, `banner-${fmt}-${data}-${suffix}.${extension}`);
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
    if (!edit.id && !canAddGame(jogos.length)) { toast.error("Limite de 5 jogos por banner"); return; }
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
    <div className="min-h-screen bg-background max-sm:[&_header_nav]:gap-0 max-sm:[&_header_nav_a]:px-2">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight">Gerador de Banner</h1>
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <section className="min-w-0 space-y-4">
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
                <h2 className="font-bold">Jogos ({jogos.length})</h2>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={duplicarOntem}><CalendarClock /> Duplicar de ontem</Button>
                  <Button size="sm" disabled={!canAddGame(jogos.length)} onClick={() => setEdit({ ...vazio })}><Plus /> Adicionar jogo</Button>
                </div>
              </div>
              {!canAddGame(jogos.length) && <p role="status" className="text-sm text-muted-foreground">Limite de 5 jogos por banner</p>}
              {!jogos.length && <p className="text-sm text-muted-foreground">Nenhum jogo nesta data.</p>}
              {pages.flat().map((j) => (
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
                    <Button variant="ghost" size="icon" aria-label={`Editar ${j.casa}`} onClick={() => setEdit(j)}><Pencil /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" aria-label={`Remover ${j.casa}`} onClick={() => salvarJogos(jogos.filter((x) => x.id !== j.id))}><Trash2 /></Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="min-w-0 space-y-3 lg:sticky lg:top-20 lg:self-start">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FORMATOS) as Formato[]).map((k) => (
                <Button key={k} size="sm" variant={fmt === k ? "default" : "outline"} onClick={() => setFmt(k)}>
                  {FORMATOS[k].label}
                </Button>
              ))}
            </div>
            {pages.length > 1 && <Tabs value={String(currentPage)} onValueChange={v => setPage(Number(v))}>
              <TabsList className="h-auto max-w-full flex-wrap justify-start">
                {pages.map((_, index) => <TabsTrigger key={index} value={String(index)}>Página {index + 1}</TabsTrigger>)}
              </TabsList>
            </Tabs>}
            <div className="flex justify-center rounded-2xl border bg-card p-3 shadow-soft" aria-busy={!exports}>
              <canvas aria-label={`Prévia do banner, página ${currentPage + 1} de ${pages.length}`} ref={canvasRef} className="h-auto max-h-[70vh] w-auto max-w-full rounded-lg" />
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button className="flex-1" disabled={!exports}><Download /> {exports ? "Baixar" : "Preparando…"}</Button></DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => baixar()}>Página atual (PNG)</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => baixar(true)}>Todas as páginas ({pages.length > 1 ? "ZIP" : "PNG"})</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button className="flex-1" variant="outline" disabled={!exports} onClick={copiar}><Copy /> Copiar imagem</Button>
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
