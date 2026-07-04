// Client-side generator for shareable SGI progress cards (Instagram / Facebook
// Stories, 1080×1920). Only ever called for POSITIVE trends — negative trends
// are never given an active share CTA (they only surface in the dashboard).

import { drawSgiLogoTile } from "./canvasUtils";

export interface ProgressStoryInput {
  username: string;
  conversationTitle: string;
  deltaPct: number;
  highlightMetricLabel: string;
  highlightDeltaPct: number;
}

const SITE_URL = "sgindex.work";

const formatSigned = (n: number): string => (n > 0 ? "+" : "") + n.toFixed(1);

const COLORS = {
  text: "#eeeeff",
  purple: "#7c6bff",
  purpleLight: "#a89fff",
  teal: "#06d6a0",
  tealLight: "#4eeec0",
  gold: "#ffd166",
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function generateProgressStoryCard(data: ProgressStoryInput): HTMLCanvasElement {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d0c1f");
  bg.addColorStop(0.5, "#12103a");
  bg.addColorStop(1, "#0a0e20");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(6,214,160,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 72) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 72) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  glow(ctx, -80, 400, 680, "6,214,160", 0.13);
  glow(ctx, W + 80, 1200, 680, "124,107,255", 0.09);
  glow(ctx, W / 2, 1500, 480, "255,209,102", 0.05);

  ctx.textAlign = "center";

  ctx.font = "bold 32px 'Space Grotesk', 'Arial', sans-serif";
  ctx.fillStyle = "rgba(144,144,184,0.5)";
  ctx.fillText("SEMANTIC GROWTH INDEX", W / 2, 100);

  const gTitle = ctx.createLinearGradient(W / 2 - 90, 0, W / 2 + 90, 0);
  gTitle.addColorStop(0, COLORS.purpleLight);
  gTitle.addColorStop(1, COLORS.teal);
  ctx.font = "900 96px 'Space Grotesk', 'Arial', sans-serif";
  ctx.fillStyle = gTitle;
  ctx.fillText("SGI", W / 2, 196);

  ctx.font = "bold 38px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(6,214,160,0.9)";
  ctx.fillText("\ud83d\udcc8  PROGRESS CARD", W / 2, 256);

  const divGrad = ctx.createLinearGradient(100, 0, W - 100, 0);
  divGrad.addColorStop(0, "transparent");
  divGrad.addColorStop(0.2, "rgba(6,214,160,0.5)");
  divGrad.addColorStop(0.8, "rgba(124,107,255,0.5)");
  divGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, 296); ctx.lineTo(W - 80, 296); ctx.stroke();

  ctx.font = "bold 40px 'Arial', sans-serif";
  ctx.fillStyle = "#eeeeff";
  const userLines = wrapText(ctx, `@${data.username}`, W - 160).slice(0, 1);
  ctx.fillText(userLines[0] ?? "", W / 2, 360);

  const titleLines = wrapText(ctx, `\u201c${data.conversationTitle}\u201d`, W - 200).slice(0, 2);
  ctx.font = "500 32px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(200,200,224,0.7)";
  titleLines.forEach((line, i) => ctx.fillText(line, W / 2, 418 + i * 42));

  // ── Big trend panel ─────────────────────────────────────────────────────────
  const panelY = 418 + titleLines.length * 42 + 60;
  const panelH = 620;
  roundRect(ctx, 90, panelY, W - 180, panelH, 32);
  const panelGrad = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
  panelGrad.addColorStop(0, "rgba(6,214,160,0.14)");
  panelGrad.addColorStop(1, "rgba(6,214,160,0.03)");
  ctx.fillStyle = panelGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(6,214,160,0.5)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.font = "bold 30px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(168,255,220,0.75)";
  ctx.fillText("TREND ULTIMI 5 MESSAGGI", W / 2, panelY + 90);

  const trendGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  trendGrad.addColorStop(0, COLORS.teal);
  trendGrad.addColorStop(1, COLORS.tealLight);
  ctx.font = "900 200px 'Space Grotesk', 'Arial', sans-serif";
  ctx.fillStyle = trendGrad;
  ctx.fillText(`${formatSigned(data.deltaPct)}%`, W / 2, panelY + 320);

  ctx.font = "600 34px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(238,238,255,0.85)";
  const highlightText = `${data.highlightMetricLabel}  ${formatSigned(data.highlightDeltaPct)}%`;
  const hLines = wrapText(ctx, highlightText, W - 260);
  hLines.forEach((line, i) => ctx.fillText(line, W / 2, panelY + 400 + i * 46));

  ctx.font = "500 26px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(144,144,184,0.6)";
  ctx.fillText("Early \u2192 Late (stessa conversazione)", W / 2, panelY + 400 + hLines.length * 46 + 60);

  // ── Footer ──────────────────────────────────────────────────────────────────
  const footerY = panelY + panelH + 90;
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(80, footerY); ctx.lineTo(W - 80, footerY); ctx.stroke();

  const logoSize = 56;
  drawSgiLogoTile(ctx, W / 2, footerY + 56, logoSize);

  const urlGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  urlGrad.addColorStop(0, COLORS.teal);
  urlGrad.addColorStop(1, COLORS.purple);
  ctx.font = "bold 46px 'Arial', sans-serif";
  ctx.fillStyle = urlGrad;
  ctx.fillText(SITE_URL, W / 2, footerY + 132);

  ctx.font = "500 28px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(144,144,184,0.4)";
  ctx.fillText("Misura la crescita del tuo pensiero", W / 2, footerY + 172);

  return canvas;
}

export type ShareResult = "shared" | "downloaded" | "cancelled";

export async function shareOrDownloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  shareMeta?: { title?: string; text?: string },
): Promise<ShareResult> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("toBlob failed");

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };

  try {
    const file = new File([blob], filename, { type: "image/png" });
    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: shareMeta?.title, text: shareMeta?.text });
      return "shared";
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
