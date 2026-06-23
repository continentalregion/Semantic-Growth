import { getAuth } from "@clerk/express";
import { Router } from "express";
import { db } from "@workspace/db";
import { users, recommendations } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getOrCreateUser } from "../lib/getOrCreateUser";

const router = Router();

router.get("/recommendations/me", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    if (user.plan === "free") {
      res.status(403).json({ error: "Premium required", code: "PREMIUM_REQUIRED" });
      return;
    }

    const recs = await db.select().from(recommendations)
      .where(eq(recommendations.userId, user.id))
      .orderBy(desc(recommendations.estimatedSgiGain))
      .limit(10);

    res.json(recs.map(r => ({
      id: r.id,
      category: r.category,
      content: r.content,
      estimatedSgiGain: r.estimatedSgiGain ?? null,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
