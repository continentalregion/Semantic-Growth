---
name: Claude conversation history caching — deferred decision
description: Approved but not-yet-implemented plan to add prompt caching on chat history in chat.ts to cut Opus/Sonnet long-conversation cost
---

## Decision
Add `cache_control: {type: "ephemeral"}` on the **penultimate message** of the
Claude message array in `chat.ts` (the last item of the stable history, i.e.
everything except the newest user turn), using the **extended 1-hour TTL**
beta (not the 5-min default).

**Why:** A single Pro user's 42-message Opus conversation cost ~€7.55 because
every turn resends the FULL conversation history uncached (only the system
prompt is cached today) — avg ~6,000 tokens/turn. This product's conversations
are reflective/slow-paced, so the default 5-min ephemeral cache TTL would
likely miss most of the time; the 1-hour extended-TTL beta header is needed
for real hit-rate, at a higher cache-write cost (2x vs 1.25x) that pays off
after ~2-3 turns for long conversations. User confirmed the existing
per-user cost cap (FASE 4, model-agnostic, Pro €11.66/mo, Premium €5.75/mo)
already fully protects margin — this caching work is a margin *optimization*,
not a safety fix, and is explicitly non-urgent.

**How to apply:** When picked up, requires converting Claude message content
from plain strings to content-block arrays (only where a cache_control
breakpoint is needed) in the `claudeMessages` construction path, adding the
Anthropic extended-cache-ttl beta header, and testing carefully against the
existing dedup/role-alternation logic and the OpenAI fallback branch (fallback
path is unaffected — it's OpenAI, not Claude — but must confirm the Claude
branch still degrades correctly to the fallback on cache-related errors too).
User explicitly deferred this until after "verifica Clarity post-fix Clerk"
is done — do not implement proactively without being asked.
