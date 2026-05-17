import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const squadsTable = pgTable("squads", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  seasonId: text("season_id").notNull(),
  teamId: text("team_id").notNull(),
  playerId: text("player_id").notNull(),
  price: integer("price").notNull().default(0),
  retained: boolean("retained").notNull().default(false),
  retentionPrice: integer("retention_price"),
  isCaptain: boolean("is_captain").notNull().default(false),
  isViceCaptain: boolean("is_vice_captain").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Squad = typeof squadsTable.$inferSelect;
export type InsertSquad = typeof squadsTable.$inferInsert;
