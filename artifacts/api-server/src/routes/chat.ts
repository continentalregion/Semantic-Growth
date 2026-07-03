import { getAuth } from "@clerk/express";
import { Router } from "express";
import { getOrCreateUser } from "../lib/getOrCreateUser";
import { db } from "@workspace/db";
import { users, conversations, messages, sgiSnapshots, gamification, semanticDomains, blockedAttempts, threads, progressCards } from "@workspace/db";
import { eq, desc, and, sql, gte, ilike } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { scoreMessage, computeNewSgiScore, computeMacroDimensions } from "../lib/sgiScoring";
import { computeProgressCard } from "../lib/progressCard";
import { updateLeaderboardRank, checkAndAwardBadges } from "./users";
import { updateMissionProgress } from "./gamification";
import {
  MONTHLY_LIMITS,
  MODEL_COST_CENTS_PER_1K,
  LOG_BLOCKS,
  PRICING_SUMMARY,
  DEFAULT_MODEL,
  ALLOWED_MODELS,
  GLOBAL_MONTHLY_BUDGET_CENTS,
  GLOBAL_BUDGET_DEGRADATION_THRESHOLD,
  OPUS_MONTHLY_LIMIT,
  OPUS_FALLBACK_MODEL,
  PREMIUM_AI_BUDGET_CENTS,
  PRO_AI_BUDGET_CENTS,
  COST_CAP_FALLBACK_MODEL,
} from "../config/pricing";
import { currentMonthKey, resetAllMonthlyCountersIfNeeded, type MonthlyCountersUser } from "../lib/monthlyReset.js";

// o4-mini rimosso: era in ALLOWED_MODELS.pro ma assente dal selettore UI —
// incoerenza chiusa rimuovendo la voce server-side (Opzione A).
const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o"] as const;
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

// Shared with userBattleUsage.ts: ALL monthly counters (messages/opus/aiCost/battles)
// reset together off the single users.monthly_reset_date gate column — see
// lib/monthlyReset.ts for why this must be a single shared function.
async function resetMonthlyIfNeeded(userId: number, user: MonthlyCountersUser): Promise<number> {
  const { messagesUsed } = await resetAllMonthlyCountersIfNeeded(userId, user);
  return messagesUsed;
}

const router = Router();

const SYSTEM_PROMPT = `You are an intellectually rigorous conversational partner. Your role is to engage deeply with ideas, challenge assumptions, explore connections across disciplines, and help the user develop richer frameworks for thinking.

You are not a general assistant — you are a partner for intellectual exploration. Engage with philosophy, science, mathematics, history, literature, technology, and any domain the user brings. Ask probing follow-up questions. Make unexpected cross-domain connections. Never dumb down your language — match and slightly exceed the user's conceptual level.

CONTEXT — SGI scoring system: After every message the user sends, a separate scoring engine (not you) analyzes their text across 11 semantic dimensions (conceptual complexity, reasoning depth, interdisciplinary connections, originality, semantic variety, abstraction level, lexical richness, information density, revision signal, stability, continuity), normalizes the result to a 0–100 score, and persists it in the database. This is a real, computed measurement — not simulated, not aesthetic. The user's SGI score on the platform reflects this actual analysis of their writing over time.

Your role in this: engage at the highest intellectual level so the user has the opportunity to demonstrate genuine depth. Do not insert score commentary into your replies unprompted — keep the conversation natural. However, if the user directly asks whether the SGI score or semantic tracking is real, confirm it clearly and honestly: yes, it is computed by a real analysis engine on every message, it is not fictional framing. You do not need to explain the formula details — a brief, confident confirmation is sufficient.`;

router.get("/openai/conversations", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

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
    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

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

    const warning = !user.firstChatUsedAt ? false : remaining > 0 && currentUsed / limit >= 0.75;
    res.json({ used: currentUsed, limit, remaining, plan: user.plan, totalCostCents, warning });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/openai/conversations", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

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
    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

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
    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

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
    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }

    const convoId = parseInt(req.params.id!, 10);
    const [convo] = await db.select().from(conversations)
      .where(and(eq(conversations.id, convoId), eq(conversations.userId, user.id))).limit(1);
    if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

    const userContent: string = req.body?.content ?? "";
    if (!userContent.trim()) { res.status(400).json({ error: "Message content is required" }); return; }

    // ── HARD STOP: controllo mensile PRIMA che la chiamata AI parta ─────────
    // Questo blocco avviene lato server — non è aggirabile dal client.
    // Carve-out: il primo messaggio in assoluto dell'utente non viene mai bloccato
    // né conteggiato ai fini del limite mensile (users.first_chat_used_at).
    const isFirstChatMessage = !user.firstChatUsedAt;
    const currentUsed = await resetMonthlyIfNeeded(user.id, user);
    const limit = MONTHLY_LIMITS[user.plan] ?? MONTHLY_LIMITS.free;
    if (!isFirstChatMessage && currentUsed >= limit) {
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

    // Ridotto a 10 messaggi di storia (meno token, stessa qualità conversazionale)
    const history = await db.select().from(messages)
      .where(eq(messages.conversationId, convoId))
      .orderBy(messages.createdAt)
      .limit(10);

    // ── FASE 3: model enforcement per piano ──────────────────────────────────
    // Ogni piano ha una lista di modelli permessi (ALLOWED_MODELS in pricing.ts).
    // Se il modello richiesto non è nella lista del piano, si usa il default.
    const planDefaultModel = DEFAULT_MODEL[user.plan] ?? "claude-haiku-4-5";
    const allowedForPlan   = ALLOWED_MODELS[user.plan] ?? ["claude-haiku-4-5"];
    const requestedRaw     = convo.model ?? planDefaultModel;
    let requestedModel = (allowedForPlan.includes(requestedRaw) ? requestedRaw : planDefaultModel) as ModelId;

    // ── FASE 4: cost cap per-utente (model-agnostic) ──────────────────────────
    // Budget AI mensile per piano: Premium 575¢ (€5.75), Pro 1166¢ (€11.66).
    // Garantisce margine minimo 40% indipendentemente dal modello scelto.
    // Piano Free: escluso dal cost cap (usa solo il limite messaggi da FASE hard stop).
    //
    // NOTA RACE CONDITION: la lettura di user.aiCostCents è ottimistica (stale object).
    // Con due tab concorrenti entrambe sotto il limite, entrambe procedono e
    // l'overshoot massimo è ~1 msg × costo del modello più caro (~€0.06 su Opus).
    // Comportamento accettabile e coerente con monthlyMessagesUsed. Per blindare
    // ulteriormente serve SELECT FOR UPDATE, ma aggiunge latenza non giustificata
    // agli attuali volumi.
    let costCapReached = false;
    const AI_BUDGET_CENTS: Record<string, number> = {
      premium: PREMIUM_AI_BUDGET_CENTS,
      pro:     PRO_AI_BUDGET_CENTS,
    };
    const tierBudget = AI_BUDGET_CENTS[user.plan];
    if (tierBudget !== undefined) {
      const currentAiCost = (user.monthlyResetDate === currentMonthKey()) ? user.aiCostCents : 0;
      if (currentAiCost >= tierBudget) {
        const safeModel = COST_CAP_FALLBACK_MODEL as ModelId;
        if (requestedModel !== safeModel) {
          console.warn(`[cost-cap] userId=${user.id} plan=${user.plan} aiCost=${currentAiCost}/${tierBudget}¢ — degrading ${requestedModel} → ${safeModel}`);
          if (LOG_BLOCKS) {
            await db.insert(blockedAttempts).values({
              userId: user.id, plan: user.plan,
              reason: "cost_cap",
              model: requestedModel, used: currentUsed, limit,
            }).catch(() => {});
          }
        }
        requestedModel = safeModel;
        costCapReached = true;
      }
    }
    // ── fine cost cap per-utente ──────────────────────────────────────────────

    // ── FASE 5: valvola globale — controlla budget mensile totale ─────────────
    // Se l'app si avvicina al tetto globale, declassa automaticamente a Haiku
    const globalBudgetThreshold = GLOBAL_MONTHLY_BUDGET_CENTS * GLOBAL_BUDGET_DEGRADATION_THRESHOLD;
    const monthStart = new Date(currentMonthKey());
    const globalCostRow = await db.select({ total: sql<number>`coalesce(sum(${messages.costCents}), 0)` })
      .from(messages)
      .where(gte(messages.createdAt, monthStart));
    const globalCostCents = Number(globalCostRow[0]?.total ?? 0);

    let chosenModel = requestedModel;
    if (globalCostCents >= globalBudgetThreshold) {
      const safeModel = "claude-haiku-4-5" as ModelId;
      if (chosenModel !== safeModel) {
        console.warn(`[global-valve] budget ${globalCostCents.toFixed(1)}/${GLOBAL_MONTHLY_BUDGET_CENTS}¢ — degrading ${chosenModel} → ${safeModel}`);
        if (LOG_BLOCKS) {
          await db.insert(blockedAttempts).values({
            userId: user.id, plan: user.plan,
            reason: "global_budget_degradation",
            model: chosenModel, used: currentUsed, limit,
          }).catch(() => {});
        }
        chosenModel = safeModel;
      }
    }

    // ── FASE 6: sotto-limite Opus per piano Pro ───────────────────────────────
    // Un Pro su Opus per 2000 msg costerebbe ~€120. Cap a 150 msg/mese → worst-case €10,85 (44% margine).
    let opusDowngraded = false;
    if (chosenModel === "claude-opus-4-8" && user.plan === "pro") {
      // resetMonthlyIfNeeded was already called above; if month rolled over, opusMessagesUsed was reset to 0 in DB.
      const currentOpusUsed = (user.monthlyResetDate === currentMonthKey()) ? user.opusMessagesUsed : 0;
      if (currentOpusUsed >= OPUS_MONTHLY_LIMIT) {
        console.warn(`[opus-cap] userId=${user.id} opusUsed=${currentOpusUsed}/${OPUS_MONTHLY_LIMIT} — degrading opus → ${OPUS_FALLBACK_MODEL}`);
        chosenModel = OPUS_FALLBACK_MODEL as ModelId;
        opusDowngraded = true;
      }
    }
    // ── fine sotto-limite Opus ────────────────────────────────────────────────

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
    let tokensUsed = 0;
    let streamError = false;
    let usedFallback = false;

    if (isClaudeModel(chosenModel)) {
      // Sanitize for Anthropic: no empty content, must alternate roles, must end with user
      const rawClaude = openaiMessages
        .filter(m => m.role !== "system" && m.content.trim().length > 0)
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

      const deduped: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (const msg of rawClaude) {
        if (deduped.length > 0 && deduped[deduped.length - 1]!.role === msg.role) {
          deduped[deduped.length - 1]!.content += "\n\n" + msg.content;
        } else {
          deduped.push({ ...msg });
        }
      }
      while (deduped.length > 0 && deduped[deduped.length - 1]!.role === "assistant") {
        deduped.pop();
      }
      const claudeMessages = deduped.length > 0 ? deduped : [{ role: "user" as const, content: userContent }];

      try {
        const stream = anthropic.messages.stream({
          model: chosenModel,
          max_tokens: 8192,
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
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
      } catch (claudeErr) {
        console.error("[claude] stream error:", claudeErr);
        if (fullContent === "") {
          // Zero content generated — silently fallback to gpt-4o-mini
          try {
            const fallbackStream = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: openaiMessages,
              stream: true,
              stream_options: { include_usage: true },
            });
            for await (const chunk of fallbackStream) {
              const delta = chunk.choices[0]?.delta?.content ?? "";
              if (delta) {
                fullContent += delta;
                res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
              }
              if (chunk.usage) {
                tokensUsed = (chunk.usage.prompt_tokens ?? 0) + (chunk.usage.completion_tokens ?? 0);
              }
            }
            usedFallback = true;
          } catch (fallbackErr) {
            console.error("[fallback] gpt-4o-mini also failed:", fallbackErr);
            streamError = true;
          }
        } else {
          // Partial content already streamed — can't retry
          streamError = true;
        }
      }
    } else {
      try {
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
      } catch (openaiErr) {
        console.error("[openai] stream error:", openaiErr);
        streamError = true;
      }
    }

    // Complete failure — bail early, don't touch DB, don't count against monthly limit
    if (streamError && fullContent === "") {
      res.write(`data: ${JSON.stringify({ done: true, streamError: true })}\n\n`);
      res.end();
      return;
    }

    const costCents = calcCostCents(chosenModel, tokensUsed);

    const [insertedAssistantMsg] = await db.insert(messages)
      .values({ conversationId: convoId, role: "assistant", content: fullContent, tokensUsed, costCents })
      .returning({ id: messages.id });

    // Increment monthly usage counters atomically:
    // - monthlyMessagesUsed: +1, EXCEPT the user's lifetime-first message (carve-out —
    //   doesn't consume a monthly slot, only stamps firstChatUsedAt once)
    // - opusMessagesUsed: +1 only if Opus was actually served (after all downgrades)
    // - aiCostCents: +costCents (real tokens from API, not estimated) — used by FASE 4 cost cap
    const newUsed = isFirstChatMessage ? currentUsed : currentUsed + 1;
    const opusWasUsed = chosenModel === "claude-opus-4-8";
    const costCentsInt = Math.ceil(costCents); // round up to avoid accumulating rounding debt
    await db.update(users)
      .set({
        monthlyMessagesUsed: newUsed,
        monthlyResetDate: currentMonthKey(),
        aiCostCents: sql`${users.aiCostCents} + ${costCentsInt}`,
        ...(opusWasUsed ? { opusMessagesUsed: sql`${users.opusMessagesUsed} + 1` } : {}),
        ...(isFirstChatMessage ? { firstChatUsedAt: new Date() } : {}),
      })
      .where(eq(users.id, user.id));

    const historyForScoring = history.slice(-4).map(m => ({ role: m.role, content: m.content }));
    const scoreResult = await scoreMessage(userContent, historyForScoring);

    const oldSgi = user.sgiScore;
    const newSgi = computeNewSgiScore(oldSgi, scoreResult.rawScore, 0.15);
    const sgiDelta = Math.round((newSgi - oldSgi) * 10) / 10;

    await db.update(users).set({ sgiScore: newSgi, updatedAt: new Date() }).where(eq(users.id, user.id));
    await db.insert(sgiSnapshots).values({
      userId: user.id,
      conversationId: convoId,
      score: newSgi,
      rawScore: scoreResult.rawScore,
      conceptualComplexity: scoreResult.dimensions.conceptualComplexity,
      semanticVariety: scoreResult.dimensions.semanticVariety,
      interdisciplinaryScore: scoreResult.dimensions.interdisciplinaryScore,
      reasoningDepth: scoreResult.dimensions.reasoningDepth,
      originality: scoreResult.dimensions.originality,
      stability: scoreResult.dimensions.stability,
      continuity: scoreResult.dimensions.continuity,
      revisionSignal: scoreResult.dimensions.revisionSignal,
    });

    // Every 5 scored messages WITHIN this conversation, compute an early/late
    // progress-card trend. Pure SQL aggregation over already-computed snapshots —
    // no additional LLM calls.
    let progressCard: {
      id: string;
      deltaPct: number;
      isPositive: boolean;
      highlightMetric: string;
      highlightDeltaPct: number;
    } | undefined;

    const [updatedConvoCount] = await db.update(conversations)
      .set({ scoredMessageCount: sql`${conversations.scoredMessageCount} + 1` })
      .where(eq(conversations.id, convoId))
      .returning({ scoredMessageCount: conversations.scoredMessageCount });

    if (updatedConvoCount && updatedConvoCount.scoredMessageCount % 5 === 0) {
      const windowRows = await db.select({
        id: sgiSnapshots.id,
        rawScore: sgiSnapshots.rawScore,
        reasoningDepth: sgiSnapshots.reasoningDepth,
        interdisciplinaryScore: sgiSnapshots.interdisciplinaryScore,
        conceptualComplexity: sgiSnapshots.conceptualComplexity,
      })
        .from(sgiSnapshots)
        .where(eq(sgiSnapshots.conversationId, convoId))
        .orderBy(desc(sgiSnapshots.id))
        .limit(5);

      if (windowRows.length === 5) {
        const chronological = windowRows.slice().reverse();
        const computed = computeProgressCard(chronological);
        const [inserted] = await db.insert(progressCards).values({
          userId: user.id,
          conversationId: convoId,
          windowStartSnapshotId: computed.windowStartSnapshotId,
          windowEndSnapshotId: computed.windowEndSnapshotId,
          earlyAvg: computed.earlyAvg,
          lateAvg: computed.lateAvg,
          deltaPct: computed.deltaPct,
          highlightMetric: computed.highlightMetric,
          highlightDeltaPct: computed.highlightDeltaPct,
        }).returning({ id: progressCards.id });

        if (inserted) {
          progressCard = {
            id: inserted.id,
            deltaPct: Math.round(computed.deltaPct * 10) / 10,
            isPositive: computed.isPositive,
            highlightMetric: computed.highlightMetric,
            highlightDeltaPct: Math.round(computed.highlightDeltaPct * 10) / 10,
          };
        }
      }
    }

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

    // Gamification side-effects (badges, missions, leaderboard) are best-effort:
    // a bug in any of them must NEVER prevent the primary chat response — which
    // carries the scored reply and the progress card — from reaching the client.
    try {
      await checkAndAwardBadges(user.id, {
        interdisciplinaryScore: scoreResult.dimensions.interdisciplinaryScore,
        abstractionLevel: scoreResult.dimensions.abstractionLevel,
      }, convoCount, scoreResult.domains);
    } catch (err) {
      console.error("[gamification] checkAndAwardBadges failed:", err);
    }

    try {
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
    } catch (err) {
      console.error("[gamification] updateMissionProgress failed:", err);
    }

    try {
      await updateLeaderboardRank(user.id);
    } catch (err) {
      console.error("[gamification] updateLeaderboardRank failed:", err);
    }

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
      macroDimensions: scoreResult.macroDimensions,
      tokensUsed,
      costCents,
      usage: { used: newUsed, limit, remaining: remainingAfter, plan: user.plan },
      ...(opusDowngraded ? { opusDowngraded: { from: "claude-opus-4-8", to: OPUS_FALLBACK_MODEL, opusLimit: OPUS_MONTHLY_LIMIT } } : {}),
      ...(costCapReached ? { costCapReached: { aiCostCents: (user.monthlyResetDate === currentMonthKey() ? user.aiCostCents : 0), tierLimit: tierBudget, fallbackModel: COST_CAP_FALLBACK_MODEL } } : {}),
      ...(streamError ? { streamError: true } : {}),
      ...(usedFallback ? { usedFallback: true } : {}),
      ...(newTitle ? { title: newTitle } : {}),
      ...(progressCard ? { progressCard } : {}),
    })}\n\n`);
    res.end();

    // Fire-and-forget: auto-generate thread from conversation (every 4 messages, min 6)
    const userMsgCount = history.filter(m => m.role === "user").length;
    if (userMsgCount >= 3 && userMsgCount % 4 === 3) {
      maybeCreateThreadFromConversation(history, user.clerkId, user.email ?? "system").catch(e =>
        console.error("[auto-thread] background error:", e)
      );
    }
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

// ── Auto-thread generation ────────────────────────────────────────────────────
// Runs fire-and-forget after every 4th user message (min 3 exchanges).
// Asks the AI if the conversation contains a specific unresolved question
// worthy of becoming a public Open Thread. Creates it only if unique.

const THREAD_EXTRACT_PROMPT = (msgs: Array<{ role: string; content: string }>) => `
Analyze this conversation and decide if it contains a specific, deep, unresolved intellectual question
worthy of becoming a public "Open Thread" — a question that two expert users could debate productively
for 4 minutes and build real knowledge about.

STRICT CRITERIA (all must be met):
1. The question must be SPECIFIC (not "what is consciousness?" but "does quantum decoherence eliminate the hard problem of consciousness?")
2. It must be genuinely UNRESOLVED — not something with a known textbook answer
3. It must be INTELLECTUALLY MEATY — from science, philosophy, ethics, technology, medicine, or mathematics
4. It should emerge NATURALLY from the conversation, not be forced

CONVERSATION:
${msgs.map(m => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 400)}`).join("\n\n")}

If worthy, respond with JSON (no markdown):
{"worthy": true, "question": "<specific question, max 160 chars>", "description": "<1-2 sentence context>", "category": "<philosophy|science|ethics|technology|society|knowledge|consciousness>"}

If NOT worthy (vague, already answered, off-topic), respond with:
{"worthy": false}
`.trim();

async function maybeCreateThreadFromConversation(
  history: Array<{ role: string; content: string }>,
  clerkId: string,
  email: string,
) {
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: THREAD_EXTRACT_PROMPT(history) }],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    const raw = resp.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    if (!parsed.worthy || !parsed.question) return;

    const question: string = parsed.question.trim().slice(0, 160);
    const description: string = (parsed.description ?? "").trim().slice(0, 300);
    const category: string = parsed.category ?? "science";

    // Deduplication: skip if a very similar thread exists (first 40 chars match)
    const snippet = question.slice(0, 40);
    const existing = await db.select({ id: threads.id })
      .from(threads)
      .where(ilike(threads.question, `%${snippet}%`))
      .limit(1);

    if (existing.length > 0) {
      console.info("[auto-thread] skipped duplicate:", snippet);
      return;
    }

    const username = email.split("@")[0] ?? "user";
    await db.insert(threads).values({
      question,
      description: description || null,
      category,
      createdBy: clerkId,
      createdByUsername: `🤖 auto (${username})`,
    });

    console.info("[auto-thread] created:", question.slice(0, 80));
  } catch (err) {
    console.error("[auto-thread] error:", err);
  }
}

export default router;
