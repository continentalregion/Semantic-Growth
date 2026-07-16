import { db } from "@workspace/db";
import { sgiSnapshots, semanticDomains, recommendations } from "@workspace/db";
import { eq, desc, asc, sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

type RecRow = { category: string; content: string; estimatedSgiGain: number };

const FALLBACK_RECS: Record<string, RecRow[]> = {
  it: [
    { category: "ragionamento", content: "Esercitati a strutturare argomenti con premesse esplicite e conclusioni verificabili, anche su argomenti quotidiani.", estimatedSgiGain: 8 },
    { category: "interdisciplinare", content: "Connetti concetti di due ambiti diversi che studi già — cerca il principio comune che li unifica.", estimatedSgiGain: 11 },
    { category: "astrazione", content: "Descrivi un fenomeno concreto a tre livelli di astrazione crescente: fatti, pattern, principio generale.", estimatedSgiGain: 9 },
    { category: "complessità", content: "Approfondisci un tema scegliendo fonti con posizioni diverse — cerca le tensioni, non solo le conferme.", estimatedSgiGain: 10 },
    { category: "originalità", content: "Prendi una domanda standard e riformulala ribaltando le assunzioni di partenza. Cosa cambia?", estimatedSgiGain: 7 },
  ],
  en: [
    { category: "reasoning", content: "Practice structuring arguments with explicit premises and verifiable conclusions, even on everyday topics.", estimatedSgiGain: 8 },
    { category: "interdisciplinary", content: "Connect concepts from two different fields you already study — find the common principle that unites them.", estimatedSgiGain: 11 },
    { category: "abstraction", content: "Describe a concrete phenomenon at three levels of abstraction: facts, patterns, general principle.", estimatedSgiGain: 9 },
    { category: "complexity", content: "Explore a topic by reading sources with different perspectives — seek the tensions, not just confirmations.", estimatedSgiGain: 10 },
    { category: "originality", content: "Take a standard question and reframe it by flipping the initial assumptions. What changes?", estimatedSgiGain: 7 },
  ],
  es: [
    { category: "razonamiento", content: "Practica estructurar argumentos con premisas explícitas y conclusiones verificables, incluso en temas cotidianos.", estimatedSgiGain: 8 },
    { category: "interdisciplinar", content: "Conecta conceptos de dos campos distintos que ya estudias — busca el principio común que los une.", estimatedSgiGain: 11 },
    { category: "abstracción", content: "Describe un fenómeno concreto en tres niveles de abstracción: hechos, patrones, principio general.", estimatedSgiGain: 9 },
    { category: "complejidad", content: "Explora un tema leyendo fuentes con perspectivas distintas — busca las tensiones, no solo las confirmaciones.", estimatedSgiGain: 10 },
    { category: "originalidad", content: "Toma una pregunta estándar y reformúlala invirtiendo las suposiciones iniciales. ¿Qué cambia?", estimatedSgiGain: 7 },
  ],
};

function getFallback(lang: string): RecRow[] {
  const l = lang.startsWith("en") ? "en" : lang.startsWith("es") ? "es" : "it";
  return FALLBACK_RECS[l] ?? FALLBACK_RECS["it"]!;
}

const DIM_KEYS: Array<keyof typeof sgiSnapshots.$inferSelect> = [
  "conceptualComplexity", "semanticVariety", "interdisciplinaryScore",
  "reasoningDepth", "originality", "stability", "continuity", "revisionSignal",
];

export async function generateRecommendations(userId: number, lang = "it"): Promise<void> {
  // a) Atomic per-user advisory lock — prevents duplicate concurrent generation.
  const lockRes = await db.execute(sql`SELECT pg_try_advisory_lock(${userId})`);
  if (!(lockRes.rows[0] as any)?.pg_try_advisory_lock) {
    // Another request is already regenerating for this user: wait for it to
    // finish, then return — the caller will read the freshly written recs.
    await db.execute(sql`SELECT pg_advisory_lock(${userId})`);
    await db.execute(sql`SELECT pg_advisory_unlock(${userId})`);
    return;
  }
  try {
    // b) Least-explored semantic domains (lowest explorationScore first).
    const domains = await db.select()
      .from(semanticDomains)
      .where(eq(semanticDomains.userId, userId))
      .orderBy(asc(semanticDomains.explorationScore))
      .limit(3);

    // c) Last 20 snapshots for per-dimension averages.
    const snapshots = await db.select()
      .from(sgiSnapshots)
      .where(eq(sgiSnapshots.userId, userId))
      .orderBy(desc(sgiSnapshots.timestamp))
      .limit(20);

    // d) New user (< 5 snapshots total) → generic fallback, no LLM call.
    const countRes = await db.execute(
      sql`SELECT count(*)::int AS c FROM sgi_snapshots WHERE user_id = ${userId}`,
    );
    const totalCount = Number((countRes.rows[0] as any)?.c ?? 0);

    if (totalCount < 5) {
      await db.delete(recommendations).where(eq(recommendations.userId, userId));
      for (const rec of getFallback(lang)) {
        await db.insert(recommendations).values({ userId, ...rec });
      }
      return;
    }

    // Compute per-dimension averages and identify the 3 weakest.
    const dimAvgs: Record<string, number> = {};
    for (const key of DIM_KEYS) {
      const sum = snapshots.reduce((acc, s) => acc + ((s[key] as number) ?? 0), 0);
      dimAvgs[key as string] = snapshots.length > 0 ? sum / snapshots.length : 0;
    }
    const weakDims = Object.entries(dimAvgs)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v.toFixed(2)}`);

    const domainNames = domains.map(d => d.domain).join(", ") || "none recorded yet";
    const langName = lang.startsWith("en") ? "English" : lang.startsWith("es") ? "Spanish" : "Italian";

    // e) LLM generation with defensive parsing and fallback.
    let recs: RecRow[] = getFallback(lang);
    try {
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        temperature: 0.6,
        messages: [{
          role: "user",
          content: `You are an expert learning coach for a semantic intelligence platform.
Generate 5 personalized study recommendations in ${langName} for a user with these weaknesses:
- Weakest dimensions (lower = weaker): ${weakDims.join(" | ")}
- Least explored domains: ${domainNames}

Return ONLY a valid JSON array of exactly 5 objects, no markdown fences, no explanation:
[{"category":"...","content":"...","estimatedSgiGain":N},...]
Rules:
- category: short label in ${langName}, 1-3 words
- content: ONE actionable sentence in ${langName}, specific and practical
- estimatedSgiGain: integer between 5 and 15
- In content, bold (**word**) the core action verb or key concept`,
        }],
      });
      const raw = (msg.content[0] as { type: string; text?: string })?.text ?? "";
      const cleaned = raw.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        recs = (parsed as Array<Record<string, unknown>>).slice(0, 5).map(r => ({
          category: String(r["category"] ?? "general"),
          content: String(r["content"] ?? ""),
          estimatedSgiGain: Number(r["estimatedSgiGain"] ?? 8),
        }));
      }
    } catch {
      // LLM error or JSON parse failure — fall through to generic fallback set.
    }

    // f) Atomically replace existing recommendations.
    await db.delete(recommendations).where(eq(recommendations.userId, userId));
    for (const rec of recs) {
      await db.insert(recommendations).values({ userId, ...rec });
    }
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${userId})`);
  }
}
