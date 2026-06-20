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
}

export interface SgiScoreResult {
  dimensions: SgiDimensions;
  domains: string[];
  rawScore: number;
}

// Prompt fisso — non cambia mai tra chiamate, ideale per il caching
const SCORING_PROMPT = `You are a semantic analysis engine. Analyze the user message and score it on these 10 dimensions (each 0.0–10.0):
1. conceptualComplexity 2. semanticVariety 3. interdisciplinaryScore 4. reasoningDepth 5. originality 6. stability 7. continuity 8. abstractionLevel 9. lexicalRichness 10. informationDensity
Domains (up to 3): philosophy,mathematics,biology,economics,psychology,physics,linguistics,technology,history,art,literature,politics,sociology,neuroscience,ethics,logic,computer_science,chemistry,astronomy,medicine
Return ONLY compact JSON: {"conceptualComplexity":5.2,"semanticVariety":4.8,"interdisciplinaryScore":3.1,"reasoningDepth":6.0,"originality":4.5,"stability":7.0,"continuity":5.5,"abstractionLevel":5.0,"lexicalRichness":4.2,"informationDensity":5.8,"domains":["philosophy"]}`;

export async function scoreMessage(
  userMessage: string,
  // Solo gli ultimi 2 scambi (non 4) — meno token, stesso segnale utile
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<SgiScoreResult> {
  try {
    // Tronca il messaggio a 600 caratteri per ridurre l'input al minimo
    const msgTruncated = userMessage.slice(0, 600);
    const context = conversationHistory
      .slice(-2)  // solo ultimi 2 messaggi di contesto
      .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
      .join("\n");

    const prompt = context
      ? `${SCORING_PROMPT}\n\nContext:\n${context}\n\nMessage:\n"${msgTruncated}"`
      : `${SCORING_PROMPT}\n\nMessage:\n"${msgTruncated}"`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,          // JSON compatto: ~200 token bastano
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());

    const dimensions: SgiDimensions = {
      conceptualComplexity:  clamp(parsed.conceptualComplexity  ?? 5, 0, 10),
      semanticVariety:       clamp(parsed.semanticVariety       ?? 5, 0, 10),
      interdisciplinaryScore:clamp(parsed.interdisciplinaryScore?? 5, 0, 10),
      reasoningDepth:        clamp(parsed.reasoningDepth        ?? 5, 0, 10),
      originality:           clamp(parsed.originality           ?? 5, 0, 10),
      stability:             clamp(parsed.stability             ?? 5, 0, 10),
      continuity:            clamp(parsed.continuity            ?? 5, 0, 10),
      abstractionLevel:      clamp(parsed.abstractionLevel      ?? 5, 0, 10),
      lexicalRichness:       clamp(parsed.lexicalRichness       ?? 5, 0, 10),
      informationDensity:    clamp(parsed.informationDensity    ?? 5, 0, 10),
    };

    const domains: string[] = Array.isArray(parsed.domains) ? parsed.domains.slice(0, 3) : [];
    const rawScore = computeRawScore(dimensions);
    return { dimensions, domains, rawScore };
  } catch (err) {
    console.error("[sgiScoring] failed, using fallback:", err);
    const fallback = defaultDimensions();
    return { dimensions: fallback, domains: [], rawScore: computeRawScore(fallback) };
  }
}

function defaultDimensions(): SgiDimensions {
  return {
    conceptualComplexity: 3, semanticVariety: 3, interdisciplinaryScore: 2,
    reasoningDepth: 3, originality: 3, stability: 5, continuity: 5,
    abstractionLevel: 3, lexicalRichness: 3, informationDensity: 3,
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function computeRawScore(dims: SgiDimensions): number {
  const weights = {
    conceptualComplexity: 0.15, semanticVariety: 0.12, interdisciplinaryScore: 0.13,
    reasoningDepth: 0.15, originality: 0.12, stability: 0.08, continuity: 0.08,
    abstractionLevel: 0.09, lexicalRichness: 0.04, informationDensity: 0.04,
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
