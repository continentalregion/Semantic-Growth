---
name: SGI leaderboard null userId equality
description: Leaderboard seeded entries have userId=null; unauthenticated requests also produce currentUserId=null causing false isCurrentUser matches
---

When the leaderboard is seeded without real users, leaderboardEntries.userId = null.
When there is no auth token, currentUserId = null.
`null === null` is true in JavaScript/TypeScript, so every seeded entry gets marked isCurrentUser:true.

**Why:** The leaderboard was seeded for demo purposes without linking to real user rows.

**How to apply:** Always null-guard before the equality check:
```ts
isCurrentUser: currentUserId !== null && e.userId === currentUserId,
```
