---
name: Supabase client URL
description: VITE_SUPABASE_URL must never be empty string — fall back to window.location.origin
---

The Supabase JS client throws "supabaseUrl is required" if given an empty string.
`VITE_SUPABASE_URL` may be set to `""` in `.env` files.

**Rule:** In `artifacts/the-pavilion/src/integrations/supabase/client.ts`, always
fall back:
```ts
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:8080");
```

**Why:** Empty string silently passes the truthy check but fails the URL validation
inside the Supabase client constructor.
