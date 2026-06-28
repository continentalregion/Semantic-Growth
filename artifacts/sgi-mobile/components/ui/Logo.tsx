import { useId } from "react";
import Svg, { Defs, LinearGradient, Stop, Rect, G, Path, Circle } from "react-native-svg";
import { palette } from "@/constants/theme";

/**
 * Canonical SGI brand mark — a rising "semantic growth" trendline (connected
 * nodes climbing to a peak) inside a viola→teal gradient app-icon tile.
 *
 * This is the single source of truth for the logo on mobile and is a faithful
 * mirror of the web mark in artifacts/sgi-app/src/components/Logo.tsx, so the
 * brand is identical across web and mobile.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  // react-native-svg gradient ids must be unique and free of ":" (Android).
  const gid = "sgiLogoGrad" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const radius = 32 * 0.26;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={palette.primary} />
          <Stop offset="1" stopColor={palette.teal} />
        </LinearGradient>
      </Defs>
      <Rect width={32} height={32} rx={radius} fill={`url(#${gid})`} />
      <G
        transform="translate(16,16) scale(0.8) translate(-12,-12)"
        fill="none"
        stroke={palette.white}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M3 17 L9 11 L13 14.5 L21 6" />
        <Circle cx={3} cy={17} r={1.7} fill={palette.white} stroke="none" />
        <Circle cx={9} cy={11} r={1.7} fill={palette.white} stroke="none" />
        <Circle cx={13} cy={14.5} r={1.7} fill={palette.white} stroke="none" />
        <Circle cx={21} cy={6} r={2.4} fill={palette.white} stroke="none" />
      </G>
    </Svg>
  );
}
