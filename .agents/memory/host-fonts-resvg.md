---
name: Host fonts & resvg rendering
description: Which fonts exist on the host and how @resvg/resvg-js resolves them when generating PNGs/cards
---

# Host fonts & resvg rendering

The only system fonts installed on this Replit host are **DejaVu Sans, DejaVu Serif, DejaVu Sans Mono** (`fc-list : family`). Space Grotesk / Inter (the SGI brand fonts in `index.css`) are **NOT** available system-wide.

**Why:** When generating raster assets (social cards, OG images) with `@resvg/resvg-js`, any `font-family` naming Space Grotesk / Inter / system-ui silently falls back. Unmatched families render with resvg's default, which can be a serif and look off-brand.

**How to apply:**
- For crisp, predictable text in resvg output, set `font-family="DejaVu Sans"` explicitly in the SVG AND pass `font: { loadSystemFonts: true, defaultFontFamily: "DejaVu Sans" }` to the `Resvg` constructor.
- Lean on the brand *palette* + gradients (purple #7c6bff → teal #06d6a0) for identity rather than the exact typeface.
- If pixel-exact output is needed, set the SVG width/height to the target and use `fitTo: { mode: "width", value: <px> }` — produces exact dimensions (verified 1080×1080 and 1080×1920).
- To use a real brand font you must embed it (base64 in the SVG or install the font file); do not assume it exists.
