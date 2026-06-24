---
name: captureRef / canvas story-card sizing
description: How to size shareable 9:16 (1080×1920) Story cards on mobile (react-native-view-shot) and web canvas so content is not clipped.
---

# Shareable Story-card (1080×1920) sizing

When building a vertical IG/FB Story card captured to a FIXED 9:16 output
(`captureRef(ref, { width: 1080, height: 1920 })` on mobile, or a fixed-size
`<canvas>` on web), the card root has a **fixed height**. React Native does NOT
clip overflow by default, but the capture box does: any content taller than the
card's logical height is silently **cropped** in the exported image (footer and
last rows disappear).

**Why:** view-shot renders the view at its logical size × devicePixelRatio, then
resizes to the requested `width`/`height`. Content past the fixed height is below
the capture region and is lost. tsc/HMR will NOT catch this — it only shows up in
the exported PNG.

**How to apply:**
- Budget the content height to the card height before shipping. Each RN bar "row"
  is as tall as its tallest child — a `<Text>` value (~16–18px) makes a "thin" bar
  row ~18px, not the track's 7px. Two stacked labelled bars × 11 metrics ≈ 700px+.
- Prefer ONE compact diverging bar per metric (single 7–8px track split at centre,
  Tu fills left / AI fills right, values in the head row as text) over two stacked
  labelled bars. This roughly halves per-row height.
- Keep the source card aspect ratio ≈ 9:16 (e.g. 620×1102) so the forced 1080×1920
  output is not distorted; ensure `logicalWidth × pixelRatio ≥ 1080` for crisp text
  (620×2 = 1240 ✓).
- Cap variable text (`numberOfLines` on the question; `.slice(0, N)` metrics).
- The capture card is rendered hidden off-screen (`position:absolute`,
  `left:-Dimensions.width*N`, `collapsable={false}`, `pointerEvents:"none"`) and a
  small delay before `captureRef` ensures layout is committed.
