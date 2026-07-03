---
name: i18next TFunction param typing
description: Custom helper functions that accept react-i18next's `t` as an argument fail structural typing unless typed as `any`
---

When writing a helper function that takes react-i18next's `t` (TFunction) as a parameter — e.g. `function notifySessionExpired(t: TFunction) {...}` — a hand-written signature like `(key: string, fallback?: string) => string` will NOT structurally match the real `TFunction` type. TFunction has multiple complex overloads (including a 3-arg `[key, defaultValue, options]` form), and TypeScript's overload resolution rejects simplified signatures even when they look compatible.

**Why:** Spent multiple failed attempts trying to narrow the type (`fallback?: string`, `...args: any[]`, etc.) before landing on `t: any` as the only clean fix — each narrower attempt produced a new "Target requires N elements" mismatch.

**How to apply:** When a helper only calls `t(key)` or `t(key, fallback)` internally and doesn't need to expose the full i18next type surface, just type the parameter as `any` (or `(key: string, ...args: any[]) => string` won't work either — go straight to `any`). Don't try to hand-roll a partial TFunction type.
