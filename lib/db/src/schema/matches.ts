import { pgTable, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";

export const matchesTable = pgTable("matches", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  seasonId: text("season_id").notNull(),
  matchNumber: integer("match_number").notNull(),
  teamA: text("team_a").notNull(),
  teamB: text("team_b").notNull(),
  stage: text("stage").notNull().default("league"),
  status: text("status").notNull().default("scheduled"),
  winner: text("winner"),
  resultText: text("result_text"),
  scorecard: jsonb("scorecard"),
  state: jsonb("state"),
  playerOfMatch: text("player_of_match"),
  tossWinner: text("toss_winner"),
  tossDecision: text("toss_decision"),
  venue: text("venue"),
  matchDate: text("match_date"),
  homeTeam: text("home_team"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ballsTable = pgTable("balls", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matchId: text("match_id").notNull(),
  innings: integer("innings").notNull(),
  overNum: integer("over_num").notNull(),
  ballInOver: integer("ball_in_over").notNull(),
  strikerId: text("striker_id"),
  nonStrikerId: text("non_striker_id"),
  bowlerId: text("bowler_id"),
  runs: integer("runs").notNull().default(0),
  extras: integer("extras").notNull().default(0),
  extraType: text("extra_type"),
  isWicket: boolean("is_wicket").notNull().default(false),
  wicketType: text("wicket_type"),
  outPlayerId: text("out_player_id"),
  commentary: text("commentary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Match = typeof matchesTable.$inferSelect;
export type InsertMatch = typeof matchesTable.$inferInsert;
