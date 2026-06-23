import { Router } from "express";

const router = Router();

const CLERK_BAPI = "https://api.clerk.com/v1";

// POST /api/auth/mobile-signin
//
// Backend-for-Frontend endpoint for Expo Go where @clerk/expo cannot establish
// client trust (needs_client_trust) in development instances because the native
// ClerkExpoModule is mocked.
//
// Flow:
//  1. Find Clerk user by email via Admin API
//  2. Verify password via Admin API  (/v1/users/{id}/verify_password)
//  3. Create one-time sign-in token  (/v1/sign_in_tokens)
//  4. Return token — mobile app uses strategy:"ticket" to complete sign-in
//
// The "ticket" strategy goes through FAPI but proves the user was authenticated
// via a server-side verified token, bypassing the dev-browser trust check.
router.post("/auth/mobile-signin", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    res.status(400).json({ error: "Email e password sono richiesti." });
    return;
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
      res.status(401).json({ error: "Nessun account trovato con questa email." });
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
      const errBody = await verifyResp.json().catch(() => ({})) as { errors?: Array<{ message?: string }> };
      const errMsg = errBody?.errors?.[0]?.message ?? "Password non corretta.";
      res.status(401).json({ error: errMsg });
      return;
    }
    const verifyData = (await verifyResp.json()) as { verified?: boolean };
    if (!verifyData.verified) {
      res.status(401).json({ error: "Password non corretta." });
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
    console.error("[mobile-signin] error:", err);
    res.status(500).json({ error: "Errore interno. Riprova tra qualche istante." });
  }
});

export default router;
