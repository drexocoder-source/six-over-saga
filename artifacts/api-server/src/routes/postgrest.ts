/**
 * PostgREST-compatible REST API for the Supabase JS client.
 *
 * Mounted at:
 *   /rest  → /rest/v1/:table (GET, HEAD, POST, PATCH, DELETE)
 *   /auth  → /auth/v1/token, /auth/v1/signup, /auth/v1/logout, /auth/v1/user
 *   /functions → /functions/v1/:name
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  leaguesTable, playersTable, seasonsTable, matchesTable, squadsTable,
  recordsTable, achievementsTable, trophiesTable, customRecordsTable,
  ratingHistoryTable, ceremonyImagesTable, matchMomentsTable,
  socialAccountsTable, socialPostsTable, socialRepliesTable,
  socialFollowsTable, socialLikesTable, usersTable, ballsTable,
} from "@workspace/db";
import { sql, eq, and, inArray, isNull, isNotNull, asc, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";

const router: IRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? "pavilion-dev-secret-change-in-prod";
const JWT_EXPIRY = "7d";

/**
 * Tables that are read-only for everyone (global player pool, lookup data).
 * No writes are permitted on these from the client layer.
 */
const READ_ONLY_TABLES = new Set(["players"]);

/**
 * Tables scoped to a league — writes require the caller to supply the league_id
 * either as a query param or body field, AND must own that league
 * (matched by JWT user id = owner_id, or device_id header = league device_id).
 */
const LEAGUE_SCOPED_TABLES = new Set([
  "seasons", "matches", "squads", "records", "achievements", "trophies",
  "custom_records", "rating_history", "ceremony_images", "match_moments",
  "social_accounts", "social_posts", "social_replies", "social_follows",
  "social_likes", "balls",
]);

/**
 * Verify the caller owns the league referenced by the request.
 * Returns null on success, or an error string on failure.
 */
async function verifyLeagueOwnership(
  req: Request,
  leagueId: string | null
): Promise<string | null> {
  if (!leagueId) return "league_id required for mutations";

  const [league] = await db.select().from(leaguesTable).where(eq(leaguesTable.id, leagueId)).limit(1);
  if (!league) return "league not found";

  const user = extractUser(req);
  if (user && league.ownerId && league.ownerId === user.id) return null;
  if (user && !league.ownerId) return null; // unclaimed league — any auth user can act on it

  const deviceId = req.headers["x-device-id"] as string | undefined;
  if (deviceId && league.deviceId === deviceId) return null;

  return "Forbidden: you do not own this league";
}

const TABLE_MAP: Record<string, any> = {
  leagues: leaguesTable,
  players: playersTable,
  seasons: seasonsTable,
  matches: matchesTable,
  squads: squadsTable,
  records: recordsTable,
  achievements: achievementsTable,
  trophies: trophiesTable,
  custom_records: customRecordsTable,
  rating_history: ratingHistoryTable,
  ceremony_images: ceremonyImagesTable,
  match_moments: matchMomentsTable,
  social_accounts: socialAccountsTable,
  social_posts: socialPostsTable,
  social_replies: socialRepliesTable,
  social_follows: socialFollowsTable,
  social_likes: socialLikesTable,
  balls: ballsTable,
};

// Join definitions: tableName -> { joinKey: foreignKey column on base, joinTable, targetKey }
const JOIN_DEFS: Record<string, { fkCol: string; refTable: any; refName: string }[]> = {
  squads: [
    { fkCol: "player_id", refTable: playersTable, refName: "players" },
  ],
  social_posts: [
    { fkCol: "account_id", refTable: socialAccountsTable, refName: "social_accounts" },
  ],
  rating_history: [
    { fkCol: "player_id", refTable: playersTable, refName: "players" },
  ],
};

function getColumnByName(table: any, name: string): any {
  // Direct snake_case match on column .name property
  for (const col of Object.values(table)) {
    if (typeof col === "object" && col !== null && (col as any).name === name) {
      return col;
    }
  }
  // camelCase key match
  const camel = name.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
  if (camel in table) return table[camel];
  return null;
}

function buildConditions(table: any, params: Record<string, string>): any[] {
  const conditions: any[] = [];
  const RESERVED = new Set(["select", "order", "limit", "offset", "count", "on_conflict", "prefer", "head"]);

  for (const [key, val] of Object.entries(params)) {
    if (RESERVED.has(key)) continue;
    const col = getColumnByName(table, key);
    if (!col) continue;

    if (val === "is.null" || val === "is.null") {
      conditions.push(isNull(col));
    } else if (val === "is.not.null") {
      conditions.push(isNotNull(col));
    } else if (val.startsWith("eq.")) {
      conditions.push(eq(col, val.slice(3)));
    } else if (val.startsWith("neq.")) {
      conditions.push(sql`${col} != ${val.slice(4)}`);
    } else if (val.startsWith("in.(") && val.endsWith(")")) {
      const vals = val.slice(4, -1).split(",").map((v) => v.trim()).filter(Boolean);
      if (vals.length > 0) conditions.push(inArray(col, vals));
    } else if (val.startsWith("is.")) {
      const v = val.slice(3);
      if (v === "null") conditions.push(isNull(col));
      else conditions.push(eq(col, v));
    } else if (val.startsWith("gte.")) {
      conditions.push(sql`${col} >= ${val.slice(4)}`);
    } else if (val.startsWith("lte.")) {
      conditions.push(sql`${col} <= ${val.slice(4)}`);
    } else if (val.startsWith("gt.")) {
      conditions.push(sql`${col} > ${val.slice(3)}`);
    } else if (val.startsWith("lt.")) {
      conditions.push(sql`${col} < ${val.slice(3)}`);
    } else if (val.startsWith("like.")) {
      conditions.push(sql`${col} LIKE ${val.slice(5)}`);
    } else if (val.startsWith("ilike.")) {
      conditions.push(sql`${col} ILIKE ${val.slice(6)}`);
    }
  }
  return conditions;
}

function toSnakeCase(row: any): any {
  if (!row || typeof row !== "object") return row;
  if (Array.isArray(row)) return row.map(toSnakeCase);
  const out: any = {};
  for (const [k, v] of Object.entries(row)) {
    const snake = k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    out[snake] = v;
  }
  return out;
}

function toCamelCase(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    out[camel] = v;
  }
  return out;
}

function extractUser(req: Request): { id: string; email: string } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  if (!token || token === "anon" || token.length < 20) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/**
 * Parse select param to extract join specs.
 * e.g. "*, players(*)" => joinNames = ["players"]
 * e.g. "*, players(name,role,rating)" => joinNames = [{ name: "players", cols: ["name","role","rating"] }]
 */
function parseSelectParam(selectParam: string | undefined): { joins: Array<{ refName: string; cols: string[] | null }> } {
  const joins: Array<{ refName: string; cols: string[] | null }> = [];
  if (!selectParam) return { joins };

  // Match patterns like players(*) or social_accounts(name,role)
  const joinRe = /(\w+)\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = joinRe.exec(selectParam)) !== null) {
    const refName = m[1];
    const inner = m[2].trim();
    const cols = inner === "*" ? null : inner.split(",").map((c) => c.trim()).filter(Boolean);
    joins.push({ refName, cols });
  }
  return { joins };
}

/**
 * Performs joins for a set of rows based on the join definitions.
 */
async function resolveJoins(
  tableName: string,
  rows: any[],
  joins: Array<{ refName: string; cols: string[] | null }>
): Promise<any[]> {
  if (!joins.length || !rows.length) return rows;
  const defs = JOIN_DEFS[tableName] ?? [];
  let result = rows.map((r) => ({ ...r }));

  for (const { refName, cols } of joins) {
    const def = defs.find((d) => d.refName === refName);
    if (!def) continue;

    const ids = [...new Set(rows.map((r) => r[def.fkCol]).filter(Boolean))];
    if (!ids.length) {
      result = result.map((r) => ({ ...r, [refName]: null }));
      continue;
    }

    const refIdCol = getColumnByName(def.refTable, "id");
    const refRows = await db.select().from(def.refTable).where(inArray(refIdCol, ids));
    const snaked = refRows.map(toSnakeCase);

    const refMap = new Map(snaked.map((r: any) => [r.id, r]));
    result = result.map((r) => {
      let ref: any = refMap.get(r[def.fkCol]) ?? null;
      if (ref && cols) {
        const partial: any = {};
        for (const col of cols) partial[col] = ref[col];
        ref = partial;
      }
      return { ...r, [refName]: ref };
    });
  }
  return result;
}

// ============ AUTH ROUTES (/auth/v1/...) ============

router.post("/v1/signup", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: "email and password required" }); return; }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) { res.status(422).json({ error: "User already registered" }); return; }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ email, passwordHash }).returning();
    const token = jwt.sign({ sub: user.id, email: user.email, role: "authenticated" }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    res.status(200).json({
      access_token: token,
      token_type: "bearer",
      user: { id: user.id, email: user.email, role: "authenticated" },
    });
  } catch (err) {
    req.log.error({ err }, "signup error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/v1/token", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: "email and password required" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) { res.status(400).json({ error: "Invalid login credentials" }); return; }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) { res.status(400).json({ error: "Invalid login credentials" }); return; }

    const token = jwt.sign({ sub: user.id, email: user.email, role: "authenticated" }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    res.json({
      access_token: token,
      token_type: "bearer",
      user: { id: user.id, email: user.email, role: "authenticated" },
    });
  } catch (err) {
    req.log.error({ err }, "signin error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/v1/logout", (_req: Request, res: Response): void => {
  res.status(204).send();
});

router.get("/v1/user", async (req: Request, res: Response): Promise<void> => {
  const user = extractUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json({ id: user.id, email: user.email, role: "authenticated" });
});

// ============ REST ROUTES (/rest/v1/...) ============

/**
 * HEAD /rest/v1/:table — count query (Supabase JS client uses this for count=exact)
 * Returns Content-Range header: 0-N/total
 */
router.head("/v1/:table", async (req: Request, res: Response): Promise<void> => {
  const tableName = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  const dbTable = TABLE_MAP[tableName];
  if (!dbTable) { res.status(404).end(); return; }

  try {
    const q = req.query as Record<string, string>;
    const conditions = buildConditions(dbTable, q);
    const whereClause = conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...conditions) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(dbTable).where(whereClause);
    const n = Number(count);
    res.setHeader("Content-Range", n > 0 ? `0-${n - 1}/${n}` : `*/${n}`);
    res.setHeader("Content-Profile", "public");
    res.status(200).end();
  } catch (err) {
    req.log.error({ err }, "HEAD /rest/v1/:table error");
    res.status(500).end();
  }
});

router.get("/v1/:table", async (req: Request, res: Response): Promise<void> => {
  const tableName = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  const dbTable = TABLE_MAP[tableName];
  if (!dbTable) { res.status(404).json({ error: "Table not found" }); return; }

  try {
    const q = req.query as Record<string, string>;
    const conditions = buildConditions(dbTable, q);
    const whereClause = conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...conditions) : undefined;

    // count only (head=true from Supabase query builder URL param fallback)
    if (q.head === "true") {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(dbTable).where(whereClause);
      const n = Number(count);
      res.setHeader("Content-Range", n > 0 ? `0-${n - 1}/${n}` : `*/${n}`);
      res.setHeader("Content-Profile", "public");
      res.json([]);
      return;
    }

    let query: any = db.select().from(dbTable);
    if (whereClause) query = query.where(whereClause);

    if (q.order) {
      const parts = q.order.split(".");
      const colName = parts[0];
      const dir = parts[1] ?? "asc";
      const col = getColumnByName(dbTable, colName);
      if (col) query = query.orderBy(dir === "desc" ? desc(col) : asc(col));
    }

    if (q.limit) query = query.limit(Number(q.limit));
    if (q.offset) query = query.offset(Number(q.offset));

    const rows = await query;
    const snaked = rows.map(toSnakeCase);

    // Handle joins from select param: e.g. "*, players(*)" or "*, players(name,role,rating)"
    const { joins } = parseSelectParam(q.select);
    const joined = await resolveJoins(tableName, snaked, joins);

    // Determine response format based on Prefer header
    const prefer = (req.headers["prefer"] as string) ?? "";
    if (prefer.includes("return=representation") && joined.length === 1) {
      res.json(joined[0]);
      return;
    }

    res.json(joined);
  } catch (err) {
    req.log.error({ err }, "GET /rest/v1/:table error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/v1/:table", async (req: Request, res: Response): Promise<void> => {
  const tableName = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  const dbTable = TABLE_MAP[tableName];
  if (!dbTable) { res.status(404).json({ error: "Table not found" }); return; }

  if (READ_ONLY_TABLES.has(tableName)) {
    res.status(403).json({ error: "Forbidden: table is read-only" });
    return;
  }

  try {
    const body = req.body;
    const rows = Array.isArray(body) ? body : [body];

    // For league-scoped tables, verify ownership before writing
    if (LEAGUE_SCOPED_TABLES.has(tableName)) {
      const firstRow = rows[0] ?? {};
      const leagueId: string | null =
        firstRow.league_id ?? firstRow.leagueId ??
        (req.query.league_id as string) ?? null;
      const err = await verifyLeagueOwnership(req, leagueId);
      if (err) { res.status(403).json({ error: err }); return; }
    }
    // For leagues table itself: if creating a new league, only authenticated or device-id callers allowed
    if (tableName === "leagues") {
      const user = extractUser(req);
      const deviceId = req.headers["x-device-id"] as string | undefined;
      if (!user && !deviceId) {
        res.status(401).json({ error: "Authentication or device-id required to create a league" });
        return;
      }
    }

    const camelRows = rows.map(toCamelCase);

    // Batch large inserts to avoid pg parameter limit (max ~65k params)
    const BATCH = 500;
    const allInserted: any[] = [];
    for (let i = 0; i < camelRows.length; i += BATCH) {
      const chunk = camelRows.slice(i, i + BATCH);
      const inserted = await db.insert(dbTable).values(chunk).returning();
      allInserted.push(...inserted);
    }
    const snaked = allInserted.map(toSnakeCase);

    const prefer = (req.query.prefer as string) || (req.headers["prefer"] as string) || "";
    if (!Array.isArray(body) && prefer.includes("return=representation")) {
      res.status(201).json(snaked[0] ?? null);
      return;
    }

    res.status(201).json(Array.isArray(body) ? snaked : snaked[0] ?? null);
  } catch (err) {
    req.log.error({ err }, "POST /rest/v1/:table error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/v1/:table", async (req: Request, res: Response): Promise<void> => {
  const tableName = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  const dbTable = TABLE_MAP[tableName];
  if (!dbTable) { res.status(404).json({ error: "Table not found" }); return; }

  if (READ_ONLY_TABLES.has(tableName)) {
    res.status(403).json({ error: "Forbidden: table is read-only" });
    return;
  }

  try {
    const q2 = req.query as Record<string, string>;
    // For league-scoped tables: derive league_id from query params or look up the row
    if (LEAGUE_SCOPED_TABLES.has(tableName)) {
      const leagueId: string | null = q2.league_id ?? (req.body?.league_id) ?? null;
      const err = await verifyLeagueOwnership(req, leagueId);
      if (err) { res.status(403).json({ error: err }); return; }
    }
    // For leagues table: require ownership (owner or device)
    if (tableName === "leagues") {
      const leagueId: string | null = q2.id?.startsWith("eq.") ? q2.id.slice(3) : null;
      if (leagueId) {
        const err = await verifyLeagueOwnership(req, leagueId);
        if (err) { res.status(403).json({ error: err }); return; }
      } else {
        // No id filter — require auth to prevent mass updates
        const user = extractUser(req);
        const deviceId = req.headers["x-device-id"] as string | undefined;
        if (!user && !deviceId) {
          res.status(401).json({ error: "Authentication required" });
          return;
        }
      }
    }

    const conditions = buildConditions(dbTable, q2);
    const camelBody = toCamelCase(req.body);
    const whereClause = conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...conditions) : undefined;

    let q: any = db.update(dbTable).set(camelBody);
    if (whereClause) q = q.where(whereClause);

    const updated = await q.returning();
    const snaked = updated.map(toSnakeCase);

    const prefer = (req.headers["prefer"] as string) ?? "";
    if (prefer.includes("return=representation") && snaked.length === 1) {
      res.json(snaked[0]);
      return;
    }
    res.json(snaked);
  } catch (err) {
    req.log.error({ err }, "PATCH /rest/v1/:table error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/v1/:table", async (req: Request, res: Response): Promise<void> => {
  const tableName = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  const dbTable = TABLE_MAP[tableName];
  if (!dbTable) { res.status(404).json({ error: "Table not found" }); return; }

  if (READ_ONLY_TABLES.has(tableName)) {
    res.status(403).json({ error: "Forbidden: table is read-only" });
    return;
  }

  try {
    const q2 = req.query as Record<string, string>;
    if (LEAGUE_SCOPED_TABLES.has(tableName)) {
      const leagueId: string | null = q2.league_id ?? null;
      const err = await verifyLeagueOwnership(req, leagueId);
      if (err) { res.status(403).json({ error: err }); return; }
    }
    if (tableName === "leagues") {
      const leagueId: string | null = q2.id?.startsWith("eq.") ? q2.id.slice(3) : null;
      if (!leagueId) { res.status(400).json({ error: "id filter required to delete a league" }); return; }
      const err = await verifyLeagueOwnership(req, leagueId);
      if (err) { res.status(403).json({ error: err }); return; }
    }

    const conditions = buildConditions(dbTable, q2);
    const whereClause = conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...conditions) : undefined;

    let q: any = db.delete(dbTable);
    if (whereClause) q = q.where(whereClause);
    await q;

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "DELETE /rest/v1/:table error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============ FUNCTIONS (/functions/v1/...) ============

router.post("/v1/:name", async (req: Request, res: Response): Promise<void> => {
  // Image generation — returns 501, app handles it gracefully
  res.status(501).json({ error: "Function not available in Replit deployment" });
});

export default router;
