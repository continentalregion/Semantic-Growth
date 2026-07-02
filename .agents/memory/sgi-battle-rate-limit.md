---
name: SGI per-user battle/chat rate limiting
description: How monthly battle/chat quotas, first-use carve-outs, and the shared reset gate work
---

Monthly counters (messages, opus, aiCost, battles) all share ONE `users.monthly_reset_date` gate column.
Any new monthly counter MUST be reset in the same shared reset function as the others, or whichever
subsystem runs first in a new month "claims" the reset date and the other counter never zeroes.

**Why:** discovered while adding a battles counter alongside the pre-existing chat message counter —
they'd silently desync if reset separately.

**How to apply:** use/extend `artifacts/api-server/src/lib/monthlyReset.ts`'s
`resetAllMonthlyCountersIfNeeded()` for any new "N per month" quota on `users`, never write a
standalone reset check.

Unit-of-account rule for battle rate limiting: charge exactly ONCE per NEW match (at matchmake
join/create in `battles.ts`), never at ai-join/auto-escalation/sparring-turn — those reuse a match
already charged, so re-checking there causes double-count (join/escalation) or massive over-count
(charged per turn).

First-use carve-out (chat's first message, battle's first match) is a lifetime flag
(`firstChatUsedAt`/`firstBattleUsedAt`), not a monthly allowance — always allowed regardless of
quota state, and does not consume a counted slot. Guests get an ephemeral `guest_usage` table whose
only job is transferring the "already had a free first battle" flag on `/battles/guest/claim` so a
newly-registered user can't double-dip the carve-out.

`drizzle-kit push` on this project will try to DROP `guest_budget`/`guest_rate_limits` (raw-SQL
tables not declared in the Drizzle schema) every time — always decline/avoid blind `push`/`push --force`
for schema changes that don't touch those tables; apply narrow `ALTER TABLE` SQL directly instead.
