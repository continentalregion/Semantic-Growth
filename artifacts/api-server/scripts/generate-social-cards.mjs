// Generates SGI social cards (1080x1920 story + 1080x1080 square) as PNGs.
// Uses ONLY design-system tokens (palette + brand glyph from index.css / App.tsx).
// Run:  node artifacts/api-server/scripts/generate-social-cards.mjs
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../../../social-cards");
mkdirSync(OUT_DIR, { recursive: true });

// ── Design tokens (from artifacts/sgi-app/src/index.css) ──────────────────────
const C = {
  bg0: "#08090f",
  bg1: "#0e0d26",
  bg2: "#0a1422",
  purple: "#7c6bff",
  teal: "#06d6a0",
  pink: "#f72585",
  fg: "#eeeeff",
  muted: "#9090b8",
  font: "DejaVu Sans", // only sans available on host; rendered crisp & bold
};
const DOMAIN = "sgindex.work";

// SGI brand glyph (rising semantic trendline) — canonical mark, identical to
// the web Logo component (artifacts/sgi-app/src/components/Logo.tsx) & favicon.svg.
// Centered within a 24x24 box, drawn at center (cx,cy) scaled by k.
function glyph(cx, cy, k) {
  return `<g stroke="#ffffff" stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(${cx},${cy}) scale(${k}) translate(-12,-12)">
    <path d="M3 17 L9 11 L13 14.5 L21 6"/>
    <circle cx="3" cy="17" r="1.7" fill="#ffffff" stroke="none"/>
    <circle cx="9" cy="11" r="1.7" fill="#ffffff" stroke="none"/>
    <circle cx="13" cy="14.5" r="1.7" fill="#ffffff" stroke="none"/>
    <circle cx="21" cy="6" r="2.4" fill="#ffffff" stroke="none"/>
  </g>`;
}

// Gradient brand logo tile (rounded square) with the glyph inside.
function logoTile(x, y, s) {
  const r = s * 0.26;
  return `<g transform="translate(${x},${y})">
    <rect width="${s}" height="${s}" rx="${r}" fill="url(#brand)"/>
    <rect width="${s}" height="${s}" rx="${r}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
    ${glyph(s / 2, s / 2, s / 24 * 0.62)}
  </g>`;
}

function defs(w, h) {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${w}" y2="${h}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${C.bg0}"/>
      <stop offset="55%" stop-color="${C.bg1}"/>
      <stop offset="100%" stop-color="${C.bg2}"/>
    </linearGradient>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.purple}"/>
      <stop offset="100%" stop-color="${C.teal}"/>
    </linearGradient>
    <linearGradient id="brandH" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.purple}"/>
      <stop offset="100%" stop-color="${C.teal}"/>
    </linearGradient>
    <radialGradient id="glowP" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${C.purple}" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${C.purple}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowT" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${C.teal}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${C.teal}" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
}

function grid(w, h) {
  const step = 60;
  let lines = "";
  for (let x = 0; x <= w; x += step) lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${C.purple}" stroke-width="1"/>`;
  for (let y = 0; y <= h; y += step) lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${C.purple}" stroke-width="1"/>`;
  return `<g opacity="0.035">${lines}</g>`;
}

// Mini brand logo tile (gradient rounded square + glyph) for inline lockups.
function logoTileMini(x, y, s) {
  const r = s * 0.26;
  return `<g transform="translate(${x},${y})">
    <rect width="${s}" height="${s}" rx="${r}" fill="url(#brand)"/>
    ${glyph(s / 2, s / 2, s / 24 * 0.6)}
  </g>`;
}

// "logo + sgindex.work" lockup inside a pill — present on every card.
function domainPill(cx, cy, fontSize) {
  const padX = 30;
  const tile = fontSize * 1.5;
  const gap = 18;
  const textW = DOMAIN.length * fontSize * 0.56;
  const w = padX * 2 + tile + gap + textW;
  const h = Math.max(fontSize * 2.1, tile + 22);
  const x = cx - w / 2;
  const y = cy - h / 2;
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="rgba(124,107,255,0.10)" stroke="rgba(124,107,255,0.32)" stroke-width="1.5"/>
    ${logoTileMini(x + padX, cy - tile / 2, tile)}
    <text x="${x + padX + tile + gap}" y="${cy}" dominant-baseline="central" font-family="${C.font}" font-size="${fontSize}" font-weight="700" letter-spacing="1" fill="${C.fg}">${DOMAIN}</text>
  </g>`;
}

// ── SQUARE 1080×1080 ──────────────────────────────────────────────────────────
function buildSquare() {
  const W = 1080, H = 1080;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${defs(W, H)}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${grid(W, H)}
  <ellipse cx="120" cy="120" rx="620" ry="620" fill="url(#glowP)"/>
  <ellipse cx="980" cy="980" rx="620" ry="620" fill="url(#glowT)"/>
  <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="40" fill="none" stroke="rgba(124,107,255,0.22)" stroke-width="2"/>

  ${logoTile(W / 2 - 82, 250, 164)}

  <text x="${W / 2}" y="615" text-anchor="middle" font-family="${C.font}" font-size="150" font-weight="700" letter-spacing="6" fill="${C.fg}">SGI</text>
  <text x="${W / 2}" y="678" text-anchor="middle" font-family="${C.font}" font-size="29" font-weight="600" letter-spacing="11" fill="${C.muted}">SEMANTIC GROWTH INDEX</text>

  <line x1="${W / 2 - 70}" y1="726" x2="${W / 2 + 70}" y2="726" stroke="url(#brandH)" stroke-width="4" stroke-linecap="round"/>

  <text x="${W / 2}" y="822" text-anchor="middle" font-family="${C.font}" font-size="40" font-weight="700" fill="url(#brandH)">Traccia l'evoluzione della tua mente</text>

  ${domainPill(W / 2, 952, 38)}
</svg>`;
}

// ── STORY 1080×1920 ───────────────────────────────────────────────────────────
function buildStory() {
  const W = 1080, H = 1920;
  const features = [
    "11 metriche semantiche per ogni messaggio",
    "Punteggio SGI come media mobile (EMA)",
    "Battle: tu vs AI sulla stessa domanda",
  ];
  const chipX = 130, chipW = W - chipX * 2, chipH = 116, gap = 36;
  let chips = "";
  features.forEach((f, i) => {
    const y = 1100 + i * (chipH + gap);
    const cy = y + chipH / 2;
    chips += `<g>
      <rect x="${chipX}" y="${y}" width="${chipW}" height="${chipH}" rx="24" fill="rgba(124,107,255,0.06)" stroke="rgba(124,107,255,0.20)" stroke-width="1.5"/>
      <circle cx="${chipX + 52}" cy="${cy}" r="11" fill="url(#brand)"/>
      <text x="${chipX + 92}" y="${cy}" dominant-baseline="central" font-family="${C.font}" font-size="33" font-weight="600" fill="${C.fg}">${f}</text>
    </g>`;
  });

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${defs(W, H)}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${grid(W, H)}
  <ellipse cx="140" cy="220" rx="720" ry="720" fill="url(#glowP)"/>
  <ellipse cx="940" cy="1720" rx="720" ry="720" fill="url(#glowT)"/>
  <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="44" fill="none" stroke="rgba(124,107,255,0.22)" stroke-width="2"/>

  <text x="${W / 2}" y="300" text-anchor="middle" font-family="${C.font}" font-size="26" font-weight="600" letter-spacing="8" fill="${C.purple}">COGNITIVE TELEMETRY</text>

  ${logoTile(W / 2 - 90, 360, 180)}

  <text x="${W / 2}" y="730" text-anchor="middle" font-family="${C.font}" font-size="170" font-weight="700" letter-spacing="6" fill="${C.fg}">SGI</text>
  <text x="${W / 2}" y="800" text-anchor="middle" font-family="${C.font}" font-size="32" font-weight="600" letter-spacing="11" fill="${C.muted}">SEMANTIC GROWTH INDEX</text>

  <line x1="${W / 2 - 80}" y1="868" x2="${W / 2 + 80}" y2="868" stroke="url(#brandH)" stroke-width="5" stroke-linecap="round"/>

  <text x="${W / 2}" y="970" text-anchor="middle" font-family="${C.font}" font-size="46" font-weight="700" fill="url(#brandH)">Traccia l'evoluzione</text>
  <text x="${W / 2}" y="1028" text-anchor="middle" font-family="${C.font}" font-size="46" font-weight="700" fill="url(#brandH)">della tua mente</text>

  ${chips}

  ${domainPill(W / 2, 1700, 44)}
  <text x="${W / 2}" y="1798" text-anchor="middle" font-family="${C.font}" font-size="28" font-weight="500" letter-spacing="2" fill="${C.muted}">Inizia gratis · misura la qualità del tuo pensiero</text>
</svg>`;
}

// ── OPENGRAPH 1200×630 (link preview card for sgindex.work) ───────────────────
function buildOG() {
  const W = 1200, H = 630;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  ${defs(W, H)}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${grid(W, H)}
  <ellipse cx="130" cy="90" rx="540" ry="540" fill="url(#glowP)"/>
  <ellipse cx="1080" cy="560" rx="540" ry="540" fill="url(#glowT)"/>
  <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="34" fill="none" stroke="rgba(124,107,255,0.22)" stroke-width="2"/>

  ${logoTile(W / 2 - 60, 66, 120)}

  <text x="${W / 2}" y="320" text-anchor="middle" font-family="${C.font}" font-size="118" font-weight="700" letter-spacing="5" fill="${C.fg}">SGI</text>
  <text x="${W / 2}" y="368" text-anchor="middle" font-family="${C.font}" font-size="25" font-weight="600" letter-spacing="10" fill="${C.muted}">SEMANTIC GROWTH INDEX</text>

  <line x1="${W / 2 - 64}" y1="408" x2="${W / 2 + 64}" y2="408" stroke="url(#brandH)" stroke-width="4" stroke-linecap="round"/>

  <text x="${W / 2}" y="488" text-anchor="middle" font-family="${C.font}" font-size="38" font-weight="700" fill="url(#brandH)">Traccia l'evoluzione della tua mente</text>

  ${domainPill(W / 2, 566, 30)}
</svg>`;
}

function render(svg, absPath, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: true, defaultFontFamily: C.font },
    background: C.bg0,
  });
  const png = resvg.render().asPng();
  writeFileSync(absPath, png);
  console.log("wrote", absPath, png.length, "bytes");
}

render(buildSquare(), resolve(OUT_DIR, "sgi-card-1080x1080.png"), 1080);
render(buildStory(), resolve(OUT_DIR, "sgi-card-1080x1920.png"), 1080);
render(buildOG(), resolve(__dirname, "../../sgi-app/public/opengraph.png"), 1200);
console.log("done");
