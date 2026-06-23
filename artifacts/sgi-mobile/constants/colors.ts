/**
 * Re-exports from theme.ts for backward compatibility.
 * Screens should import useColors() from @/hooks/useColors — not this file directly.
 */
export { colorTokens as default, palette } from "./theme";

import { colorTokens, radii } from "./theme";

const colors = {
  light: { ...colorTokens },
  dark:  { ...colorTokens },
  radius: radii.lg,
};

export default colors;
