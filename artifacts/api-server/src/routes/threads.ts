import { getAuth } from "@clerk/express";
import { Router } from "express";
import { db } from "@workspace/db";
import { users, threads, threadSessions, battleCards, aiBattles, gamification, badges, progressCards, sgiSnapshots, conversations } from "@workspace/db";
import type { ThreadConnection, SessionMessage, BattleAnswerScore } from "@workspace/db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { evaluateBattle } from "../lib/battleScoring";
import { getOrCreateUser } from "../lib/getOrCreateUser";
import { computeLevel } from "../lib/sgiScoring";
import { anonHandle } from "../lib/anonHandle";

// Renders the SGI brand glyph (rising trendline + nodes inside a gradient
// tile) as inline SVG markup, matching Logo.tsx / drawSgiLogoTile exactly.
function sgiLogoSvg(cx: number, cy: number, tileSize: number, gradId: string): string {
  const r = tileSize * 0.26;
  const tx = cx - tileSize / 2;
  const ty = cy - tileSize / 2;
  const scale = tileSize / 32;
  const pts: [number, number][] = [
    [8.8, 20],
    [13.6, 15.2],
    [16.8, 18],
    [23.2, 11.2],
  ].map(([px, py]) => [tx + px * scale, ty + py * scale]);
  const nodeR = [1.36, 1.36, 1.36, 1.92].map((nr) => nr * scale);
  return `
  <defs>
    <linearGradient id="${gradId}" x1="${tx}" y1="${ty}" x2="${tx + tileSize}" y2="${ty + tileSize}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7c6bff"/>
      <stop offset="100%" stop-color="#06d6a0"/>
    </linearGradient>
  </defs>
  <rect x="${tx}" y="${ty}" width="${tileSize}" height="${tileSize}" rx="${r}" fill="url(#${gradId})"/>
  <polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#ffffff" stroke-width="${2.1 * scale}" stroke-linecap="round" stroke-linejoin="round"/>
  ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${nodeR[i]}" fill="#ffffff"/>`).join("")}`;
}

const router = Router();

// ─── System Prompts ─────────────────────────────────────────────────────────

const BATTLE_SYSTEM = (question: string, knowledgeBase: ThreadConnection[]) => `
You are a Socratic intellectual partner engaging in a timed 4-minute "Battle Thread" session.

THE QUESTION: "${question}"

${knowledgeBase.length > 0 ? `KNOWLEDGE BASE (concepts established by previous players):\n${knowledgeBase.map(c => `- ${c.concept1} ↔ ${c.concept2}: ${c.description}`).join("\n")}\n` : ""}

YOUR ROLE:
- Engage as a co-thinker, not an interrogator. Think aloud together.
- Propose unexpected cross-domain connections. Build on the user's ideas.
- Aim to traverse as many distinct relevant concepts as possible, linking them coherently.
- Never mention scoring or the SGI system. Just engage at the highest intellectual level.
- Match and slightly exceed the user's conceptual depth.
- Keep responses focused and dense — this is a timed session.

This is a philosophical/intellectual sparring match. Depth, originality, and conceptual density matter.`.trim();

const SCORE_PROMPT = (question: string, messages: SessionMessage[]) => `
You are scoring an intellectual battle session on the question: "${question}"

CONVERSATION:
${messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n\n")}

Score this conversation on THREE criteria (0-33 each, total max 99, but use integer points):

1. CONCEPTUAL DENSITY (0-33): How many distinct, relevant concepts were touched? Reward breadth across disciplines.
2. CONNECTION QUALITY (0-33): How logically coherent and non-superficial are the conceptual links made? Penalize surface-level associations.
3. REASONING DEPTH (0-33): How original and rigorous is the thinking? Reward novel framings, not just recitations.

Respond ONLY with valid JSON (no markdown, no extra text):
{"density": <int>, "connections": <int>, "depth": <int>, "total": <int>, "explanation": "<2-3 sentences summarizing the quality>"}
`.trim();

const EXTRACT_CONNECTIONS_PROMPT = (question: string, messages: SessionMessage[]) => `
From this intellectual battle conversation about "${question}", extract the 3-5 most valuable conceptual connections established.

CONVERSATION:
${messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n\n")}

Extract connections where two concepts were meaningfully linked. These will be added to a growing knowledge base.

Respond ONLY with valid JSON array (no markdown):
[{"concept1": "...", "concept2": "...", "description": "one sentence explaining the link", "strength": <1-5>}]
`.trim();

// ─── GET /threads — list all threads ────────────────────────────────────────
router.get("/threads", async (req, res) => {
  try {
    const rows = await db.select().from(threads)
      .orderBy(desc(threads.createdAt))
      .limit(50);

    // Fetch all battle cards for these threads in one query
    const threadIds = rows.map(t => t.id);
    let battleCardMap = new Map<string, string>(); // threadId → battleCardId
    if (threadIds.length > 0) {
      const cards = await db.select({ threadId: battleCards.threadId, id: battleCards.id })
        .from(battleCards)
        .orderBy(desc(battleCards.createdAt));
      for (const c of cards) {
        if (!battleCardMap.has(c.threadId)) battleCardMap.set(c.threadId, c.id);
      }
    }

    // Display handle is ALWAYS computed here, never trusted from the stored
    // created_by_username column — see anonHandle() + schema comment.
    const creatorClerkIds = [...new Set(rows.map(t => t.createdBy))];
    let creatorMap = new Map<string, number>(); // clerkId → users.id
    if (creatorClerkIds.length > 0) {
      const creators = await db.select({ clerkId: users.clerkId, id: users.id })
        .from(users)
        .where(inArray(users.clerkId, creatorClerkIds));
      for (const c of creators) creatorMap.set(c.clerkId, c.id);
    }

    res.json(rows.map(t => {
      const uid = creatorMap.get(t.createdBy);
      const handle = uid != null ? anonHandle(uid) : "User_000000";
      return {
        id: t.id,
        question: t.question,
        aiTitle: t.aiTitle,
        description: t.description,
        category: t.category,
        createdBy: t.createdBy,
        createdByUsername: t.isAutoGenerated ? `🤖 auto (${handle})` : handle,
        totalSessions: t.totalSessions,
        knowledgeBaseSize: (t.knowledgeBase as ThreadConnection[])?.length ?? 0,
        createdAt: t.createdAt,
        battleCardId: battleCardMap.get(t.id) ?? null,
      };
    }));
  } catch (err) {
    console.error("[threads] list error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /threads — create a thread ────────────────────────────────────────
router.post("/threads", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const { question, description, category } = req.body;
    if (!question || typeof question !== "string" || question.trim().length < 10) {
      res.status(400).json({ error: "Question must be at least 10 characters" }); return;
    }

    const [thread] = await db.insert(threads).values({
      question: question.trim(),
      description: description?.trim() ?? null,
      category: category ?? "philosophy",
      createdBy: clerkId,
      isAutoGenerated: false,
    }).returning();

    res.status(201).json({ ...thread, createdByUsername: anonHandle(user.id) });
  } catch (err) {
    console.error("[threads] create error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /threads/:id — thread detail + sessions ─────────────────────────────
router.get("/threads/:id", async (req, res) => {
  try {
    const [thread] = await db.select().from(threads).where(eq(threads.id, req.params.id)).limit(1);
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }

    const sessions = await db.select().from(threadSessions)
      .where(and(eq(threadSessions.threadId, req.params.id), eq(threadSessions.status, "completed")))
      .orderBy(desc(threadSessions.scoreTotal))
      .limit(20);

    const clerkId = getAuth(req).userId;
    let mySession = null;
    if (clerkId) {
      const [mine] = await db.select().from(threadSessions)
        .where(and(eq(threadSessions.threadId, req.params.id), eq(threadSessions.userId, clerkId)))
        .orderBy(desc(threadSessions.createdAt))
        .limit(1);
      mySession = mine ?? null;
    }

    const [battleCard] = await db.select().from(battleCards)
      .where(eq(battleCards.threadId, req.params.id))
      .orderBy(desc(battleCards.createdAt))
      .limit(1);

    const [creator] = await db.select({ id: users.id }).from(users)
      .where(eq(users.clerkId, thread.createdBy)).limit(1);
    const handle = creator ? anonHandle(creator.id) : "User_000000";

    res.json({
      ...thread,
      createdByUsername: thread.isAutoGenerated ? `🤖 auto (${handle})` : handle,
      sessions: sessions.map(s => ({
        id: s.id,
        userId: s.userId,
        username: s.username,
        scoreTotal: s.scoreTotal,
        scoreDensity: s.scoreDensity,
        scoreConnections: s.scoreConnections,
        scoreDepth: s.scoreDepth,
        durationSeconds: s.durationSeconds,
        connectionsCount: (s.connections as ThreadConnection[])?.length ?? 0,
        endedAt: s.endedAt,
      })),
      mySession: mySession ? {
        id: mySession.id,
        status: mySession.status,
        scoreTotal: mySession.scoreTotal,
        startedAt: mySession.startedAt,
      } : null,
      battleCardId: battleCard?.id ?? null,
    });
  } catch (err) {
    console.error("[threads] detail error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /threads/:id/sessions — start a battle session ────────────────────
router.post("/threads/:id/sessions", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [thread] = await db.select().from(threads).where(eq(threads.id, req.params.id)).limit(1);
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }

    // Check for existing in_progress session
    const [existing] = await db.select().from(threadSessions)
      .where(and(
        eq(threadSessions.threadId, req.params.id),
        eq(threadSessions.userId, clerkId),
        eq(threadSessions.status, "in_progress"),
      )).limit(1);

    if (existing) {
      res.json({ sessionId: existing.id, alreadyStarted: true });
      return;
    }

    const [session] = await db.insert(threadSessions).values({
      threadId: req.params.id,
      userId: clerkId,
      username: anonHandle(user.id),
      startedAt: new Date(),
      status: "in_progress",
    }).returning();

    res.status(201).json({ sessionId: session.id });
  } catch (err) {
    console.error("[threads] start session error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /threads/:id/sessions/:sessionId/chat — stream battle chat ─────────
router.post("/threads/:id/sessions/:sessionId/chat", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [session] = await db.select().from(threadSessions)
      .where(and(
        eq(threadSessions.id, req.params.sessionId),
        eq(threadSessions.userId, clerkId),
      )).limit(1);

    if (!session) { res.status(404).json({ error: "Session not found" }); return; }
    if (session.status !== "in_progress") {
      res.status(400).json({ error: "Session already completed" }); return;
    }

    const [thread] = await db.select().from(threads).where(eq(threads.id, req.params.id)).limit(1);
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }

    const { message } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Message required" }); return;
    }

    const existingMessages = (session.messages as SessionMessage[]) ?? [];
    const newUserMsg: SessionMessage = { role: "user", content: message, timestamp: new Date().toISOString() };
    const allMessages = [...existingMessages, newUserMsg];

    // SSE setup
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Stream AI response
    const knowledgeBase = (thread.knowledgeBase as ThreadConnection[]) ?? [];
    const systemPrompt = BATTLE_SYSTEM(thread.question, knowledgeBase);

    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system: systemPrompt,
      messages: allMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    let fullResponse = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ type: "content", text: event.delta.text })}\n\n`);
      }
    }

    const newAssistantMsg: SessionMessage = { role: "assistant", content: fullResponse, timestamp: new Date().toISOString() };
    const updatedMessages = [...allMessages, newAssistantMsg];

    // Score the conversation so far
    let scoreData = {
      density: session.scoreDensity ?? 0,
      connections: session.scoreConnections ?? 0,
      depth: session.scoreDepth ?? 0,
      total: session.scoreTotal ?? 0,
      explanation: session.scoreExplanation ?? "",
    };

    try {
      const scoreResp = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        messages: [{ role: "user", content: SCORE_PROMPT(thread.question, updatedMessages) }],
        max_tokens: 300,
      });
      const parsed = JSON.parse(((scoreResp.content[0] as { type: string; text?: string })?.text) ?? "{}");
      scoreData = {
        density: Math.min(33, Math.max(0, parsed.density ?? 0)),
        connections: Math.min(33, Math.max(0, parsed.connections ?? 0)),
        depth: Math.min(33, Math.max(0, parsed.depth ?? 0)),
        total: Math.min(99, Math.max(0, parsed.total ?? 0)),
        explanation: parsed.explanation ?? "",
      };
    } catch (e) {
      console.error("[threads] scoring error", e);
    }

    // Update session in DB
    await db.update(threadSessions)
      .set({
        messages: updatedMessages,
        scoreDensity: scoreData.density,
        scoreConnections: scoreData.connections,
        scoreDepth: scoreData.depth,
        scoreTotal: scoreData.total,
        scoreExplanation: scoreData.explanation,
      })
      .where(eq(threadSessions.id, session.id));

    // Send score event
    res.write(`data: ${JSON.stringify({
      type: "score",
      density: scoreData.density,
      connections: scoreData.connections,
      depth: scoreData.depth,
      total: scoreData.total,
      explanation: scoreData.explanation,
    })}\n\n`);

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("[threads] chat error", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
    else res.end();
  }
});

// ─── POST /threads/:id/sessions/:sessionId/complete — finish session ──────────
router.post("/threads/:id/sessions/:sessionId/complete", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [session] = await db.select().from(threadSessions)
      .where(and(
        eq(threadSessions.id, req.params.sessionId),
        eq(threadSessions.userId, clerkId),
      )).limit(1);

    if (!session) { res.status(404).json({ error: "Session not found" }); return; }
    if (session.status === "completed") {
      res.json({ sessionId: session.id, alreadyCompleted: true, scoreTotal: session.scoreTotal });
      return;
    }

    const [thread] = await db.select().from(threads).where(eq(threads.id, req.params.id)).limit(1);
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }

    const sessionMessages = (session.messages as SessionMessage[]) ?? [];
    const now = new Date();
    const startedAt = session.startedAt ?? now;
    const durationSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);

    // Extract key connections from this session
    let sessionConnections: ThreadConnection[] = [];
    if (sessionMessages.length >= 2) {
      try {
        const connResp = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          messages: [{ role: "user", content: EXTRACT_CONNECTIONS_PROMPT(thread.question, sessionMessages) }],
          max_tokens: 500,
        });
        const raw = (connResp.content[0] as { type: string; text?: string })?.text ?? "[]";
        const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        sessionConnections = JSON.parse(clean);
      } catch (e) {
        console.error("[threads] extract connections error", e);
      }
    }

    // Merge into thread knowledge base (deduplicate by concept pair)
    const existingKb = (thread.knowledgeBase as ThreadConnection[]) ?? [];
    const mergedKb = [...existingKb];
    for (const conn of sessionConnections) {
      const key = [conn.concept1, conn.concept2].sort().join("||");
      const exists = mergedKb.some(c => [c.concept1, c.concept2].sort().join("||") === key);
      if (!exists) mergedKb.push(conn);
    }

    // Update session as completed
    await db.update(threadSessions).set({
      status: "completed",
      endedAt: now,
      durationSeconds,
      connections: sessionConnections,
    }).where(eq(threadSessions.id, session.id));

    // Update thread knowledge base + session count
    await db.update(threads).set({
      knowledgeBase: mergedKb,
      totalSessions: (thread.totalSessions ?? 0) + 1,
    }).where(eq(threads.id, thread.id));

    // Check if a battle card should be created (exactly 2 completed sessions by different users)
    const [existingBattleCard] = await db.select().from(battleCards)
      .where(eq(battleCards.threadId, thread.id)).limit(1);

    let battleCardId: string | null = existingBattleCard?.id ?? null;

    if (!existingBattleCard) {
      const completedSessions = await db.select().from(threadSessions)
        .where(and(eq(threadSessions.threadId, thread.id), eq(threadSessions.status, "completed")))
        .orderBy(desc(threadSessions.scoreTotal))
        .limit(10);

      // Find two different users
      const uniqueUsers = new Map<string, typeof completedSessions[0]>();
      for (const s of completedSessions) {
        if (!uniqueUsers.has(s.userId)) uniqueUsers.set(s.userId, s);
        if (uniqueUsers.size >= 2) break;
      }

      if (uniqueUsers.size >= 2) {
        const [s1, s2] = Array.from(uniqueUsers.values());
        const winner = (s1.scoreTotal ?? 0) >= (s2.scoreTotal ?? 0) ? s1 : s2;
        const [card] = await db.insert(battleCards).values({
          threadId: thread.id,
          session1Id: s1.id,
          session2Id: s2.id,
          winnerSessionId: winner.id,
        }).returning();
        battleCardId = card.id;
      }
    }

    res.json({
      sessionId: session.id,
      scoreTotal: session.scoreTotal,
      scoreDensity: session.scoreDensity,
      scoreConnections: session.scoreConnections,
      scoreDepth: session.scoreDepth,
      scoreExplanation: session.scoreExplanation,
      connections: sessionConnections,
      battleCardId,
    });
  } catch (err) {
    console.error("[threads] complete session error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /battle-cards/:id — battle card data ─────────────────────────────────
router.get("/battle-cards/:id", async (req, res) => {
  try {
    const [card] = await db.select().from(battleCards).where(eq(battleCards.id, req.params.id)).limit(1);
    if (!card) { res.status(404).json({ error: "Battle card not found" }); return; }

    const [thread] = await db.select().from(threads).where(eq(threads.id, card.threadId)).limit(1);
    const [s1] = await db.select().from(threadSessions).where(eq(threadSessions.id, card.session1Id)).limit(1);
    const [s2] = await db.select().from(threadSessions).where(eq(threadSessions.id, card.session2Id)).limit(1);

    res.json({
      id: card.id,
      threadId: card.threadId,
      createdAt: card.createdAt,
      thread: { question: thread?.question, category: thread?.category },
      player1: {
        sessionId: s1?.id,
        username: s1?.username ?? "Player 1",
        scoreTotal: s1?.scoreTotal ?? 0,
        scoreDensity: s1?.scoreDensity ?? 0,
        scoreConnections: s1?.scoreConnections ?? 0,
        scoreDepth: s1?.scoreDepth ?? 0,
        scoreExplanation: s1?.scoreExplanation ?? "",
        connections: (s1?.connections as ThreadConnection[]) ?? [],
        isWinner: card.winnerSessionId === s1?.id,
      },
      player2: {
        sessionId: s2?.id,
        username: s2?.username ?? "Player 2",
        scoreTotal: s2?.scoreTotal ?? 0,
        scoreDensity: s2?.scoreDensity ?? 0,
        scoreConnections: s2?.scoreConnections ?? 0,
        scoreDepth: s2?.scoreDepth ?? 0,
        scoreExplanation: s2?.scoreExplanation ?? "",
        connections: (s2?.connections as ThreadConnection[]) ?? [],
        isWinner: card.winnerSessionId === s2?.id,
      },
    });
  } catch (err) {
    console.error("[threads] battle card error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /battle-cards/:id/og-image — SVG/PNG for social sharing ──────────────
router.get("/battle-cards/:id/og-image", async (req, res) => {
  try {
    const [card] = await db.select().from(battleCards).where(eq(battleCards.id, req.params.id)).limit(1);
    if (!card) { res.status(404).send("Not found"); return; }

    const [thread] = await db.select().from(threads).where(eq(threads.id, card.threadId)).limit(1);
    const [s1] = await db.select().from(threadSessions).where(eq(threadSessions.id, card.session1Id)).limit(1);
    const [s2] = await db.select().from(threadSessions).where(eq(threadSessions.id, card.session2Id)).limit(1);

    const winner = card.winnerSessionId === s1?.id ? "p1" : "p2";
    const p1 = s1 ?? { username: "Player 1", scoreTotal: 0 };
    const p2 = s2 ?? { username: "Player 2", scoreTotal: 0 };
    const question = thread?.question ?? "Open Thread";

    const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + "…" : s;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0a0b18"/>
      <stop offset="100%" stop-color="#0e0d26"/>
    </linearGradient>
    <linearGradient id="p1g" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#7c6bff" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#7c6bff" stop-opacity="0.05"/>
    </linearGradient>
    <linearGradient id="p2g" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#06d6a0" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#06d6a0" stop-opacity="0.05"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="none" stroke="rgba(124,107,255,0.2)" stroke-width="2"/>

  <!-- Grid overlay -->
  <g opacity="0.04">
    ${Array.from({length: 20}, (_, i) => `<line x1="${i*64}" y1="0" x2="${i*64}" y2="630" stroke="#7c6bff" stroke-width="1"/>`).join("")}
    ${Array.from({length: 10}, (_, i) => `<line x1="0" y1="${i*70}" x2="1200" y2="${i*70}" stroke="#7c6bff" stroke-width="1"/>`).join("")}
  </g>

  <!-- SGI label -->
  <text x="600" y="52" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="700" letter-spacing="4" fill="#7c6bff" opacity="0.8">SGI · THREAD BATTLE</text>

  <!-- Question -->
  <text x="600" y="102" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="600" fill="#eeeeff">${truncate(question, 80)}</text>

  <!-- VS divider -->
  <line x1="570" y1="120" x2="570" y2="520" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <line x1="630" y1="120" x2="630" y2="520" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <rect x="558" y="295" width="84" height="40" rx="8" fill="#1a1832" stroke="rgba(124,107,255,0.4)" stroke-width="1"/>
  <text x="600" y="320" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" font-weight="800" fill="#7c6bff">VS</text>

  <!-- Player 1 panel -->
  <rect x="40" y="120" width="510" height="380" rx="16" fill="url(#p1g)" stroke="${winner === "p1" ? "#7c6bff" : "rgba(255,255,255,0.06)"}" stroke-width="${winner === "p1" ? "2" : "1"}"/>
  ${winner === "p1" ? `<rect x="40" y="120" width="510" height="36" rx="8" fill="rgba(124,107,255,0.15)"/>
  <text x="295" y="143" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="2" fill="#7c6bff">● VINCITORE</text>` : ""}
  <text x="295" y="${winner === "p1" ? "200" : "175"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#eeeeff">@${truncate(p1.username ?? "p1", 18)}</text>
  <text x="295" y="${winner === "p1" ? "270" : "250"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="64" font-weight="800" fill="#7c6bff">${p1.scoreTotal}</text>
  <text x="295" y="${winner === "p1" ? "295" : "275"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="rgba(168,159,255,0.7)" letter-spacing="1">SGI SCORE</text>
  <text x="120" y="${winner === "p1" ? "355" : "330"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="rgba(168,159,255,0.6)">DENSITÀ</text>
  <text x="120" y="${winner === "p1" ? "378" : "353"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#a89fff">${s1?.scoreDensity ?? 0}</text>
  <text x="295" y="${winner === "p1" ? "355" : "330"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="rgba(168,159,255,0.6)">CONNESSIONI</text>
  <text x="295" y="${winner === "p1" ? "378" : "353"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#a89fff">${s1?.scoreConnections ?? 0}</text>
  <text x="470" y="${winner === "p1" ? "355" : "330"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="rgba(168,159,255,0.6)">PROFONDITÀ</text>
  <text x="470" y="${winner === "p1" ? "378" : "353"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#a89fff">${s1?.scoreDepth ?? 0}</text>

  <!-- Player 2 panel -->
  <rect x="650" y="120" width="510" height="380" rx="16" fill="url(#p2g)" stroke="${winner === "p2" ? "#06d6a0" : "rgba(255,255,255,0.06)"}" stroke-width="${winner === "p2" ? "2" : "1"}"/>
  ${winner === "p2" ? `<rect x="650" y="120" width="510" height="36" rx="8" fill="rgba(6,214,160,0.12)"/>
  <text x="905" y="143" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="2" fill="#06d6a0">● VINCITORE</text>` : ""}
  <text x="905" y="${winner === "p2" ? "200" : "175"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#eeeeff">@${truncate(p2.username ?? "p2", 18)}</text>
  <text x="905" y="${winner === "p2" ? "270" : "250"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="64" font-weight="800" fill="#06d6a0">${p2.scoreTotal}</text>
  <text x="905" y="${winner === "p2" ? "295" : "275"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="rgba(6,214,160,0.7)" letter-spacing="1">SGI SCORE</text>
  <text x="730" y="${winner === "p2" ? "355" : "330"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="rgba(6,214,160,0.6)">DENSITÀ</text>
  <text x="730" y="${winner === "p2" ? "378" : "353"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#06d6a0">${s2?.scoreDensity ?? 0}</text>
  <text x="905" y="${winner === "p2" ? "355" : "330"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="rgba(6,214,160,0.6)">CONNESSIONI</text>
  <text x="905" y="${winner === "p2" ? "378" : "353"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#06d6a0">${s2?.scoreConnections ?? 0}</text>
  <text x="1080" y="${winner === "p2" ? "355" : "330"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="rgba(6,214,160,0.6)">PROFONDITÀ</text>
  <text x="1080" y="${winner === "p2" ? "378" : "353"}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#06d6a0">${s2?.scoreDepth ?? 0}</text>

  <!-- Footer -->
  ${sgiLogoSvg(548, 560, 32, "logoGradBattle")}
  <text x="572" y="566" text-anchor="start" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#06d6a0">sgindex.work</text>
  <text x="600" y="595" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="rgba(144,144,184,0.4)">Thread Aperti</text>
</svg>`;

    // Try PNG conversion with @resvg/resvg-js, fallback to SVG
    try {
      const { Resvg } = await import("@resvg/resvg-js");
      const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(pngBuffer);
    } catch {
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(svg);
    }
  } catch (err) {
    console.error("[threads] og-image error", err);
    res.status(500).send("Error generating image");
  }
});

// ─── GET /progress-cards — recent progress cards for the current user ────────
// Includes BOTH positive and negative trends — negative trends are only ever
// surfaced here (personal dashboard), never as an in-chat share prompt.
router.get("/progress-cards", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const rows = await db.select({
      id: progressCards.id,
      createdAt: progressCards.createdAt,
      conversationId: progressCards.conversationId,
      deltaPct: progressCards.deltaPct,
      highlightMetric: progressCards.highlightMetric,
      highlightDeltaPct: progressCards.highlightDeltaPct,
      insightText: progressCards.insightText,
      conversationTitle: conversations.title,
    })
      .from(progressCards)
      .leftJoin(conversations, eq(conversations.id, progressCards.conversationId))
      .where(eq(progressCards.userId, user.id))
      .orderBy(desc(progressCards.createdAt))
      .limit(10);

    res.json(rows.map(r => ({
      id: r.id,
      createdAt: r.createdAt,
      conversationTitle: r.conversationTitle ?? "Exploration",
      deltaPct: Math.round(r.deltaPct * 10) / 10,
      isPositive: r.deltaPct > 0,
      highlightMetric: r.highlightMetric,
      highlightMetricLabel: HIGHLIGHT_METRIC_LABELS[r.highlightMetric] ?? r.highlightMetric,
      highlightDeltaPct: Math.round(r.highlightDeltaPct * 10) / 10,
      insightText: r.insightText ?? null,
    })));
  } catch (err) {
    console.error("[threads] progress cards list error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /progress-cards/:id — progress card data ─────────────────────────────
const HIGHLIGHT_METRIC_LABELS: Record<string, string> = {
  reasoningDepth: "Profondità di ragionamento",
  interdisciplinaryScore: "Interdisciplinarità",
  conceptualComplexity: "Complessità concettuale",
  semanticVariety: "Varietà semantica",
  originality: "Originalità",
  stability: "Stabilità",
  continuity: "Continuità",
  revisionSignal: "Capacità di revisione",
};

const formatSigned = (n: number): string => (n > 0 ? "+" : "") + n;

router.get("/progress-cards/:id", async (req, res) => {
  try {
    const [card] = await db.select().from(progressCards).where(eq(progressCards.id, req.params.id)).limit(1);
    if (!card) { res.status(404).json({ error: "Progress card not found" }); return; }

    const [convo] = await db.select({ title: conversations.title }).from(conversations).where(eq(conversations.id, card.conversationId)).limit(1);
    // Fetch the user's current EMA-based SGI score (the same "7.4/10" shown on home).
    const [owner] = await db.select({ sgiScore: users.sgiScore }).from(users).where(eq(users.id, card.userId)).limit(1);
    const username = anonHandle(card.userId);

    res.json({
      id: card.id,
      createdAt: card.createdAt,
      username,
      conversationTitle: convo?.title ?? "Exploration",
      // sgiScore: absolute EMA-based score — the primary visual element.
      sgiScore: Math.round((owner?.sgiScore ?? 0) * 10) / 10,
      earlyAvg: card.earlyAvg,
      lateAvg: card.lateAvg,
      deltaPct: Math.round(card.deltaPct * 10) / 10,
      isPositive: card.deltaPct > 0,
      highlightMetric: card.highlightMetric,
      highlightMetricLabel: HIGHLIGHT_METRIC_LABELS[card.highlightMetric] ?? card.highlightMetric,
      highlightDeltaPct: Math.round(card.highlightDeltaPct * 10) / 10,
      insightText: card.insightText ?? null,
    });
  } catch (err) {
    console.error("[threads] progress card error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /progress-cards/:id/og-image — SVG/PNG for social sharing ────────────
router.get("/progress-cards/:id/og-image", async (req, res) => {
  try {
    const [card] = await db.select().from(progressCards).where(eq(progressCards.id, req.params.id)).limit(1);
    if (!card) { res.status(404).send("Not found"); return; }
    // Progress cards are only ever OG-shared when the trend is positive (share
    // CTA is gated client-side too, but guard here in case of direct hits).
    if (card.deltaPct <= 0) { res.status(404).send("Not found"); return; }

    const username = anonHandle(card.userId);
    const deltaPct = Math.round(card.deltaPct * 10) / 10;
    const highlightLabel = HIGHLIGHT_METRIC_LABELS[card.highlightMetric] ?? card.highlightMetric;
    const highlightDeltaPct = Math.round(card.highlightDeltaPct * 10) / 10;
    const insightText = card.insightText ?? null;

    const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + "…" : s;

    // No canvas available server-side to measure text width, so we wrap by an
    // approximate char-per-line budget for this font-size/panel-width combo,
    // capped at 2 lines with a trailing ellipsis as a hard overflow guard —
    // this keeps the layout safe across IT/EN/ES phrase-length variance.
    const wrapPlain = (s: string, charsPerLine: number, maxLines: number): string[] => {
      const words = s.split(" ");
      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (test.length > charsPerLine && current) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
        if (lines.length === maxLines) break;
      }
      if (current && lines.length < maxLines) lines.push(current);
      if (lines.length === maxLines) {
        const last = lines[maxLines - 1]!;
        const consumed = lines.slice(0, maxLines - 1).join(" ").length + (maxLines > 1 ? 1 : 0);
        const stillRemaining = s.length > consumed + last.length;
        if (stillRemaining && last.length > 3) lines[maxLines - 1] = last.slice(0, -1).trimEnd() + "…";
      }
      return lines;
    };
    const insightLines = insightText ? wrapPlain(insightText, 68, 2) : [];
    // Panel + everything below it grows to fit the (optional) insight text so
    // it never overlaps or gets clipped, regardless of language/line count.
    const panelExtraH = insightLines.length > 0 ? insightLines.length * 24 + 16 : 0;
    const panelH = 260 + panelExtraH;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${630 + panelExtraH}" viewBox="0 0 1200 ${630 + panelExtraH}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0a0b18"/>
      <stop offset="100%" stop-color="#0e0d26"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#06d6a0" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#06d6a0" stop-opacity="0.04"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="${630 + panelExtraH}" fill="url(#bg)"/>
  <rect width="1200" height="${630 + panelExtraH}" fill="none" stroke="rgba(6,214,160,0.25)" stroke-width="2"/>

  <g opacity="0.04">
    ${Array.from({length: 20}, (_, i) => `<line x1="${i*64}" y1="0" x2="${i*64}" y2="${630 + panelExtraH}" stroke="#06d6a0" stroke-width="1"/>`).join("")}
    ${Array.from({length: 10 + Math.ceil(panelExtraH / 70)}, (_, i) => `<line x1="0" y1="${i*70}" x2="1200" y2="${i*70}" stroke="#06d6a0" stroke-width="1"/>`).join("")}
  </g>

  <text x="600" y="70" text-anchor="middle" font-family="DejaVu Sans" font-size="13" font-weight="700" letter-spacing="4" fill="#06d6a0" opacity="0.85">SGI · PROGRESS CARD</text>

  <text x="600" y="130" text-anchor="middle" font-family="DejaVu Sans" font-size="24" font-weight="700" fill="#eeeeff">@${truncate(username, 24)}</text>

  <rect x="260" y="190" width="680" height="${panelH}" rx="20" fill="url(#glow)" stroke="rgba(6,214,160,0.4)" stroke-width="2"/>

  <text x="600" y="230" text-anchor="middle" font-family="DejaVu Sans" font-size="14" fill="rgba(168,255,220,0.7)" letter-spacing="1">TREND ULTIMI 5 MESSAGGI</text>
  <text x="600" y="330" text-anchor="middle" font-family="DejaVu Sans" font-size="88" font-weight="800" fill="#06d6a0">${formatSigned(deltaPct)}%</text>
  <text x="600" y="380" text-anchor="middle" font-family="DejaVu Sans" font-size="16" fill="rgba(238,238,255,0.8)">${truncate(highlightLabel, 40)} ${formatSigned(highlightDeltaPct)}%</text>
  ${insightLines.map((line, i) => `<text x="600" y="${414 + i * 24}" text-anchor="middle" font-family="DejaVu Sans" font-size="15" font-style="italic" fill="rgba(200,200,224,0.75)">${line}</text>`).join("\n  ")}

  <text x="600" y="${470 + panelExtraH}" text-anchor="middle" font-family="DejaVu Sans" font-size="14" fill="rgba(144,144,184,0.7)">In crescita nella conversazione corrente</text>

  ${sgiLogoSvg(548, 560 + panelExtraH, 40, "logoGradProgress")}
  <text x="578" y="${568 + panelExtraH}" text-anchor="start" font-family="DejaVu Sans" font-size="20" font-weight="700" fill="#06d6a0">sgindex.work</text>
  <text x="600" y="${600 + panelExtraH}" text-anchor="middle" font-family="DejaVu Sans" font-size="11" fill="rgba(144,144,184,0.4)">Progress Card</text>
</svg>`;

    try {
      const { Resvg } = await import("@resvg/resvg-js");
      const resvg = new Resvg(svg, {
        fitTo: { mode: "width", value: 1200 },
        font: { loadSystemFonts: true, defaultFontFamily: "DejaVu Sans" },
      });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(pngBuffer);
    } catch {
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(svg);
    }
  } catch (err) {
    console.error("[threads] progress card og-image error", err);
    res.status(500).send("Error generating image");
  }
});

// ─── POST /threads/:id/battle — DEPRECATED (USER vs AI removed) ──────────────
// The old USER-vs-AI duel has been replaced by ASYNC USER-vs-USER battles (see
// routes/battles.ts: POST /battles/matchmake). This endpoint is intentionally
// retired and no longer writes to ai_battles. Legacy ai_battles/battle_cards
// rows are kept for history but read-only.
router.post("/threads/:id/battle", (_req, res) => {
  res.status(410).json({
    error: "La sfida contro l'AI è stata sostituita dalle battaglie tra utenti.",
    code: "BATTLE_MODE_REPLACED",
    replacement: "/api/battles/matchmake",
  });
});

export default router;
