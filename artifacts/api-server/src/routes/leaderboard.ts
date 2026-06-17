import { getAuth } from "@clerk/express";
import { Router } from "express";
import { db } from "@workspace/db";
import { leaderboardEntries, users } from "@workspace/db";
import { eq, asc, desc, sql, gt } from "drizzle-orm";

const router = Router();

router.get("/leaderboard", async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10)));
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10));

    const clerkId = getAuth(req).userId;
    let currentUserId: number | null = null;
    if (clerkId) {
      const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
      currentUserId = u?.id ?? null;
    }

    const [total] = await db.select({ count: sql<number>`count(*)` }).from(leaderboardEntries);
    const totalCount = Number(total?.count ?? 0);

    const entries = await db.select().from(leaderboardEntries)
      .orderBy(asc(leaderboardEntries.rank))
      .limit(limit)
      .offset(offset);

    let currentUserEntry = null;
    if (currentUserId) {
      const [u] = await db.select({ id: users.id, sgiScore: users.sgiScore, globalRank: users.globalRank }).from(users).where(eq(users.id, currentUserId)).limit(1);
      if (u && u.globalRank) {
        const [leEntry] = await db.select().from(leaderboardEntries).where(eq(leaderboardEntries.userId, currentUserId)).limit(1);
        if (leEntry) {
          currentUserEntry = {
            rank: leEntry.rank,
            displayName: `You (User_${currentUserId.toString().padStart(6, "0")})`,
            sgiScore: u.sgiScore,
            percentile: leEntry.percentile,
            rankChange30d: leEntry.rankChange30d ?? null,
            isCurrentUser: true,
          };
        }
      }
    }

    const formattedEntries = entries.map(e => ({
      rank: e.rank,
      displayName: currentUserId !== null && e.userId === currentUserId ? `You (${e.displayName})` : e.displayName,
      sgiScore: e.sgiScore,
      percentile: e.percentile,
      rankChange30d: e.rankChange30d ?? null,
      isCurrentUser: currentUserId !== null && e.userId === currentUserId,
    }));

    res.json({ entries: formattedEntries, total: totalCount, currentUserEntry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/leaderboard/summary", async (req, res) => {
  try {
    const [stats] = await db.select({
      totalUsers: sql<number>`count(*)`,
      averageSgi: sql<number>`avg(${leaderboardEntries.sgiScore})`,
      topSgi: sql<number>`max(${leaderboardEntries.sgiScore})`,
    }).from(leaderboardEntries);

    const totalUsers = Number(stats?.totalUsers ?? 0);
    const averageSgi = Math.round(Number(stats?.averageSgi ?? 50) * 10) / 10;
    const topSgi = Math.round(Number(stats?.topSgi ?? 80) * 10) / 10;

    const top1Count = Math.ceil(totalUsers * 0.01);
    const top10Count = Math.ceil(totalUsers * 0.10);

    const [top1Entry] = await db.select({ sgiScore: leaderboardEntries.sgiScore }).from(leaderboardEntries).orderBy(asc(leaderboardEntries.rank)).limit(1).offset(Math.max(0, top1Count - 1));
    const [top10Entry] = await db.select({ sgiScore: leaderboardEntries.sgiScore }).from(leaderboardEntries).orderBy(asc(leaderboardEntries.rank)).limit(1).offset(Math.max(0, top10Count - 1));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [activeStats] = await db.select({ count: sql<number>`count(*)` })
      .from(users).where(sql`${users.updatedAt} >= ${sevenDaysAgo}`);

    res.json({
      totalUsers,
      averageSgi,
      topSgi,
      top1PercentThreshold: top1Entry?.sgiScore ?? 90,
      top10PercentThreshold: top10Entry?.sgiScore ?? 75,
      usersActive7d: Number(activeStats?.count ?? 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
