---
name: SGI scoring model
description: gpt-4o-mini with json_object mode; 11 dimensions including revisionSignal; 4 visible macro-dimensions
---

## The Rule

Use `gpt-4o-mini` with `max_tokens: 320` and `response_format: { type: "json_object" }`. The prompt now covers **11 dimensions** including `revisionSignal` — do NOT drop back to 10 or the schema insert will write `0` for that column.

**Why gpt-4o-mini:** `gpt-5-nano` at 512 tokens consistently truncates the JSON → `SyntaxError` → fallback dimensions → score never changes.

## 4 Macro-Dimensions (visible to user)

Computed by `computeMacroDimensions()` in `sgiScoring.ts`:

| Macro | Source dims | Color |
|---|---|---|
| profondita | conceptualComplexity + reasoningDepth + abstractionLevel | #7c6bff |
| connettivita | interdisciplinaryScore + semanticVariety | #06b6d4 |
| precisione | informationDensity + lexicalRichness | #a855f7 |
| revisione | revisionSignal (alone) | #10b981 |

**Why revisione gets 20% weight:** It's the most honest growth signal — lexicalRichness (4% old → 3% new) is gameable with jargon, revision is not.

## revisionSignal

Score 0–10. 0 = no revision or first message. 1–4 = minor nuance. 5–7 = explicit refinement. 8–10 = meaningful position change with stated reason. The scoring prompt is explicit about this to prevent inflation.

## Schema

`sgi_snapshots` has a `revision_signal` column (real, default 0). If adding a new snapshot without this column, Drizzle will use the default — no crash, but the revision metric will be flat until a re-score.

## How to apply

Any change to scoring dimensions must: (1) update `SgiDimensions` interface, (2) update the SCORING_PROMPT, (3) update `computeRawScore` weights, (4) update `computeMacroDimensions`, (5) add column to schema + `pnpm --filter @workspace/db push`.

## Gotchas (non-obvious, verified in code)

- **`sgi_snapshots` persists only 8 of the 11 dims** — missing `abstractionLevel`, `lexicalRichness`, `informationDensity`. So `buildUserProfile` (users.ts) reconstructs dashboard macros from the snapshot with those three = 0 → `precisione` is ALWAYS 0 and `profondita` is partial when computed from a snapshot. The in-line macros computed at scoring time use all 11.
- **SGI score (and thus global rank) changes ONLY from /chat** via `computeNewSgiScore` EMA (alpha 0.15). Battles (`POST /threads/:id/battle`) award XP to `gamification` only and NEVER touch `users.sgiScore` — XP/level is fully independent of SGI rank.
- **Badge XP inconsistency:** `checkAndAwardBadges` grants +500 XP per badge, but the `battle_victor` badge (granted in threads.ts) does NOT add the +500. `mind_changer` is defined in `BADGE_DEFINITIONS` but never awarded by `checkAndAwardBadges`.

## Phase-1 technical reference doc

A full source-of-truth doc lives at `docs/SGI-DOCUMENTAZIONE-TECNICA.md` (Italian): 11 metrics, 4 macros, SGI score/EMA/rank, battle system, gamification, architecture (endpoints+tables), 11 site sections. Branding domains in code = `semantic-growth.app` + `semantic-growth-index.replit.app`; `sgindex.work` is NOT in code (needed for Phase 3 social cards).
