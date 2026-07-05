import { getAuth } from "@clerk/express";
import { Router } from "express";
import { db } from "@workspace/db";
import { users, sgiSnapshots, leaderboardEntries, gamification, badges, missions, recommendations, semanticDomains, conversations, messages, threads, blockedAttempts } from "@workspace/db";
import { eq, desc, gte, and, asc, sql, inArray } from "drizzle-orm";
import { SyncUserBody } from "@workspace/api-zod";
import { computeLevel, xpToNextLevel as xpToNext, levelProgress as lvlProgress, BADGE_DEFINITIONS, computeMacroDimensions } from "../lib/sgiScoring";
import { getOrCreateUser } from "../lib/getOrCreateUser";

const router = Router();

// Shared percentile formula: "you're ahead of X% of tracked users", derived
// from a REAL rank + total (not to be confused with the hypothetical
// percentile→rank projection formula used by /predictions, which runs the
// inverse direction on a simulated future score and is intentionally kept
// separate).
function computePercentile(rank: number, total: number): number {
  return Math.round((1 - rank / total) * 1000) / 10;
}

router.post("/users/me", async (req, res) => {
  try {
    const authUserId = getAuth(req).userId;
    if (!authUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const parsed = SyncUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const { clerkId, email } = parsed.data;

    if (clerkId !== authUserId) { res.status(403).json({ error: "Forbidden" }); return; }

    const existing = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (existing.length > 0) {
      const user = existing[0]!;
      const profile = await buildUserProfile(user.id);
      res.json(profile);
      return;
    }

    const [newUser] = await db.insert(users).values({ clerkId, email, plan: "free", sgiScore: 0 }).returning();
    if (!newUser) { res.status(500).json({ error: "Failed to create user" }); return; }

    await db.insert(gamification).values({ userId: newUser.id, xp: 0, level: 1, streak: 0 }).onConflictDoNothing();

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(missions).values([
      { userId: newUser.id, type: "weekly", title: "First Steps", description: "Have 3 conversations", progress: 0, target: 3, completed: 0, expiresAt: nextWeek },
      { userId: newUser.id, type: "weekly", title: "Deep Thinker", description: "Achieve a reasoning depth score of 7+", progress: 0, target: 1, completed: 0, expiresAt: nextWeek },
    ]);

    await generateRecommendations(newUser.id);
    await updateLeaderboardRank(newUser.id);

    const profile = await buildUserProfile(newUser.id);
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/users/me", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) {
      res.status(401).json({ error: "Unauthorized" }); return;
    }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    const profile = await buildUserProfile(user.id);
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/users/me/sgi-history", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    const FREE_TIER_MAX_DAYS = 7;
    const requestedDays = parseInt(String(req.query.days ?? "30"), 10);
    const days = user.plan !== "free" ? requestedDays : Math.min(requestedDays, FREE_TIER_MAX_DAYS);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshots = await db.select().from(sgiSnapshots)
      .where(and(eq(sgiSnapshots.userId, user.id), gte(sgiSnapshots.timestamp, since)))
      .orderBy(asc(sgiSnapshots.timestamp))
      .limit(500);

    res.json(snapshots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/users/me/semantic-map", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    if (user.plan === "free") {
      res.status(403).json({ error: "Premium required", code: "PREMIUM_REQUIRED" });
      return;
    }

    const domains = await db.select().from(semanticDomains).where(eq(semanticDomains.userId, user.id)).orderBy(desc(semanticDomains.explorationScore));

    const nodes = domains.map(d => ({ id: d.domain, domain: d.domain, explorationScore: d.explorationScore, messageCount: d.messageCount }));

    const edges: Array<{ source: string; target: string; strength: number }> = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        if (!n1 || !n2) continue;
        const strength = Math.min(n1.explorationScore, n2.explorationScore) / 10;
        if (strength > 0.2) {
          edges.push({ source: n1.id, target: n2.id, strength });
        }
      }
    }

    res.json({ nodes, edges });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/users/me/domain-strengths", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    if (user.plan === "free") {
      res.status(403).json({ error: "Premium required", code: "PREMIUM_REQUIRED" });
      return;
    }

    const domains = await db.select().from(semanticDomains).where(eq(semanticDomains.userId, user.id)).orderBy(desc(semanticDomains.explorationScore));

    const ALL_DOMAINS = ["philosophy", "mathematics", "biology", "economics", "psychology", "physics", "linguistics", "technology", "history", "art", "literature", "ethics", "logic", "computer_science"];

    const exploredDomainNames = new Set(domains.map(d => d.domain));
    const unexplored = ALL_DOMAINS.filter(d => !exploredDomainNames.has(d));

    const strongAreas = domains.slice(0, 3).map(d => formatDomain(d.domain));
    const developmentAreas = [
      ...domains.filter(d => d.explorationScore < 4).slice(0, 2).map(d => formatDomain(d.domain)),
      ...unexplored.slice(0, 3).map(d => formatDomain(d))
    ].slice(0, 5);

    res.json({ strongAreas, developmentAreas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/users/me/predictions", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    if (user.plan === "free") {
      res.status(403).json({ error: "Premium required", code: "PREMIUM_REQUIRED" });
      return;
    }

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const snapshots = await db.select().from(sgiSnapshots)
      .where(and(eq(sgiSnapshots.userId, user.id), gte(sgiSnapshots.timestamp, since30)))
      .orderBy(asc(sgiSnapshots.timestamp))
      .limit(100);

    const currentSgi = user.sgiScore;
    const currentRank = user.globalRank ?? 50000;

    const totalUsersCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    const totalUsers = Number(totalUsersCount[0]?.count ?? 100000);

    let avgDailyGrowth = 0.3;
    if (snapshots.length >= 2) {
      const first = snapshots[0]!;
      const last = snapshots[snapshots.length - 1]!;
      const daysDiff = Math.max(1, (last.timestamp.getTime() - first.timestamp.getTime()) / (1000 * 60 * 60 * 24));
      avgDailyGrowth = Math.max(-0.5, Math.min(2, (last.score - first.score) / daysDiff));
    }

    const meanReversion = 0.03;
    const targetSgi = 65;

    function project(days: number, growthMultiplier: number): { sgi: number; rank: number } {
      let sgi = currentSgi;
      for (let d = 0; d < days; d++) {
        const growth = avgDailyGrowth * growthMultiplier - meanReversion * (sgi - targetSgi) * 0.01;
        sgi = Math.min(100, Math.max(0, sgi + growth));
      }
      const percentile = Math.max(0.1, Math.min(99.9, 50 + (sgi - 50) * 1.5));
      const rank = Math.round(totalUsers * (1 - percentile / 100));
      return { sgi: Math.round(sgi * 10) / 10, rank: Math.max(1, rank) };
    }

    const conservative = {
      ...project(30, 0.5), sgi30d: project(30, 0.5).sgi, rank30d: project(30, 0.5).rank,
      sgi90d: project(90, 0.5).sgi, rank90d: project(90, 0.5).rank,
      sgi180d: project(180, 0.5).sgi, rank180d: project(180, 0.5).rank,
    };
    const realistic = {
      sgi30d: project(30, 1).sgi, rank30d: project(30, 1).rank,
      sgi90d: project(90, 1).sgi, rank90d: project(90, 1).rank,
      sgi180d: project(180, 1).sgi, rank180d: project(180, 1).rank,
    };
    const optimistic = {
      sgi30d: project(30, 2).sgi, rank30d: project(30, 2).rank,
      sgi90d: project(90, 2).sgi, rank90d: project(90, 2).rank,
      sgi180d: project(180, 2).sgi, rank180d: project(180, 2).rank,
    };

    res.json({ conservative, realistic, optimistic });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

async function buildUserProfile(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const totalUsersResult = await db.select({ count: sql<number>`count(*)` }).from(leaderboardEntries);
  const totalUsers = Number(totalUsersResult[0]?.count ?? 1);

  const snapshots = await db.select().from(sgiSnapshots)
    .where(eq(sgiSnapshots.userId, userId))
    .orderBy(desc(sgiSnapshots.timestamp))
    .limit(50);

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const snapshotDay = snapshots.find(s => s.timestamp < dayAgo);
  const snapshotWeek = snapshots.find(s => s.timestamp < weekAgo);
  const snapshotMonth = snapshots.find(s => s.timestamp < monthAgo);

  const sgiDailyDelta = snapshotDay ? Math.round((user.sgiScore - snapshotDay.score) * 10) / 10 : null;
  const sgiWeeklyDelta = snapshotWeek ? Math.round((user.sgiScore - snapshotWeek.score) * 10) / 10 : null;
  const sgiMonthlyDelta = snapshotMonth ? Math.round((user.sgiScore - snapshotMonth.score) * 10) / 10 : null;

  const rank = user.globalRank;
  const percentile = rank ? computePercentile(rank, totalUsers) : null;

  // Real historical rank, not reconstructed from score: the oldest snapshot
  // from the last 30 days that actually recorded a global_rank. Snapshots are
  // additive-only (see sgiSnapshots.globalRank), so users who haven't
  // accumulated 30 days of ranked history yet simply get null — no invented
  // number.
  const [oldestRankedSnapshot] = await db.select({ globalRank: sgiSnapshots.globalRank })
    .from(sgiSnapshots)
    .where(and(
      eq(sgiSnapshots.userId, userId),
      gte(sgiSnapshots.timestamp, monthAgo),
      sql`${sgiSnapshots.globalRank} IS NOT NULL`,
    ))
    .orderBy(asc(sgiSnapshots.timestamp))
    .limit(1);

  const rankChange30d: number | null =
    oldestRankedSnapshot?.globalRank != null && rank != null
      ? oldestRankedSnapshot.globalRank - rank
      : null;

  // Latest snapshot → macro-dimensions breakdown for dashboard
  const latestSnap = snapshots[0];
  const macroDimensions = latestSnap
    ? computeMacroDimensions({
        conceptualComplexity:   latestSnap.conceptualComplexity,
        semanticVariety:        latestSnap.semanticVariety,
        interdisciplinaryScore: latestSnap.interdisciplinaryScore,
        reasoningDepth:         latestSnap.reasoningDepth,
        originality:            latestSnap.originality,
        stability:              latestSnap.stability,
        continuity:             latestSnap.continuity,
        abstractionLevel:       0,
        lexicalRichness:        0,
        informationDensity:     0,
        revisionSignal:         (latestSnap as any).revisionSignal ?? 0,
      })
    : { profondita: 0, connettivita: 0, precisione: 0, revisione: 0 };

  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    plan: user.plan,
    sgiScore: Math.round(user.sgiScore * 10) / 10,
    sgiDailyDelta,
    sgiWeeklyDelta,
    sgiMonthlyDelta,
    globalRank: rank ?? null,
    totalUsers,
    percentile,
    rankChange30d,
    macroDimensions,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function updateLeaderboardRank(userId: number, snapshotId?: number): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const betterCount = await db.select({ count: sql<number>`count(*)` })
    .from(leaderboardEntries)
    .where(sql`${leaderboardEntries.sgiScore} > ${user.sgiScore}`);

  const rank = Number(betterCount[0]?.count ?? 0) + 1;
  await db.update(users).set({ globalRank: rank }).where(eq(users.id, userId));

  const totalCount = await db.select({ count: sql<number>`count(*)` }).from(leaderboardEntries);
  const total = Number(totalCount[0]?.count ?? 1);
  const percentile = computePercentile(rank, total);

  // Record this rank in the history trail (additive, no historical backfill)
  // so rankChange30d can later be computed from a real past rank instead of
  // being reconstructed from the score. If the caller just inserted a
  // dimension-rich snapshot for this same scoring event (e.g. chat.ts), we
  // piggyback the rank onto THAT row instead of inserting a second one —
  // a dedicated zero-dimension row would otherwise become the "latest"
  // snapshot and blank out the macro-dimensions breakdown on the dashboard.
  // Callers with no associated snapshot (new user creation, battle XP) fall
  // back to a lightweight dedicated insert.
  if (snapshotId != null) {
    await db.update(sgiSnapshots).set({ globalRank: rank }).where(eq(sgiSnapshots.id, snapshotId));
  } else {
    await db.insert(sgiSnapshots).values({
      userId,
      score: user.sgiScore,
      globalRank: rank,
    });
  }

  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [oldestRankedSnapshot] = await db.select({ globalRank: sgiSnapshots.globalRank })
    .from(sgiSnapshots)
    .where(and(
      eq(sgiSnapshots.userId, userId),
      gte(sgiSnapshots.timestamp, monthAgo),
      sql`${sgiSnapshots.globalRank} IS NOT NULL`,
    ))
    .orderBy(asc(sgiSnapshots.timestamp))
    .limit(1);
  const rankChange30d = oldestRankedSnapshot?.globalRank != null ? oldestRankedSnapshot.globalRank - rank : null;

  const displayName = `User_${userId.toString().padStart(6, "0")}`;

  const [existing] = await db.select({ id: leaderboardEntries.id })
    .from(leaderboardEntries)
    .where(eq(leaderboardEntries.userId, userId))
    .limit(1);

  if (existing) {
    await db.update(leaderboardEntries)
      .set({ sgiScore: user.sgiScore, rank, percentile, rankChange30d, updatedAt: new Date() })
      .where(eq(leaderboardEntries.id, existing.id));
  } else {
    await db.insert(leaderboardEntries).values({
      userId, displayName, sgiScore: user.sgiScore, rank, percentile, rankChange30d, isAnonymous: 1
    });
  }
}

export async function checkAndAwardBadges(userId: number, dims: { interdisciplinaryScore: number; abstractionLevel: number }, conversationCount: number, domainsInConversation: string[]): Promise<void> {
  const existingBadges = await db.select({ badgeKey: badges.badgeKey }).from(badges).where(eq(badges.userId, userId));
  const existing = new Set(existingBadges.map(b => b.badgeKey));

  const toAward: string[] = [];

  if (!existing.has("semantic_explorer") && conversationCount >= 5) toAward.push("semantic_explorer");
  if (!existing.has("systems_thinker") && dims.interdisciplinaryScore > 7.5) toAward.push("systems_thinker");
  if (!existing.has("abstract_reasoner") && dims.abstractionLevel > 8.0) toAward.push("abstract_reasoner");

  if (!existing.has("cross_domain_architect") && new Set(domainsInConversation).size >= 5) {
    toAward.push("cross_domain_architect");
  }

  if (!existing.has("high_growth_user")) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldSnap = await db.select({ score: sgiSnapshots.score })
      .from(sgiSnapshots)
      .where(and(eq(sgiSnapshots.userId, userId), gte(sgiSnapshots.timestamp, sevenDaysAgo)))
      .orderBy(asc(sgiSnapshots.timestamp))
      .limit(1);
    const [currentUser] = await db.select({ sgiScore: users.sgiScore }).from(users).where(eq(users.id, userId)).limit(1);
    if (oldSnap.length > 0 && currentUser && (currentUser.sgiScore - oldSnap[0]!.score) >= 10) {
      toAward.push("high_growth_user");
    }
  }

  for (const key of toAward) {
    await db.insert(badges).values({ userId, badgeKey: key }).onConflictDoNothing();
    await db.update(gamification).set({ xp: sql`${gamification.xp} + 500` }).where(eq(gamification.userId, userId));
  }
}

async function generateRecommendations(userId: number): Promise<void> {
  const recs = [
    { category: "reasoning", content: "Explore Bayesian probability — practice updating beliefs with new evidence in your conversations", estimatedSgiGain: 8.5 },
    { category: "interdisciplinary", content: "Connect economics and psychology by exploring behavioral economics concepts like loss aversion and anchoring", estimatedSgiGain: 12.0 },
    { category: "abstraction", content: "Study systems theory — practice describing complex systems at multiple levels of abstraction", estimatedSgiGain: 10.0 },
    { category: "domain", content: "Deepen your exploration of information theory — discuss entropy, channel capacity, and compression", estimatedSgiGain: 7.5 },
    { category: "conceptual", content: "Explore causal modeling — practice distinguishing correlation from causation in complex domains", estimatedSgiGain: 9.0 },
  ];

  for (const rec of recs) {
    await db.insert(recommendations).values({ userId, ...rec }).onConflictDoNothing();
  }
}

function formatDomain(d: string): string {
  return d.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function requireOwner(req: import("express").Request, res: import("express").Response, userId: string): boolean {
  if (getAuth(req).userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

router.get("/users/:clerkId", async (req, res) => {
  if (!requireOwner(req, res, req.params.clerkId!)) return;
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  const profile = await buildUserProfile(user.id);
  res.json(profile);
});

router.get("/users/:clerkId/sgi-history", async (req, res) => {
  if (!requireOwner(req, res, req.params.clerkId!)) return;
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  const FREE_TIER_MAX_DAYS = 7;
  const requestedDays = parseInt(String(req.query.days ?? "30"), 10);
  const days = user.plan !== "free" ? requestedDays : Math.min(requestedDays, FREE_TIER_MAX_DAYS);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const snapshots = await db.select().from(sgiSnapshots)
    .where(and(eq(sgiSnapshots.userId, user.id), gte(sgiSnapshots.timestamp, since)))
    .orderBy(asc(sgiSnapshots.timestamp)).limit(500);
  res.json(snapshots);
});

router.get("/users/:clerkId/semantic-map", async (req, res) => {
  if (!requireOwner(req, res, req.params.clerkId!)) return;
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  if (user.plan === "free") { res.status(403).json({ error: "Premium required", code: "PREMIUM_REQUIRED" }); return; }
  const domains = await db.select().from(semanticDomains).where(eq(semanticDomains.userId, user.id)).orderBy(desc(semanticDomains.explorationScore));
  const nodes = domains.map(d => ({ id: d.domain, domain: d.domain, explorationScore: d.explorationScore, messageCount: d.messageCount }));
  const edges: Array<{ source: string; target: string; strength: number }> = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const n1 = nodes[i]; const n2 = nodes[j];
      if (!n1 || !n2) continue;
      const strength = Math.min(n1.explorationScore, n2.explorationScore) / 10;
      if (strength > 0.2) edges.push({ source: n1.id, target: n2.id, strength });
    }
  }
  res.json({ nodes, edges });
});

router.get("/users/:clerkId/domain-strengths", async (req, res) => {
  if (!requireOwner(req, res, req.params.clerkId!)) return;
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  if (user.plan === "free") { res.status(403).json({ error: "Premium required", code: "PREMIUM_REQUIRED" }); return; }
  const domains = await db.select().from(semanticDomains).where(eq(semanticDomains.userId, user.id)).orderBy(desc(semanticDomains.explorationScore));
  const ALL_DOMAINS = ["philosophy", "mathematics", "biology", "economics", "psychology", "physics", "linguistics", "technology", "history", "art", "literature", "ethics", "logic", "computer_science"];
  const exploredDomainNames = new Set(domains.map(d => d.domain));
  const unexplored = ALL_DOMAINS.filter(d => !exploredDomainNames.has(d));
  const strongAreas = domains.slice(0, 3).map(d => formatDomain(d.domain));
  const developmentAreas = [
    ...domains.filter(d => d.explorationScore < 4).slice(0, 2).map(d => formatDomain(d.domain)),
    ...unexplored.slice(0, 3).map(d => formatDomain(d))
  ].slice(0, 5);
  res.json({ strongAreas, developmentAreas });
});

router.get("/users/:clerkId/predictions", async (req, res) => {
  if (!requireOwner(req, res, req.params.clerkId!)) return;
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  if (user.plan === "free") { res.status(403).json({ error: "Premium required", code: "PREMIUM_REQUIRED" }); return; }
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const snapshots = await db.select().from(sgiSnapshots)
    .where(and(eq(sgiSnapshots.userId, user.id), gte(sgiSnapshots.timestamp, since30)))
    .orderBy(asc(sgiSnapshots.timestamp)).limit(100);
  const currentSgi = user.sgiScore;
  const currentRank = user.globalRank ?? 50000;
  const totalUsersCount = await db.select({ count: sql<number>`count(*)` }).from(users);
  const totalUsers = Number(totalUsersCount[0]?.count ?? 100000);
  let avgDailyGrowth = 0.3;
  if (snapshots.length >= 2) {
    const first = snapshots[0]!;
    const last = snapshots[snapshots.length - 1]!;
    const daysDiff = Math.max(1, (last.timestamp.getTime() - first.timestamp.getTime()) / (1000 * 60 * 60 * 24));
    avgDailyGrowth = Math.max(-0.5, Math.min(2, (last.score - first.score) / daysDiff));
  }
  const meanReversion = 0.03;
  const targetSgi = 65;
  function project(days: number, growthMultiplier: number): { sgi: number; rank: number } {
    let sgi = currentSgi;
    for (let d = 0; d < days; d++) {
      const growth = avgDailyGrowth * growthMultiplier - meanReversion * (sgi - targetSgi) * 0.01;
      sgi = Math.min(100, Math.max(0, sgi + growth));
    }
    const percentile = Math.max(0.1, Math.min(99.9, 50 + (sgi - 50) * 1.5));
    const rank = Math.round(totalUsers * (1 - percentile / 100));
    return { sgi: Math.round(sgi * 10) / 10, rank: Math.max(1, rank) };
  }
  void currentRank;
  const conservative = { sgi30d: project(30, 0.5).sgi, rank30d: project(30, 0.5).rank, sgi90d: project(90, 0.5).sgi, rank90d: project(90, 0.5).rank, sgi180d: project(180, 0.5).sgi, rank180d: project(180, 0.5).rank };
  const realistic = { sgi30d: project(30, 1).sgi, rank30d: project(30, 1).rank, sgi90d: project(90, 1).sgi, rank90d: project(90, 1).rank, sgi180d: project(180, 1).sgi, rank180d: project(180, 1).rank };
  const optimistic = { sgi30d: project(30, 2).sgi, rank30d: project(30, 2).rank, sgi90d: project(90, 2).sgi, rank90d: project(90, 2).rank, sgi180d: project(180, 2).sgi, rank180d: project(180, 2).rank };
  res.json({ conservative, realistic, optimistic });
});

router.delete("/users/me", async (req, res) => {
  try {
    const authUserId = getAuth(req).userId;
    if (!authUserId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [user] = await db.select().from(users).where(eq(users.clerkId, authUserId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const userId = user.id;

    await db.transaction(async (tx) => {
      const userConvos = await tx.select({ id: conversations.id }).from(conversations).where(eq(conversations.userId, userId));
      const convoIds = userConvos.map((c) => c.id);
      if (convoIds.length > 0) {
        await tx.delete(messages).where(inArray(messages.conversationId, convoIds));
      }
      await tx.delete(conversations).where(eq(conversations.userId, userId));
      await tx.delete(threads).where(eq(threads.userId, userId));
      await tx.delete(blockedAttempts).where(eq(blockedAttempts.userId, userId));
      await tx.delete(recommendations).where(eq(recommendations.userId, userId));
      await tx.delete(missions).where(eq(missions.userId, userId));
      await tx.delete(badges).where(eq(badges.userId, userId));
      await tx.delete(semanticDomains).where(eq(semanticDomains.userId, userId));
      await tx.delete(sgiSnapshots).where(eq(sgiSnapshots.userId, userId));
      await tx.delete(leaderboardEntries).where(eq(leaderboardEntries.userId, userId));
      await tx.delete(gamification).where(eq(gamification.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /users/me]", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
