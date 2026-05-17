import { pgTable, text, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";

export const playersTable = pgTable("players", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  rating: real("rating").notNull().default(50),
  basePrice: real("base_price").notNull().default(20),
  nationality: text("nationality").default("IND"),
  personality: text("personality"),
  pfpUrl: text("pfp_url"),
  attrs: jsonb("attrs").notNull().default("{}"),
  form: jsonb("form").notNull().default("[]"),
  injuryStatus: text("injury_status"),
  injuryMatchesLeft: integer("injury_matches_left").notNull().default(0),
  injuryUntilSeason: integer("injury_until_season"),
  seasonsPlayed: integer("seasons_played").notNull().default(0),
  debutSeason: integer("debut_season"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Player = typeof playersTable.$inferSelect;
export type InsertPlayer = typeof playersTable.$inferInsert;
