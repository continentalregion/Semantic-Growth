/**
 * SGI Design System — single source of truth for all visual tokens.
 * Every screen MUST read exclusively from here (via useColors / useTheme).
 * Zero hardcoded hex, font-size, spacing or radius values in screen files.
 */

// ─── Palette ──────────────────────────────────────────────────────────────────
export const palette = {
  // Surfaces (darkest → lightest)
  bg:       "#08090f",
  surface1: "#0f1322",  // card
  surface2: "#151728",  // muted background
  surface3: "#1a1e3a",  // border / input

  // Text
  textPrimary:   "#f0f1fa",
  textSecondary: "#7a7ea8",

  // Brand purple
  primary:      "#7c6bff",
  primaryLight: "#a89fff",   // secondary icons, dimmer purple
  primaryFg:    "#0a0e1a",   // text ON primary background

  // Semantic colours
  teal:    "#06d6a0",   // success / positive delta
  cyan:    "#06b6d4",   // connectivity / info accent
  violet:  "#a855f7",   // precision / secondary accent
  pink:    "#f72585",   // error / negative / destructive
  gold:    "#ffd700",   // trophy / rank-1
  silver:  "#c0c0c0",   // rank-2
  bronze:  "#cd7f32",   // rank-3
  warning: "#ffd166",   // amber / caution

  // Misc
  white: "#ffffff",
  transparent: "transparent",
} as const;

// ─── Semantic colour tokens (what screens import) ─────────────────────────────
export const colorTokens = {
  background:          palette.bg,
  foreground:          palette.textPrimary,
  card:                palette.surface1,
  cardForeground:      palette.textPrimary,
  muted:               palette.surface2,
  mutedForeground:     palette.textSecondary,
  border:              palette.surface3,
  input:               palette.surface3,
  primary:             palette.primary,
  primaryLight:        palette.primaryLight,
  primaryForeground:   palette.primaryFg,
  secondary:           "#1b1e35",
  secondaryForeground: palette.textPrimary,
  accent:              palette.primary,
  accentForeground:    palette.textPrimary,
  destructive:         palette.pink,
  destructiveForeground: palette.white,
  teal:                palette.teal,
  pink:                palette.pink,
  gold:                palette.gold,
  silver:              palette.silver,
  bronze:              palette.bronze,
  warning:             palette.warning,
  text:                palette.textPrimary,
  tint:                palette.primary,
} as const;

// ─── Spacing (4-pt grid) ─────────────────────────────────────────────────────
export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
export const font = {
  size: {
    xs:   11,  // label, caption, badge
    sm:   12,  // secondary text
    md:   14,  // body secondary
    base: 15,  // body primary
    lg:   17,  // subtitle
    xl:   20,  // screen title
    xxl:  24,  // section header
    hero: 56,  // score display
  },
  family: {
    regular:  "Inter_400Regular",
    medium:   "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold:     "Inter_700Bold",
    heading:  "SpaceGrotesk_700Bold",
  },
  lineHeight: {
    tight:  20,
    normal: 22,
    loose:  24,
  },
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────
export const radii = {
  xs:   4,
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  full: 9999,
} as const;

// ─── Animation ────────────────────────────────────────────────────────────────
export const animation = {
  fast:   150,
  normal: 250,
  slow:   400,
} as const;

// ─── Full theme object ────────────────────────────────────────────────────────
export const theme = {
  ...colorTokens,
  palette,
  spacing,
  font,
  radii,
  animation,
  radius: radii.lg,  // backward-compat single-value used by old hook
} as const;

export type Theme = typeof theme;
