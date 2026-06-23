---
name: SGI mobile ↔ API contract mismatches
description: Recurring class of bug where SGI mobile screens are wired against a different contract than the Express API actually serves
---

# SGI mobile ↔ API contract mismatches

When wiring an SGI mobile screen to an `@workspace/api-server` endpoint, **verify the exact request/response contract against the backend route** before trusting the mobile code. The mobile client has repeatedly been written against a contract the backend does not serve.

**Why:** Real shipped bugs from this exact class:
- Battle chat: mobile sent `{ content }` and did `r.json()`, but the backend `POST /threads/:id/sessions/:sessionId/chat` reads `req.body.message` and replies with an **SSE stream** (`data: {type:"content",text}\n\n` … `data: [DONE]\n\n`). Result: 400 "Message required" → "AI never responds / talking to yourself".
- Battle complete: mobile read `data.score` (nested), but `POST .../complete` returns **flat** fields `scoreTotal/scoreDensity/scoreConnections/scoreDepth/scoreExplanation` → final score screen showed nothing.

**How to apply:**
- The canonical/working reference for an endpoint's contract is usually the **web** client (`artifacts/sgi-app/src/pages/*`), which tends to be correct first. Mirror it on mobile.
- SSE streaming works on mobile via `import { fetch } from "expo/fetch"` + `r.body.getReader()` + `TextDecoder` (already proven in `app/(tabs)/index.tsx`). The global RN fetch does NOT stream.
- Don't assume an endpoint returns JSON — several SGI endpoints stream SSE.
