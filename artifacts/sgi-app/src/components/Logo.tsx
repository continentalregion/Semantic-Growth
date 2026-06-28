import { useId } from "react";

/**
 * Canonical SGI brand mark — a rising "semantic growth" trendline (connected
 * nodes climbing to a peak) inside a viola→teal gradient app-icon tile.
 * Single source of truth for the logo across the whole site; the same glyph is
 * mirrored in public/favicon.svg and the social-card / OpenGraph generator
 * (artifacts/api-server/scripts/generate-social-cards.mjs).
 */
export function LogoMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const id = useId();
  const gid = `logo-grad-${id}`;
  const radius = size * 0.26;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c6bff" />
          <stop offset="100%" stopColor="#06d6a0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx={radius} fill={`url(#${gid})`} />
      <g
        transform="translate(16,16) scale(0.8) translate(-12,-12)"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 17 L9 11 L13 14.5 L21 6" />
        <circle cx="3" cy="17" r="1.7" fill="#ffffff" stroke="none" />
        <circle cx="9" cy="11" r="1.7" fill="#ffffff" stroke="none" />
        <circle cx="13" cy="14.5" r="1.7" fill="#ffffff" stroke="none" />
        <circle cx="21" cy="6" r="2.4" fill="#ffffff" stroke="none" />
      </g>
    </svg>
  );
}

/**
 * Full brand lockup: the mark + the "Semantic Growth" wordmark and the
 * sgindex.work domain. Used in the app sidebar, landing header, etc.
 */
export function Logo({
  size = 32,
  wordmark = true,
  className,
}: {
  size?: number;
  wordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`.trim()}>
      <LogoMark size={size} />
      {wordmark && (
        <div className="leading-none">
          <div
            className="font-display font-bold leading-none"
            style={{
              fontSize: Math.round(size * 0.44),
              background: "linear-gradient(135deg, #a89fff, #06d6a0)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Semantic Growth
          </div>
          <span
            className="block uppercase font-medium mt-[3px]"
            style={{
              fontSize: Math.round(size * 0.27),
              letterSpacing: "0.7px",
              color: "rgba(144,144,184,0.6)",
            }}
          >
            sgindex.work
          </span>
        </div>
      )}
    </div>
  );
}
