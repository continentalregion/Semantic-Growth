import { db } from "@workspace/db";
import { sgiSnapshots, verdicts, narrativeGenerationLog } from "@workspace/db";
import type { VerdictSupportingMetrics } from "@workspace/db";
import { eq, desc, and, gte, lt, sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

// ─── Types ────────────────────────────────────────────────────────────────────

type DimKey =
  | "conceptualComplexity"
  | "semanticVariety"
  | "interdisciplinaryScore"
  | "reasoningDepth"
  | "originality"
  | "stability"
  | "continuity"
  | "revisionSignal"
  | "abstractionLevel"
  | "lexicalRichness"
  | "informationDensity";

const ALL_DIMS: DimKey[] = [
  "conceptualComplexity", "semanticVariety", "interdisciplinaryScore",
  "reasoningDepth", "originality", "stability", "continuity",
  "revisionSignal", "abstractionLevel", "lexicalRichness", "informationDensity",
];

interface ArchetypeConfig {
  name: string;
  metric1: { key: DimKey; direction: "high" | "low"; label: string };
  metric2: { key: DimKey; direction: "high" | "low"; label: string };
}

// ─── Archetype definitions ────────────────────────────────────────────────────

const ARCHETYPES: ArchetypeConfig[] = [
  {
    name: "Il Cartografo",
    metric1: { key: "interdisciplinaryScore", direction: "high", label: "Interdisciplinarità" },
    metric2: { key: "stability", direction: "low", label: "Stabilità" },
  },
  {
    name: "Il Notaio",
    metric1: { key: "informationDensity", direction: "high", label: "Densità informativa" },
    metric2: { key: "originality", direction: "low", label: "Originalità" },
  },
  {
    name: "L'Architetto",
    metric1: { key: "conceptualComplexity", direction: "high", label: "Complessità concettuale" },
    metric2: { key: "stability", direction: "high", label: "Stabilità" },
  },
  {
    name: "Il Revisore",
    metric1: { key: "revisionSignal", direction: "high", label: "Segnale di revisione" },
    metric2: { key: "reasoningDepth", direction: "low", label: "Profondità di ragionamento" },
  },
  {
    name: "Il Visionario",
    metric1: { key: "abstractionLevel", direction: "high", label: "Livello di astrazione" },
    metric2: { key: "informationDensity", direction: "low", label: "Densità informativa" },
  },
  {
    name: "Il Tessitore",
    metric1: { key: "continuity", direction: "high", label: "Continuità" },
    metric2: { key: "semanticVariety", direction: "high", label: "Varietà semantica" },
  },
  {
    name: "Lo Sperimentatore",
    metric1: { key: "originality", direction: "high", label: "Originalità" },
    metric2: { key: "stability", direction: "low", label: "Stabilità" },
  },
  {
    name: "Il Fondamentalista",
    metric1: { key: "reasoningDepth", direction: "high", label: "Profondità di ragionamento" },
    metric2: { key: "interdisciplinaryScore", direction: "low", label: "Interdisciplinarità" },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1)); // exclusive upper bound
  return { start, end };
}

function monthExpiresAt(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map(Number) as [number, number];
  // First day of month after next, i.e. start of next month + 7 days
  return new Date(Date.UTC(y, m, 8)); // day 8 of next calendar month = +7 days past end of month
}

function dimAvg(snapshots: (typeof sgiSnapshots.$inferSelect)[], key: DimKey): number {
  if (snapshots.length === 0) return 0;
  return snapshots.reduce((acc, s) => acc + ((s[key] as number) ?? 0), 0) / snapshots.length;
}

function dimStd(snapshots: (typeof sgiSnapshots.$inferSelect)[], key: DimKey, avg: number): number {
  if (snapshots.length < 2) return 1;
  const variance = snapshots.reduce((acc, s) => {
    const v = (s[key] as number) ?? 0;
    return acc + (v - avg) ** 2;
  }, 0) / snapshots.length;
  return Math.sqrt(variance) || 1; // never return 0
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateVerdict(userId: number, lang = "it"): Promise<void> {
  const monthKey = currentMonthKey();

  // Advisory lock — prevents duplicate concurrent generation for same user.
  const lockRes = await db.execute(sql`SELECT pg_try_advisory_lock(${userId + 100000})`);
  if (!(lockRes.rows[0] as { pg_try_advisory_lock: boolean })?.pg_try_advisory_lock) {
    await db.execute(sql`SELECT pg_advisory_lock(${userId + 100000})`);
    await db.execute(sql`SELECT pg_advisory_unlock(${userId + 100000})`);
    return;
  }

  try {
    const { start: monthStart, end: monthEnd } = monthBounds(monthKey);

    // a) Current month snapshots.
    const currentSnaps = await db.select()
      .from(sgiSnapshots)
      .where(and(
        eq(sgiSnapshots.userId, userId),
        gte(sgiSnapshots.timestamp, monthStart),
        lt(sgiSnapshots.timestamp, monthEnd),
      ))
      .orderBy(desc(sgiSnapshots.timestamp))
      .limit(200);

    // b) Early-exit fallback if < 5 snapshots this month.
    if (currentSnaps.length < 5) {
      const langName = lang.startsWith("en") ? "English" : lang.startsWith("es") ? "Spanish" : "Italian";
      const fallbackVerdict =
        langName === "Italian"
          ? "Non ci sono ancora abbastanza dati questo mese per un verdetto preciso."
          : langName === "English"
            ? "Not enough data this month yet for a precise verdict."
            : "Aún no hay suficientes datos este mes para un veredicto preciso.";
      await db.insert(verdicts)
        .values({
          userId,
          monthKey,
          verdict: fallbackVerdict,
          archetype: "—",
          supportingMetrics: {
            metric1: { key: "reasoningDepth", label: "Profondità di ragionamento", value: 0, direction: "high" as const },
            metric2: { key: "stability", label: "Stabilità", value: 0, direction: "low" as const },
          } satisfies VerdictSupportingMetrics,
          lifestyleSuggestion: "",
          expiresAt: monthExpiresAt(monthKey),
        })
        .onConflictDoUpdate({
          target: [verdicts.userId, verdicts.monthKey],
          set: { verdict: fallbackVerdict, archetype: "—", lifestyleSuggestion: "", expiresAt: monthExpiresAt(monthKey) },
        });
      return;
    }

    // c) Historical baseline: last 180 days EXCLUDING current month.
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const histSnaps = await db.select()
      .from(sgiSnapshots)
      .where(and(
        eq(sgiSnapshots.userId, userId),
        gte(sgiSnapshots.timestamp, sixMonthsAgo),
        lt(sgiSnapshots.timestamp, monthStart),
      ))
      .orderBy(desc(sgiSnapshots.timestamp))
      .limit(500);

    // d) Compute per-dimension averages and z-scores.
    const currentAvgs: Record<DimKey, number> = {} as Record<DimKey, number>;
    const histAvgs: Record<DimKey, number> = {} as Record<DimKey, number>;
    const zScores: Record<DimKey, number> = {} as Record<DimKey, number>;

    for (const key of ALL_DIMS) {
      currentAvgs[key] = dimAvg(currentSnaps, key);
      histAvgs[key] = dimAvg(histSnaps, key);
      const std = dimStd(histSnaps, key, histAvgs[key]!);
      // If no historical data, use current value directly (z = 0 means neutral).
      zScores[key] = histSnaps.length >= 5
        ? (currentAvgs[key]! - histAvgs[key]!) / std
        : 0;
    }

    // e) Score each archetype — sum z-score contributions (high = +z, low = -z).
    let bestArchetype = ARCHETYPES[0]!;
    let bestScore = -Infinity;

    for (const arch of ARCHETYPES) {
      const z1 = zScores[arch.metric1.key]!;
      const z2 = zScores[arch.metric2.key]!;
      const score =
        (arch.metric1.direction === "high" ? z1 : -z1) +
        (arch.metric2.direction === "high" ? z2 : -z2);
      if (score > bestScore) {
        bestScore = score;
        bestArchetype = arch;
      }
    }

    // f) Build supporting metrics payload.
    const supportingMetrics: VerdictSupportingMetrics = {
      metric1: {
        key: bestArchetype.metric1.key,
        label: bestArchetype.metric1.label,
        value: Math.max(0, Math.min(1, currentAvgs[bestArchetype.metric1.key]!)),
        direction: bestArchetype.metric1.direction,
      },
      metric2: {
        key: bestArchetype.metric2.key,
        label: bestArchetype.metric2.label,
        value: Math.max(0, Math.min(1, currentAvgs[bestArchetype.metric2.key]!)),
        direction: bestArchetype.metric2.direction,
      },
    };

    // g) LLM call with timeout guard.
    const m1 = supportingMetrics.metric1;
    const m2 = supportingMetrics.metric2;
    const langName = lang.startsWith("en") ? "English" : lang.startsWith("es") ? "Spanish" : "Italian";

    const prompt = `You are a cognitive analyst writing a monthly summary for a user of SGI, an app that measures how people reason and argue.

ARCHETYPE ASSIGNED: "${bestArchetype.name}"
- ${m1.label}: ${(m1.value * 100).toFixed(0)}% (expected ${m1.direction === "high" ? "HIGH" : "LOW"} for this archetype)
- ${m2.label}: ${(m2.value * 100).toFixed(0)}% (expected ${m2.direction === "high" ? "HIGH" : "LOW"} for this archetype)

Write in ${langName}. Return ONLY valid JSON, no markdown fences:
{
  "verdict": "ONE declarative sentence max 20 words, second person (tu). NEVER observational language like 'hai lavorato su'. Reveal a cognitive trait directly. Example tone: 'Pensi per convergenza: parti largo, stringi in fretta, e raramente torni indietro.'",
  "explanation": "Max 30 words. Link the verdict to the two numbers above. Specific, not generic.",
  "lifestyleSuggestion": "Max 25 words. Physical activity or lifestyle habit derived ONLY from the archetype cognitive profile. NEVER mention health, medical, clinical, or diagnostic language. NEVER infer the user's physical condition."
}`;

    let resultVerdict = "Questo mese il tuo stile cognitivo è difficile da classificare con certezza.";
    let resultLifestyle = "";

    try {
      const callPromise = anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 250,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("verdict timeout")), 8_000),
      );
      const response = await Promise.race([callPromise, timeoutPromise]);
      const raw = (response.content[0] as { type: string; text?: string })?.text ?? "";
      const cleaned = raw.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as Record<string, string>;
      if (parsed["verdict"]) resultVerdict = String(parsed["verdict"]);
      if (parsed["explanation"]) resultVerdict = `${String(parsed["verdict"])}\n\n${String(parsed["explanation"])}`;
      if (parsed["lifestyleSuggestion"]) resultLifestyle = String(parsed["lifestyleSuggestion"]);
    } catch {
      // LLM/timeout/parse error — use fallback text set above.
    }

    // h) UPSERT verdict.
    const expiresAt = monthExpiresAt(monthKey);
    await db.insert(verdicts)
      .values({
        userId,
        monthKey,
        verdict: resultVerdict,
        archetype: bestArchetype.name,
        supportingMetrics,
        lifestyleSuggestion: resultLifestyle,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [verdicts.userId, verdicts.monthKey],
        set: {
          verdict: resultVerdict,
          archetype: bestArchetype.name,
          supportingMetrics,
          lifestyleSuggestion: resultLifestyle,
          expiresAt,
        },
      });

    // i) Log generation.
    const inputTokensEst = Math.ceil(prompt.length / 4);
    await db.insert(narrativeGenerationLog)
      .values({ userId, generatedAt: new Date(), inputTokensEst });

  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${userId + 100000})`);
  }
}
