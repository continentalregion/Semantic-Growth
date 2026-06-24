---
name: SGI battle architecture
description: How the SGI "Battle" feature works after the USER-vs-AI redesign, and the legacy session system that still coexists with it.
---

# SGI Battle = USER vs AI (single question)

Battle is a single hard question answered by BOTH the user and the AI, scored by the
same 11-metric SGI engine in one LLM call. No timer; calm flow. The UI (web
`battle-session.tsx`, mobile `battles.tsx` modal) posts to `POST /threads/:id/battle`
with `{ userAnswer }` and renders the returned result card (winner, dual rawScores,
per-metric breakdown with Italian labels, XP/level/badge).

**Why this matters:** an OLDER multi-round chat+timer "session" duel still exists in
the backend — `POST /threads/:id/sessions`, `.../sessions/:sessionId/chat`,
`.../complete` and the `threadSessions` table. These endpoints were NOT removed, but
the battle UI no longer uses them. Do not assume the sessions code is the live battle
path; the live path is `/threads/:id/battle`.

**How to apply / invariants to preserve:**
- vs-AI battles enter the public feed (`GET /battles/public`) ONLY on a win
  (`isPublic = winner === 'user'`); losses stay private. Feed items are flagged
  `isVsAi` and render a "vs AI" badge (legacy pips/duration/connections/share UI is
  hidden for them).
- Battle XP (`reward.xpAwarded`, always > 0, reduced on a loss) feeds
  `gamification.xp`/`level` only. It must NEVER touch `users.sgiScore` (global rank).
- Win grants the one-time `battle_victor` badge (`badgeAwarded`).
- Mobile compose modal is an iOS `pageSheet`; its compose `ScrollView` needs
  `automaticallyAdjustKeyboardInsets` so the keyboard never hides the submit button.
