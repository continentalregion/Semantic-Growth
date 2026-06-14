import { Router } from "express";
import { db } from "@workspace/db";
import { users, conversations, messages, sgiSnapshots, gamification, semanticDomains } from "@workspace/db";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { scoreMessage, computeNewSgiScore } from "../lib/sgiScoring";
import { updateLeaderboardRank, checkAndAwardBadges } from "./users";
import { updateMissionProgress } from "./gamification";

const router = Router();

const SYSTEM_PROMPT = `You are an intellectually rigorous conversational partner. Your role is to engage deeply with ideas, challenge assumptions, explore connections across disciplines, and help the user develop richer frameworks for thinking. 

You are not a general assistant — you are a partner for intellectual exploration. Engage with philosophy, science, mathematics, history, literature, technology, and any domain the user brings. Ask probing follow-up questions. Make unexpected cross-domain connections. Never dumb down your language — match and slightly exceed the user's conceptual level.

The platform you are part of tracks the user's semantic growth across conversations. Reward precise language, deep reasoning, and novel connections. Do not mention scoring — just engage at the highest intellectual level possible.`;

router.get("/openai/conversations", async (req, res) => {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const convos = await db.select().from(conversations)
      .where(eq(conversations.userId, user.id))
      .orderBy(desc(conversations.createdAt))
      .limit(50);

    res.json(convos.map(c => ({
      id: c.id,
      title: c.title,
      sgiDelta: c.sgiDelta ?? 0,
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/openai/conversations", async (req, res) => {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const title = req.body?.title ?? "New Conversation";
    const [convo] = await db.insert(conversations).values({ userId: user.id, title, sgiDelta: 0 }).returning();
    if (!convo) { res.status(500).json({ error: "Failed to create conversation" }); return; }

    res.status(201).json({ id: convo.id, title: convo.title, sgiDelta: 0, createdAt: convo.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/openai/conversations/:id", async (req, res) => {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const convoId = parseInt(req.params.id!, 10);
    const [convo] = await db.select().from(conversations)
      .where(and(eq(conversations.id, convoId), eq(conversations.userId, user.id))).limit(1);
    if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

    const msgs = await db.select().from(messages).where(eq(messages.conversationId, convoId)).orderBy(messages.createdAt);

    res.json({
      id: convo.id,
      title: convo.title,
      sgiDelta: convo.sgiDelta ?? 0,
      createdAt: convo.createdAt.toISOString(),
      messages: msgs.map(m => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        sgiDelta: m.sgiDelta ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/openai/conversations/:id", async (req, res) => {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const convoId = parseInt(req.params.id!, 10);
    const [convo] = await db.select().from(conversations)
      .where(and(eq(conversations.id, convoId), eq(conversations.userId, user.id))).limit(1);
    if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

    await db.delete(conversations).where(eq(conversations.id, convoId));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/openai/conversations/:id/messages", async (req, res) => {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const convoId = parseInt(req.params.id!, 10);
    const [convo] = await db.select().from(conversations)
      .where(and(eq(conversations.id, convoId), eq(conversations.userId, user.id))).limit(1);
    if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

    const userContent: string = req.body?.content ?? "";
    if (!userContent.trim()) { res.status(400).json({ error: "Message content is required" }); return; }

    if (user.plan === "free") {
      const FREE_TIER_DAILY_LIMIT = 10;
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const todayMessages = await db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversationId))
        .where(and(
          eq(conversations.userId, user.id),
          eq(messages.role, "user"),
          gte(messages.createdAt, dayStart),
        ));
      if (Number(todayMessages[0]?.count ?? 0) >= FREE_TIER_DAILY_LIMIT) {
        res.status(429).json({ error: "Daily message limit reached", code: "DAILY_LIMIT_REACHED", limit: FREE_TIER_DAILY_LIMIT });
        return;
      }
    }

    const [insertedUserMsg] = await db.insert(messages).values({ conversationId: convoId, role: "user", content: userContent }).returning({ id: messages.id });

    const history = await db.select().from(messages)
      .where(eq(messages.conversationId, convoId))
      .orderBy(messages.createdAt)
      .limit(20);

    const openaiMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let fullContent = "";
    try {
      const stream = await openai.chat.completions.create({
        model: "gpt-5-nano",
        messages: openaiMessages,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          fullContent += delta;
          res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
        }
      }
    } catch (streamErr) {
      console.error("Stream error:", streamErr);
      res.write(`data: ${JSON.stringify({ content: "[Error generating response]" })}\n\n`);
    }

    await db.insert(messages).values({ conversationId: convoId, role: "assistant", content: fullContent });

    const historyForScoring = history.slice(-4).map(m => ({ role: m.role, content: m.content }));
    const scoreResult = await scoreMessage(userContent, historyForScoring);

    const oldSgi = user.sgiScore;
    const newSgi = computeNewSgiScore(oldSgi, scoreResult.rawScore, 0.15);
    const sgiDelta = Math.round((newSgi - oldSgi) * 10) / 10;

    await db.update(users).set({ sgiScore: newSgi, updatedAt: new Date() }).where(eq(users.id, user.id));
    await db.insert(sgiSnapshots).values({
      userId: user.id,
      score: newSgi,
      conceptualComplexity: scoreResult.dimensions.conceptualComplexity,
      semanticVariety: scoreResult.dimensions.semanticVariety,
      interdisciplinaryScore: scoreResult.dimensions.interdisciplinaryScore,
      reasoningDepth: scoreResult.dimensions.reasoningDepth,
      originality: scoreResult.dimensions.originality,
      stability: scoreResult.dimensions.stability,
      continuity: scoreResult.dimensions.continuity,
    });

    const totalConvos = await db.select({ count: sql<number>`count(*)` }).from(conversations).where(eq(conversations.userId, user.id));
    const convoCount = Number(totalConvos[0]?.count ?? 0);

    const newConvoDelta = (convo.sgiDelta ?? 0) + sgiDelta;
    await db.update(conversations).set({ sgiDelta: newConvoDelta }).where(eq(conversations.id, convoId));

    for (const domain of scoreResult.domains) {
      await db.insert(semanticDomains).values({
        userId: user.id,
        domain,
        explorationScore: scoreResult.dimensions.interdisciplinaryScore,
        messageCount: 1,
      }).onConflictDoUpdate({
        target: [semanticDomains.userId, semanticDomains.domain],
        set: {
          explorationScore: sql`(${semanticDomains.explorationScore} * ${semanticDomains.messageCount} + ${scoreResult.dimensions.interdisciplinaryScore}) / (${semanticDomains.messageCount} + 1)`,
          messageCount: sql`${semanticDomains.messageCount} + 1`,
          updatedAt: new Date(),
        },
      });
    }

    const xpGained = Math.round(10 + sgiDelta * 5 + convoCount * 0.5);
    await db.update(gamification)
      .set({
        xp: sql`${gamification.xp} + ${xpGained}`,
        streak: sql`CASE WHEN DATE(${gamification.lastActiveDate}) = CURRENT_DATE - INTERVAL '1 day' THEN ${gamification.streak} + 1 WHEN DATE(${gamification.lastActiveDate}) = CURRENT_DATE THEN ${gamification.streak} ELSE 1 END`,
        lastActiveDate: new Date().toISOString().split("T")[0],
        level: sql`floor(sqrt((${gamification.xp} + ${xpGained}) / 100.0)) + 1`,
      })
      .where(eq(gamification.userId, user.id));

    await checkAndAwardBadges(user.id, {
      interdisciplinaryScore: scoreResult.dimensions.interdisciplinaryScore,
      abstractionLevel: scoreResult.dimensions.abstractionLevel,
    }, convoCount, scoreResult.domains);

    await updateMissionProgress(user.id, {
      conversationCompleted: true,
      reasoningDepth: scoreResult.dimensions.reasoningDepth,
      domainsExplored: scoreResult.domains,
      sgiDelta,
    }, async (bonusXp) => {
      await db.update(gamification)
        .set({ xp: sql`${gamification.xp} + ${bonusXp}` })
        .where(eq(gamification.userId, user.id));
    });

    await updateLeaderboardRank(user.id);

    if (insertedUserMsg) {
      await db.update(messages)
        .set({ sgiDelta })
        .where(eq(messages.id, insertedUserMsg.id));
    }

    res.write(`data: ${JSON.stringify({ done: true, sgiDelta, newSgi: Math.round(newSgi * 10) / 10 })}\n\n`);
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal error" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Internal error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
