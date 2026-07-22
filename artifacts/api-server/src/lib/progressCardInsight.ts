// Generates the short (1-2 line) qualitative phrase shown alongside the
// numeric delta% on a progress card. Uses Haiku with a small, numeric-only
// prompt — NEVER the original message text — to keep cost minimal and avoid
// leaking conversation content into an unrelated LLM call.
//
// Hard rules enforced via prompt + post-validation:
// - Localized to the user's current UI language (it/en/es), passed in.
// - Must reference language/argumentation/reasoning-style — never brain/mind
//   (SGI measures text patterns, not neuroscience).
// - Honest but constructive on negative trends — never celebratory.
// - Any failure (error, timeout, empty/invalid output) resolves to `null` so
//   the caller can insert the progress card with insightText=null and the
//   card still renders fine with numeric data only.
import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { HighlightCandidateMetric } from "./progressCard";

export type ProgressInsightLang = "it" | "en" | "es";

const LANGUAGE_NAMES: Record<ProgressInsightLang, string> = {
  it: "Italian",
  en: "English",
  es: "Spanish",
};

// Localized metric labels used ONLY to give the LLM natural-language context
// for the highlighted metric — never sent back to the client as-is (the
// existing highlightMetricLabel field in threads.ts is unaffected/unchanged).
const METRIC_LABELS: Record<HighlightCandidateMetric, Record<ProgressInsightLang, string>> = {
  reasoningDepth: { it: "profondità di ragionamento", en: "depth of reasoning", es: "profundidad de razonamiento" },
  interdisciplinaryScore: { it: "interdisciplinarità", en: "interdisciplinary thinking", es: "pensamiento interdisciplinario" },
  conceptualComplexity: { it: "complessità concettuale", en: "conceptual complexity", es: "complejidad conceptual" },
  semanticVariety: { it: "varietà semantica", en: "semantic variety", es: "variedad semántica" },
  originality: { it: "originalità", en: "originality", es: "originalidad" },
  stability: { it: "stabilità argomentativa", en: "argumentative stability", es: "estabilidad argumentativa" },
  continuity: { it: "continuità del filo logico", en: "continuity of thought", es: "continuidad del hilo lógico" },
};

export interface ProgressInsightInput {
  earlyAvg: number;
  lateAvg: number;
  deltaPct: number;
  highlightMetric: HighlightCandidateMetric;
  highlightDeltaPct: number;
  isPositive: boolean;
}

const MAX_CHARS = 160; // hard safety cap so SVG/canvas layouts never overflow, regardless of language
const CALL_TIMEOUT_MS = 2500; // must never meaningfully delay the chat response

const FORBIDDEN_TERMS = [
  "cervello", "cerebro", "brain",
  "mente", "mind", // "mente" is also the Spanish word for "mind" — same ban applies
  "neurale", "neural", "neuronal", "neurona", "neurone",
];

// Word-boundary matching is required, NOT plain substring matching: Italian
// adverbs overwhelmingly end in "-mente" (e.g. "significativamente",
// "chiaramente", "onestamente"), so a naive `.includes("mente")` false-positives
// on almost any Italian sentence and silently nukes the insight. Similarly,
// English words like "reminder"/"mindful" contain "mind" as a substring.
// \b anchors ensure we only match the standalone forbidden word/term itself.
function containsForbiddenTerm(text: string): boolean {
  const normalized = text.toLowerCase();
  return FORBIDDEN_TERMS.some(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
  });
}

function buildPrompt(input: ProgressInsightInput, lang: ProgressInsightLang): string {
  const langName = LANGUAGE_NAMES[lang];
  const metricLabel = METRIC_LABELS[input.highlightMetric][lang];
  const trendWord = input.isPositive ? "improving" : "declining";

  return `You write a single short caption (max 2 short sentences, under 140 characters total) for a "progress card" on SGI, an app that measures how a person's LANGUAGE and ARGUMENTATION evolve across a conversation — it analyzes TEXT PATTERNS only, never neuroscience.

DATA (all numeric, no conversation content):
- Overall score: early=${input.earlyAvg.toFixed(1)}, late=${input.lateAvg.toFixed(1)}, change=${input.deltaPct.toFixed(1)}%
- Most-changed dimension: "${metricLabel}", change=${input.highlightDeltaPct.toFixed(1)}% (${trendWord})

RULES:
- Respond ONLY in ${langName} (language code: ${lang}). Do not mix languages.
- Talk about the person's LANGUAGE, ARGUMENTATION, or REASONING STYLE in this conversation (e.g. "your argumentation", "the way you reason here", "your language"). NEVER use words meaning "brain", "mind", or anything implying a neuroscientific/neural measurement — SGI reads text, not neural activity.
- If the change is negative, be honest and constructive — point at what shifted without sugar-coating, but never dismissive. NEVER sound celebratory or upbeat about a decline.
- If the change is positive, be genuine and specific, not generic hype.
- No emojis, no quotation marks, no markdown, no hashtags. Plain text only, 1-2 sentences.
- VARY your opening and sentence structure — do NOT always start with "Il tuo X si è fatto" or "Your X has become". Use different angles each time:
    • Direct observation: "La tua argomentazione ha cambiato ritmo in questa sessione."
    • Rhetorical question: "Cosa è cambiato nel modo in cui costruisci le tue posizioni?"
    • Short metaphor: "Come un muscolo che trova la sua forma, il ragionamento si è fatto più preciso."
    • Naming the shift: "Una svolta nella struttura argomentativa: meno affermazioni, più connessioni."
  Pick whichever angle fits the data and feels fresh — never the same formula twice.
- Output ONLY the caption text, nothing else.`;
}

export async function generateProgressInsight(
  input: ProgressInsightInput,
  lang: string | undefined,
): Promise<string | null> {
  const safeLang: ProgressInsightLang = lang === "en" || lang === "es" ? lang : "it";

  try {
    const call = anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 100,
      temperature: 0.9,
      messages: [{ role: "user", content: buildPrompt(input, safeLang) }],
    });

    const timeoutGuard = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("progress-insight timeout")), CALL_TIMEOUT_MS),
    );

    const response = await Promise.race([call, timeoutGuard]);
    const block = response.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";

    if (!text) {
      console.warn("[progress-insight] empty LLM output, falling back to numeric-only card");
      return null;
    }
    if (containsForbiddenTerm(text)) {
      console.warn("[progress-insight] LLM output contained a forbidden term, discarding:", text.slice(0, 60));
      return null;
    }

    return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS - 1).trimEnd() + "…" : text;
  } catch (err) {
    console.warn("[progress-insight] LLM call failed, falling back to numeric-only card:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
