---
name: Vite proxy config
description: Frontend dev server must proxy API paths to port 8080 — without this the Supabase client gets 404/ECONNREFUSED
---

The frontend runs on port 5000; the API server runs on port 8080.
The Supabase JS client uses `window.location.origin` as its base URL, so all
`/rest/v1/...`, `/auth/v1/...`, `/functions/v1/...` requests go to port 5000
which must proxy them to 8080.

**Rule:** `vite.config.ts` server block must include:
```ts
proxy: {
  "/rest":      { target: "http://localhost:8080", changeOrigin: true },
  "/auth":      { target: "http://localhost:8080", changeOrigin: true },
  "/functions": { target: "http://localhost:8080", changeOrigin: true },
},
```

**Why:** Without this, all API calls return 404 and the app shows "League creation failed" on load.

**How to apply:** Any time the Vite config is regenerated or reset, re-add these proxy entries.
