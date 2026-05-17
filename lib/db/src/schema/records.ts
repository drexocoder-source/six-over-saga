import { pgTable, text, timestamp, integer, real, jsonb, boolean } from "drizzle-orm/pg-core";

export const recordsTable = pgTable("records", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  recordKey: text("record_key").notNull(),
  label: text("label").notNull(),
  value: real("value"),
  playerId: text("player_id"),
  playerName: text("player_name"),
  teamId: text("team_id"),
  matchId: text("match_id"),
  seasonNumber: integer("season_number"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const achievementsTable = pgTable("achievements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  achievementKey: text("achievement_key").notNull(),
  label: text("label").notNull(),
  emoji: text("emoji"),
  value: real("value"),
  playerId: text("player_id"),
  playerName: text("player_name"),
  teamId: text("team_id"),
  matchId: text("match_id"),
  seasonNumber: integer("season_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trophiesTable = pgTable("trophies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  award: text("award").notNull(),
  seasonNumber: integer("season_number").notNull(),
  playerId: text("player_id"),
  playerName: text("player_name"),
  teamId: text("team_id"),
  value: real("value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customRecordsTable = pgTable("custom_records", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  metric: text("metric").notNull().default("runs"),
  scope: text("scope").notNull().default("career"),
  emoji: text("emoji"),
  higherIsBetter: boolean("higher_is_better").notNull().default(true),
  threshold: real("threshold"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
