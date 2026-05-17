import { pgTable, text, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";

export const ratingHistoryTable = pgTable("rating_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  playerId: text("player_id").notNull(),
  seasonNumber: integer("season_number").notNull(),
  oldRating: real("old_rating").notNull(),
  newRating: real("new_rating").notNull(),
  delta: real("delta").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ceremonyImagesTable = pgTable("ceremony_images", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  seasonNumber: integer("season_number").notNull(),
  award: text("award").notNull(),
  imageUrl: text("image_url").notNull(),
  playerId: text("player_id"),
  teamId: text("team_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matchMomentsTable = pgTable("match_moments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  matchId: text("match_id").notNull(),
  momentType: text("moment_type").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  playerId: text("player_id"),
  playerName: text("player_name"),
  teamId: text("team_id"),
  seasonNumber: integer("season_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
