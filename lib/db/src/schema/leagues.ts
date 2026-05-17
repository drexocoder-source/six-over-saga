import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const leaguesTable = pgTable("leagues", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceId: text("device_id").notNull(),
  name: text("name").notNull().default("Indian Premier League"),
  ownerId: text("owner_id"),
  teams: jsonb("teams").notNull().default("[]"),
  settings: jsonb("settings").notNull().default("{}"),
  currentSeason: integer("current_season").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type League = typeof leaguesTable.$inferSelect;
export type InsertLeague = typeof leaguesTable.$inferInsert;
