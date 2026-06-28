---
name: SGI battle architecture
description: How the SGI "Battle" feature works after the ASYNC USER-vs-USER (PvP) redesign. Replaced the old USER-vs-AI mode.
---

# SGI Battle = ASYNC USER vs USER (matchmaking + timed sparring)

Battle pairs two REAL users who need NOT be online at the same time. Each gets a
server-enforced 6:30 (390s) TURN-BASED conversation with an AI *sparring partner*
(a Socratic challenger — NOT the opponent and NOT scored) on the SAME shared theme.
When both finish, only their USER messages are compared on density + persuasiveness;
denser/more convincing wins. Both get XP; ties possible.

**Data model (lib/db `pvpBattles.ts`):** split into `battle_matches` (the pairing:
status `waiting|active|scoring|completed|abandoned`, theme, winnerUserId, tie,
comparison jsonb) and `battle_entries` (one row per player: slot 1|2, status
`matched|in_progress|completed|forfeit`, messages, userText, score, startedAt). The
old `ai_battles`/`battle_cards` tables are NOT used by battle anymore.

**Race-safe matchmaking** (`POST /battles/matchmake`, routes/battles.ts): one txn —
resume my open entry if any; else claim a waiting match not mine with
`FOR UPDATE SKIP LOCKED` → join as slot 2 + set match active; else open a new waiting
match (slot 1) with a curated theme from `THEME_POOL`. The partial unique index
`battle_entries_open_user_idx ON (user_id) WHERE status IN ('matched','in_progress')`
is the hard guard against a user holding two open entries.

**Key invariants to preserve:**
- The 390s timer is SERVER-owned: anchored on first `/turn` (or `/start`) via
  `startedAt`; `/turn` past `startedAt+390s` returns 409 `TIME_UP` and auto-completes.
  Never trust client timestamps or client scores.
- Scoring (`lib/pvpBattleScoring.ts`) compares USER text only, one LLM call, temp 0,
  untrusted user text JSON-escaped. Resolution is claimed atomically
  (`UPDATE ... SET status='scoring' WHERE status='active' RETURNING id`) so XP/badges
  run exactly once. XP feeds `gamification` only — NEVER `users.sgiScore`.
- No background jobs: expiry/forfeit is reconciled ON READ. There are TWO clocks —
  individual entry `startedAt+390s` (TURN_WINDOW_S) and the match-level TTL
  (`expiresAt`: 48h waiting / 24h active). A completed player must NOT wait for the
  24h TTL: if one side completed and the other's 390s window lapsed, forfeit-resolve
  immediately (handled in `completeEntryAndMaybeResolve`, `GET /matches/:id` on read,
  and the `reconcileExpiredMatches` lapsed-entry sweep).
- Authz: every route requires `getAuth(req).userId` AND entry ownership BEFORE any
  resolution side effect (a non-participant must never trigger scoring on a guessed
  match id). `/complete` must reject a `waiting` match (no opponent) — completing it
  would orphan a finished entry and free the open-entry guard → ghost matches.
- `POST /threads/:id/battle` is permanently disabled → HTTP 410. `GET /battles/public`
  now lists resolved PvP matches (non-tie); `battle_victor` badge = beating a HUMAN.
- UI mirrors backend `status` + `myEntryStatus` and POLLS during passive phases
  (waiting-for-opponent, waiting-for-result): web `battle-session.tsx` +
  `battles.tsx`; mobile `(tabs)/battles.tsx` `BattlePvpModal`.
