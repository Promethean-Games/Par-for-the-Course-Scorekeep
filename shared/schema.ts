import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
import { z } from "zod";

// Universal Players - persistent player identities across tournaments
export const universalPlayers = pgTable("universal_players", {
  id: serial("id").primaryKey(),
  // Note: uniqueCode is nullable to allow migration of existing data, but should always be populated on insert
  uniqueCode: text("unique_code").unique(), // Format: PC7001, PC7002, etc.
  name: text("name").notNull(),
  email: text("email"),
  phoneNumber: text("phone_number"),
  tShirtSize: text("t_shirt_size"),
  contactInfo: text("contact_info"),
  pin: text("pin"), // 4-digit PIN for player login
  handicap: real("handicap"),
  isProvisional: boolean("is_provisional").notNull().default(true),
  completedTournaments: integer("completed_tournaments").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const universalPlayersRelations = relations(universalPlayers, ({ many }) => ({
  tournamentHistory: many(playerTournamentHistory),
  tournamentPlayers: many(tournamentPlayers),
}));

// Player Tournament History - stores completed tournament results for handicap calculation
export const playerTournamentHistory = pgTable("player_tournament_history", {
  id: serial("id").primaryKey(),
  universalPlayerId: integer("universal_player_id").notNull().references(() => universalPlayers.id),
  tournamentId: integer("tournament_id").references(() => tournaments.id), // nullable for manual entries
  tournamentName: text("tournament_name").notNull(),
  courseName: text("course_name"), // optional course name for manual entries
  totalStrokes: integer("total_strokes").notNull(),
  totalPar: integer("total_par").notNull(),
  holesPlayed: integer("holes_played").notNull(),
  relativeToPar: integer("relative_to_par").notNull(),
  totalScratches: integer("total_scratches").default(0),
  totalPenalties: integer("total_penalties").default(0),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  isManualEntry: boolean("is_manual_entry").default(false),
});

export const playerTournamentHistoryRelations = relations(playerTournamentHistory, ({ one }) => ({
  universalPlayer: one(universalPlayers, {
    fields: [playerTournamentHistory.universalPlayerId],
    references: [universalPlayers.id],
  }),
  tournament: one(tournaments, {
    fields: [playerTournamentHistory.tournamentId],
    references: [tournaments.id],
  }),
}));

// Tournament/Room table - for live leaderboard sync
export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  roomCode: text("room_code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isStarted: boolean("is_started").notNull().default(false),
  isHandicapped: boolean("is_handicapped").notNull().default(false),
  directorPin: text("director_pin").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const tournamentsRelations = relations(tournaments, ({ many }) => ({
  players: many(tournamentPlayers),
}));

// Tournament players - players registered to a tournament
export const tournamentPlayers = pgTable("tournament_players", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id),
  playerName: text("player_name").notNull(),
  deviceId: text("device_id"),
  groupName: text("group_name"),
  universalId: text("universal_id"),
  universalPlayerId: integer("universal_player_id").references(() => universalPlayers.id),
  contactInfo: text("contact_info"),
  isDnf: boolean("is_dnf").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tournamentPlayersRelations = relations(tournamentPlayers, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [tournamentPlayers.tournamentId],
    references: [tournaments.id],
  }),
  universalPlayer: one(universalPlayers, {
    fields: [tournamentPlayers.universalPlayerId],
    references: [universalPlayers.id],
  }),
  scores: many(tournamentScores),
}));

// Tournament scores - synced scores for leaderboard
export const tournamentScores = pgTable("tournament_scores", {
  id: serial("id").primaryKey(),
  tournamentPlayerId: integer("tournament_player_id").notNull().references(() => tournamentPlayers.id),
  hole: integer("hole").notNull(),
  par: integer("par").notNull(),
  strokes: integer("strokes").notNull(),
  scratches: integer("scratches").notNull().default(0),
  penalties: integer("penalties").notNull().default(0),
}, (table) => [
  uniqueIndex("idx_tournament_scores_player_hole").on(table.tournamentPlayerId, table.hole),
]);

export const tournamentScoresRelations = relations(tournamentScores, ({ one }) => ({
  player: one(tournamentPlayers, {
    fields: [tournamentScores.tournamentPlayerId],
    references: [tournamentPlayers.id],
  }),
}));

// Tournament payouts - payout calculations linked to tournaments
export const tournamentPayouts = pgTable("tournament_payouts", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id).unique(),
  numPlayers: integer("num_players").notNull(),
  entryFee: real("entry_fee").notNull(),
  addedPrize: real("added_prize").notNull().default(0),
  numSpots: integer("num_spots").notNull(),
  percentages: jsonb("percentages").notNull().$type<number[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tournamentPayoutsRelations = relations(tournamentPayouts, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournamentPayouts.tournamentId],
    references: [tournaments.id],
  }),
}));

// Push notification subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  deviceId: text("device_id"),
  tournamentRoomCode: text("tournament_room_code"),
  universalPlayerId: integer("universal_player_id").references(() => universalPlayers.id),
  isDirector: boolean("is_director").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for database operations
export const insertUniversalPlayerSchema = createInsertSchema(universalPlayers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlayerTournamentHistorySchema = createInsertSchema(playerTournamentHistory).omit({ id: true, completedAt: true });
export const insertTournamentSchema = createInsertSchema(tournaments).omit({ id: true, createdAt: true });
export const insertTournamentPlayerSchema = createInsertSchema(tournamentPlayers).omit({ id: true, createdAt: true });
export const insertTournamentScoreSchema = createInsertSchema(tournamentScores).omit({ id: true });
export const insertTournamentPayoutSchema = createInsertSchema(tournamentPayouts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });

// Types from database
export type UniversalPlayer = typeof universalPlayers.$inferSelect;
export type InsertUniversalPlayer = z.infer<typeof insertUniversalPlayerSchema>;
export type PlayerTournamentHistory = typeof playerTournamentHistory.$inferSelect;
export type InsertPlayerTournamentHistory = z.infer<typeof insertPlayerTournamentHistorySchema>;
export type Tournament = typeof tournaments.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type TournamentPlayer = typeof tournamentPlayers.$inferSelect;
export type InsertTournamentPlayer = z.infer<typeof insertTournamentPlayerSchema>;
export type TournamentScore = typeof tournamentScores.$inferSelect;
export type InsertTournamentScore = z.infer<typeof insertTournamentScoreSchema>;
export type TournamentPayout = typeof tournamentPayouts.$inferSelect;
export type InsertTournamentPayout = z.infer<typeof insertTournamentPayoutSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

// Zod schemas for local game state (not stored in DB - kept in localStorage)
export const playerSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  color: z.string(),
  order: z.number(),
});

export type Player = z.infer<typeof playerSchema>;

export const holeScoreSchema = z.object({
  hole: z.number(),
  par: z.number(),
  strokes: z.number(),
  scratches: z.number(),
  penalties: z.number(),
});

export type HoleScore = z.infer<typeof holeScoreSchema>;

export const gameSessionSchema = z.object({
  id: z.string(),
  players: z.array(playerSchema),
  currentHole: z.number(),
  currentPlayerIndex: z.number(),
  scores: z.record(z.string(), z.array(holeScoreSchema)),
  isComplete: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GameSession = z.infer<typeof gameSessionSchema>;

export const insertPlayerSchema = playerSchema.omit({ id: true });
export const insertHoleScoreSchema = holeScoreSchema;
export const insertGameSessionSchema = gameSessionSchema.omit({ id: true, createdAt: true, updatedAt: true });

export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertHoleScore = z.infer<typeof insertHoleScoreSchema>;
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;

export const settingsSchema = z.object({
  theme: z.enum(["light", "dark"]),
  leftHandedMode: z.boolean(),
  autoSave: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const setupTimeSchema = z.object({
  hole: z.number(),
  par: z.number(),
  setupTimeMs: z.number(),
  timestamp: z.string(),
});

export type SetupTime = z.infer<typeof setupTimeSchema>;

// Leaderboard entry type for API responses
export const leaderboardEntrySchema = z.object({
  playerId: z.number(),
  playerName: z.string(),
  groupName: z.string().nullable(),
  totalStrokes: z.number(),
  totalPar: z.number(),
  holesCompleted: z.number(),
  relativeToPar: z.number(),
  totalScratches: z.number(),
  totalPenalties: z.number(),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

// Batch update schema for group assignments
export const batchUpdateGroupsSchema = z.object({
  directorPin: z.string().min(1, "Director PIN is required"),
  updates: z.array(z.object({
    playerId: z.number(),
    groupName: z.string().nullable(),
  })),
});

export type BatchUpdateGroups = z.infer<typeof batchUpdateGroupsSchema>;
