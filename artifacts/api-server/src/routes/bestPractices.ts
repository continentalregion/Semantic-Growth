import { getAuth } from "@clerk/express";
import { Router } from "express";
import { db } from "@workspace/db";
import { users, bestPractices, bestPracticeSignals, bestPracticeSaves, bestPracticeTopics } from "@workspace/db";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { getOrCreateUser } from "../lib/getOrCreateUser";
import { generateBestPractice } from "../lib/generateBestPractice";

const router = Router();

// ─── Admin guard ──────────────────────────────────────────────────────────────
// Reuses the same ADMIN_EMAILS env pattern as admin.ts — do not duplicate to a
// shared helper; both files intentionally stay independent so they can be
// deployed/reverted separately.
const ADMIN_EMAILS = (process.env.ADMIN_EMAIL ?? "francescoullo1@gmail.com")
  .split(",")
  .map(e => e.trim().toLowerCase());

async function requireAdmin(
  clerkId: string,
): Promise<{ ok: true; adminEmail: string } | { ok: false }> {
  const [caller] = await db.select({ email: users.email })
    .from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!caller || !ADMIN_EMAILS.includes((caller.email ?? "").toLowerCase())) {
    return { ok: false };
  }
  return { ok: true, adminEmail: caller.email ?? "" };
}

// ─── Pagination helper ────────────────────────────────────────────────────────
const DEFAULT_PAGE  = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

function parsePage(q: unknown): number {
  const n = parseInt(String(q ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PAGE;
}
function parseLimit(q: unknown): number {
  const n = parseInt(String(q ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_LIMIT) : DEFAULT_LIMIT;
}

// ─── GET /best-practices — published list, filterable by category ─────────────
// Uses composite index: (status, category, saved_count DESC) — created in Fase A.
// With ?category= the index satisfies the WHERE clause and ORDER BY without a
// sequential scan. Without ?category= the index still covers the status filter.
router.get("/best-practices", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const page  = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const offset = (page - 1) * limit;
    const category = typeof req.query.category === "string" ? req.query.category : null;

    const rows = await db.select({
      id:             bestPractices.id,
      source:         bestPractices.source,
      category:       bestPractices.category,
      archetype:      bestPractices.archetype,
      synthesizedText: bestPractices.synthesizedText,
      triggerType:    bestPractices.triggerType,
      savedCount:     bestPractices.savedCount,
      createdAt:      bestPractices.createdAt,
    })
      .from(bestPractices)
      .where(
        category
          ? and(eq(bestPractices.status, "published"), eq(bestPractices.category, category))
          : eq(bestPractices.status, "published"),
      )
      .orderBy(desc(bestPractices.savedCount), desc(bestPractices.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ page, limit, items: rows });
  } catch (err) {
    console.error("[best-practices] list error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /best-practices/proposed — admin: review queue ───────────────────────
// Must be declared BEFORE /best-practices/:id/... so Express does not mistake
// "proposed" for a numeric id.
router.get("/best-practices/proposed", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const admin = await requireAdmin(clerkId);
    if (!admin.ok) { res.status(403).json({ error: "Admin only" }); return; }

    const rows = await db.select()
      .from(bestPractices)
      .where(eq(bestPractices.status, "proposed"))
      .orderBy(desc(bestPractices.createdAt))
      .limit(100);

    res.json(rows);
  } catch (err) {
    console.error("[best-practices] proposed error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /best-practices/saved — current user's saved entries ─────────────────
// Must be declared BEFORE /best-practices/:id/... for the same reason above.
router.get("/best-practices/saved", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    const rows = await db.select({
      id:              bestPractices.id,
      source:          bestPractices.source,
      category:        bestPractices.category,
      archetype:       bestPractices.archetype,
      synthesizedText: bestPractices.synthesizedText,
      triggerType:     bestPractices.triggerType,
      savedCount:      bestPractices.savedCount,
      createdAt:       bestPractices.createdAt,
      savedAt:         bestPracticeSaves.savedAt,
    })
      .from(bestPracticeSaves)
      .innerJoin(bestPractices, eq(bestPracticeSaves.bestPracticeId, bestPractices.id))
      .where(eq(bestPracticeSaves.userId, user.id))
      .orderBy(desc(bestPracticeSaves.savedAt));

    res.json(rows);
  } catch (err) {
    console.error("[best-practices] saved error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /best-practices/contextual — Battle retrieval (≤3 entries) ──────────
// Hits the composite index (status, category, saved_count DESC) directly.
// The ?theme= param is accepted but used only as a tiebreaker hint today;
// full-text search can be layered in a future iteration without breaking the API.
router.get("/best-practices/contextual", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const category = typeof req.query.category === "string" ? req.query.category : "philosophy";

    // Query uses the bp_status_category_saved index directly (status + category
    // equality predicates, ordered by saved_count DESC as in the index definition).
    const rows = await db.select({
      id:              bestPractices.id,
      category:        bestPractices.category,
      archetype:       bestPractices.archetype,
      synthesizedText: bestPractices.synthesizedText,
      savedCount:      bestPractices.savedCount,
    })
      .from(bestPractices)
      .where(and(
        eq(bestPractices.status, "published"),
        eq(bestPractices.category, category),
      ))
      .orderBy(desc(bestPractices.savedCount), desc(bestPractices.createdAt))
      .limit(3);

    res.json(rows);
  } catch (err) {
    console.error("[best-practices] contextual error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /best-practices/signal — explicit user signal (fire-and-forget) ─────
// Responds immediately with 202; generation happens in the background.
// The client must NOT poll this endpoint for a result — result visibility
// comes later via GET /best-practices/proposed (admin) or push notification (future).
router.post("/best-practices/signal", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    const { source, triggerType, userTurns, category, sourceConvoId, sourceMatchId } = req.body ?? {};

    if (source !== "chat" && source !== "battle") {
      res.status(400).json({ error: "source must be 'chat' or 'battle'" });
      return;
    }
    if (triggerType !== "explicit" && triggerType !== "inferred") {
      res.status(400).json({ error: "triggerType must be 'explicit' or 'inferred'" });
      return;
    }
    if (typeof userTurns !== "string" || !userTurns.trim()) {
      res.status(400).json({ error: "userTurns is required" });
      return;
    }

    // Respond immediately — generation is async and may take several seconds.
    res.status(202).json({ ok: true, queued: true });

    // Fire-and-forget: all dedup / cooldown / LLM logic is inside generateBestPractice.
    generateBestPractice({
      userId: user.id,
      source,
      triggerType,
      userTurns,
      category: typeof category === "string" ? category : undefined,
      sourceConvoId: typeof sourceConvoId === "number" ? sourceConvoId : null,
      sourceMatchId: typeof sourceMatchId === "string" ? sourceMatchId : null,
    }).catch(e => console.error("[best-practices] signal generation error:", e));
  } catch (err) {
    console.error("[best-practices] signal error", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /best-practices/:id/save — save for current user ───────────────────
router.post("/best-practices/:id/save", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    const practiceId = parseInt(req.params.id!, 10);
    if (!Number.isFinite(practiceId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [practice] = await db.select({ id: bestPractices.id, status: bestPractices.status })
      .from(bestPractices)
      .where(eq(bestPractices.id, practiceId))
      .limit(1);
    if (!practice) { res.status(404).json({ error: "Not found" }); return; }
    if (practice.status !== "published") { res.status(403).json({ error: "Not published" }); return; }

    // Insert save; if the unique constraint fires (already saved), do nothing.
    const inserted = await db.insert(bestPracticeSaves)
      .values({ bestPracticeId: practiceId, userId: user.id })
      .onConflictDoNothing()
      .returning({ id: bestPracticeSaves.id });

    // Only increment the denormalised counter when a new row was actually inserted.
    if (inserted.length > 0) {
      await db.execute(
        sql`UPDATE best_practices SET saved_count = saved_count + 1 WHERE id = ${practiceId}`,
      );
    }

    // Re-read the fresh savedCount to return to the client.
    const [updated] = await db.select({ savedCount: bestPractices.savedCount })
      .from(bestPractices).where(eq(bestPractices.id, practiceId)).limit(1);

    res.json({ ok: true, savedCount: updated?.savedCount ?? null });
  } catch (err) {
    console.error("[best-practices] save error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /best-practices/:id/save — remove save for current user ───────────
router.delete("/best-practices/:id/save", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    const practiceId = parseInt(req.params.id!, 10);
    if (!Number.isFinite(practiceId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const deleted = await db.delete(bestPracticeSaves)
      .where(and(
        eq(bestPracticeSaves.bestPracticeId, practiceId),
        eq(bestPracticeSaves.userId, user.id),
      ))
      .returning({ id: bestPracticeSaves.id });

    if (deleted.length > 0) {
      // Only decrement if a row was actually removed.
      await db.execute(
        sql`UPDATE best_practices SET saved_count = GREATEST(0, saved_count - 1) WHERE id = ${practiceId}`,
      );
    }

    const [updated] = await db.select({ savedCount: bestPractices.savedCount })
      .from(bestPractices).where(eq(bestPractices.id, practiceId)).limit(1);

    res.json({ ok: true, savedCount: updated?.savedCount ?? null });
  } catch (err) {
    console.error("[best-practices] unsave error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PATCH /best-practices/:id/status — admin: approve or reject ──────────────
//
// CRITICAL RULE (established in Fase A schema comment):
//   status → "published"  ⟹  UPDATE status column
//   status → "rejected"   ⟹  HARD DELETE the row immediately
//
// Rejected rows must NOT remain in the table as status="rejected".
// Rationale: the synthesized_text was derived from user conversation data;
// retaining it after the user's content is rejected violates the data-
// minimisation principle established in the schema. Hard-delete is the only
// safe outcome for rejected proposals.
router.patch("/best-practices/:id/status", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const admin = await requireAdmin(clerkId);
    if (!admin.ok) { res.status(403).json({ error: "Admin only" }); return; }

    const practiceId = parseInt(req.params.id!, 10);
    if (!Number.isFinite(practiceId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const newStatus = req.body?.status;
    if (newStatus !== "published" && newStatus !== "rejected") {
      res.status(400).json({ error: "status must be 'published' or 'rejected'" });
      return;
    }

    const [practice] = await db.select({
      id:      bestPractices.id,
      status:  bestPractices.status,
      topicId: bestPractices.topicId,
    })
      .from(bestPractices)
      .where(eq(bestPractices.id, practiceId))
      .limit(1);
    if (!practice) { res.status(404).json({ error: "Not found" }); return; }
    if (practice.status !== "proposed") {
      res.status(400).json({ error: "Only proposed entries can be reviewed" });
      return;
    }

    if (newStatus === "rejected") {
      // ── HARD DELETE — see rule above. ────────────────────────────────────────
      // Cascade on best_practice_saves (ON DELETE CASCADE) and
      // best_practice_signals.proposed_id (ON DELETE SET NULL) handle FK cleanup.
      // The rejected row never reached "published" so resolutionCount is NOT touched.
      await db.delete(bestPractices).where(eq(bestPractices.id, practiceId));
      res.json({ ok: true, action: "deleted" });
      return;
    }

    // newStatus === "published"
    const [updated] = await db.update(bestPractices)
      .set({ status: "published", expiresAt: null })
      // Clear expiresAt — published entries never expire.
      .where(eq(bestPractices.id, practiceId))
      .returning();

    // Increment resolutionCount on the topic (only on published transition).
    // Rejected entries never reach this branch, so the counter is never decremented.
    if (practice.topicId != null) {
      await db.execute(
        sql`UPDATE best_practice_topics
            SET resolution_count = resolution_count + 1
            WHERE id = ${practice.topicId}`,
      );
    }

    res.json({ ok: true, action: "published", entry: updated });
  } catch (err) {
    console.error("[best-practices] status error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
