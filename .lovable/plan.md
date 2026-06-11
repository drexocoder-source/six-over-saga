# Build Plan — Playoffs, Auctions, Captaincy & History

This is a large multi-system pass. I'll ship it in 4 phases so you can verify each before moving on. Tell me if you want to reorder or drop anything.

## Phase 1 — Fixes & Quick Wins
1. **Hall of Fame not showing** — diagnose the query (likely empty `records` table or filter mismatch), seed fallback aggregation from completed seasons, and render even when historical data is thin.
2. **Playoff "PO" count bug** — currently counts playoff *matches*; change to count *distinct seasons* a team/captain qualified for playoffs. Applies to team leaderboard and captaincy leaderboard.
3. **Tie / standings sanity pass** — verify DC vs PBKS tie still shows 1 pt each after the schedule rework.

## Phase 2 — Playoffs Bracket + Trophy
1. New `PlayoffsBracket` component on Schedule + a dedicated `/playoffs` view: aesthetic Q1 / Eliminator / Q2 / Final bracket lines, team crests, scores, winner highlight.
2. **Trophy ceremony**: when Final concludes, full-screen IPL-style trophy reveal (champions logo, confetti, year, captain, MVP, Orange/Purple cap). Reuses `Ceremony` page styling.

## Phase 3 — Schedule Variety + Captaincy
1. **Varied schedule each season**:
   - Seeded RNG per season so each year produces a different fixture list.
   - Opening match: previous champion vs a random opponent (IPL tradition).
   - Rivalry second-legs rotate yearly so home/away balance changes.
2. **Captaincy expansion**:
   - Captain dashboard: W/L, win%, toss win%, chase vs defend, home/away, finals reached, trophies, avg score under captaincy, longest win streak.
   - **Auto captaincy change**: if captain's rolling win% over last N matches < threshold, system promotes next-best leader (rating + experience) and logs the change to team history.

## Phase 4 — Auction Cycle + Retention AI + Team History
1. **Auction cycle rule**:
   - Mega every 4 seasons (S1, S5, S9…). Mini every other season.
   - **Mega**: max 5 retentions, ≥1 must be uncapped; per-slot retention cost deducted from 120 cr purse (IPL 2025 bracket).
   - **Mini**: unlimited retentions, full salary deducted from 90 cr purse (no cap on count, but purse naturally limits).
2. **AI Retain button** on Retention page: scores each player by `rating + season form + role scarcity + age curve + price/value`, returns ranked retain list within current cycle limits, shows reasoning per pick.
3. **Team History page** (`/team/:id/history`):
   - Per-season row: final position, pts, NRR, playoffs stage reached, captain, top scorer, top wicket-taker, trophies.
   - Best/worst season call-outs, captaincy timeline, retention history.
   - Mirror simpler version for players: per-season runs/wickets, captaincy spells, awards.

## Technical Notes
- `src/lib/schedule.ts`: add `seed` parameter (xorshift), opening-match override, rotation of rivalry doubles.
- `src/lib/seasonCycle.ts`: already has mega/mini logic — tweak to mini = unlimited retentions and mega = 5 with ≥1 uncapped.
- New `src/lib/retentionAI.ts`: scoring function + greedy selector respecting cycle caps and purse.
- New `src/lib/captaincy.ts`: rolling form, auto-swap rule, history log written to `records` or new `captaincy_changes` table.
- New `src/pages/TeamHistory.tsx` + route; aggregator in `src/lib/teamHistory.ts` reading seasons/matches/squads.
- Playoff appearance counter: `COUNT(DISTINCT season_id WHERE stage != 'league')` instead of raw match count — update `recordsAgg.ts` and Stats/Records consumers.
- Hall of Fame: re-check `src/pages/AllTime.tsx` (or equivalent), broaden the source query, add empty-state with computed fallback.
- New migration only if `captaincy_changes` table is needed; team history can ride on existing tables.

## Out of Scope (unless you say otherwise)
- New franchises beyond current 10.
- IPL 2008/09 retro skin (separate visual pass).
- Image-generation chat tools (still pending from earlier turns).

Reply **"go"** to start with Phase 1, or tell me which phase to do first / what to cut.