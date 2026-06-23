import { theme } from "@/constants/theme";
import type { Theme } from "@/constants/theme";

/**
 * Returns the full SGI design system theme (colors + spacing + font + radii + animation).
 * Dark/light is handled at the palette level — the app is always dark.
 * Usage: const t = useColors();  → t.primary, t.spacing.lg, t.font.size.base, etc.
 */
export function useColors(): Theme {
  return theme;
}

export type { Theme };
