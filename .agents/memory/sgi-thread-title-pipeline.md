---
name: Thread title field must survive the publish pipeline
description: Lesson from the aiTitle data-loss bug — a field needed by list UIs must be traced through every stage of the candidate → publish → list → render pipeline, not just the final render.
---

SGI's Threads feature has a multi-stage pipeline: AI proposes a candidate (`thread_candidates`, has `aiTitle`) → user confirms → row inserted into `threads` (published) → `GET /threads` lists them → client renders cards.

**Why:** a "list shows raw question text instead of a short title" bug looked like a UI-only issue but was actually caused by `threads` never having an `aiTitle` column at all — the confirm handler silently dropped the field when publishing, so by the time the list/render stage ran, the data was already gone. Fixing only the client component would have been a no-op.

**How to apply:** when a bug report says "field X isn't showing in Y", trace X backward through every persistence/transform boundary it crosses (source table → insert/copy step → list query projection → API response shape → client render), not just the last hop. Grep the schema definition itself to confirm the column exists before assuming it's a display bug. Also budget for legacy rows that predate the field (nullable fallback in the render function, e.g. truncated original text).
