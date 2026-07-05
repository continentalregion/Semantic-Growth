// Pure aggregation over already-computed sgi_snapshots rows — no LLM calls.
// Every 5 consecutive scored messages within the SAME conversation, we split the
// window into early (first 2) vs late (last 2), excluding the middle (3rd) message
// as a neutral pivot, and compute a trend. Only positive trends get an active
// share CTA; negative trends are surfaced only in the personal dashboard.

import { SGI_SCORE_WEIGHTS } from "./sgiScoring";

// 7 of the 8 dimensions currently persisted on sgi_snapshots (abstractionLevel,
// lexicalRichness, informationDensity are NOT stored yet — see
// docs/progress-card-11-metrics-calibration.md). The highlight must be picked
// from a broad set of available dimensions, not an arbitrary subset, or it
// can show a declining metric while the (11-dimension-weighted) aggregate
// deltaPct is positive — driven by a dimension outside the candidate list.
//
// revisionSignal is deliberately EXCLUDED (plan-mode decision): it is forced
// to 0 on the first message of every conversation, so its delta% can be
// artificially huge/meaningless and would mislead readers of a public card.
export const HIGHLIGHT_CANDIDATE_METRICS = [
  "reasoningDepth",
  "interdisciplinaryScore",
  "conceptualComplexity",
  "semanticVariety",
  "originality",
  "stability",
  "continuity",
] as const;

export type HighlightCandidateMetric = (typeof HIGHLIGHT_CANDIDATE_METRICS)[number];

export interface ProgressCardSnapshotInput {
  id: number;
  rawScore: number | null;
  reasoningDepth: number;
  interdisciplinaryScore: number;
  conceptualComplexity: number;
  semanticVariety: number;
  originality: number;
  stability: number;
  continuity: number;
  revisionSignal: number;
}

export interface ComputedProgressCard {
  windowStartSnapshotId: number;
  windowEndSnapshotId: number;
  earlyAvg: number;
  lateAvg: number;
  deltaPct: number;
  highlightMetric: HighlightCandidateMetric;
  highlightDeltaPct: number;
  isPositive: boolean;
}

function pctChange(early: number, late: number): number {
  if (early === 0) return late === 0 ? 0 : late > 0 ? 100 : -100;
  return ((late - early) / Math.abs(early)) * 100;
}

/**
 * `window` must be exactly 5 snapshots for the same conversation, ordered
 * chronologically ascending (oldest first). Index 2 (the middle one) is the
 * pivot and is excluded from both early and late averages.
 *
 * `isFirstWindow` should be true only for a conversation's very first
 * progress-card window (snapshot #1 through #5). On the first-ever message
 * `continuity` has nothing prior to build on, so the LLM naturally scores it
 * low — producing an artificial "growth spike" by message 5 that doesn't
 * reflect real improvement. `continuity` is excluded from the highlight pool
 * for that one window only (later windows are unaffected).
 */
export function computeProgressCard(
  window: ProgressCardSnapshotInput[],
  opts: { isFirstWindow?: boolean } = {},
): ComputedProgressCard {
  if (window.length !== 5) {
    throw new Error(`computeProgressCard requires exactly 5 snapshots, got ${window.length}`);
  }

  const [s0, s1, , s3, s4] = window as [
    ProgressCardSnapshotInput, ProgressCardSnapshotInput, ProgressCardSnapshotInput,
    ProgressCardSnapshotInput, ProgressCardSnapshotInput,
  ];

  const earlyRaw = [s0.rawScore ?? 0, s1.rawScore ?? 0];
  const lateRaw = [s3.rawScore ?? 0, s4.rawScore ?? 0];
  const earlyAvg = (earlyRaw[0] + earlyRaw[1]) / 2;
  const lateAvg = (lateRaw[0] + lateRaw[1]) / 2;
  const deltaPct = pctChange(earlyAvg, lateAvg);

  const candidates = opts.isFirstWindow
    ? HIGHLIGHT_CANDIDATE_METRICS.filter(m => m !== "continuity")
    : HIGHLIGHT_CANDIDATE_METRICS;

  // Pick the highlighted metric by its WEIGHTED contribution to the overall
  // score (not raw %-change) and only among metrics moving in the SAME
  // direction as the overall trend. Without this, a low-weight dimension
  // (e.g. stability at 8%) could spike upward while the aggregate score is
  // actually falling, producing a card that visibly contradicts itself
  // (e.g. "+50% Stabilità" next to an overall drop).
  let bestMetric: HighlightCandidateMetric = candidates[0]!;
  let bestDelta = 0;
  let bestWeighted = -Infinity;
  let fallbackMetric: HighlightCandidateMetric = candidates[0]!;
  let fallbackDelta = -Infinity;

  for (const metric of candidates) {
    const early = (s0[metric] + s1[metric]) / 2;
    const late = (s3[metric] + s4[metric]) / 2;
    const delta = pctChange(early, late);
    const weighted = delta * SGI_SCORE_WEIGHTS[metric];

    // Track the best same-direction candidate (the primary pick).
    const sameDirection = deltaPct >= 0 ? delta >= 0 : delta <= 0;
    if (sameDirection && weighted > bestWeighted) {
      bestWeighted = weighted;
      bestMetric = metric;
      bestDelta = delta;
    }
    // Track the least-contradictory candidate as a fallback, in case every
    // metric happens to move opposite the overall trend.
    if (delta > fallbackDelta) {
      fallbackDelta = delta;
      fallbackMetric = metric;
    }
  }

  if (bestWeighted === -Infinity) {
    bestMetric = fallbackMetric;
    bestDelta = fallbackDelta;
  }

  return {
    windowStartSnapshotId: s0.id,
    windowEndSnapshotId: s4.id,
    earlyAvg,
    lateAvg,
    deltaPct,
    highlightMetric: bestMetric,
    highlightDeltaPct: bestDelta,
    isPositive: deltaPct > 0,
  };
}
