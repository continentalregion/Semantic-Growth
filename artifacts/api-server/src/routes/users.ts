import { getAuth } from "@clerk/express";
import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { users, sgiSnapshots, leaderboardEntries, gamification, badges, missions, recommendations, semanticDomains, conversations, messages, threads, blockedAttempts, userDeclaredFacts, aiInferredFacts, contextFileNarratives, narrativeGenerationLog, verdicts } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { eq, desc, gte, lt, and, asc, sql, inArray } from "drizzle-orm";
import { SyncUserBody } from "@workspace/api-zod";
import { computeLevel, xpToNextLevel as xpToNext, levelProgress as lvlProgress, BADGE_DEFINITIONS, computeMacroDimensions } from "../lib/sgiScoring";
import { generateVerdict } from "../lib/generateVerdict";
import { MONTHLY_BATTLE_LIMITS } from "../config/pricing.js";
import { getOrCreateUser } from "../lib/getOrCreateUser";
import { generateRecommendations } from "../lib/generateRecommendations";
import { awardBadge } from "../lib/awardBadge";

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

    await generateRecommendations(newUser.id, "it");
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

    const meanReversion = 0.15;
    const targetSgi = 65;

    // Use additive offsets so optimistic > realistic > conservative holds
    // regardless of whether avgDailyGrowth is positive or negative.
    function project(days: number, growthOffset: number): { sgi: number; rank: number } {
      let sgi = currentSgi;
      const dailyGrowth = avgDailyGrowth + growthOffset;
      for (let d = 0; d < days; d++) {
        const growth = dailyGrowth - meanReversion * (sgi - targetSgi) * 0.01;
        sgi = Math.min(100, Math.max(5, sgi + growth));
      }
      const percentile = Math.max(0.1, Math.min(99.9, 50 + (sgi - 50) * 1.5));
      const rank = Math.round(totalUsers * (1 - percentile / 100));
      return { sgi: Math.round(sgi * 10) / 10, rank: Math.max(1, rank) };
    }

    const conservative = {
      ...project(30, -0.2), sgi30d: project(30, -0.2).sgi, rank30d: project(30, -0.2).rank,
      sgi90d: project(90, -0.2).sgi, rank90d: project(90, -0.2).rank,
      sgi180d: project(180, -0.2).sgi, rank180d: project(180, -0.2).rank,
    };
    const realistic = {
      sgi30d: project(30, 0).sgi, rank30d: project(30, 0).rank,
      sgi90d: project(90, 0).sgi, rank90d: project(90, 0).rank,
      sgi180d: project(180, 0).sgi, rank180d: project(180, 0).rank,
    };
    const optimistic = {
      sgi30d: project(30, 0.2).sgi, rank30d: project(30, 0.2).rank,
      sgi90d: project(90, 0.2).sgi, rank90d: project(90, 0.2).rank,
      sgi180d: project(180, 0.2).sgi, rank180d: project(180, 0.2).rank,
    };

    res.json({ conservative, realistic, optimistic });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

async function buildUserProfile(userId: number) {
  // Date anchors computed before queries so all 4 can run in parallel.
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // All 4 queries are data-independent — none depends on another's result.
  // Running in parallel cuts serial latency from ~320ms to ~80ms warm.
  const [
    [user],
    totalUsersResult,
    snapshots,
    [oldestRankedSnapshot],
  ] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db.select({ count: sql<number>`count(*)` }).from(leaderboardEntries),
    db.select().from(sgiSnapshots)
      .where(eq(sgiSnapshots.userId, userId))
      .orderBy(desc(sgiSnapshots.timestamp))
      .limit(50),
    db.select({ globalRank: sgiSnapshots.globalRank })
      .from(sgiSnapshots)
      .where(and(
        eq(sgiSnapshots.userId, userId),
        gte(sgiSnapshots.timestamp, monthAgo),
        sql`${sgiSnapshots.globalRank} IS NOT NULL`,
      ))
      .orderBy(asc(sgiSnapshots.timestamp))
      .limit(1),
  ]);

  if (!user) throw new Error("User not found");

  const totalUsers = Number(totalUsersResult[0]?.count ?? 1);

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
        abstractionLevel:       latestSnap.abstractionLevel,
        lexicalRichness:        latestSnap.lexicalRichness,
        informationDensity:     latestSnap.informationDensity,
        revisionSignal:         latestSnap.revisionSignal,
      })
    : { profondita: 0, connettivita: 0, precisione: 0, revisione: 0 };

  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    plan: user.plan,
    planSource: user.planSource,
    sgiScore: Math.round(user.sgiScore * 10) / 10,
    sgiDailyDelta,
    sgiWeeklyDelta,
    sgiMonthlyDelta,
    globalRank: rank ?? null,
    totalUsers,
    percentile,
    rankChange30d,
    macroDimensions,
    monthlyBattlesUsed: user.monthlyBattlesUsed,
    monthlyBattlesLimit: MONTHLY_BATTLE_LIMITS[user.plan] ?? MONTHLY_BATTLE_LIMITS.free!,
    monthlyResetDate: user.monthlyResetDate ?? null,
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

export async function checkAndAwardBadges(userId: number, dims: { interdisciplinaryScore: number; abstractionLevel: number; revisionSignal?: number }, conversationCount: number, domainsInConversation: string[]): Promise<void> {
  const existingBadges = await db.select({ badgeKey: badges.badgeKey }).from(badges).where(eq(badges.userId, userId));
  const existing = new Set(existingBadges.map(b => b.badgeKey));

  const toAward: string[] = [];

  if (!existing.has("semantic_explorer") && conversationCount >= 5) toAward.push("semantic_explorer");
  if (!existing.has("systems_thinker") && dims.interdisciplinaryScore > 7.5) toAward.push("systems_thinker");
  if (!existing.has("abstract_reasoner") && dims.abstractionLevel > 8.0) toAward.push("abstract_reasoner");
  // "Mind Changer" — sgiScoring.ts BADGE_DEFINITIONS.mind_changer ("Revised your
  // position with a revisionSignal above 7.0") was never actually checked here,
  // so it was permanently unassignable despite being defined.
  if (!existing.has("mind_changer") && (dims.revisionSignal ?? 0) > 7.0) toAward.push("mind_changer");

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
    const granted = await awardBadge(userId, key);
    if (granted) {
      await db.update(gamification).set({ xp: sql`${gamification.xp} + 500` }).where(eq(gamification.userId, userId));
    }
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
      await tx.delete(threads).where(eq(threads.createdBy, authUserId));
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

// ─── Context File — shared helpers (reused by endpoints + narrative) ─────────

async function getActiveDeclaredFacts(userId: number) {
  return db
    .select()
    .from(userDeclaredFacts)
    .where(and(eq(userDeclaredFacts.userId, userId), eq(userDeclaredFacts.isActive, true)))
    .orderBy(desc(userDeclaredFacts.declaredAt));
}

async function getActiveInferredFacts(userId: number) {
  return db
    .select({
      id:               aiInferredFacts.id,
      fact:             aiInferredFacts.fact,
      persistenceLevel: aiInferredFacts.persistenceLevel,
      status:           aiInferredFacts.status,
      lastReinforcedAt: aiInferredFacts.lastReinforcedAt,
    })
    .from(aiInferredFacts)
    .where(and(
      eq(aiInferredFacts.userId, userId),
      inArray(aiInferredFacts.status, ["active", "stale"]),
    ))
    .orderBy(desc(aiInferredFacts.lastReinforcedAt));
}

async function getDomainDominance(userId: number) {
  const result = await db.execute(sql`
    SELECT domain, created_at
    FROM domain_events
    WHERE user_id = ${userId}
      AND created_at >= NOW() - INTERVAL '42 days'
    ORDER BY created_at DESC
  `);

  const rows = result.rows as { domain: string; created_at: string }[];
  const now = Date.now();

  function computeCategory(windowDays: number, thresholdPct: number) {
    const cutoff = now - windowDays * 24 * 60 * 60 * 1000;
    const subset = rows.filter(r => new Date(r.created_at).getTime() >= cutoff);
    const counts = new Map<string, number>();
    for (const r of subset) counts.set(r.domain, (counts.get(r.domain) ?? 0) + 1);
    const total = subset.length;
    const distribution = Array.from(counts.entries())
      .map(([domain, mentions]) => ({ domain, pct: total > 0 ? Math.round((mentions / total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.pct - a.pct);
    const top = distribution[0];
    const dominant = top && top.pct >= thresholdPct
      ? { domain: top.domain, pct: top.pct, window_days: windowDays, threshold: thresholdPct }
      : null;
    return { dominant, distribution };
  }

  const lavoro = computeCategory(42, 60);
  const studio = computeCategory(21, 45);
  const hobby  = computeCategory(14, 30);

  return {
    lavoro:  lavoro.dominant,
    studio:  studio.dominant,
    hobby:   hobby.dominant,
    distribution: {
      lavoro: lavoro.distribution,
      studio: studio.distribution,
      hobby:  hobby.distribution,
    },
  };
}

// ─── Context File — declared facts (Pro only) ────────────────────────────────

const declaredFactBodySchema = z.object({
  fact: z.string().min(1).max(200),
});

router.get("/users/me/context-file/facts", async (req, res) => {
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  if (user.plan !== "pro") { res.status(403).json({ error: "Pro required", code: "PRO_REQUIRED" }); return; }

  const facts = await getActiveDeclaredFacts(user.id);
  res.json(facts);
});

router.post("/users/me/context-file/facts", async (req, res) => {
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  if (user.plan !== "pro") { res.status(403).json({ error: "Pro required", code: "PRO_REQUIRED" }); return; }

  const parsed = declaredFactBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userDeclaredFacts)
    .where(and(eq(userDeclaredFacts.userId, user.id), eq(userDeclaredFacts.isActive, true)));

  if (Number(count) >= 10) {
    res.status(422).json({ error: "Limit reached", code: "FACTS_LIMIT_REACHED", max: 10 });
    return;
  }

  const [inserted] = await db
    .insert(userDeclaredFacts)
    .values({ userId: user.id, fact: parsed.data.fact })
    .returning({ id: userDeclaredFacts.id, fact: userDeclaredFacts.fact, declaredAt: userDeclaredFacts.declaredAt });

  res.status(201).json(inserted);
});

router.delete("/users/me/context-file/facts/:factId", async (req, res) => {
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  if (user.plan !== "pro") { res.status(403).json({ error: "Pro required", code: "PRO_REQUIRED" }); return; }

  const factId = parseInt(req.params.factId!, 10);
  if (isNaN(factId)) { res.status(400).json({ error: "Invalid factId" }); return; }

  const result = await db
    .update(userDeclaredFacts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(userDeclaredFacts.id, factId), eq(userDeclaredFacts.userId, user.id), eq(userDeclaredFacts.isActive, true)));

  if (result.rowCount === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

// ─── Context File — AI inferred facts (Pro only) ─────────────────────────────

router.get("/users/me/context-file/inferred-facts", async (req, res) => {
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  if (user.plan !== "pro") { res.status(403).json({ error: "Pro required", code: "PRO_REQUIRED" }); return; }

  const facts = await getActiveInferredFacts(user.id);
  res.json(facts);
});

router.delete("/users/me/context-file/inferred-facts/:factId", async (req, res) => {
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  if (user.plan !== "pro") { res.status(403).json({ error: "Pro required", code: "PRO_REQUIRED" }); return; }

  const factId = parseInt(req.params.factId!, 10);
  if (isNaN(factId)) { res.status(400).json({ error: "Invalid factId" }); return; }

  const result = await db
    .update(aiInferredFacts)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(aiInferredFacts.id, factId), eq(aiInferredFacts.userId, user.id)));

  if (result.rowCount === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

router.post("/users/me/context-file/inferred-facts/:factId/promote", async (req, res) => {
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  if (user.plan !== "pro") { res.status(403).json({ error: "Pro required", code: "PRO_REQUIRED" }); return; }

  const factId = parseInt(req.params.factId!, 10);
  if (isNaN(factId)) { res.status(400).json({ error: "Invalid factId" }); return; }

  const [inferred] = await db
    .select({ id: aiInferredFacts.id, fact: aiInferredFacts.fact })
    .from(aiInferredFacts)
    .where(and(eq(aiInferredFacts.id, factId), eq(aiInferredFacts.userId, user.id)))
    .limit(1);

  if (!inferred) { res.status(404).json({ error: "Not found" }); return; }

  const [declared] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(userDeclaredFacts)
      .values({ userId: user.id, fact: inferred.fact, isActive: true })
      .returning({ id: userDeclaredFacts.id, fact: userDeclaredFacts.fact, declaredAt: userDeclaredFacts.declaredAt });
    await tx
      .update(aiInferredFacts)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(aiInferredFacts.id, factId));
    return [inserted];
  });

  res.status(201).json(declared);
});

// ─── Context File — domain dominance ─────────────────────────────────────────

router.get("/users/me/context-file/domains", async (req, res) => {
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  if (user.plan !== "pro") { res.status(403).json({ error: "Pro required", code: "PRO_REQUIRED" }); return; }

  res.json(await getDomainDominance(user.id));
});

// ─── Context File — public summary / Component B (Pro only) ─────────────────

router.get("/users/me/context-file/public-summary", async (req, res) => {
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  if (user.plan !== "pro") { res.status(403).json({ error: "Pro required", code: "PRO_REQUIRED" }); return; }

  const [profile, [gam]] = await Promise.all([
    buildUserProfile(user.id),
    db.select({ xp: gamification.xp, streak: gamification.streak })
      .from(gamification)
      .where(eq(gamification.userId, user.id))
      .limit(1),
  ]);

  const xp = gam?.xp ?? 0;
  const streakDays = gam?.streak ?? 0;

  const md = profile.macroDimensions;
  const topDimension = (Object.entries(md) as [string, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  res.json({
    sgiScore:     profile.sgiScore,
    sgiTrend: {
      daily:   profile.sgiDailyDelta   ?? null,
      weekly:  profile.sgiWeeklyDelta  ?? null,
      monthly: profile.sgiMonthlyDelta ?? null,
    },
    globalRank:    profile.globalRank,
    totalUsers:    profile.totalUsers,
    percentile:    profile.percentile,
    rankChange30d: profile.rankChange30d ?? null,
    macroDimensions: md,
    topDimension,
    level:      computeLevel(xp),
    xp,
    streakDays,
  });
});

// ─── Context File — AI narrative (Pro only) ──────────────────────────────────

const NARRATIVE_CACHE_MS = 10 * 60 * 1000; // 10 minutes
const NARRATIVE_TIMEOUT_MS = 8_000;

function buildNarrativePrompt(
  declaredFacts: { fact: string }[],
  profile: Awaited<ReturnType<typeof buildUserProfile>> & { xp: number; streakDays: number; topDimension: string | null; level: number },
  domains: Awaited<ReturnType<typeof getDomainDominance>>,
  inferredFacts: { fact: string; status: string; persistenceLevel: string }[],
): string {
  const parts: string[] = [];

  parts.push(`You write a short personal narrative (4-8 sentences) for a user of SGI — an app that measures how a person's language and argumentation evolve. This is their Context File: a living portrait of who they are intellectually.`);

  parts.push(`\nUSER DATA:`);

  if (declaredFacts.length > 0) {
    parts.push(`\n[A — Self-declared facts]\n${declaredFacts.map(f => `- ${f.fact}`).join("\n")}`);
  }

  parts.push(`\n[B — SGI Profile & Progress]`);
  parts.push(`Score: ${profile.sgiScore?.toFixed(1) ?? "n/a"} | Level: ${profile.level} | XP: ${profile.xp}`);
  parts.push(`Global rank: ${profile.globalRank ?? "unranked"} of ${profile.totalUsers} | Percentile: ${profile.percentile != null ? profile.percentile + "%" : "n/a"}`);
  if (profile.topDimension) parts.push(`Strongest dimension: ${profile.topDimension}`);
  if (profile.streakDays > 0) parts.push(`Current streak: ${profile.streakDays} days`);

  const dominantAreas = [domains.lavoro, domains.studio, domains.hobby].filter(Boolean);
  if (dominantAreas.length > 0) {
    parts.push(`\n[C — Contextual areas (recent activity)]\n${dominantAreas.map(d => `- ${d!.domain} (${d!.pct}% over last ${d!.window_days}d)`).join("\n")}`);
  }

  if (inferredFacts.length > 0) {
    const capped = [
      ...inferredFacts.filter(f => f.status === "active").slice(0, 15),
      ...inferredFacts.filter(f => f.status === "stale").slice(0, 5),
    ];
    parts.push(`\n[D — AI-inferred facts]\n${capped.map(f => `- ${f.fact} (${f.persistenceLevel})`).join("\n")}`);
  }

  parts.push(`\nWRITE the narrative in Italian. Speak directly to the user ("tu"). Synthesize all available components into a single flowing portrait — who they are, what they care about, how their thinking shows up. Be specific, not generic. Never mention neuroscience or the brain. Use **bold** to highlight one or two key traits or insights. No emojis, no headers, no bullet lists — flowing prose only. Output ONLY the narrative text.`);

  return parts.join("\n");
}

router.get("/users/me/context-file/narrative", async (req, res) => {
  const clerkId = getAuth(req).userId;
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
  if (user.plan !== "pro") { res.status(403).json({ error: "Pro required", code: "PRO_REQUIRED" }); return; }

  try {
    // 1. Check cache
    const [cached] = await db
      .select()
      .from(contextFileNarratives)
      .where(and(
        eq(contextFileNarratives.userId, user.id),
        sql`${contextFileNarratives.expiresAt} > NOW()`,
      ))
      .limit(1);

    if (cached) {
      res.json({ narrative: cached.generatedText, cached: true, generatedAt: cached.generatedAt });
      return;
    }

    // 2. Aggregate all 4 components in parallel
    const [declaredFacts, profile, domains, inferredFacts, [gam]] = await Promise.all([
      getActiveDeclaredFacts(user.id),
      buildUserProfile(user.id),
      getDomainDominance(user.id),
      getActiveInferredFacts(user.id),
      db.select({ xp: gamification.xp, streak: gamification.streak })
        .from(gamification)
        .where(eq(gamification.userId, user.id))
        .limit(1),
    ]);

    const xp = gam?.xp ?? 0;
    const streakDays = gam?.streak ?? 0;
    const md = profile.macroDimensions;
    const topDimension = (Object.entries(md) as [string, number][])
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const fullProfile = { ...profile, xp, streakDays, topDimension, level: computeLevel(xp) };

    // 3. Placeholder for empty users (no meaningful data yet)
    const hasScore = profile.sgiScore != null && profile.sgiScore > 0;
    const hasDeclared = declaredFacts.length > 0;
    const hasDomains = domains.lavoro != null || domains.studio != null || domains.hobby != null;
    const hasInferred = inferredFacts.length > 0;

    if (!hasScore && !hasDeclared && !hasDomains && !hasInferred) {
      const placeholder = "Il tuo Context File è ancora vuoto. Inizia a conversare con SGI e aggiungi qualche fatto su di te: la narrativa si costruirà man mano che il sistema impara a conoscerti.";
      res.json({ narrative: placeholder, cached: false, generatedAt: new Date() });
      return;
    }

    // 4. Build prompt and call Haiku
    const prompt = buildNarrativePrompt(declaredFacts, fullProfile, domains, inferredFacts);
    const inputTokensEst = Math.ceil(prompt.length / 4); // rough char→token estimate

    const call = anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    });

    const timeoutGuard = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("narrative timeout")), NARRATIVE_TIMEOUT_MS),
    );

    const response = await Promise.race([call, timeoutGuard]);
    const block = response.content[0];
    const narrativeText = block && block.type === "text" ? block.text.trim() : "";

    if (!narrativeText) {
      res.status(502).json({ error: "Empty response from AI model" });
      return;
    }

    // 5. UPSERT cache
    const now = new Date();
    const expiresAt = new Date(Date.now() + NARRATIVE_CACHE_MS);
    await db
      .insert(contextFileNarratives)
      .values({ userId: user.id, generatedText: narrativeText, generatedAt: now, expiresAt })
      .onConflictDoUpdate({
        target: contextFileNarratives.userId,
        set: { generatedText: narrativeText, generatedAt: now, expiresAt },
      });

    // 6. Log generation (awaited — pricing data must not be lost)
    await db
      .insert(narrativeGenerationLog)
      .values({ userId: user.id, generatedAt: now, inputTokensEst });

    res.json({ narrative: narrativeText, cached: false, generatedAt: now });
  } catch (err) {
    console.error("[narrative] generation failed:", err instanceof Error ? err.message : String(err));
    res.status(502).json({ error: "Failed to generate narrative" });
  }
});

// ─── GET /users/me/verdict ───────────────────────────────────────────────────

router.get("/users/me/verdict", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    if (user.plan === "free") {
      res.status(403).json({ error: "Premium required", code: "PREMIUM_REQUIRED" });
      return;
    }

    const lang = typeof req.query.lang === "string" ? req.query.lang : "it";
    const d = new Date();
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

    const [cached] = await db.select()
      .from(verdicts)
      .where(and(
        eq(verdicts.userId, user.id),
        eq(verdicts.monthKey, monthKey),
        sql`${verdicts.expiresAt} > NOW()`,
      ))
      .limit(1);

    if (cached) {
      res.json({
        verdict: cached.verdict,
        archetype: cached.archetype,
        supportingMetrics: cached.supportingMetrics,
        lifestyleSuggestion: cached.lifestyleSuggestion,
        monthKey: cached.monthKey,
        cached: true,
      });
      return;
    }

    await generateVerdict(user.id, lang);

    const [fresh] = await db.select()
      .from(verdicts)
      .where(and(eq(verdicts.userId, user.id), eq(verdicts.monthKey, monthKey)))
      .limit(1);

    if (!fresh) {
      res.status(502).json({ error: "Failed to generate verdict" });
      return;
    }

    res.json({
      verdict: fresh.verdict,
      archetype: fresh.archetype,
      supportingMetrics: fresh.supportingMetrics,
      lifestyleSuggestion: fresh.lifestyleSuggestion,
      monthKey: fresh.monthKey,
      cached: false,
    });
  } catch (err) {
    console.error("[verdict] endpoint failed:", err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
