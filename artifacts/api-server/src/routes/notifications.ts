import { getAuth } from "@clerk/express";
import { Router } from "express";
import { db } from "@workspace/db";
import { notifications } from "@workspace/db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { getOrCreateUser } from "../lib/getOrCreateUser";
import { runNotificationSweep } from "../lib/notificationSweep";

const router = Router();

// Internal cron entry point — invoked by an external scheduler (not user-facing).
// Guarded by a shared secret header rather than Clerk auth, since the caller
// is a scheduler, not a logged-in user. Runs the full sweep (battle-result +
// streak-risk notifications; also drains any pending battle reconciliation).
router.post("/internal/notifications/sweep", async (req, res) => {
  try {
    const provided = req.header("x-internal-cron-secret");
    const expected = process.env.INTERNAL_CRON_SECRET;
    if (!expected || !provided || provided !== expected) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const result = await runNotificationSweep();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[notifications] sweep error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

const PAGE_SIZE = 20;

router.get("/notifications", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    const page = Math.max(1, Number(req.query.page) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const rows = await db.select().from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    res.json({
      notifications: rows.map(n => ({
        id: n.id,
        type: n.type,
        titleKey: n.titleKey,
        bodyKey: n.bodyKey,
        bodyParams: n.bodyParams ?? {},
        payload: n.payload ?? {},
        deepLink: n.deepLink,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
      })),
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/notifications/unread-count", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

    res.json({ unreadCount: row?.count ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [updated] = await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
      .returning({ id: notifications.id });

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
