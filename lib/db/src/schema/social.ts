import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const socialAccountsTable = pgTable("social_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  handle: text("handle").notNull(),
  displayName: text("display_name").notNull(),
  accountType: text("account_type").notNull().default("player"),
  playerId: text("player_id"),
  teamId: text("team_id"),
  bio: text("bio"),
  pfpUrl: text("pfp_url"),
  pfpSeed: text("pfp_seed"),
  followers: integer("followers").notNull().default(0),
  following: integer("following").notNull().default(0),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const socialPostsTable = pgTable("social_posts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  accountId: text("account_id").notNull(),
  content: text("content").notNull(),
  postType: text("post_type").notNull().default("regular"),
  matchId: text("match_id"),
  seasonNumber: integer("season_number"),
  imageUrl: text("image_url"),
  imagePrompt: text("image_prompt"),
  likes: integer("likes").notNull().default(0),
  replies: integer("replies").notNull().default(0),
  reposts: integer("reposts").notNull().default(0),
  hashtags: text("hashtags").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const socialRepliesTable = pgTable("social_replies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  postId: text("post_id").notNull(),
  accountId: text("account_id").notNull(),
  content: text("content").notNull(),
  likes: integer("likes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const socialFollowsTable = pgTable("social_follows", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  followerId: text("follower_id").notNull(),
  followeeId: text("followee_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const socialLikesTable = pgTable("social_likes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leagueId: text("league_id").notNull(),
  postId: text("post_id").notNull(),
  accountId: text("account_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
