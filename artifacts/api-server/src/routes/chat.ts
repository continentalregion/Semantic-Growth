import { getAuth } from "@clerk/express";
import { Router } from "express";
import { db } from "@workspace/db";
import { users, conversations, messages, sgiSnapshots, gamification, semanticDomains, blockedAttempts } from "@workspace/db";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { scoreMessage, computeNewSgiScore } from "../lib/sgiScoring";
import { updateLeaderboardRank, checkAndAwardBadges } from "./users";
import { updateMissionProgress } from "./gamification";
import {
  MONTHLY_LIMITS,
  MODEL_COST_CENTS_PER_1K,
  LOG_BLOCKS,
  PRICING_SUMMARY,
} from "../config/pricing";

const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o", "o4-mini"] as const;
const CLAUDE_MODELS = ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"] as const;
const ALL_MODELS = [...OPENAI_MODELS, ...CLAUDE_MODELS] as const;
type ModelId = typeof ALL_MODELS[number];

// Log pricing summary on startup for transparency
console.info("[pricing] config loaded:", PRICING_SUMMARY);

function isClaudeModel(model: string): boolean {
  return model.startsWith("claude-");
}

function calcCostCents(model: string, tokens: number): number {
  const rate = MODEL_COST_CENTS_PER_1K[model] ?? 0.5;
  return Math.round((tokens / 1000) * rate * 1000) / 1000;
}

// Returns today's YYYY-MM-01 (start of month) as string
function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function resetMonthlyIfNeeded(userId: number, user: { monthlyResetDate: string | null; monthlyMessagesUsed: number }) {
  const thisMonth = currentMonthKey();
  if (user.monthlyResetDate !== thisMonth) {
    await db.update(users)
      .set({ monthlyMessagesUsed: 0, monthlyResetDate: thisMonth })
      .where(eq(users.id, userId));
    return 0;
  }
  return user.monthlyMessagesUsed;
}

const router = Router();

const SYSTEM_PROMPT = `You are an intellectually rigorous conversational partner. Your role is to engage deeply with ideas, challenge assumptions, explore connections across disciplines, and help the user develop richer frameworks for thinking. 

You are not a general assistant — you are a partner for intellectual exploration. Engage with philosophy, science, mathematics, history, literature, technology, and any domain the user brings. Ask probing follow-up questions. Make unexpected cross-domain connections. Never dumb down your language — match and slightly exceed the user's conceptual level.

The platform you are part of tracks the user's semantic growth across conversations. Reward precise language, deep reasoning, and novel connections. Do not mention scoring — just engage at the highest intellectual level possible.`;

router.get("/openai/conversations", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    await resetMonthlyIfNeeded(user.id, user);

    const convos = await db.select().from(conversations)
      .where(eq(conversations.userId, user.id))
      .orderBy(desc(conversations.createdAt))
      .limit(50);

    res.json(convos.map(c => ({
      id: c.id,
      title: c.title,
      model: c.model ?? "claude-opus-4-8",
      sgiDelta: c.sgiDelta ?? 0,
      createdAt: c.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/openai/usage", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const currentUsed = await resetMonthlyIfNeeded(user.id, user);
    const limit = MONTHLY_LIMITS[user.plan] ?? MONTHLY_LIMITS.free;
    const remaining = Math.max(0, limit - currentUsed);

    // Total cost this month from messages
    const thisMonth = currentMonthKey();
    const monthStart = new Date(thisMonth);
    const costRow = await db.select({ total: sql<number>`coalesce(sum(${messages.costCents}), 0)` })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(and(
        eq(conversations.userId, user.id),
        gte(messages.createdAt, monthStart),
        eq(messages.role, "assistant"),
      ));
    const totalCostCents = Number(costRow[0]?.total ?? 0);

    res.json({ used: currentUsed, limit, remaining, plan: user.plan, totalCostCents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/openai/conversations", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const title = req.body?.title ?? "New Conversation";
    const requestedModel = req.body?.model ?? "claude-opus-4-8";
    const model = ALL_MODELS.includes(requestedModel as ModelId) ? requestedModel as ModelId : "claude-opus-4-8";
    const [convo] = await db.insert(conversations).values({ userId: user.id, title, model, sgiDelta: 0 }).returning();
    if (!convo) { res.status(500).json({ error: "Failed to create conversation" }); return; }

    res.status(201).json({ id: convo.id, title: convo.title, model: convo.model, sgiDelta: 0, createdAt: convo.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/openai/conversations/:id", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
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
      model: convo.model ?? "claude-opus-4-8",
      sgiDelta: convo.sgiDelta ?? 0,
      createdAt: convo.createdAt.toISOString(),
      messages: msgs.map(m => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        sgiDelta: m.sgiDelta ?? null,
        tokensUsed: m.tokensUsed ?? null,
        costCents: m.costCents ?? null,
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
    const clerkId = getAuth(req).userId;
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
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const convoId = parseInt(req.params.id!, 10);
    const [convo] = await db.select().from(conversations)
      .where(and(eq(conversations.id, convoId), eq(conversations.userId, user.id))).limit(1);
    if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

    const userContent: string = req.body?.content ?? "";
    if (!userContent.trim()) { res.status(400).json({ error: "Message content is required" }); return; }

    // ── HARD STOP: controllo mensile PRIMA che la chiamata AI parta ─────────
    // Questo blocco avviene lato server — non è aggirabile dal client.
    const currentUsed = await resetMonthlyIfNeeded(user.id, user);
    const limit = MONTHLY_LIMITS[user.plan] ?? MONTHLY_LIMITS.free;
    if (currentUsed >= limit) {
      if (LOG_BLOCKS) {
        await db.insert(blockedAttempts).values({
          userId: user.id,
          plan: user.plan,
          reason: "monthly_limit",
          model: convo.model ?? "unknown",
          used: currentUsed,
          limit,
        }).catch(e => console.error("[block-log] failed to log block:", e));
        console.warn(`[block] userId=${user.id} plan=${user.plan} used=${currentUsed}/${limit} reason=monthly_limit`);
      }
      res.status(429).json({
        error: "Monthly message limit reached",
        code: "MONTHLY_LIMIT_REACHED",
        used: currentUsed,
        limit,
        plan: user.plan,
      });
      return;
    }
    // ── fine hard stop ────────────────────────────────────────────────────────

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

    const chosenModel = (convo.model ?? "claude-opus-4-8") as ModelId;
    let fullContent = "";
    let tokensUsed = 0;

    try {
      if (isClaudeModel(chosenModel)) {
        const claudeMessages = openaiMessages
          .filter(m => m.role !== "system")
          .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
        const systemMsg = openaiMessages.find(m => m.role === "system")?.content ?? SYSTEM_PROMPT;

        const stream = anthropic.messages.stream({
          model: chosenModel,
          max_tokens: 8192,
          system: systemMsg,
          messages: claudeMessages,
        });

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullContent += event.delta.text;
            res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
          }
        }
        const finalMsg = await stream.finalMessage();
        tokensUsed = (finalMsg.usage?.input_tokens ?? 0) + (finalMsg.usage?.output_tokens ?? 0);
      } else {
        const stream = await openai.chat.completions.create({
          model: chosenModel,
          messages: openaiMessages,
          stream: true,
          stream_options: { include_usage: true },
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullContent += delta;
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
          if (chunk.usage) {
            tokensUsed = (chunk.usage.prompt_tokens ?? 0) + (chunk.usage.completion_tokens ?? 0);
          }
        }
      }
    } catch (streamErr) {
      console.error("Stream error:", streamErr);
      res.write(`data: ${JSON.stringify({ content: "[Error generating response]" })}\n\n`);
    }

    const costCents = calcCostCents(chosenModel, tokensUsed);

    const [insertedAssistantMsg] = await db.insert(messages)
      .values({ conversationId: convoId, role: "assistant", content: fullContent, tokensUsed, costCents })
      .returning({ id: messages.id });

    // Increment monthly usage counter
    const newUsed = currentUsed + 1;
    await db.update(users)
      .set({ monthlyMessagesUsed: newUsed, monthlyResetDate: currentMonthKey() })
      .where(eq(users.id, user.id));

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
    const [updatedGam] = await db.update(gamification)
      .set({
        xp: sql`${gamification.xp} + ${xpGained}`,
        streak: sql`CASE WHEN DATE(${gamification.lastActiveDate}) = CURRENT_DATE - INTERVAL '1 day' THEN ${gamification.streak} + 1 WHEN DATE(${gamification.lastActiveDate}) = CURRENT_DATE THEN ${gamification.streak} ELSE 1 END`,
        lastActiveDate: new Date().toISOString().split("T")[0],
        level: sql`floor(sqrt((${gamification.xp} + ${xpGained}) / 100.0)) + 1`,
      })
      .where(eq(gamification.userId, user.id))
      .returning({ streak: gamification.streak });

    const currentStreak = updatedGam?.streak ?? 1;

    await checkAndAwardBadges(user.id, {
      interdisciplinaryScore: scoreResult.dimensions.interdisciplinaryScore,
      abstractionLevel: scoreResult.dimensions.abstractionLevel,
    }, convoCount, scoreResult.domains);

    await updateMissionProgress(user.id, {
      conversationCompleted: true,
      reasoningDepth: scoreResult.dimensions.reasoningDepth,
      domainsExplored: scoreResult.domains,
      sgiDelta,
      streakDays: currentStreak,
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

    // Auto-generate title on first message
    let newTitle: string | undefined;
    const isFirstMessage = history.filter(m => m.role === "user").length === 1;
    if (isFirstMessage && (convo.title === "Exploration" || convo.title === "New Conversation")) {
      try {
        const titleResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 20,
          messages: [{
            role: "user",
            content: `Summarize this message in 3-5 words, title case, no punctuation: "${userContent.slice(0, 300)}"`
          }]
        });
        const generated = titleResp.choices[0]?.message?.content?.trim().replace(/[".]/g, "");
        if (generated && generated.length > 0 && generated.length <= 60) {
          newTitle = generated;
          await db.update(conversations).set({ title: newTitle }).where(eq(conversations.id, convoId));
        }
      } catch (err) {
        console.error("Failed to generate conversation title:", err);
      }
    }

    const remainingAfter = Math.max(0, limit - newUsed);

    res.write(`data: ${JSON.stringify({
      done: true,
      sgiDelta,
      newSgi: Math.round(newSgi * 10) / 10,
      tokensUsed,
      costCents,
      usage: { used: newUsed, limit, remaining: remainingAfter, plan: user.plan },
      ...(newTitle ? { title: newTitle } : {}),
    })}\n\n`);
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
