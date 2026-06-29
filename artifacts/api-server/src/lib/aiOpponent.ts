import { openai } from "@workspace/integrations-openai-ai-server";

export const AI_PLAYER_ID = "ai_opponent";
export const AI_USERNAME = "Avversario AI";

const AI_ARGUMENT_PROMPT = (theme: string) =>
  `Sei un pensatore brillante che partecipa a un dibattito intellettuale. Scrivi un'argomentazione densa, originale e persuasiva di circa 300 parole sul seguente tema. Ogni frase deve portare peso semantico reale: usa concetti precisi, esempi concreti, struttura logica rigorosa. Evita ripetizioni, filler e vaghezze. Difendi o metti in discussione la proposizione con forza e coerenza. Non menzionare che sei un'AI, non aggiungere intestazioni, non commentare il compito — scrivi solo l'argomentazione.

TEMA: ${theme}`;

export async function generateAiArgument(theme: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      temperature: 0.85,
      messages: [{ role: "user", content: AI_ARGUMENT_PROMPT(theme.slice(0, 500)) }],
    });
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    if (text.length >= 50) return text;
  } catch (err) {
    console.error("[aiOpponent] generateAiArgument error", err);
  }
  return (
    "La proposizione in esame rivela una tensione strutturale irriducibile: ogni risposta definitiva " +
    "presuppone già una scelta di paradigma che non può essere giustificata all'interno del paradigma stesso. " +
    "Questo non è relativismo, ma riconoscimento dei limiti epistemici di qualsiasi sistema chiuso. " +
    "Ciò che chiamiamo 'soluzione' è spesso una ridefinizione strategica del problema — un atto linguistico " +
    "più che conoscitivo. La vera posta in gioco non è trovare la risposta giusta, ma interrogare le condizioni " +
    "di possibilità che rendono alcune risposte pensabili e altre invisibili."
  );
}
