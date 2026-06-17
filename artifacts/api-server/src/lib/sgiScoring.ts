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

const SCORING_PROMPT = `You are a semantic analysis engine. Analyze the following user message and score it on these dimensions (each 0.0–10.0):

1. conceptualComplexity: How conceptually rich and multi-layered is the thinking?
2. semanticVariety: How diverse and wide-ranging is the vocabulary and conceptual space?
3. interdisciplinaryScore: How much does the message connect ideas from different domains?
4. reasoningDepth: How deep, rigorous, and structured is the reasoning?
5. originality: How novel, creative, or non-obvious are the ideas?
6. stability: How coherent and logically consistent is the narrative?
7. continuity: How well does this build on prior conversation themes?
8. abstractionLevel: How abstract vs. concrete is the thinking?
9. lexicalRichness: How rich and precise is the vocabulary?
10. informationDensity: How much meaningful information per unit of text?

Also identify up to 3 knowledge domains from: philosophy, mathematics, biology, economics, psychology, physics, linguistics, technology, history, art, literature, politics, sociology, neuroscience, ethics, logic, computer_science, chemistry, astronomy, medicine

Return ONLY valid JSON in this exact format:
{
  "conceptualComplexity": 5.2,
  "semanticVariety": 4.8,
  "interdisciplinaryScore": 3.1,
  "reasoningDepth": 6.0,
  "originality": 4.5,
  "stability": 7.0,
  "continuity": 5.5,
  "abstractionLevel": 5.0,
  "lexicalRichness": 4.2,
  "informationDensity": 5.8,
  "domains": ["philosophy", "psychology"]
}`;

export async function scoreMessage(userMessage: string, conversationHistory: Array<{role: string, content: string}>): Promise<SgiScoreResult> {
  try {
    const context = conversationHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join("\n");
    const prompt = `${SCORING_PROMPT}\n\nConversation context:\n${context}\n\nUser message to analyze:\n"${userMessage}"`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      max_completion_tokens: 512,
      messages: [
        { role: "user", content: prompt }
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const dimensions: SgiDimensions = {
      conceptualComplexity: clamp(parsed.conceptualComplexity ?? 5, 0, 10),
      semanticVariety: clamp(parsed.semanticVariety ?? 5, 0, 10),
      interdisciplinaryScore: clamp(parsed.interdisciplinaryScore ?? 5, 0, 10),
      reasoningDepth: clamp(parsed.reasoningDepth ?? 5, 0, 10),
      originality: clamp(parsed.originality ?? 5, 0, 10),
      stability: clamp(parsed.stability ?? 5, 0, 10),
      continuity: clamp(parsed.continuity ?? 5, 0, 10),
      abstractionLevel: clamp(parsed.abstractionLevel ?? 5, 0, 10),
      lexicalRichness: clamp(parsed.lexicalRichness ?? 5, 0, 10),
      informationDensity: clamp(parsed.informationDensity ?? 5, 0, 10),
    };

    const domains: string[] = Array.isArray(parsed.domains) ? parsed.domains.slice(0, 3) : [];

    const rawScore = computeRawScore(dimensions);

    return { dimensions, domains, rawScore };
  } catch (err) {
    console.error("[sgiScoring] scoreMessage failed, using fallback dimensions:", err);
    const fallback = defaultDimensions();
    return { dimensions: fallback, domains: [], rawScore: computeRawScore(fallback) };
  }
}

function defaultDimensions(): SgiDimensions {
  return {
    conceptualComplexity: 3,
    semanticVariety: 3,
    interdisciplinaryScore: 2,
    reasoningDepth: 3,
    originality: 3,
    stability: 5,
    continuity: 5,
    abstractionLevel: 3,
    lexicalRichness: 3,
    informationDensity: 3,
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function computeRawScore(dims: SgiDimensions): number {
  const weights = {
    conceptualComplexity: 0.15,
    semanticVariety: 0.12,
    interdisciplinaryScore: 0.13,
    reasoningDepth: 0.15,
    originality: 0.12,
    stability: 0.08,
    continuity: 0.08,
    abstractionLevel: 0.09,
    lexicalRichness: 0.04,
    informationDensity: 0.04,
  };

  let weightedSum = 0;
  for (const [key, weight] of Object.entries(weights)) {
    weightedSum += (dims[key as keyof SgiDimensions] / 10) * weight;
  }
  return weightedSum * 100;
}

export function computeNewSgiScore(currentScore: number, messageScore: number, alpha = 0.15): number {
  if (currentScore === 0) return messageScore;
  return alpha * messageScore + (1 - alpha) * currentScore;
}

export const BADGE_DEFINITIONS: Record<string, { name: string; description: string }> = {
  semantic_explorer: {
    name: "Semantic Explorer",
    description: "Completed 5 conversations"
  },
  systems_thinker: {
    name: "Systems Thinker",
    description: "Achieved interdisciplinary score above 7.5"
  },
  cross_domain_architect: {
    name: "Cross-Domain Architect",
    description: "Connected 5 distinct domains in one conversation"
  },
  abstract_reasoner: {
    name: "Abstract Reasoner",
    description: "Achieved abstraction level above 8.0"
  },
  high_growth_user: {
    name: "High Growth User",
    description: "Gained 10+ SGI points in 7 days"
  },
};

export function computeLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function xpToNextLevel(xp: number): number {
  const level = computeLevel(xp);
  const nextLevelXp = level * level * 100;
  return nextLevelXp - xp;
}

export function levelProgress(xp: number): number {
  const level = computeLevel(xp);
  const currentLevelXp = (level - 1) * (level - 1) * 100;
  const nextLevelXp = level * level * 100;
  const range = nextLevelXp - currentLevelXp;
  const progress = xp - currentLevelXp;
  return Math.min(1, progress / range);
}
