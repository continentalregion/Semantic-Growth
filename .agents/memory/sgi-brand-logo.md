---
name: SGI canonical brand logo
description: The single source of truth for the SGI brand mark and the three places it must be kept in sync.
---

The SGI brand uses ONE canonical mark: a white "rising semantic trendline" glyph
(4 connected nodes climbing to a peak, peak node larger) inside a
viola(#7c6bff)→teal(#06d6a0) gradient app-icon tile, paired with the
"Semantic Growth" wordmark + "sgindex.work" domain.

**Rule:** the glyph is duplicated by necessity across three independent renderers —
keep them in lockstep on ANY logo change:
- `artifacts/sgi-app/src/components/Logo.tsx` (`Logo` lockup + `LogoMark`) — used by
  the sidebar, landing header, and auth page.
- `artifacts/sgi-app/public/favicon.svg`.
- `artifacts/api-server/scripts/generate-social-cards.mjs` (`glyph()`), which renders
  the 1080 social cards AND `artifacts/sgi-app/public/opengraph.png` (the 1200x630
  OG/Twitter card referenced from `index.html`).

**Why:** there is no shared SVG source across React, a static favicon file, and a
Node card generator, so a change in one silently drifts from the others.

**How to apply:** after editing the glyph, also run
`pnpm --filter @workspace/api-server exec node scripts/generate-social-cards.mjs`
to regenerate the social cards + opengraph.png.

**Deploy note:** `artifacts/sgi-app/dist/` is gitignored (the web build is regenerated
at deploy time), so stale local dist does NOT ship. This is the OPPOSITE of
`artifacts/api-server/dist/`, which IS committed and must be rebuilt before deploy.
