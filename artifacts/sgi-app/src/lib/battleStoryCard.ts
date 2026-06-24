// Client-side generator for shareable AI-battle Story cards (Instagram / Facebook
// Stories, 1080×1920). Generated entirely in the browser so that losing battles
// can still be shared without ever creating a public URL or DB row.

export interface BattleStoryMetric {
  label: string;
  user: number; // 0-10 scale
  ai: number; // 0-10 scale
  winner: "user" | "ai" | "tie";
}

export interface BattleStoryInput {
  question: string;
  category: string;
  winner: "user" | "ai" | "tie";
  userRawScore: number; // /100
  aiRawScore: number; // /100
  xpAwarded: number;
  level: number | null;
  metrics: BattleStoryMetric[];
}

const SITE_URL = "semantic-growth.app";

const COLORS = {
  text: "#eeeeff",
  purple: "#7c6bff",
  purpleLight: "#a89fff",
  teal: "#06d6a0",
  tealLight: "#4eeec0",
  pink: "#f72585",
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

export function generateBattleStoryCard(data: BattleStoryInput): HTMLCanvasElement {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const isWin = data.winner === "user";
  const isTie = data.winner === "tie";
  const verdictColor = isWin ? COLORS.teal : isTie ? COLORS.gold : COLORS.pink;
  const verdictLabel = isWin ? "VITTORIA" : isTie ? "PAREGGIO" : "SCONFITTA";
  const verdictSub = isWin
    ? "Ho battuto l'AI su questa domanda."
    : isTie
      ? "Testa a testa con l'AI."
      : "L'AI ha avuto la meglio — round in arrivo.";

  // ── Background ──────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d0c1f");
  bg.addColorStop(0.5, "#12103a");
  bg.addColorStop(1, "#0a0e20");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(124,107,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 72) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 72) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  glow(ctx, -80, 360, 680, "124,107,255", 0.13);
  glow(ctx, W + 80, 1180, 680, "6,214,160", 0.09);
  glow(ctx, W / 2, 980, 520, "247,37,133", 0.05);

  ctx.textAlign = "center";

  // ── Brand header ────────────────────────────────────────────────────────────
  ctx.font = "bold 32px 'Space Grotesk', 'Arial', sans-serif";
  ctx.fillStyle = "rgba(144,144,184,0.5)";
  ctx.fillText("SEMANTIC GROWTH INDEX", W / 2, 92);

  const gTitle = ctx.createLinearGradient(W / 2 - 90, 0, W / 2 + 90, 0);
  gTitle.addColorStop(0, COLORS.purpleLight);
  gTitle.addColorStop(1, COLORS.teal);
  ctx.font = "900 96px 'Space Grotesk', 'Arial', sans-serif";
  ctx.fillStyle = gTitle;
  ctx.fillText("SGI", W / 2, 188);

  ctx.font = "bold 40px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(247,37,133,0.9)";
  ctx.fillText("\u2694  BATTAGLIA AI", W / 2, 250);

  const divGrad = ctx.createLinearGradient(100, 0, W - 100, 0);
  divGrad.addColorStop(0, "transparent");
  divGrad.addColorStop(0.2, "rgba(124,107,255,0.5)");
  divGrad.addColorStop(0.8, "rgba(6,214,160,0.5)");
  divGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, 288); ctx.lineTo(W - 80, 288); ctx.stroke();

  // ── Category pill ───────────────────────────────────────────────────────────
  const catLabel = (data.category || "").toUpperCase();
  if (catLabel) {
    ctx.font = "bold 26px 'Arial', sans-serif";
    const catW = ctx.measureText(catLabel).width + 48;
    const catX = (W - catW) / 2;
    roundRect(ctx, catX, 318, catW, 48, 24);
    ctx.fillStyle = "rgba(255,209,102,0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,209,102,0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(catLabel, W / 2, 350);
  }

  // ── Question ────────────────────────────────────────────────────────────────
  ctx.font = "500 42px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(238,238,255,0.88)";
  const qLines = wrapText(ctx, `\u201c${data.question}\u201d`, W - 150).slice(0, 3);
  const qStartY = 430;
  qLines.forEach((line, i) => ctx.fillText(line, W / 2, qStartY + i * 56));

  // ── Verdict banner ──────────────────────────────────────────────────────────
  const bannerY = qStartY + qLines.length * 56 + 26;
  roundRect(ctx, 80, bannerY, W - 160, 128, 24);
  ctx.fillStyle = verdictColor + "1f";
  ctx.fill();
  ctx.strokeStyle = verdictColor + "66";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = "900 60px 'Space Grotesk', 'Arial', sans-serif";
  ctx.fillStyle = verdictColor;
  ctx.fillText(verdictLabel, W / 2, bannerY + 62);
  ctx.font = "500 28px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(200,200,224,0.75)";
  ctx.fillText(verdictSub, W / 2, bannerY + 104);

  // ── Duel scores (Tu vs AI) ──────────────────────────────────────────────────
  const duelY = bannerY + 168;
  const panelW = 430;
  const panelH = 250;
  const leftX = 70;
  const rightX = W - 70 - panelW;

  function drawPanel(label: string, score: number, px: number, color: string, rgb: string, isWinner: boolean) {
    roundRect(ctx, px, duelY, panelW, panelH, 26);
    ctx.fillStyle = `rgba(${rgb}, 0.07)`;
    ctx.fill();
    ctx.strokeStyle = isWinner ? `rgba(${rgb}, 0.6)` : `rgba(${rgb}, 0.18)`;
    ctx.lineWidth = isWinner ? 3 : 1.5;
    ctx.stroke();

    if (isWinner) {
      ctx.font = "bold 30px 'Arial', sans-serif";
      ctx.fillStyle = COLORS.gold;
      ctx.fillText("\ud83d\udc51", px + panelW / 2, duelY + 6);
    }

    ctx.font = "bold 30px 'Arial', sans-serif";
    ctx.fillStyle = "rgba(180,180,210,0.85)";
    ctx.fillText(label, px + panelW / 2, duelY + 64);

    const sg = ctx.createLinearGradient(px + panelW / 2 - 60, 0, px + panelW / 2 + 60, 0);
    sg.addColorStop(0, color);
    sg.addColorStop(1, color === COLORS.teal ? COLORS.tealLight : color === COLORS.purple ? COLORS.purpleLight : color);
    ctx.font = "900 120px 'Space Grotesk', 'Arial', sans-serif";
    ctx.fillStyle = isWinner ? sg : COLORS.text;
    ctx.fillText(score.toFixed(1), px + panelW / 2, duelY + 178);

    ctx.font = "500 26px 'Arial', sans-serif";
    ctx.fillStyle = "rgba(144,144,184,0.55)";
    ctx.fillText("/ 100 SGI", px + panelW / 2, duelY + 220);
  }

  drawPanel("TU", data.userRawScore, leftX, isWin ? COLORS.teal : COLORS.purple, isWin ? "6,214,160" : "124,107,255", isWin);
  drawPanel("SGI \u00b7 AI", data.aiRawScore, rightX, COLORS.pink, "247,37,133", data.winner === "ai");

  // VS badge
  const vsX = W / 2;
  const vsY = duelY + panelH / 2;
  ctx.beginPath();
  ctx.arc(vsX, vsY, 52, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(247,37,133,0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(247,37,133,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = "900 44px 'Space Grotesk', 'Arial', sans-serif";
  ctx.fillStyle = COLORS.pink;
  ctx.fillText("VS", vsX, vsY + 16);

  // ── XP chip ─────────────────────────────────────────────────────────────────
  const xpY = duelY + panelH + 36;
  const xpText = `\u26a1  +${data.xpAwarded} XP${data.level != null ? `   \u00b7   Livello ${data.level}` : ""}`;
  ctx.font = "bold 38px 'Arial', sans-serif";
  const xpW = ctx.measureText(xpText).width + 64;
  const xpX = (W - xpW) / 2;
  roundRect(ctx, xpX, xpY, xpW, 76, 22);
  ctx.fillStyle = "rgba(255,209,102,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,209,102,0.32)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(xpText, W / 2, xpY + 52);

  // ── Metric breakdown (diverging bars) ───────────────────────────────────────
  const metricsTop = xpY + 76 + 50;
  ctx.font = "bold 30px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(238,238,255,0.9)";
  ctx.fillText("ANALISI PER METRICA \u2014 STESSO MOTORE SGI", W / 2, metricsTop - 14);

  const metrics = data.metrics.slice(0, 11);
  const listTop = metricsTop + 18;
  const footerY = 1812;
  const rowH = Math.min(58, (footerY - 40 - listTop) / Math.max(metrics.length, 1));
  const centerX = W / 2;
  const halfTrack = 360;

  metrics.forEach((m, i) => {
    const top = listTop + i * rowH;
    const barY = top + rowH - 20;

    // label (left) + values (right)
    ctx.textAlign = "left";
    ctx.font = "500 25px 'Arial', sans-serif";
    ctx.fillStyle = "rgba(220,220,240,0.92)";
    ctx.fillText(m.label, 70, top + 22);

    ctx.textAlign = "right";
    ctx.font = "bold 24px 'Arial', sans-serif";
    ctx.fillStyle = m.winner === "user" ? COLORS.teal : COLORS.purpleLight;
    const aiValText = m.ai.toFixed(1);
    const tuValText = m.user.toFixed(1);
    const aiW = ctx.measureText(aiValText).width;
    ctx.fillText(`Tu ${tuValText}`, W - 70 - aiW - 90, top + 22);
    ctx.fillStyle = COLORS.pink;
    ctx.fillText(`AI ${aiValText}`, W - 70, top + 22);

    // diverging track
    ctx.textAlign = "center";
    roundRect(ctx, centerX - halfTrack, barY, halfTrack * 2, 12, 6);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();

    const tuW = Math.max(0, Math.min(1, m.user / 10)) * halfTrack;
    const aiBarW = Math.max(0, Math.min(1, m.ai / 10)) * halfTrack;
    // Tu grows left from centre
    roundRect(ctx, centerX - tuW, barY, tuW, 12, 6);
    ctx.fillStyle = m.winner === "user" ? COLORS.teal : COLORS.purple;
    ctx.fill();
    // AI grows right from centre
    roundRect(ctx, centerX, barY, aiBarW, 12, 6);
    ctx.fillStyle = "rgba(247,37,133,0.8)";
    ctx.fill();
    // centre divider
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(centerX, barY - 3); ctx.lineTo(centerX, barY + 15); ctx.stroke();
  });

  // ── Footer ──────────────────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(80, footerY); ctx.lineTo(W - 80, footerY); ctx.stroke();

  const urlGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  urlGrad.addColorStop(0, COLORS.purple);
  urlGrad.addColorStop(1, COLORS.teal);
  ctx.font = "bold 46px 'Arial', sans-serif";
  ctx.fillStyle = urlGrad;
  ctx.fillText(SITE_URL, W / 2, footerY + 64);

  ctx.font = "500 28px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(144,144,184,0.4)";
  ctx.fillText("Sfida l'AI e misura la crescita del tuo pensiero", W / 2, footerY + 104);

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
    // otherwise fall through to download
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
