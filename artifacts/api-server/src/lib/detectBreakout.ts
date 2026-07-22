import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface BreakoutResult {
  detected: boolean;
  snapshotId: number | null;
  delta: number;
  triggerType: "inferred";
}

// ─── Calibration note ─────────────────────────────────────────────────────────
// The thresholds below are INITIAL ESTIMATES only — they have NOT been calibrated
// against real production data because no historical dataset existed at the time
// of implementation.
//
// REVISION REQUIRED after 2–3 weeks of production data:
//   - REVISION_SIGNAL_THRESHOLD (0.65): may need raising (too many false positives)
//     or lowering (too few detections) once we can plot the distribution of
//     revision_signal values across real conversations.
//   - RAW_SCORE_DELTA_THRESHOLD (0.12): similarly — check the distribution of
//     consecutive rawScore deltas within the same conversationId.
//
// A good calibration target: 1–2 breakout proposals per user per week.
const REVISION_SIGNAL_THRESHOLD = 0.65;
const RAW_SCORE_DELTA_THRESHOLD = 0.12;

/**
 * Detects a cognitive breakout within a single conversation by finding the
 * pair of consecutive sgi_snapshots (same conversationId) with the largest
 * raw-score delta that also exceeds the revision-signal threshold.
 *
 * Returns the best-scoring breakout found, or detected=false if none qualify.
 *
 * NOTE: caller is responsible for de-duplication (checking best_practice_signals
 * before triggering generation so the same conversation is not processed twice).
 */
export async function detectBreakout(
  userId: number,
  conversationId: number,
): Promise<BreakoutResult> {
  const NONE: BreakoutResult = {
    detected: false,
    snapshotId: null,
    delta: 0,
    triggerType: "inferred",
  };

  const rows = await db.execute(sql`
    SELECT
      s2.id               AS snapshot_id,
      s2.raw_score - s1.raw_score AS delta
    FROM   sgi_snapshots s1
    JOIN   sgi_snapshots s2
           ON  s2.conversation_id = s1.conversation_id
           AND s2.timestamp > s1.timestamp
    WHERE  s1.conversation_id = ${conversationId}
      AND  s1.user_id         = ${userId}
      AND  s2.raw_score IS NOT NULL
      AND  s1.raw_score IS NOT NULL
      AND  s2.revision_signal > ${REVISION_SIGNAL_THRESHOLD}
      AND  s2.raw_score - s1.raw_score > ${RAW_SCORE_DELTA_THRESHOLD}
    ORDER  BY delta DESC
    LIMIT  1
  `);

  const row = rows.rows[0] as { snapshot_id: number | string; delta: number | string } | undefined;
  if (!row) return NONE;

  return {
    detected: true,
    snapshotId: Number(row.snapshot_id),
    delta: Number(row.delta),
    triggerType: "inferred",
  };
}
