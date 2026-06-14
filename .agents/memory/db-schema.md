---
name: DB schema push
description: Fresh Replit environments have no DB tables — must push schema before first run
---

The PostgreSQL database is provisioned empty. Drizzle ORM schema lives in
`lib/db/src/schema/`. Tables do not exist until you push.

**Rule:** After any environment reset or first-time setup, run:
```
pnpm --filter @workspace/db run push
```

**Why:** The API server logs `relation "leagues" does not exist` and returns 500
on every request, causing "League creation failed" in the frontend.

**How to apply:** Run once after environment provisioning. Also run after any
schema migration changes to keep prod/dev in sync.
