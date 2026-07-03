---
name: drizzle-kit push TTY failure in sandbox
description: drizzle-kit push/push --force cannot run in this sandbox because it needs an interactive TTY prompt; use direct SQL DDL instead for dev schema changes.
---

`pnpm drizzle-kit push` (and `push --force`) prompt interactively when they detect
ambiguous changes (renames, etc.) or even for plain confirmations. The Replit
agent shell has no TTY, so the command exits with a TTY-related error instead
of applying the migration.

**Why:** drizzle-kit's push flow is designed for local interactive use; there is
no reliable non-interactive flag that bypasses all prompts in this drizzle-kit
version.

**How to apply:** For dev database schema changes, hand-write the equivalent
`CREATE TABLE` / `ALTER TABLE` DDL and run it directly against `DATABASE_URL`
(via the `executeSql` tool) so it matches what the Drizzle schema file
declares. Keep the Drizzle schema (`schema.ts`) and the manually-applied SQL in
sync by hand. This only affects the dev database — production migrations still
go through the normal deploy path.
