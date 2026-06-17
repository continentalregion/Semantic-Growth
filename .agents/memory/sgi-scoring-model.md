---
name: SGI scoring model and JSON truncation
description: gpt-5-nano truncates scoring JSON at 512 tokens; use gpt-4o-mini with response_format json_object
---

## The Rule

The SGI scoring call uses a large JSON prompt (10 dimensions + domains). `gpt-5-nano` with `max_completion_tokens: 512` consistently truncates the response → `SyntaxError: Unexpected end of JSON input` → fallback dimensions → rawScore always 31.9 → score never changes.

**Fix:** Use `gpt-4o-mini` with `max_tokens: 1024` and `response_format: { type: "json_object" }`.

**Why:** The scoring prompt asks for 10 float fields + a domains array. `gpt-5-nano` at 512 tokens cuts off before the closing brace. `gpt-4o-mini` with json_object mode guarantees valid complete JSON.

**How to apply:** Any call to `scoreMessage()` must use a model that supports `response_format: { type: "json_object" }` and enough tokens to complete the JSON (~200-400 tokens output).
