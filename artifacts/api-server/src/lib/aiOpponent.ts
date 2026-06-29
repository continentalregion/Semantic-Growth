import { openai } from "@workspace/integrations-openai-ai-server";

export const AI_PLAYER_ID = "ai_opponent";
export const AI_USERNAME = "Avversario AI";

export type AiLevel = "sfidante" | "pensatore" | "maestro";

interface LevelConfig {
  maxTokens: number;
  temperature: number;
  instruction: string;
}

const LEVEL_CONFIG: Record<AiLevel, LevelConfig> = {
  sfidante: {
    maxTokens: 250,
    temperature: 0.4,
    instruction:
      "Esprimi UN SOLO punto principale, in modo semplice e diretto. Scrivi 100–130 parole in totale. " +
      "Evita strutture complesse, esempi multipli, connessioni interdisciplinari o argomentazioni a più livelli. " +
      "Sii prevedibile: un lettore esperto deve poter anticipare facilmente la tua conclusione.",
  },
  pensatore: {
    maxTokens: 400,
    temperature: 0.65,
    instruction:
      "Sviluppa DUE punti distinti con struttura discreta. Scrivi 180–220 parole in totale. " +
      "Usa qualche riferimento concettuale ma senza approfondimento eccessivo. " +
      "La struttura deve essere chiara ma non particolarmente elaborata.",
  },
  maestro: {
    maxTokens: 600,
    temperature: 0.85,
    instruction:
      "Scrivi un'argomentazione densa, multi-punto, persuasiva. 280–320 parole. " +
      "Usa connessioni interdisciplinari, gestisci i controesempi con precisione, " +
      "ogni frase deve portare peso semantico reale. Nessun filler, nessuna ripetizione.",
  },
};

export async function generateAiArgument(
  theme: string,
  level: AiLevel,
): Promise<string> {
  const cfg = LEVEL_CONFIG[level];
  const prompt =
    `Sei un pensatore che partecipa a un dibattito intellettuale. ` +
    `${cfg.instruction} ` +
    `Scrivi l'argomentazione direttamente, senza intestazioni né meta-commenti. ` +
    `Non menzionare che sei un'AI.\n\nTEMA: ${theme.slice(0, 500)}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: cfg.maxTokens,
      temperature: cfg.temperature,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    if (text.length >= 40) return text;
  } catch (err) {
    console.error("[aiOpponent] generateAiArgument error", err);
  }

  return (
    "La proposizione tocca un nodo concettuale reale. " +
    "Ogni risposta definitiva presuppone già una scelta di paradigma che non può essere giustificata " +
    "all'interno del paradigma stesso. Ciò che chiamiamo soluzione è spesso una ridefinizione " +
    "strategica del problema — un atto linguistico più che conoscitivo."
  );
}
