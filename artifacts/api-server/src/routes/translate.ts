import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const LANGUAGE_NAMES: Record<string, string> = {
  it: "Italian", en: "English", es: "Spanish", fr: "French",
  de: "German", pt: "Portuguese", nl: "Dutch", ru: "Russian",
  zh: "Chinese (Simplified)", ja: "Japanese", ko: "Korean",
  ar: "Arabic", hi: "Hindi", tr: "Turkish", pl: "Polish",
  sv: "Swedish", da: "Danish", fi: "Finnish", no: "Norwegian",
  cs: "Czech", ro: "Romanian", hu: "Hungarian", uk: "Ukrainian",
  el: "Greek", he: "Hebrew", th: "Thai", vi: "Vietnamese",
  id: "Indonesian", ms: "Malay", ca: "Catalan", hr: "Croatian",
};

function flattenObject(obj: unknown, prefix = ""): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  if (typeof obj !== "object" || obj === null) return result;

  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(val)) {
      result[fullKey] = val as string[];
    } else if (typeof val === "object" && val !== null) {
      Object.assign(result, flattenObject(val, fullKey));
    } else if (typeof val === "string") {
      result[fullKey] = val;
    }
  }
  return result;
}

function unflattenObject(flat: Record<string, string | string[]>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split(".");
    let cur: Record<string, unknown> = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!(part in cur) || typeof cur[part] !== "object") cur[part] = {};
      cur = cur[part] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]!] = val;
  }
  return result;
}

router.post("/translate", async (req, res) => {
  try {
    const { targetLanguage, translations } = req.body as {
      targetLanguage: string;
      translations: Record<string, unknown>;
    };

    if (!targetLanguage || typeof targetLanguage !== "string") {
      return res.status(400).json({ error: "targetLanguage required" });
    }
    if (!translations || typeof translations !== "object") {
      return res.status(400).json({ error: "translations object required" });
    }

    const langName = LANGUAGE_NAMES[targetLanguage.toLowerCase()] ?? targetLanguage;

    const flat = flattenObject(translations);
    const total = Object.keys(flat).length;

    const CHUNK_SIZE = 80;
    const keys = Object.keys(flat);
    const chunks: Record<string, string | string[]>[] = [];

    for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
      const chunk: Record<string, string | string[]> = {};
      for (const k of keys.slice(i, i + CHUNK_SIZE)) {
        chunk[k] = flat[k]!;
      }
      chunks.push(chunk);
    }

    const translatedFlat: Record<string, string | string[]> = {};

    for (const chunk of chunks) {
      const chunkStr = JSON.stringify(chunk);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are a professional UI translator specializing in web application localization. 
Translate the JSON values from Italian to ${langName}.

Rules:
- Keep ALL keys EXACTLY as-is (do not translate keys)
- Preserve ALL template placeholders like {{variable}}, {{n}}, {{used}}, etc. — never translate them
- Arrays must remain arrays with the same number of elements
- Keep special characters like ✦, ✓, →, —, #, +, %, € unchanged
- Keep product/brand names unchanged: SGI, Premium, Pro, Free, XP, Stripe, OpenAI, Anthropic, Claude, GPT, Haiku, Sonnet, Opus
- Translate naturally and idiomatically, not literally
- Response must be valid JSON object with the exact same keys`,
          },
          {
            role: "user",
            content: chunkStr,
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as Record<string, string | string[]>;
      Object.assign(translatedFlat, parsed);
    }

    const result = unflattenObject(translatedFlat);

    console.info(`[translate] translated ${total} keys to ${langName}`);
    return res.json({ language: targetLanguage, translations: result });
  } catch (err: unknown) {
    console.error("[translate] error:", err);
    const message = err instanceof Error ? err.message : "Translation failed";
    return res.status(500).json({ error: message });
  }
});

export default router;
