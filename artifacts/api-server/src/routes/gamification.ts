import { Router } from "express";
import { db } from "@workspace/db";
import { users, gamification, badges, missions } from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeLevel, xpToNextLevel, levelProgress, BADGE_DEFINITIONS } from "../lib/sgiScoring";

const router = Router();

router.get("/gamification/me", async (req, res) => {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [gam] = await db.select().from(gamification).where(eq(gamification.userId, user.id)).limit(1);
    const xp = gam?.xp ?? 0;

    const earnedBadges = await db.select().from(badges).where(eq(badges.userId, user.id));
    const userMissions = await db.select().from(missions).where(eq(missions.userId, user.id));

    const formattedBadges = earnedBadges.map(b => ({
      id: b.id,
      badgeKey: b.badgeKey,
      name: BADGE_DEFINITIONS[b.badgeKey]?.name ?? b.badgeKey,
      description: BADGE_DEFINITIONS[b.badgeKey]?.description ?? "",
      earnedAt: b.earnedAt.toISOString(),
    }));

    const formattedMissions = userMissions.map(m => ({
      id: m.id,
      type: m.type,
      title: m.title,
      description: m.description,
      progress: m.progress,
      target: m.target,
      completed: m.completed === 1,
      expiresAt: m.expiresAt.toISOString(),
    }));

    res.json({
      xp,
      level: computeLevel(xp),
      streak: gam?.streak ?? 0,
      lastActiveDate: gam?.lastActiveDate ?? null,
      badges: formattedBadges,
      missions: formattedMissions,
      xpToNextLevel: xpToNextLevel(xp),
      levelProgress: Math.round(levelProgress(xp) * 1000) / 1000,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
