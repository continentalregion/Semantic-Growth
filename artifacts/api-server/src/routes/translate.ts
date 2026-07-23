import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── Server-side translation cache + rate limit (Postgres-backed) ────────────
// Anti-abuse: /translate is unauthenticated by design (frontend calls it the
// first time any visitor picks a non-cached language). Without a server-side
// cache, every visitor re-triggers a paid GPT-4o-mini call for the SAME
// language, and without a rate limit a scripted client can drive unlimited
// spend. Tables created idempotently at module load, same pattern as
// auth_rate_limits / guest_rate_limits in auth.ts / guestBattles.ts.
const TRANSLATE_MAX_REQUESTS = 5; // per IP, per 1-hour window
const MAX_TRANSLATION_KEYS = 500;

void (async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS translation_cache (
        lang TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS translate_rate_limits (
        ip      TEXT NOT NULL,
        win_key TEXT NOT NULL,
        count   INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (ip, win_key)
      )
    `);
  } catch (err) {
    console.error("[translate] table init error:", err);
  }
})();

function getClientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return first?.trim() ?? req.ip ?? "unknown";
}

function currentWindowKey(): string {
  return new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH — 1-hour window
}

async function checkTranslateRateLimit(ip: string): Promise<boolean> {
  const win = currentWindowKey();
  const row = await db.execute(sql`
    SELECT count FROM translate_rate_limits WHERE ip = ${ip} AND win_key = ${win}
  `);
  const count = (row.rows?.[0] as { count?: number } | undefined)?.count ?? 0;
  return count < TRANSLATE_MAX_REQUESTS;
}

async function incrementTranslateRateLimit(ip: string): Promise<void> {
  const win = currentWindowKey();
  await db.execute(sql`
    INSERT INTO translate_rate_limits (ip, win_key, count) VALUES (${ip}, ${win}, 1)
    ON CONFLICT (ip, win_key) DO UPDATE SET count = translate_rate_limits.count + 1
  `);
}

async function getCachedTranslation(lang: string): Promise<unknown | null> {
  const row = await db.execute(sql`
    SELECT value FROM translation_cache WHERE lang = ${lang}
  `);
  return (row.rows?.[0] as { value?: unknown } | undefined)?.value ?? null;
}

async function saveCachedTranslation(lang: string, value: unknown): Promise<void> {
  await db.execute(sql`
    INSERT INTO translation_cache (lang, value, updated_at) VALUES (${lang}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (lang) DO UPDATE SET value = ${JSON.stringify(value)}::jsonb, updated_at = now()
  `);
}

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

    const lang = targetLanguage.toLowerCase().trim();

    // Server-side cache — the vast majority of requests are the SAME language
    // requested by many different visitors, so this alone eliminates most
    // paid LLM calls regardless of the per-IP rate limit below.
    const cached = await getCachedTranslation(lang);
    if (cached) {
      console.info(`[translate] cache hit for ${lang}`);
      return res.json({ language: targetLanguage, translations: cached });
    }

    // Only requests that actually reach the LLM (cache miss) count against
    // the rate limit — legitimate repeat visitors never hit it.
    const ip = getClientIp(req as Parameters<typeof getClientIp>[0]);
    if (!(await checkTranslateRateLimit(ip))) {
      return res.status(429).json({ error: "Too many translation requests, try again later", code: "RATE_LIMIT" });
    }
    await incrementTranslateRateLimit(ip);

    const langName = LANGUAGE_NAMES[lang] ?? targetLanguage;

    const flat = flattenObject(translations);
    const total = Object.keys(flat).length;
    if (total > MAX_TRANSLATION_KEYS) {
      return res.status(400).json({ error: `translations payload too large (${total} > ${MAX_TRANSLATION_KEYS} keys)` });
    }

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

      const completion = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        temperature: 0.1,
        system: `You are a professional UI translator specializing in web application localization. 
Translate the JSON values from Italian to ${langName}.

Rules:
- Keep ALL keys EXACTLY as-is (do not translate keys)
- Preserve ALL template placeholders like {{variable}}, {{n}}, {{used}}, etc. — never translate them
- Arrays must remain arrays with the same number of elements
- Keep special characters like ✦, ✓, →, —, #, +, %, € unchanged
- Keep product/brand names unchanged: SGI, Premium, Pro, Free, XP, Stripe, OpenAI, Anthropic, Claude, GPT, Haiku, Sonnet, Opus
- Translate naturally and idiomatically, not literally
- Response must be valid JSON object with the exact same keys`,
        messages: [
          {
            role: "user",
            content: chunkStr,
          },
        ],
      });

      const raw = (completion.content[0] as { type: string; text?: string })?.text ?? "{}";
      const parsed = JSON.parse(raw) as Record<string, string | string[]>;
      Object.assign(translatedFlat, parsed);
    }

    const result = unflattenObject(translatedFlat);

    await saveCachedTranslation(lang, result);
    console.info(`[translate] translated ${total} keys to ${langName} (cached for future requests)`);
    return res.json({ language: targetLanguage, translations: result });
  } catch (err: unknown) {
    console.error("[translate] error:", err);
    const message = err instanceof Error ? err.message : "Translation failed";
    return res.status(500).json({ error: message });
  }
});

export default router;
