import { useEffect, useCallback, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trophy, Share2, ArrowLeft, Network, Flame, Crown, Download, Instagram } from "lucide-react";

const API_BASE = "/api";
const SITE_URL = "semantic-growth.app";

interface BattleCardData {
  id: string;
  threadId: string;
  createdAt: string;
  thread: { question: string; category: string };
  player1: {
    sessionId: string; username: string; scoreTotal: number;
    scoreDensity: number; scoreConnections: number; scoreDepth: number;
    scoreExplanation: string;
    connections: Array<{ concept1: string; concept2: string; description: string; strength: number }>;
    isWinner: boolean;
  };
  player2: {
    sessionId: string; username: string; scoreTotal: number;
    scoreDensity: number; scoreConnections: number; scoreDepth: number;
    scoreExplanation: string;
    connections: Array<{ concept1: string; concept2: string; description: string; strength: number }>;
    isWinner: boolean;
  };
}

// ── Canvas Story Card Generator ──────────────────────────────────────────────

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

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawGlowCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 0.18) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace(")", `, ${alpha})`).replace("rgb", "rgba"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function generateStoryCard(card: BattleCardData): HTMLCanvasElement {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Background ────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   "#0d0c1f");
  bg.addColorStop(0.5, "#12103a");
  bg.addColorStop(1,   "#0a0e20");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = "rgba(124,107,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 72) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 72) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Glow blobs
  drawGlowCircle(ctx, -100, 400, 700, "rgb(124,107,255)", 0.12);
  drawGlowCircle(ctx, W + 100, 1100, 700, "rgb(6,214,160)", 0.09);
  drawGlowCircle(ctx, W / 2, 960, 500, "rgb(247,37,133)", 0.04);

  // ── Top Bar ───────────────────────────────────────────────────────────────
  // Logo row
  ctx.font = "bold 36px 'Space Grotesk', 'Arial', sans-serif";
  ctx.fillStyle = "rgba(144,144,184,0.5)";
  ctx.textAlign = "center";
  ctx.fillText("SEMANTIC GROWTH INDEX", W / 2, 90);

  // SGI wordmark
  const gTitle = ctx.createLinearGradient(W/2 - 80, 0, W/2 + 80, 0);
  gTitle.addColorStop(0, "#a89fff");
  gTitle.addColorStop(1, "#06d6a0");
  ctx.font = "black 100px 'Space Grotesk', 'Arial', sans-serif";
  ctx.fillStyle = gTitle;
  ctx.textAlign = "center";
  ctx.fillText("SGI", W / 2, 200);

  // ── Battle Badge ──────────────────────────────────────────────────────────
  ctx.font = "bold 56px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(247,37,133,0.9)";
  ctx.fillText("⚔  BATTLE", W / 2, 310);

  // Divider line
  const divGrad = ctx.createLinearGradient(100, 0, W - 100, 0);
  divGrad.addColorStop(0, "transparent");
  divGrad.addColorStop(0.2, "rgba(124,107,255,0.5)");
  divGrad.addColorStop(0.8, "rgba(6,214,160,0.5)");
  divGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 355); ctx.lineTo(W - 80, 355);
  ctx.stroke();

  // ── Category pill ─────────────────────────────────────────────────────────
  const catLabel = card.thread.category.toUpperCase();
  ctx.font = "bold 28px 'Arial', sans-serif";
  const catW = ctx.measureText(catLabel).width + 48;
  const catX = (W - catW) / 2;
  drawRoundRect(ctx, catX, 378, catW, 50, 25);
  ctx.fillStyle = "rgba(255,209,102,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,209,102,0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#ffd166";
  ctx.textAlign = "center";
  ctx.fillText(catLabel, W / 2, 413);

  // ── Thread question ───────────────────────────────────────────────────────
  ctx.font = "500 46px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(238,238,255,0.85)";
  ctx.textAlign = "center";
  const question = `"${card.thread.question}"`;
  const lines = wrapText(ctx, question, W - 160);
  const lineH = 62;
  const qStartY = 520;
  lines.slice(0, 4).forEach((line, i) => {
    ctx.fillText(line, W / 2, qStartY + i * lineH);
  });

  // ── Winner Banner ─────────────────────────────────────────────────────────
  const winner = card.player1.isWinner ? card.player1 : card.player2;
  const bannerY = qStartY + Math.min(lines.length, 4) * lineH + 40;

  drawRoundRect(ctx, 80, bannerY, W - 160, 100, 20);
  const bannerGrad = ctx.createLinearGradient(80, bannerY, W - 80, bannerY);
  bannerGrad.addColorStop(0, "rgba(255,209,102,0.12)");
  bannerGrad.addColorStop(1, "rgba(255,209,102,0.04)");
  ctx.fillStyle = bannerGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,209,102,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = "bold 42px 'Arial', sans-serif";
  ctx.fillStyle = "#ffd166";
  ctx.textAlign = "center";
  ctx.fillText(`👑  @${winner.username} vince con ${winner.scoreTotal} SGI`, W / 2, bannerY + 62);

  // ── Player Panels ─────────────────────────────────────────────────────────
  const panelY = bannerY + 140;
  const panelW = 460;
  const panelH = 560;
  const leftX = 60;
  const rightX = W - 60 - panelW;

  function drawPlayerPanel(
    player: BattleCardData["player1"],
    px: number,
    py: number,
    color: string,
    glowRgb: string,
  ) {
    // Panel background
    drawRoundRect(ctx, px, py, panelW, panelH, 28);
    ctx.fillStyle = `rgba(${glowRgb}, 0.06)`;
    ctx.fill();
    ctx.strokeStyle = player.isWinner
      ? `rgba(${glowRgb}, 0.6)`
      : `rgba(${glowRgb}, 0.2)`;
    ctx.lineWidth = player.isWinner ? 2.5 : 1.5;
    ctx.stroke();

    // Winner crown
    if (player.isWinner) {
      ctx.font = "bold 24px 'Arial', sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText("VINCITORE  👑", px + panelW / 2, py - 18);
    }

    // Avatar circle
    const avatarX = px + panelW / 2;
    const avatarY = py + 80;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, 44, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${glowRgb}, 0.15)`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${glowRgb}, 0.45)`;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = "bold 52px 'Arial', sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(player.username.charAt(0).toUpperCase(), avatarX, avatarY + 19);

    // Username
    ctx.font = "bold 38px 'Arial', sans-serif";
    ctx.fillStyle = "#eeeeff";
    ctx.textAlign = "center";
    ctx.fillText(`@${player.username}`, px + panelW / 2, py + 155);

    // Big score
    const scoreGrad = ctx.createLinearGradient(px + panelW/2 - 50, 0, px + panelW/2 + 50, 0);
    scoreGrad.addColorStop(0, color);
    scoreGrad.addColorStop(1, color === "#7c6bff" ? "#a89fff" : "#4eeec0");
    ctx.font = "black 108px 'Space Grotesk', 'Arial', sans-serif";
    ctx.fillStyle = scoreGrad;
    ctx.textAlign = "center";
    ctx.fillText(String(player.scoreTotal), px + panelW / 2, py + 295);

    ctx.font = "500 28px 'Arial', sans-serif";
    ctx.fillStyle = "rgba(144,144,184,0.5)";
    ctx.textAlign = "center";
    ctx.fillText("SGI Score", px + panelW / 2, py + 335);

    // Sub-scores
    const subLabels = ["Densità", "Conn.", "Depth"];
    const subValues = [player.scoreDensity, player.scoreConnections, player.scoreDepth];
    const subW = (panelW - 48) / 3;
    subValues.forEach((val, i) => {
      const sx = px + 24 + i * (subW + 12);
      const sy = py + 370;
      drawRoundRect(ctx, sx, sy, subW, 88, 14);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fill();
      ctx.font = "bold 34px 'Arial', sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText(String(val), sx + subW / 2, sy + 50);
      ctx.font = "500 20px 'Arial', sans-serif";
      ctx.fillStyle = "rgba(144,144,184,0.45)";
      ctx.fillText(subLabels[i]!, sx + subW / 2, sy + 78);
    });

    // Top connection
    const conn = player.connections[0];
    if (conn) {
      ctx.font = "500 22px 'Arial', sans-serif";
      ctx.fillStyle = `rgba(${glowRgb}, 0.6)`;
      ctx.textAlign = "center";
      const connText = `${conn.concept1}  ↔  ${conn.concept2}`;
      const maxConnW = panelW - 40;
      const trimmed = ctx.measureText(connText).width > maxConnW
        ? `${conn.concept1.slice(0, 12)}… ↔ ${conn.concept2.slice(0, 12)}…`
        : connText;
      ctx.fillText(trimmed, px + panelW / 2, py + 500);
    }
  }

  drawPlayerPanel(card.player1, leftX, panelY, "#7c6bff", "124,107,255");
  drawPlayerPanel(card.player2, rightX, panelY, "#06d6a0", "6,214,160");

  // VS badge in the center
  const vsX = W / 2;
  const vsY = panelY + panelH / 2;
  ctx.beginPath();
  ctx.arc(vsX, vsY, 52, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(247,37,133,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(247,37,133,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = "black 44px 'Arial', sans-serif";
  ctx.fillStyle = "#f72585";
  ctx.textAlign = "center";
  ctx.fillText("VS", vsX, vsY + 16);

  // ── Footer ────────────────────────────────────────────────────────────────
  const footY = panelY + panelH + 80;

  // Divider
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(80, footY); ctx.lineTo(W - 80, footY);
  ctx.stroke();

  ctx.font = "bold 38px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(238,238,255,0.55)";
  ctx.textAlign = "center";
  ctx.fillText("Sfidami su", W / 2, footY + 70);

  const urlGrad = ctx.createLinearGradient(W/2 - 200, 0, W/2 + 200, 0);
  urlGrad.addColorStop(0, "#7c6bff");
  urlGrad.addColorStop(1, "#06d6a0");
  ctx.font = "bold 52px 'Arial', sans-serif";
  ctx.fillStyle = urlGrad;
  ctx.textAlign = "center";
  ctx.fillText(SITE_URL, W / 2, footY + 140);

  ctx.font = "500 30px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(144,144,184,0.35)";
  ctx.textAlign = "center";
  ctx.fillText("Misura la crescita del tuo pensiero", W / 2, footY + 190);

  return canvas;
}

function generateSquareCard(card: BattleCardData): HTMLCanvasElement {
  const S = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, "#0d0c1f");
  bg.addColorStop(1, "#0a0e20");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  ctx.strokeStyle = "rgba(124,107,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < S; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,S); ctx.stroke(); }
  for (let y = 0; y < S; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(S,y); ctx.stroke(); }

  drawGlowCircle(ctx, 0, 0, 500, "rgb(124,107,255)", 0.14);
  drawGlowCircle(ctx, S, S, 500, "rgb(6,214,160)", 0.1);

  ctx.font = "bold 30px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(144,144,184,0.4)";
  ctx.textAlign = "center";
  ctx.fillText("SEMANTIC GROWTH INDEX", S / 2, 72);

  ctx.font = "black 82px 'Arial', sans-serif";
  const gSgi = ctx.createLinearGradient(S/2-70, 0, S/2+70, 0);
  gSgi.addColorStop(0, "#a89fff"); gSgi.addColorStop(1, "#06d6a0");
  ctx.fillStyle = gSgi;
  ctx.fillText("SGI ⚔ BATTLE", S / 2, 165);

  const winner = card.player1.isWinner ? card.player1 : card.player2;

  ctx.font = "bold 36px 'Arial', sans-serif";
  ctx.fillStyle = "#ffd166";
  ctx.textAlign = "center";
  ctx.fillText(`👑  @${winner.username} vince con ${winner.scoreTotal} SGI`, S / 2, 240);

  const divG = ctx.createLinearGradient(60, 0, S - 60, 0);
  divG.addColorStop(0, "transparent");
  divG.addColorStop(0.3, "rgba(124,107,255,0.5)");
  divG.addColorStop(0.7, "rgba(6,214,160,0.5)");
  divG.addColorStop(1, "transparent");
  ctx.strokeStyle = divG; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(60, 270); ctx.lineTo(S - 60, 270); ctx.stroke();

  ctx.font = "500 38px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(238,238,255,0.75)";
  ctx.textAlign = "center";
  const qLines = wrapText(ctx, `"${card.thread.question}"`, S - 120);
  qLines.slice(0, 3).forEach((l, i) => ctx.fillText(l, S / 2, 340 + i * 54));

  const pY = 490;
  [[card.player1, 60, "#7c6bff", "124,107,255"] as const,
   [card.player2, S / 2 + 30, "#06d6a0", "6,214,160"] as const].forEach(([p, px, col, rgb]) => {
    const pw = S / 2 - 90;
    drawRoundRect(ctx, px, pY, pw, 340, 22);
    ctx.fillStyle = `rgba(${rgb}, 0.06)`;
    ctx.fill();
    ctx.strokeStyle = p.isWinner ? `rgba(${rgb}, 0.55)` : `rgba(${rgb}, 0.2)`;
    ctx.lineWidth = p.isWinner ? 2.5 : 1.5;
    ctx.stroke();

    ctx.font = "bold 34px 'Arial', sans-serif";
    ctx.fillStyle = "#eeeeff";
    ctx.textAlign = "center";
    ctx.fillText(`@${p.username}`, px + pw / 2, pY + 55);

    const sg = ctx.createLinearGradient(px + pw/2 - 40, 0, px + pw/2 + 40, 0);
    sg.addColorStop(0, col); sg.addColorStop(1, col === "#7c6bff" ? "#a89fff" : "#4eeec0");
    ctx.font = "black 96px 'Arial', sans-serif";
    ctx.fillStyle = sg;
    ctx.textAlign = "center";
    ctx.fillText(String(p.scoreTotal), px + pw / 2, pY + 190);

    ctx.font = "500 24px 'Arial', sans-serif";
    ctx.fillStyle = "rgba(144,144,184,0.5)";
    ctx.fillText("SGI", px + pw / 2, pY + 230);

    const subW2 = (pw - 32) / 3;
    [p.scoreDensity, p.scoreConnections, p.scoreDepth].forEach((v, i) => {
      const sx = px + 16 + i * (subW2 + 8);
      drawRoundRect(ctx, sx, pY + 255, subW2, 68, 12);
      ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fill();
      ctx.font = "bold 28px 'Arial', sans-serif";
      ctx.fillStyle = col;
      ctx.textAlign = "center";
      ctx.fillText(String(v), sx + subW2 / 2, pY + 300);
    });
  });

  ctx.beginPath();
  ctx.arc(S / 2, pY + 170, 44, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(247,37,133,0.12)"; ctx.fill();
  ctx.strokeStyle = "rgba(247,37,133,0.4)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = "black 36px 'Arial', sans-serif";
  ctx.fillStyle = "#f72585";
  ctx.textAlign = "center";
  ctx.fillText("VS", S / 2, pY + 183);

  ctx.beginPath(); ctx.moveTo(60, 865); ctx.lineTo(S-60, 865);
  ctx.strokeStyle = divG; ctx.lineWidth = 1.5; ctx.stroke();

  const urlG = ctx.createLinearGradient(S/2-160, 0, S/2+160, 0);
  urlG.addColorStop(0, "#7c6bff"); urlG.addColorStop(1, "#06d6a0");
  ctx.font = "bold 48px 'Arial', sans-serif";
  ctx.fillStyle = urlG;
  ctx.textAlign = "center";
  ctx.fillText(SITE_URL, S / 2, 930);

  ctx.font = "500 28px 'Arial', sans-serif";
  ctx.fillStyle = "rgba(144,144,184,0.35)";
  ctx.fillText("Misura la tua crescita semantica", S / 2, 978);

  return canvas;
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ── Components ───────────────────────────────────────────────────────────────

function PlayerPanel({ player, side }: { player: BattleCardData["player1"]; side: "left" | "right" }) {
  const color = side === "left" ? "#7c6bff" : "#06d6a0";
  const dimColor = side === "left" ? "rgba(124,107,255,0.12)" : "rgba(6,214,160,0.1)";
  const borderColor = player.isWinner
    ? (side === "left" ? "rgba(124,107,255,0.5)" : "rgba(6,214,160,0.5)")
    : "rgba(255,255,255,0.07)";

  return (
    <div
      className="flex-1 rounded-2xl p-5 relative"
      style={{ background: dimColor, border: `1.5px solid ${borderColor}` }}
    >
      {player.isWinner && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
          style={{ background: side === "left" ? "#7c6bff" : "#06d6a0", color: "#fff" }}
        >
          <Crown className="w-3 h-3" />
          Vincitore
        </div>
      )}

      <div className="text-center mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-2"
          style={{ background: `${color}22`, border: `2px solid ${color}55`, color }}
        >
          {player.username.charAt(0).toUpperCase()}
        </div>
        <p className="font-bold text-sm" style={{ color: "#eeeeff" }}>@{player.username}</p>
      </div>

      <div className="text-center mb-5">
        <span className="text-5xl font-black font-display" style={{ color }}>{player.scoreTotal}</span>
        <span className="text-sm block mt-0.5" style={{ color: "rgba(144,144,184,0.5)" }}>SGI Score</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Densità", value: player.scoreDensity, icon: "⬡" },
          { label: "Conn.", value: player.scoreConnections, icon: "⟳" },
          { label: "Profondità", value: player.scoreDepth, icon: "◉" },
        ].map(item => (
          <div key={item.label} className="text-center rounded-lg py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-sm font-bold" style={{ color }}>{item.value}</div>
            <div className="text-[9px]" style={{ color: "rgba(144,144,184,0.5)" }}>{item.label}</div>
          </div>
        ))}
      </div>

      {player.scoreExplanation && (
        <p className="text-xs leading-relaxed mb-4 italic" style={{ color: "rgba(144,144,184,0.7)" }}>
          "{player.scoreExplanation}"
        </p>
      )}

      {player.connections.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest mb-2 flex items-center gap-1" style={{ color: "rgba(144,144,184,0.4)" }}>
            <Network className="w-3 h-3" />
            Connessioni chiave
          </p>
          <div className="space-y-1.5">
            {player.connections.slice(0, 3).map((conn, i) => (
              <div key={i} className="text-[11px] rounded-lg px-2.5 py-1.5" style={{ background: `${color}0a`, border: `1px solid ${color}22` }}>
                <span style={{ color: "#a89fff" }}>{conn.concept1}</span>
                <span style={{ color: "rgba(144,144,184,0.5)" }}> ↔ </span>
                <span style={{ color }}>{conn.concept2}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BattleCardPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const [exporting, setExporting] = useState<"story" | "square" | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const { data: card, isLoading } = useQuery({
    queryKey: ["battle-card", id],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(`${API_BASE}/battle-cards/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!r.ok) throw new Error("Battle card non trovata");
      return r.json() as Promise<BattleCardData>;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!card) return;
    const ogImageUrl = `${window.location.origin}/api/battle-cards/${id}/og-image`;
    const pageUrl = window.location.href;
    const title = `SGI Battle: ${card.player1.username} vs ${card.player2.username}`;
    const desc = `"${card.thread.question}" — ${card.player1.isWinner ? card.player1.username : card.player2.username} vince con ${Math.max(card.player1.scoreTotal, card.player2.scoreTotal)} punti SGI`;

    document.title = title;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
      el.content = content;
    };
    const setMetaName = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
      el.content = content;
    };

    setMeta("og:title", title);
    setMeta("og:description", desc);
    setMeta("og:image", ogImageUrl);
    setMeta("og:url", pageUrl);
    setMeta("og:type", "website");
    setMetaName("twitter:card", "summary_large_image");
    setMetaName("twitter:title", title);
    setMetaName("twitter:description", desc);
    setMetaName("twitter:image", ogImageUrl);
  }, [card, id]);

  const handleExport = useCallback(async (format: "story" | "square") => {
    if (!card) return;
    setExporting(format);
    setShowExportMenu(false);
    try {
      await new Promise(r => setTimeout(r, 50));
      const canvas = format === "story"
        ? generateStoryCard(card)
        : generateSquareCard(card);
      const winner = card.player1.isWinner ? card.player1 : card.player2;
      const filename = `sgi-battle-${winner.username}-${format}.png`;
      downloadCanvas(canvas, filename);
      toast.success(format === "story"
        ? "Card Stories scaricata! Aprila in Instagram → + → Stories"
        : "Card quadrata scaricata! Usala nel Feed o nelle Stories");
    } catch {
      toast.error("Errore nella generazione dell'immagine");
    } finally {
      setExporting(null);
    }
  }, [card]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiato negli appunti!");
    } catch {
      toast.info(`Link: ${url}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "#08090f" }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#7c6bff", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!card) return null;

  const winner = card.player1.isWinner ? card.player1 : card.player2;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#08090f" }}>
      <div className="max-w-[820px] mx-auto px-6 py-8">

        <button
          onClick={() => setLocation(`/threads/${card.threadId}`)}
          className="flex items-center gap-2 text-sm mb-6 transition-colors"
          style={{ color: "#9090b8" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#eeeeff"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#9090b8"}
        >
          <ArrowLeft className="w-4 h-4" />
          Thread
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5" style={{ color: "#ffd166" }} />
              <h1 className="text-xl font-bold font-display" style={{ color: "#eeeeff" }}>Battle Card</h1>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,209,102,0.12)", color: "#ffd166" }}>
                {card.thread.category}
              </span>
            </div>
            <p className="text-sm max-w-[500px]" style={{ color: "#9090b8" }}>
              "{card.thread.question}"
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(o => !o)}
                disabled={!!exporting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: "linear-gradient(135deg, rgba(124,107,255,0.2), rgba(6,214,160,0.12))",
                  border: "1px solid rgba(124,107,255,0.4)",
                  color: "#a89fff",
                  opacity: exporting ? 0.6 : 1,
                }}
              >
                {exporting
                  ? <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "#a89fff", borderTopColor: "transparent" }} />
                  : <Download className="w-4 h-4" />}
                {exporting === "story" ? "Story…" : exporting === "square" ? "Square…" : "Scarica Card"}
              </button>

              {showExportMenu && (
                <div
                  className="absolute right-0 top-full mt-1 w-64 rounded-xl overflow-hidden z-50 shadow-2xl"
                  style={{ background: "#0d0f20", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <button
                    onClick={() => handleExport("story")}
                    className="flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-white/5"
                  >
                    <Instagram className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#a855f7" }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#eeeeff" }}>Instagram Stories</p>
                      <p className="text-xs" style={{ color: "#9090b8" }}>1080×1920 · formato verticale 9:16</p>
                    </div>
                  </button>
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
                  <button
                    onClick={() => handleExport("square")}
                    className="flex items-start gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-white/5"
                  >
                    <div className="w-5 h-5 mt-0.5 flex-shrink-0 rounded-sm" style={{ background: "rgba(6,214,160,0.3)", border: "1.5px solid #06d6a0" }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#eeeeff" }}>Feed / Quadrata</p>
                      <p className="text-xs" style={{ color: "#9090b8" }}>1080×1080 · Instagram, TikTok, X</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#eeeeff" }}
            >
              <Share2 className="w-4 h-4" />
              Copia link
            </button>
          </div>
        </div>

        {/* Winner banner */}
        <div
          className="rounded-2xl px-5 py-4 mb-6 flex items-center gap-4"
          style={{
            background: "linear-gradient(135deg, rgba(255,209,102,0.08), rgba(255,209,102,0.03))",
            border: "1px solid rgba(255,209,102,0.25)",
          }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,209,102,0.2)" }}>
            <Crown className="w-5 h-5" style={{ color: "#ffd166" }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#ffd166" }}>
              @{winner.username} vince con {winner.scoreTotal} punti SGI
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#9090b8" }}>
              {winner.scoreExplanation || "Eccellente performance intellettuale."}
            </p>
          </div>
        </div>

        {/* Player panels */}
        <div className="flex gap-4 mb-6">
          <PlayerPanel player={card.player1} side="left" />
          <div className="flex items-center justify-center w-14 flex-shrink-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black"
              style={{ background: "rgba(247,37,133,0.12)", border: "1px solid rgba(247,37,133,0.3)", color: "#f72585" }}
            >
              VS
            </div>
          </div>
          <PlayerPanel player={card.player2} side="right" />
        </div>

        {/* Share section */}
        <div
          className="rounded-xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4" style={{ color: "#f72585" }} />
            <span className="font-semibold text-sm" style={{ color: "#eeeeff" }}>Condividi questa battaglia</span>
          </div>

          {/* Export tip */}
          <div
            className="rounded-lg px-4 py-3 mb-4 flex gap-3"
            style={{ background: "rgba(124,107,255,0.08)", border: "1px solid rgba(124,107,255,0.2)" }}
          >
            <Instagram className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#a855f7" }} />
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "#a89fff" }}>Come condividere su Instagram Stories</p>
              <ol className="text-xs space-y-0.5" style={{ color: "#9090b8" }}>
                <li>1. Clicca <strong style={{ color: "#a89fff" }}>Scarica Card</strong> → scegli <strong style={{ color: "#a89fff" }}>Instagram Stories</strong></li>
                <li>2. Apri Instagram → tocca <strong style={{ color: "#a89fff" }}>+</strong> in alto a sinistra</li>
                <li>3. Scegli l'immagine dalla galleria → pubblica come Story</li>
              </ol>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => handleExport("story")}
              disabled={!!exporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "linear-gradient(135deg, #a855f7, #7c6bff)", color: "#fff", opacity: exporting ? 0.6 : 1 }}
            >
              <Instagram className="w-4 h-4" />
              Scarica per Stories
            </button>
            <button
              onClick={() => handleExport("square")}
              disabled={!!exporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "rgba(6,214,160,0.15)", border: "1px solid rgba(6,214,160,0.3)", color: "#06d6a0", opacity: exporting ? 0.6 : 1 }}
            >
              <Download className="w-4 h-4" />
              Scarica Feed (quadrata)
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#eeeeff" }}
            >
              <Share2 className="w-4 h-4" />
              Copia link
            </button>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`⚔ Ho vinto una battaglia intellettuale su SGI!\n"${card.thread.question}"\n\nScore: ${winner.scoreTotal} SGI`)}&url=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "rgba(29,161,242,0.12)", border: "1px solid rgba(29,161,242,0.3)", color: "#1da1f2" }}
            >
              𝕏 Twitter
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
