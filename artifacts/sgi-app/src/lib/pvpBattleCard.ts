import {
  wrapText,
  drawRoundRect,
  drawGlowCircle,
  drawSgiLogoTile,
  downloadCanvas,
} from "./canvasUtils";

const SITE_URL = "sgindex.work";
const FONT = "'Space Grotesk', Arial, sans-serif";

export interface PvpCardData {
  outcome: "win" | "loss" | "tie";
  myRawScore: number;
  opponentRawScore: number;
  myUsername: string;
  opponentUsername: string;
  theme: string;
  category: string;
  vsAi: boolean;
  aiLevel: "sfidante" | "pensatore" | "maestro" | null;
}

const C_PURPLE = "#7c6bff";
const C_TEAL   = "#06d6a0";
const C_PINK   = "#f72585";
const C_GOLD   = "#ffd166";
const C_MUTED  = "rgba(144,144,184,0.65)";
const C_TEXT   = "#eeeeff";

function outcomeColor(o: PvpCardData["outcome"]) {
  if (o === "win")  return C_TEAL;
  if (o === "tie")  return C_GOLD;
  return C_PINK;
}

function outcomeLabel(o: PvpCardData["outcome"]) {
  if (o === "win")  return "VITTORIA";
  if (o === "tie")  return "PAREGGIO";
  return "SCONFITTA";
}

function gradDivider(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  const g = ctx.createLinearGradient(x1, 0, x2, 0);
  g.addColorStop(0, "transparent");
  g.addColorStop(0.25, "rgba(124,107,255,0.45)");
  g.addColorStop(0.75, "rgba(6,214,160,0.45)");
  g.addColorStop(1, "transparent");
  ctx.save();
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   "#0d0c1f");
  bg.addColorStop(0.5, "#12103a");
  bg.addColorStop(1,   "#0a0e20");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = "rgba(124,107,255,0.03)";
  ctx.lineWidth = 1;
  const grid = Math.round(W / 15);
  for (let x = 0; x < W; x += grid) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += grid) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.restore();

  drawGlowCircle(ctx, -W * 0.1, H * 0.2, W * 0.65, "rgb(124,107,255)", 0.11);
  drawGlowCircle(ctx, W * 1.1,  H * 0.6, W * 0.65, "rgb(6,214,160)",   0.08);
  drawGlowCircle(ctx, W / 2,    H * 0.5, W * 0.4,  "rgb(247,37,133)",  0.03);
}

function drawBranding(ctx: CanvasRenderingContext2D, W: number, centerY: number, logoSize: number) {
  const logoX = W / 2 - logoSize / 2 - 8;
  const logoActualCX = logoX + logoSize / 2;
  const logoActualCY = centerY;
  drawSgiLogoTile(ctx, logoActualCX, logoActualCY, logoSize);

  const textX = logoX + logoSize + 18;
  const scale = logoSize / 80;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const wm = ctx.createLinearGradient(textX, 0, textX + 260 * scale, 0);
  wm.addColorStop(0, "#a89fff");
  wm.addColorStop(1, "#06d6a0");
  ctx.font = `bold ${Math.round(32 * scale)}px ${FONT}`;
  ctx.fillStyle = wm;
  ctx.fillText("Semantic Growth", textX, centerY - 8 * scale);

  ctx.font = `500 ${Math.round(19 * scale)}px ${FONT}`;
  ctx.fillStyle = "rgba(144,144,184,0.55)";
  ctx.fillText(SITE_URL.toUpperCase(), textX, centerY + 16 * scale);

  ctx.restore();
}

function drawScorePanel(
  ctx: CanvasRenderingContext2D,
  px: number, py: number, pw: number, ph: number,
  label: string,
  score: number,
  color: string,
  rgb: string,
  isWinner: boolean,
  isAi: boolean,
  aiLevel: string | null,
) {
  drawRoundRect(ctx, px, py, pw, ph, 28);
  ctx.fillStyle = `rgba(${rgb}, 0.06)`;
  ctx.fill();
  ctx.strokeStyle = isWinner ? `rgba(${rgb}, 0.55)` : `rgba(${rgb}, 0.18)`;
  ctx.lineWidth = isWinner ? 2.5 : 1.5;
  ctx.stroke();

  if (isWinner) {
    ctx.save();
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillStyle = C_GOLD;
    ctx.textAlign = "center";
    ctx.fillText("👑 VINCITORE", px + pw / 2, py - 16);
    ctx.restore();
  }

  const avY = py + ph * 0.22;
  const avR = Math.min(pw * 0.13, 44);
  ctx.save();
  ctx.beginPath();
  ctx.arc(px + pw / 2, avY, avR, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb}, 0.15)`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb}, 0.45)`;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.font = `bold ${Math.round(avR * 1.1)}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label.charAt(0).toUpperCase(), px + pw / 2, avY);
  ctx.textBaseline = "alphabetic";
  ctx.restore();

  ctx.save();
  ctx.font = `bold ${Math.round(pw * 0.08)}px ${FONT}`;
  ctx.fillStyle = C_TEXT;
  ctx.textAlign = "center";
  const displayLabel = isAi ? "⚡ AI" : `@${label}`;
  ctx.fillText(displayLabel, px + pw / 2, py + ph * 0.44);
  if (isAi && aiLevel) {
    ctx.font = `500 ${Math.round(pw * 0.057)}px ${FONT}`;
    ctx.fillStyle = C_GOLD;
    ctx.fillText(aiLevel.charAt(0).toUpperCase() + aiLevel.slice(1), px + pw / 2, py + ph * 0.52);
  }
  ctx.restore();

  const scoreGrad = ctx.createLinearGradient(px + pw / 2 - 50, 0, px + pw / 2 + 50, 0);
  scoreGrad.addColorStop(0, color);
  scoreGrad.addColorStop(1, color === C_PURPLE ? "#a89fff" : color === C_TEAL ? "#4eeec0" : "#ff80b5");
  ctx.save();
  ctx.font = `900 ${Math.round(pw * 0.22)}px ${FONT}`;
  ctx.fillStyle = scoreGrad;
  ctx.textAlign = "center";
  ctx.fillText(Math.round(score).toString(), px + pw / 2, py + ph * 0.72);
  ctx.font = `500 ${Math.round(pw * 0.065)}px ${FONT}`;
  ctx.fillStyle = C_MUTED;
  ctx.fillText("/100 SGI", px + pw / 2, py + ph * 0.83);
  ctx.restore();
}

// ── Story Card 1080×1920 ──────────────────────────────────────────────────────
export function generatePvpStoryCard(data: PvpCardData): HTMLCanvasElement {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  drawBackground(ctx, W, H);

  // ── Branding ─────────────────────────────────────────────────────────────
  const logoSize = 88;
  drawBranding(ctx, W, 110, logoSize);

  gradDivider(ctx, 80, W - 80, 185);

  // ── Category pill ─────────────────────────────────────────────────────────
  const catLabel = data.category.toUpperCase();
  ctx.font = `bold 28px ${FONT}`;
  const catW = ctx.measureText(catLabel).width + 52;
  const catX = (W - catW) / 2;
  drawRoundRect(ctx, catX, 208, catW, 52, 26);
  ctx.fillStyle = "rgba(255,209,102,0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,209,102,0.38)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = C_GOLD;
  ctx.textAlign = "center";
  ctx.fillText(catLabel, W / 2, 244);

  // ── Outcome label ─────────────────────────────────────────────────────────
  const oColor = outcomeColor(data.outcome);
  const oLabel = outcomeLabel(data.outcome);

  const oGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  oGrad.addColorStop(0, oColor);
  oGrad.addColorStop(1, oColor === C_TEAL ? "#4eeec0" : oColor === C_GOLD ? "#ffe999" : "#ff80b5");
  ctx.font = `900 148px ${FONT}`;
  ctx.fillStyle = oGrad;
  ctx.textAlign = "center";
  ctx.fillText(oLabel, W / 2, 430);

  // Outcome glow
  drawGlowCircle(ctx, W / 2, 380, 300, oColor === C_TEAL ? "rgb(6,214,160)" : oColor === C_GOLD ? "rgb(255,209,102)" : "rgb(247,37,133)", 0.06);

  // ── Theme ────────────────────────────────────────────────────────────────
  ctx.font = `500 46px ${FONT}`;
  ctx.fillStyle = "rgba(238,238,255,0.82)";
  ctx.textAlign = "center";
  const themeLines = wrapText(ctx, `"${data.theme}"`, W - 160);
  const lineH = 64;
  const themeStartY = 510;
  themeLines.slice(0, 4).forEach((line, i) => {
    ctx.fillText(line, W / 2, themeStartY + i * lineH);
  });
  const afterThemeY = themeStartY + Math.min(themeLines.length, 4) * lineH + 40;

  gradDivider(ctx, 80, W - 80, afterThemeY);

  // ── Score panels ──────────────────────────────────────────────────────────
  const panelTop = afterThemeY + 50;
  const panelH = 520;
  const gap = 24;
  const panelW = (W - 120 - gap) / 2;
  const leftX = 60;
  const rightX = leftX + panelW + gap;

  const myColor = data.outcome === "win" ? C_TEAL : "#7c7ccc";
  const myRgb   = data.outcome === "win" ? "6,214,160" : "120,120,200";
  const opColor = data.vsAi ? C_GOLD : C_PINK;
  const opRgb   = data.vsAi ? "255,209,102" : "247,37,133";

  drawScorePanel(
    ctx, leftX, panelTop, panelW, panelH,
    data.myUsername, data.myRawScore, myColor, myRgb,
    data.outcome === "win", false, null,
  );
  drawScorePanel(
    ctx, rightX, panelTop, panelW, panelH,
    data.opponentUsername, data.opponentRawScore, opColor, opRgb,
    data.outcome === "loss", data.vsAi, data.aiLevel,
  );

  // VS badge
  const vsX = W / 2;
  const vsY = panelTop + panelH / 2;
  ctx.beginPath();
  ctx.arc(vsX, vsY, 48, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(247,37,133,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(247,37,133,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `900 40px ${FONT}`;
  ctx.fillStyle = C_PINK;
  ctx.textAlign = "center";
  ctx.fillText("VS", vsX, vsY + 14);

  // ── Footer ────────────────────────────────────────────────────────────────
  const footTop = panelTop + panelH + 90;
  gradDivider(ctx, 80, W - 80, footTop);

  ctx.font = `500 38px ${FONT}`;
  ctx.fillStyle = "rgba(238,238,255,0.5)";
  ctx.textAlign = "center";
  ctx.fillText("Sfidami su", W / 2, footTop + 80);

  const urlGrad = ctx.createLinearGradient(W / 2 - 220, 0, W / 2 + 220, 0);
  urlGrad.addColorStop(0, C_PURPLE);
  urlGrad.addColorStop(1, C_TEAL);
  ctx.font = `bold 60px ${FONT}`;
  ctx.fillStyle = urlGrad;
  ctx.fillText(SITE_URL, W / 2, footTop + 165);

  ctx.font = `500 30px ${FONT}`;
  ctx.fillStyle = "rgba(144,144,184,0.35)";
  ctx.fillText("Misura la crescita del tuo pensiero", W / 2, footTop + 225);

  return canvas;
}

// ── Square Card 1080×1080 ─────────────────────────────────────────────────────
export function generatePvpSquareCard(data: PvpCardData): HTMLCanvasElement {
  const S = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;

  drawBackground(ctx, S, S);

  // Branding
  drawBranding(ctx, S, 72, 64);

  gradDivider(ctx, 60, S - 60, 130);

  // Outcome
  const oColor = outcomeColor(data.outcome);
  const oLabel = outcomeLabel(data.outcome);
  const oGrad = ctx.createLinearGradient(S / 2 - 150, 0, S / 2 + 150, 0);
  oGrad.addColorStop(0, oColor);
  oGrad.addColorStop(1, oColor === C_TEAL ? "#4eeec0" : oColor === C_GOLD ? "#ffe999" : "#ff80b5");
  ctx.font = `900 100px ${FONT}`;
  ctx.fillStyle = oGrad;
  ctx.textAlign = "center";
  ctx.fillText(oLabel, S / 2, 240);

  // Category
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillStyle = C_GOLD;
  ctx.textAlign = "center";
  ctx.fillText(data.category.toUpperCase(), S / 2, 275);

  // Theme
  ctx.font = `500 36px ${FONT}`;
  ctx.fillStyle = "rgba(238,238,255,0.78)";
  const sq_lines = wrapText(ctx, `"${data.theme}"`, S - 120);
  sq_lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, S / 2, 325 + i * 50));

  // Panels
  const panelTop = 485;
  const panelH = 330;
  const gap = 20;
  const panelW = (S - 120 - gap) / 2;
  const lx = 60;
  const rx = lx + panelW + gap;

  const myColor = data.outcome === "win" ? C_TEAL : "#7c7ccc";
  const myRgb   = data.outcome === "win" ? "6,214,160" : "120,120,200";
  const opColor = data.vsAi ? C_GOLD : C_PINK;
  const opRgb   = data.vsAi ? "255,209,102" : "247,37,133";

  drawScorePanel(ctx, lx, panelTop, panelW, panelH, data.myUsername, data.myRawScore, myColor, myRgb, data.outcome === "win", false, null);
  drawScorePanel(ctx, rx, panelTop, panelW, panelH, data.opponentUsername, data.opponentRawScore, opColor, opRgb, data.outcome === "loss", data.vsAi, data.aiLevel);

  const vsX2 = S / 2;
  const vsY2 = panelTop + panelH / 2;
  ctx.beginPath();
  ctx.arc(vsX2, vsY2, 36, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(247,37,133,0.12)"; ctx.fill();
  ctx.strokeStyle = "rgba(247,37,133,0.4)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = `900 30px ${FONT}`;
  ctx.fillStyle = C_PINK;
  ctx.textAlign = "center";
  ctx.fillText("VS", vsX2, vsY2 + 11);

  // Footer
  const footY = panelTop + panelH + 40;
  gradDivider(ctx, 60, S - 60, footY);

  const urlG2 = ctx.createLinearGradient(S / 2 - 180, 0, S / 2 + 180, 0);
  urlG2.addColorStop(0, C_PURPLE);
  urlG2.addColorStop(1, C_TEAL);
  ctx.font = `bold 52px ${FONT}`;
  ctx.fillStyle = urlG2;
  ctx.textAlign = "center";
  ctx.fillText(SITE_URL, S / 2, footY + 65);

  ctx.font = `500 26px ${FONT}`;
  ctx.fillStyle = "rgba(144,144,184,0.35)";
  ctx.fillText("Misura la crescita del tuo pensiero", S / 2, footY + 105);

  return canvas;
}

// ── Share / Download helper ───────────────────────────────────────────────────
export async function shareOrDownloadPvpCard(
  canvas: HTMLCanvasElement,
  format: "story" | "square",
  title: string,
) {
  const filename = `sgi-battle-${format}.png`;
  return new Promise<void>((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const file = new File([blob], filename, { type: "image/png" });
      try {
        if (
          typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({
            files: [file],
            title,
            text: `Ho appena giocato una battle su ${SITE_URL}!`,
          });
        } else {
          downloadCanvas(canvas, filename);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          downloadCanvas(canvas, filename);
        }
      }
      resolve();
    }, "image/png");
  });
}
