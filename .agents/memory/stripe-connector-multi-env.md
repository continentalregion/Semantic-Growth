---
name: Stripe connector returns ALL environments
description: The Replit credential proxy returns dev+prod connections together; must filter by environment or prod uses test keys
---

The Replit credential proxy (`/api/v2/connection?connector_names=stripe`) returns
**ALL** connections for the account — both the development/TEST connection AND the
production/LIVE connection — in one `items[]` array, regardless of which token
(`repl ` dev / `depl ` deployment) makes the call. Each item carries a top-level
`environment` field (`"development"` | `"production"`).

**Rule:** Never take `items[0]`. Select the connection whose `environment` matches
the current runtime. Detect runtime via `process.env.REPL_IDENTITY` (present only in
the workspace = development; absent in deployments = production), which mirrors the
existing token selection in the same function.

**Why:** taking `items[0]` made the deployed app pick the dev/TEST Stripe connection,
so checkout ran in Sandbox on the live domain (`sgindex.work`) even though a separate
production LIVE connection existed and was healthy. The bug is invisible in dev (dev
correctly wants test) and only bites production.

**How to apply:** any connector credential reader that can have both a dev and a prod
connection (Stripe, and likely other connectors too) must filter `items` by
`environment`, not index 0. webhook_secret must also come from the matched item.
