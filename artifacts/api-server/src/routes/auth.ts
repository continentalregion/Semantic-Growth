import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const CLERK_BAPI = "https://api.clerk.com/v1";
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_WINDOW_MINUTES = 15;

// ─── Rate limiting ─────────────────────────────────────────────────────────────
// Table created idempotently at module load — not managed by Drizzle migrations.
void (async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS auth_rate_limits (
        ip      TEXT NOT NULL,
        win_key TEXT NOT NULL,
        count   INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (ip, win_key)
      )
    `);
  } catch (err) {
    console.error("[auth] rate-limit table init error:", err);
  }
})();

function getClientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return first?.trim() ?? req.ip ?? "unknown";
}

function currentWindowKey(): string {
  const now = new Date();
  const quarter = Math.floor(now.getUTCMinutes() / AUTH_WINDOW_MINUTES) * AUTH_WINDOW_MINUTES;
  return `${now.toISOString().slice(0, 13)}:${String(quarter).padStart(2, "0")}`;
}

async function checkAuthRateLimit(ip: string): Promise<boolean> {
  const win = currentWindowKey();
  const row = await db.execute(sql`
    SELECT count FROM auth_rate_limits WHERE ip = ${ip} AND win_key = ${win}
  `);
  const count = (row.rows?.[0] as { count?: number } | undefined)?.count ?? 0;
  return count < AUTH_MAX_ATTEMPTS;
}

async function incrementAuthRateLimit(ip: string): Promise<void> {
  const win = currentWindowKey();
  await db.execute(sql`
    INSERT INTO auth_rate_limits (ip, win_key, count) VALUES (${ip}, ${win}, 1)
    ON CONFLICT (ip, win_key) DO UPDATE SET count = auth_rate_limits.count + 1
  `);
}

// POST /api/auth/mobile-signin
//
// Backend-for-Frontend endpoint for Expo Go where @clerk/expo cannot establish
// client trust (needs_client_trust) in development instances because the native
// ClerkExpoModule is mocked.
//
// Flow:
//  1. Rate-check IP (5 attempts per 15-minute window → 429)
//  2. Find Clerk user by email via Admin API
//  3. Verify password via Admin API  (/v1/users/{id}/verify_password)
//  4. Create one-time sign-in token  (/v1/sign_in_tokens)
//  5. Return token — mobile app uses strategy:"ticket" to complete sign-in
//
// The "ticket" strategy goes through FAPI but proves the user was authenticated
// via a server-side verified token, bypassing the dev-browser trust check.
router.post("/auth/mobile-signin", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    res.status(400).json({ error: "Email e password sono richiesti." });
    return;
  }

  // ── Rate limit by IP ──
  const ip = getClientIp(req as Parameters<typeof getClientIp>[0]);
  try {
    if (!(await checkAuthRateLimit(ip))) {
      res.status(429).json({ error: "Troppi tentativi. Riprova tra qualche minuto." });
      return;
    }
    await incrementAuthRateLimit(ip);
  } catch {
    // fail-open: don't block legitimate users on DB errors
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    res.status(503).json({ error: "Server non configurato correttamente." });
    return;
  }

  const headers = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };

  // Unified error message for all auth failures — prevents user enumeration
  const INVALID_CREDS = "Credenziali non valide.";

  try {
    // 1. Find user by email
    const usersResp = await fetch(
      `${CLERK_BAPI}/users?email_address=${encodeURIComponent(email)}&limit=1`,
      { headers }
    );
    if (!usersResp.ok) {
      res.status(502).json({ error: "Errore di comunicazione con il server di autenticazione." });
      return;
    }
    const users = (await usersResp.json()) as Array<{ id: string }>;
    if (!users || users.length === 0) {
      res.status(401).json({ error: INVALID_CREDS });
      return;
    }
    const userId = users[0]!.id;

    // 2. Verify password
    const verifyResp = await fetch(
      `${CLERK_BAPI}/users/${userId}/verify_password`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ password }),
      }
    );
    if (!verifyResp.ok) {
      res.status(401).json({ error: INVALID_CREDS });
      return;
    }
    const verifyData = (await verifyResp.json()) as { verified?: boolean };
    if (!verifyData.verified) {
      res.status(401).json({ error: INVALID_CREDS });
      return;
    }

    // 3. Create sign-in token (one-time use, expires in 10 min by default)
    const tokenResp = await fetch(`${CLERK_BAPI}/sign_in_tokens`, {
      method: "POST",
      headers,
      body: JSON.stringify({ user_id: userId }),
    });
    if (!tokenResp.ok) {
      res.status(502).json({ error: "Impossibile generare il token di accesso. Riprova." });
      return;
    }
    const tokenData = (await tokenResp.json()) as { token?: string; url?: string };
    const token = tokenData.token ?? tokenData.url;
    if (!token) {
      res.status(502).json({ error: "Token non ricevuto dal server. Riprova." });
      return;
    }

    res.json({ token });
  } catch (err) {
    // Never log request body — password must not appear in logs
    console.error("[mobile-signin] unexpected error:", (err instanceof Error) ? err.message : "unknown");
    res.status(500).json({ error: "Errore interno. Riprova tra qualche istante." });
  }
});

export default router;
