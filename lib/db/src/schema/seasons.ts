import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const seasonsTable = pgTable("seasons", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  seasonNumber: integer("season_number").notNull(),
  year: integer("year").notNull(),
  status: text("status").notNull().default("auction"),
  auctionStatus: text("auction_status").notNull().default("pending"),
  auctionType: text("auction_type").notNull().default("standard"),
  purse: integer("purse").notNull().default(100),
  championTeamId: text("champion_team_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Season = typeof seasonsTable.$inferSelect;
export type InsertSeason = typeof seasonsTable.$inferInsert;
