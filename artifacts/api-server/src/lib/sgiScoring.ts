import { openai } from "@workspace/integrations-openai-ai-server";

export interface SgiDimensions {
  conceptualComplexity: number;
  semanticVariety: number;
  interdisciplinaryScore: number;
  reasoningDepth: number;
  originality: number;
  stability: number;
  continuity: number;
  abstractionLevel: number;
  lexicalRichness: number;
  informationDensity: number;
  revisionSignal: number;
}

export interface MacroDimensions {
  profondita: number;
  connettivita: number;
  precisione: number;
  revisione: number;
}

export interface SgiScoreResult {
  dimensions: SgiDimensions;
  macroDimensions: MacroDimensions;
  domains: string[];
  rawScore: number;
}

// Shared rubric — reused by the dashboard scorer (scoreMessage) AND the battle
// dual-scorer (battleScoring.ts) so both judge on the IDENTICAL 11-metric criteria.
export const SGI_DIMENSIONS_RUBRIC = `1. conceptualComplexity — how many distinct, non-trivial concepts are present
2. semanticVariety — breadth of semantic fields touched
3. interdisciplinaryScore — cross-domain bridges (e.g. physics ↔ philosophy)
4. reasoningDepth — how deep the logical chain goes (surface claim vs. full argument)
5. originality — departure from obvious/common framings
6. stability — internal consistency, no contradictions
7. continuity — builds coherently on prior context
8. abstractionLevel — degree of abstraction from concrete to meta
9. lexicalRichness — precision and technical accuracy of vocabulary (NOT mere word count or rareness — using the RIGHT word scores high; padding with jargon scores low)
10. informationDensity — signal-to-noise ratio; how much semantic content per word
11. revisionSignal — CRITICAL: does this message show the user revising, nuancing, or updating a position they held earlier in the conversation? Score 0 if no revision; 1–4 if minor nuance; 5–7 if explicit refinement; 8–10 if meaningful position change with stated reason. Score 0 if this is the first message or no prior position exists.`;

export const SGI_DOMAINS_LIST = "philosophy,mathematics,biology,economics,psychology,physics,linguistics,technology,history,art,literature,politics,sociology,neuroscience,ethics,logic,computer_science,chemistry,astronomy,medicine";

const SCORING_PROMPT = `You are a semantic analysis engine. Analyze the USER message (and conversation context) and score it on these 11 dimensions (each 0.0–10.0):

${SGI_DIMENSIONS_RUBRIC}

Domains (up to 3 from): ${SGI_DOMAINS_LIST}

Return ONLY compact JSON:
{"conceptualComplexity":5.2,"semanticVariety":4.8,"interdisciplinaryScore":3.1,"reasoningDepth":6.0,"originality":4.5,"stability":7.0,"continuity":5.5,"abstractionLevel":5.0,"lexicalRichness":4.2,"informationDensity":5.8,"revisionSignal":0.0,"domains":["philosophy"]}`;

export async function scoreMessage(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<SgiScoreResult> {
  try {
    const msgTruncated = userMessage.slice(0, 600);
    const context = conversationHistory
      .slice(-4)
      .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
      .join("\n");

    const prompt = context
      ? `${SCORING_PROMPT}\n\nContext:\n${context}\n\nMessage:\n"${msgTruncated}"`
      : `${SCORING_PROMPT}\n\nMessage:\n"${msgTruncated}"`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 320,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());

    const dimensions = normalizeDimensions(parsed);

    const domains: string[] = Array.isArray(parsed.domains) ? parsed.domains.slice(0, 3) : [];
    const macroDimensions = computeMacroDimensions(dimensions);
    const rawScore = computeRawScore(dimensions);
    return { dimensions, macroDimensions, domains, rawScore };
  } catch (err) {
    console.error("[sgiScoring] failed, using fallback:", err);
    const fallback = defaultDimensions();
    const macroDimensions = computeMacroDimensions(fallback);
    return { dimensions: fallback, macroDimensions, domains: [], rawScore: computeRawScore(fallback) };
  }
}

function defaultDimensions(): SgiDimensions {
  return {
    conceptualComplexity: 3, semanticVariety: 3, interdisciplinaryScore: 2,
    reasoningDepth: 3, originality: 3, stability: 5, continuity: 5,
    abstractionLevel: 3, lexicalRichness: 3, informationDensity: 3,
    revisionSignal: 0,
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Parse + clamp raw LLM output into the 11 SGI dimensions.
 * Preserves legitimate 0 values (e.g. revisionSignal) — only missing/NaN fields
 * fall back to the default. Shared by the dashboard scorer and the battle scorer.
 */
export function normalizeDimensions(parsed: Record<string, unknown> | null | undefined): SgiDimensions {
  const p = parsed ?? {};
  const num = (key: string, fallback: number): number => {
    const v = (p as Record<string, unknown>)[key];
    const n = typeof v === "number" ? v : v == null ? NaN : Number(v);
    return clamp(Number.isFinite(n) ? n : fallback, 0, 10);
  };
  return {
    conceptualComplexity:   num("conceptualComplexity",   5),
    semanticVariety:        num("semanticVariety",        5),
    interdisciplinaryScore: num("interdisciplinaryScore", 5),
    reasoningDepth:         num("reasoningDepth",          5),
    originality:            num("originality",             5),
    stability:              num("stability",               5),
    continuity:             num("continuity",              5),
    abstractionLevel:       num("abstractionLevel",        5),
    lexicalRichness:        num("lexicalRichness",         5),
    informationDensity:     num("informationDensity",      5),
    revisionSignal:         num("revisionSignal",          0),
  };
}

/**
 * 4 macro-dimensions visible to the user — transparent, not opaque.
 *
 * profondita  = depth of reasoning (conceptualComplexity + reasoningDepth + abstractionLevel)
 * connettivita = cross-domain bridges (interdisciplinaryScore + semanticVariety)
 * precisione  = quality of expression (informationDensity + lexicalRichness) — low weight since gameable
 * revisione   = honest growth signal: does the user update their thinking? (revisionSignal)
 */
export function computeMacroDimensions(d: SgiDimensions): MacroDimensions {
  const profondita   = (d.conceptualComplexity + d.reasoningDepth + d.abstractionLevel) / 3;
  const connettivita = (d.interdisciplinaryScore + d.semanticVariety) / 2;
  const precisione   = (d.informationDensity + d.lexicalRichness) / 2;
  const revisione    = d.revisionSignal;
  return {
    profondita:   Math.round(profondita   * 10) / 10,
    connettivita: Math.round(connettivita * 10) / 10,
    precisione:   Math.round(precisione   * 10) / 10,
    revisione:    Math.round(revisione    * 10) / 10,
  };
}

export function computeRawScore(dims: SgiDimensions): number {
  // Revised weights — revision gets 20% (honest growth signal), lexical low (gameable)
  const weights = {
    reasoningDepth:         0.15,
    conceptualComplexity:   0.12,
    abstractionLevel:       0.08,
    interdisciplinaryScore: 0.17,
    semanticVariety:        0.13,
    revisionSignal:         0.20,
    informationDensity:     0.07,
    lexicalRichness:        0.03,
    originality:            0.03,
    stability:              0.01,
    continuity:             0.01,
  };
  let sum = 0;
  for (const [key, weight] of Object.entries(weights)) {
    sum += (dims[key as keyof SgiDimensions] / 10) * weight;
  }
  return sum * 100;
}

export function computeNewSgiScore(currentScore: number, messageScore: number, alpha = 0.15): number {
  if (currentScore === 0) return messageScore;
  return alpha * messageScore + (1 - alpha) * currentScore;
}

export const BADGE_DEFINITIONS: Record<string, { name: string; description: string }> = {
  semantic_explorer:       { name: "Semantic Explorer",       description: "Completed 5 conversations" },
  systems_thinker:         { name: "Systems Thinker",         description: "Achieved interdisciplinary score above 7.5" },
  cross_domain_architect:  { name: "Cross-Domain Architect",  description: "Connected 5 distinct domains in one conversation" },
  abstract_reasoner:       { name: "Abstract Reasoner",       description: "Achieved abstraction level above 8.0" },
  high_growth_user:        { name: "High Growth User",        description: "Gained 10+ SGI points in 7 days" },
  mind_changer:            { name: "Mind Changer",            description: "Revised your position with a revisionSignal above 7.0" },
  battle_victor:           { name: "Battle Victor",           description: "Defeated the SGI AI in a 1-on-1 battle" },
};

export function computeLevel(xp: number): number { return Math.floor(Math.sqrt(xp / 100)) + 1; }
export function xpToNextLevel(xp: number): number {
  const level = computeLevel(xp);
  return level * level * 100 - xp;
}
export function levelProgress(xp: number): number {
  const level = computeLevel(xp);
  const cur = (level - 1) * (level - 1) * 100;
  const nxt = level * level * 100;
  return Math.min(1, (xp - cur) / (nxt - cur));
}
