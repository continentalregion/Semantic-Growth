export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
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

export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
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

export function drawGlowCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 0.18,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace(")", `, ${alpha})`).replace("rgb", "rgba"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
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

/**
 * Draw the SGI brand glyph (rising trendline + nodes) inside a violet→teal
 * gradient rounded-rect tile, matching Logo.tsx exactly.
 * cx/cy = center of the tile, tileSize = edge length in canvas pixels.
 */
export function drawSgiLogoTile(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tileSize: number,
) {
  const r = tileSize * 0.26;
  const tx = cx - tileSize / 2;
  const ty = cy - tileSize / 2;

  const grad = ctx.createLinearGradient(tx, ty, tx + tileSize, ty + tileSize);
  grad.addColorStop(0, "#7c6bff");
  grad.addColorStop(1, "#06d6a0");
  drawRoundRect(ctx, tx, ty, tileSize, tileSize, r);
  ctx.fillStyle = grad;
  ctx.fill();

  // Glyph points derived from Logo.tsx SVG transform:
  // transform="translate(16,16) scale(0.8) translate(-12,-12)"
  // globalX = (localX - 12) * 0.8 + 16  (within 32×32 viewBox)
  const scale = tileSize / 32;
  const pts: [number, number][] = [
    [8.8, 20],     // node 1 (3,17)
    [13.6, 15.2],  // node 2 (9,11)
    [16.8, 18],    // node 3 (13,14.5)
    [23.2, 11.2],  // node 4 = peak (21,6)
  ].map(([px, py]) => [tx + px * scale, ty + py * scale]);

  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.1 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  const nodeR = [1.36, 1.36, 1.36, 1.92].map(nr => nr * scale);
  pts.forEach((pt, i) => {
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], nodeR[i]!, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
