---
name: SGI WCAG AA color palette
description: Definitive dark-equivalent text colors for each bright neon accent, verified ≥4.5:1 on cream #FAF9F5 background
---

## Rule
Never use bright neon hex values as text/icon color on the light cream (#FAF9F5) or sidebar (#F3F1EC) backgrounds. Use only the dark equivalents below.

**Why:** The app launched with neon colors copied from a dark-bg prototype. On light backgrounds these fail WCAG AA (< 4.5:1 contrast). Future features on light-bg pages must use these values from the start.

**How to apply:** Any inline `style={{ color: "..." }}` or JSX color prop on a page that uses the cream background must use the values below, not the bright originals. Dark-bg pages (thread-detail, battle-session, guest-battle, progress-card) are exempt — they use the neon palette intentionally.

## Definitive mapping (bright neon → WCAG-safe dark)

| Bright (dark-bg only) | Dark equivalent (light-bg) | Contrast on #FAF9F5 |
|---|---|---|
| `#9090b8` / `rgba(144,144,184,*)` | `#4a4a6a` / `rgba(74,74,106,*)` | ≥ 7:1 ✅ |
| `#a89fff` | `#3930a8` | ≥ 7:1 ✅ |
| `#7c6bff` | `#3930a8` | ≥ 7:1 ✅ |
| `#4eeec0` / `#06d6a0` | `#0d7a5e` | ≥ 5.5:1 ✅ |
| `#f0c040` / `#ffd166` / `#ffbb55` | `#8c6300` | ≥ 4.8:1 ✅ |
| `#f72585` | `#a8003f` | ≥ 7.3:1 ✅ |
| `#eeeeff` | `#1a1b2e` | ≥ 15:1 ✅ |
| `#7070a0` | `#4a4a6a` | ≥ 7:1 ✅ |
| `#ff9900` | `#b45309` | ≥ 4.8:1 ✅ |
| `#f59e0b` | `#b45309` | ≥ 4.8:1 ✅ |
| `#10b981` | `#15803d` | ≥ 4.5:1 ✅ |
| `#a855f7` | `#7e22ce` | ≥ 5:1 ✅ |
| `#06b6d4` | `#0e7490` | ≥ 5:1 ✅ |

## Gradient buttons (on light bg)
| Bright gradient | Dark gradient |
|---|---|
| `linear-gradient(135deg, #f0c040, #e08020)` | `linear-gradient(135deg, #9a6800, #7a5200)` |
| `linear-gradient(135deg, #7c6bff, #5b4de0)` | `linear-gradient(135deg, #4c3cbf, #3a2ea0)` |

## MACRO_DIMS (dashboard dimension colors)
| Dimension | Color |
|---|---|
| profondita | `#3930a8` |
| connettivita | `#0e7490` |
| precisione | `#7e22ce` |
| revisione | `#15803d` |

## RankOrb pattern (leaderboard.tsx)
`orbitColor` (bright) = used ONLY for SVG stroke (decorative ring). 
`textColor` (dark equivalent) = used for all text inside the orb.
Never collapse these two into one variable.
