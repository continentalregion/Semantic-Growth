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
