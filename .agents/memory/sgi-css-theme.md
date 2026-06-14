---
name: SGI CSS theme variables
description: The SGI app's index.css uses Tailwind v4 custom HSL vars; original template had "red" placeholders that need real values
---

The SGI app index.css uses Tailwind v4 `@theme inline` with CSS vars like `--background`, `--primary`, etc.
The original template scaffold ships ALL variables set to `red; /*replace with H S L */`.

**Why:** This is a Replit design template placeholder — it compiles fine (red is a valid color) but renders everything red until replaced.

**How to apply:** Replace all `:root` and `.dark` variables with actual HSL triples (no `hsl()` wrapper — just the numbers).
Current dark theme values:
- `--background: 222 47% 11%` (deep navy)
- `--primary: 199 89% 48%` (electric cyan)
- `--foreground: 210 40% 98%` (near white)
- `--card: 217 33% 15%`
- `--muted-foreground: 215 20% 65%`
- `--destructive: 0 84% 60%`
