import { getAuth } from "@clerk/express";
import { Router } from "express";
import { db } from "@workspace/db";
import { users, gamification, badges, missions } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { computeLevel, xpToNextLevel, levelProgress, BADGE_DEFINITIONS } from "../lib/sgiScoring";

const router = Router();

function nextMonday(): Date {
  const d = new Date();
  const day = d.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

const WEEKLY_MISSION_POOL = [
  { title: "First Steps", description: "Have 3 conversations", target: 3, trackingKey: "conversations" },
  { title: "Deep Thinker", description: "Achieve a reasoning depth score of 7+ in a conversation", target: 1, trackingKey: "reasoning_depth_7" },
  { title: "Curious Mind", description: "Explore 3 different semantic domains", target: 3, trackingKey: "domains_explored" },
  { title: "Daily Streak", description: "Chat 5 days in a row", target: 5, trackingKey: "streak_days" },
  { title: "SGI Climber", description: "Gain 5 SGI points in a week", target: 5, trackingKey: "sgi_gain" },
];

const MONTHLY_MISSION_POOL = [
  { title: "Scholar of the Month", description: "Complete 20 conversations", target: 20, trackingKey: "conversations" },
  { title: "Cross-Domain Master", description: "Explore 8 different semantic domains", target: 8, trackingKey: "domains_explored" },
  { title: "Growth Champion", description: "Gain 15 SGI points in a month", target: 15, trackingKey: "sgi_gain" },
];

export async function regenerateMissionsIfNeeded(userId: number): Promise<void> {
  const now = new Date();
  const expiredWeekly = await db.select({ id: missions.id })
    .from(missions)
    .where(and(eq(missions.userId, userId), eq(missions.type, "weekly"), lt(missions.expiresAt, now)));

  if (expiredWeekly.length > 0) {
    for (const m of expiredWeekly) {
      await db.delete(missions).where(eq(missions.id, m.id));
    }
    const picked = WEEKLY_MISSION_POOL.sort(() => Math.random() - 0.5).slice(0, 2);
    await db.insert(missions).values(
      picked.map(m => ({ userId, type: "weekly", title: m.title, description: m.description, progress: 0, target: m.target, completed: 0, expiresAt: nextMonday() }))
    );
  }

  const expiredMonthly = await db.select({ id: missions.id })
    .from(missions)
    .where(and(eq(missions.userId, userId), eq(missions.type, "monthly"), lt(missions.expiresAt, now)));

  if (expiredMonthly.length > 0) {
    for (const m of expiredMonthly) {
      await db.delete(missions).where(eq(missions.id, m.id));
    }
    const picked = MONTHLY_MISSION_POOL.sort(() => Math.random() - 0.5).slice(0, 1);
    await db.insert(missions).values(
      picked.map(m => ({ userId, type: "monthly", title: m.title, description: m.description, progress: 0, target: m.target, completed: 0, expiresAt: endOfMonth() }))
    );
  }

  const hasMonthly = await db.select({ id: missions.id })
    .from(missions)
    .where(and(eq(missions.userId, userId), eq(missions.type, "monthly")))
    .limit(1);

  if (hasMonthly.length === 0) {
    const picked = MONTHLY_MISSION_POOL.sort(() => Math.random() - 0.5).slice(0, 1);
    await db.insert(missions).values(
      picked.map(m => ({ userId, type: "monthly", title: m.title, description: m.description, progress: 0, target: m.target, completed: 0, expiresAt: endOfMonth() }))
    );
  }
}

export async function updateMissionProgress(userId: number, event: {
  conversationCompleted?: boolean;
  reasoningDepth?: number;
  domainsExplored?: string[];
  sgiDelta?: number;
  streakDays?: number;
}, xpCallback: (xp: number) => Promise<void>): Promise<void> {
  const activeMissions = await db.select().from(missions)
    .where(and(eq(missions.userId, userId), eq(missions.completed, 0)));

  for (const mission of activeMissions) {
    const m = { ...mission };
    let newProgress = m.progress;

    if (event.conversationCompleted && m.title === "First Steps") newProgress = Math.min(m.progress + 1, m.target);
    if (event.conversationCompleted && m.title === "Scholar of the Month") newProgress = Math.min(m.progress + 1, m.target);
    if (event.reasoningDepth && event.reasoningDepth >= 7 && m.title === "Deep Thinker") newProgress = Math.min(m.progress + 1, m.target);
    if (event.domainsExplored?.length && (m.title === "Curious Mind" || m.title === "Cross-Domain Master")) {
      const increment = event.domainsExplored.length;
      newProgress = Math.min(m.progress + increment, m.target);
    }
    if (event.sgiDelta && event.sgiDelta > 0 && (m.title === "SGI Climber" || m.title === "Growth Champion")) {
      newProgress = Math.min(m.progress + Math.round(event.sgiDelta * 10) / 10, m.target);
    }
    if (event.streakDays && m.title === "Daily Streak") newProgress = Math.min(event.streakDays, m.target);

    if (newProgress !== m.progress) {
      const completed = newProgress >= m.target ? 1 : 0;
      await db.update(missions)
        .set({ progress: newProgress, completed })
        .where(eq(missions.id, m.id));

      if (completed && !m.completed) {
        await xpCallback(250);
      }
    }
  }
}

router.get("/gamification/me", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [gam] = await db.select().from(gamification).where(eq(gamification.userId, user.id)).limit(1);
    const xp = gam?.xp ?? 0;

    const earnedBadges = await db.select().from(badges).where(eq(badges.userId, user.id));

    const formattedBadges = earnedBadges.map(b => ({
      id: b.id,
      badgeKey: b.badgeKey,
      name: BADGE_DEFINITIONS[b.badgeKey]?.name ?? b.badgeKey,
      description: BADGE_DEFINITIONS[b.badgeKey]?.description ?? "",
      earnedAt: b.earnedAt.toISOString(),
    }));

    let formattedMissions: object[] = [];
    if (user.plan === "premium") {
      await regenerateMissionsIfNeeded(user.id);
      const userMissions = await db.select().from(missions).where(eq(missions.userId, user.id));
      formattedMissions = userMissions.map(m => ({
        id: m.id,
        type: m.type,
        title: m.title,
        description: m.description,
        progress: m.progress,
        target: m.target,
        completed: m.completed === 1,
        expiresAt: m.expiresAt.toISOString(),
      }));
    }

    res.json({
      xp,
      level: computeLevel(xp),
      streak: gam?.streak ?? 0,
      lastActiveDate: gam?.lastActiveDate ?? null,
      badges: formattedBadges,
      missions: formattedMissions,
      missionsLocked: user.plan !== "premium",
      xpToNextLevel: xpToNextLevel(xp),
      levelProgress: Math.round(levelProgress(xp) * 1000) / 1000,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
