# The Pavilion

A cricket league simulation app — manage your own IPL-style T20 league with AI-driven auction, match simulation, statistics, social feed, and season history.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 / env PORT)
- `pnpm --filter @workspace/the-pavilion run dev` — run the frontend (port 18087 / env PORT)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `JWT_SECRET` — defaults to "pavilion-dev-secret-change-in-prod"

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (Tailwind CSS v3 + shadcn/ui), port 18087
- API: Express 5, port 8080 (proxied at /rest, /auth, /functions)
- DB: PostgreSQL + Drizzle ORM
- Auth: Custom JWT (bcryptjs + jsonwebtoken), users table
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/the-pavilion/` — React + Vite frontend (migrated from Lovable.dev)
- `artifacts/api-server/` — Express API server
- `artifacts/api-server/src/routes/postgrest.ts` — PostgREST-compatible router (main backend logic)
- `lib/db/src/schema/` — Drizzle ORM schema (8 files: leagues, players, seasons, matches, squads, records, social, misc)
- `artifacts/the-pavilion/src/integrations/supabase/client.ts` — Supabase JS client pointed at our Express API
- `artifacts/the-pavilion/src/lib/` — Business logic (league, auction, match sim, social, etc.)

## Architecture decisions

- Supabase JS client kept intact — `createClient()` pointed at `window.location.origin` with key "anon". Our Express router at `/rest/v1/:table`, `/auth/v1/...`, `/functions/v1/:name` mimics PostgREST protocol so the client works without changes.
- HEAD requests with `Prefer: count=exact` return `Content-Range: 0-N/total` for count queries (Supabase JS `.select("*", { count: "exact", head: true })` pattern).
- Join selects (`squads?select=*,players(*)`) resolved via `JOIN_DEFS` in-memory after fetching base rows — not SQL JOINs.
- JWT auth instead of Supabase Auth — `/auth/v1/signup` and `/auth/v1/token` issue JWTs, users stored in `users` table.
- All batch inserts use batches of ≤500 rows to stay well under pg parameter limit.
- `base_price` is `real` type (decimal crore values like 0.3, 1.5, 2.0).

## Product

- **Dashboard** — league overview, season stats, start/continue season
- **Auction** — AI full auction or manual bidding room for all 10 teams
- **Schedule** — round-robin fixtures & standings with NRR
- **Match** — live ball-by-ball simulation with AI or manual play
- **Squads** — per-team roster view after auction
- **Players** — career profile, batting/bowling stats
- **Records & Stats** — all-time records, season bests, milestones
- **Social** — IPL Twitter-style feed with team/player accounts
- **Season History** — season-by-season archive
- **Ceremony** — end-of-season awards (Orange Cap, Purple Cap, etc.)
- **Head-to-Head** — franchise rivalry stats

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The Supabase JS client sends real HTTP HEAD requests for count queries — must have `router.head()` handler.
- `.is("owner_id", null)` sends `?owner_id=is.null` — handled in `buildConditions`.
- `.in("id", ids)` sends `?id=in.(val1,val2)` format — handled via `in.(...)` parser.
- `JOIN_DEFS` in postgrest.ts must be updated when new join selects are added to the frontend.
- Player seed pool is in `artifacts/the-pavilion/src/lib/seedPlayers.ts` (809 players). Re-run seed script if DB is wiped.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- PostgREST protocol reference: https://docs.postgrest.org/en/stable/
