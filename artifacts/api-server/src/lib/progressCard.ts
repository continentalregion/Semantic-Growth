// Pure aggregation over already-computed sgi_snapshots rows — no LLM calls.
// Every 5 consecutive scored messages within the SAME conversation, we split the
// window into early (first 2) vs late (last 2), excluding the middle (3rd) message
// as a neutral pivot, and compute a trend. Only positive trends get an active
// share CTA; negative trends are surfaced only in the personal dashboard.

export const HIGHLIGHT_CANDIDATE_METRICS = [
  "reasoningDepth",
  "interdisciplinaryScore",
  "conceptualComplexity",
] as const;

export type HighlightCandidateMetric = (typeof HIGHLIGHT_CANDIDATE_METRICS)[number];

export interface ProgressCardSnapshotInput {
  id: number;
  rawScore: number | null;
  reasoningDepth: number;
  interdisciplinaryScore: number;
  conceptualComplexity: number;
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
 */
export function computeProgressCard(window: ProgressCardSnapshotInput[]): ComputedProgressCard {
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

  let bestMetric: HighlightCandidateMetric = HIGHLIGHT_CANDIDATE_METRICS[0];
  let bestDelta = -Infinity;
  for (const metric of HIGHLIGHT_CANDIDATE_METRICS) {
    const early = (s0[metric] + s1[metric]) / 2;
    const late = (s3[metric] + s4[metric]) / 2;
    const delta = pctChange(early, late);
    if (delta > bestDelta) {
      bestDelta = delta;
      bestMetric = metric;
    }
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
