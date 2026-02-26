import {
  tournaments,
  tournamentPlayers,
  tournamentScores,
  universalPlayers,
  playerTournamentHistory,
  pushSubscriptions,
  tournamentPayouts,
  type Tournament,
  type InsertTournament,
  type TournamentPlayer,
  type InsertTournamentPlayer,
  type TournamentScore,
  type InsertTournamentScore,
  type LeaderboardEntry,
  type UniversalPlayer,
  type InsertUniversalPlayer,
  type PlayerTournamentHistory,
  type InsertPlayerTournamentHistory,
  type PushSubscription,
  type InsertPushSubscription,
  type TournamentPayout,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, ilike, or } from "drizzle-orm";

export interface TournamentStats {
  playerCount: number;
  mostHolesCompleted: number;
  leastHolesCompleted: number;
  averageScore: number | null;
  averageRelativeToPar: number | null;
  playersWithScores: number;
}

export interface IStorage {
  // Tournament operations
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  getAllTournaments(): Promise<Tournament[]>;
  getAllTournamentsWithStats(): Promise<(Tournament & { stats: TournamentStats })[]>;
  getTournamentByCode(roomCode: string): Promise<Tournament | undefined>;
  getTournament(id: number): Promise<Tournament | undefined>;
  getTournamentStats(tournamentId: number): Promise<TournamentStats>;
  closeTournament(id: number): Promise<void>;
  reopenTournament(id: number): Promise<void>;
  startTournament(id: number): Promise<void>;
  deleteTournament(id: number): Promise<void>;
  verifyDirectorPin(roomCode: string, pin: string): Promise<boolean>;
  getTournamentBackup(tournamentId: number): Promise<{ tournament: Tournament; players: TournamentPlayer[]; scores: TournamentScore[] }>;

  // Tournament player operations
  addPlayerToTournament(player: InsertTournamentPlayer): Promise<TournamentPlayer>;
  getPlayersInTournament(tournamentId: number): Promise<TournamentPlayer[]>;
  getPlayersByDevice(tournamentId: number, deviceId: string): Promise<TournamentPlayer[]>;
  assignDeviceToPlayer(playerId: number, deviceId: string): Promise<void>;
  unassignDeviceFromPlayer(playerId: number): Promise<void>;
  updatePlayer(playerId: number, data: Partial<Pick<TournamentPlayer, "playerName" | "groupName" | "universalId" | "contactInfo">>): Promise<TournamentPlayer>;
  removePlayerFromTournament(playerId: number): Promise<void>;
  markPlayerDnf(playerId: number): Promise<void>;

  // Score operations
  upsertScore(score: InsertTournamentScore): Promise<TournamentScore>;
  getPlayerScores(tournamentPlayerId: number): Promise<TournamentScore[]>;
  getLeaderboard(tournamentId: number): Promise<LeaderboardEntry[]>;

  // Universal player operations
  getNextUniqueCode(): Promise<string>;
  createUniversalPlayer(player: InsertUniversalPlayer): Promise<UniversalPlayer>;
  getAllUniversalPlayers(): Promise<UniversalPlayer[]>;
  getUniversalPlayer(id: number): Promise<UniversalPlayer | undefined>;
  getUniversalPlayerByCode(uniqueCode: string): Promise<UniversalPlayer | undefined>;
  searchUniversalPlayers(query: string): Promise<UniversalPlayer[]>;
  updateUniversalPlayer(id: number, data: Partial<Pick<UniversalPlayer, "name" | "email" | "phoneNumber" | "tShirtSize" | "contactInfo" | "handicap" | "isProvisional">>): Promise<UniversalPlayer>;
  updateUniversalPlayerPin(id: number, pin: string | null): Promise<void>;
  deleteUniversalPlayer(id: number): Promise<void>;
  mergeUniversalPlayers(sourceId: number, targetId: number): Promise<UniversalPlayer>;
  linkTournamentPlayerToUniversal(tournamentPlayerId: number, universalPlayerId: number): Promise<TournamentPlayer>;
  addTournamentHistory(history: InsertPlayerTournamentHistory): Promise<PlayerTournamentHistory>;
  getPlayerTournamentHistory(universalPlayerId: number, limit?: number): Promise<PlayerTournamentHistory[]>;
  deleteTournamentHistory(historyId: number): Promise<void>;
  recalculateHandicap(universalPlayerId: number): Promise<UniversalPlayer>;
  getTournamentPlayers(tournamentId: number): Promise<TournamentPlayer[]>;
  getLiveTournamentStats(universalPlayerId: number): Promise<LiveTournamentStat[]>;

  // Payout operations
  upsertTournamentPayout(tournamentId: number, data: { numPlayers: number; entryFee: number; addedPrize: number; numSpots: number; percentages: number[] }): Promise<TournamentPayout>;
  getTournamentPayout(tournamentId: number): Promise<TournamentPayout | undefined>;
  deleteTournamentPayout(tournamentId: number): Promise<void>;

  // Push subscription operations
  upsertPushSubscription(sub: InsertPushSubscription): Promise<PushSubscription>;
  removePushSubscription(endpoint: string): Promise<void>;
  getSubscriptionsForTournament(roomCode: string): Promise<PushSubscription[]>;
  getDirectorSubscriptionsForTournament(roomCode: string): Promise<PushSubscription[]>;
  getSubscriptionsForPlayer(universalPlayerId: number): Promise<PushSubscription[]>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;
}

export interface LiveTournamentStat {
  tournamentId: number;
  tournamentName: string;
  roomCode: string;
  playerName: string;
  holesPlayed: number;
  totalStrokes: number;
  totalPar: number;
  relativeToPar: number;
  totalPenalties: number;
  totalScratches: number;
}

export class DatabaseStorage implements IStorage {
  async createTournament(tournament: InsertTournament): Promise<Tournament> {
    const [created] = await db.insert(tournaments).values(tournament).returning();
    return created;
  }

  async getAllTournaments(): Promise<Tournament[]> {
    return db.select().from(tournaments).orderBy(desc(tournaments.createdAt));
  }

  async getTournamentStats(tournamentId: number): Promise<TournamentStats> {
    // Get player count
    const players = await db
      .select()
      .from(tournamentPlayers)
      .where(eq(tournamentPlayers.tournamentId, tournamentId));
    
    const playerCount = players.length;
    
    if (playerCount === 0) {
      return {
        playerCount: 0,
        mostHolesCompleted: 0,
        leastHolesCompleted: 0,
        averageScore: null,
        averageRelativeToPar: null,
        playersWithScores: 0,
      };
    }

    // Get scores for each active (non-DNF) player
    const playerStats: { holesCompleted: number; totalStrokes: number; totalPar: number }[] = [];
    
    for (const player of players) {
      if (player.isDnf) continue;
      const scores = await db
        .select()
        .from(tournamentScores)
        .where(eq(tournamentScores.tournamentPlayerId, player.id));
      
      if (scores.length > 0) {
        const uniqueHoles = new Set(scores.map(s => s.hole));
        const dedupedScores = Array.from(uniqueHoles).map(hole => {
          const holeScores = scores.filter(s => s.hole === hole);
          return holeScores[holeScores.length - 1];
        });
        const totalStrokes = dedupedScores.reduce((sum, s) => sum + s.strokes + s.scratches + s.penalties, 0);
        const totalPar = dedupedScores.reduce((sum, s) => sum + s.par, 0);
        playerStats.push({
          holesCompleted: uniqueHoles.size,
          totalStrokes,
          totalPar,
        });
      }
    }

    if (playerStats.length === 0) {
      return {
        playerCount,
        mostHolesCompleted: 0,
        leastHolesCompleted: 0,
        averageScore: null,
        averageRelativeToPar: null,
        playersWithScores: 0,
      };
    }

    const mostHolesCompleted = Math.max(...playerStats.map(p => p.holesCompleted));
    const leastHolesCompleted = Math.min(...playerStats.map(p => p.holesCompleted));
    const totalStrokes = playerStats.reduce((sum, p) => sum + p.totalStrokes, 0);
    const totalPar = playerStats.reduce((sum, p) => sum + p.totalPar, 0);
    const averageScore = totalStrokes / playerStats.length;
    const averageRelativeToPar = (totalStrokes - totalPar) / playerStats.length;

    return {
      playerCount,
      mostHolesCompleted,
      leastHolesCompleted,
      averageScore: Math.round(averageScore * 10) / 10,
      averageRelativeToPar: Math.round(averageRelativeToPar * 10) / 10,
      playersWithScores: playerStats.length,
    };
  }

  async getAllTournamentsWithStats(): Promise<(Tournament & { stats: TournamentStats })[]> {
    const allTournaments = await this.getAllTournaments();
    const results: (Tournament & { stats: TournamentStats })[] = [];
    
    for (const tournament of allTournaments) {
      const stats = await this.getTournamentStats(tournament.id);
      results.push({ ...tournament, stats });
    }
    
    return results;
  }

  async getTournamentByCode(roomCode: string): Promise<Tournament | undefined> {
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.roomCode, roomCode.toUpperCase()));
    return tournament || undefined;
  }

  async getTournament(id: number): Promise<Tournament | undefined> {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    return tournament || undefined;
  }

  async closeTournament(id: number): Promise<void> {
    await db.update(tournaments).set({ isActive: false, completedAt: new Date() }).where(eq(tournaments.id, id));
  }

  async reopenTournament(id: number): Promise<void> {
    await db.update(tournaments).set({ isActive: true, completedAt: null }).where(eq(tournaments.id, id));
  }

  async startTournament(id: number): Promise<void> {
    await db.update(tournaments).set({ isStarted: true, startedAt: new Date() }).where(eq(tournaments.id, id));
  }

  async deleteTournament(id: number): Promise<void> {
    const players = await this.getPlayersInTournament(id);
    for (const player of players) {
      await db.delete(tournamentScores).where(eq(tournamentScores.tournamentPlayerId, player.id));
    }
    await db.delete(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, id));
    await db.delete(tournaments).where(eq(tournaments.id, id));
  }

  async verifyDirectorPin(roomCode: string, pin: string): Promise<boolean> {
    const tournament = await this.getTournamentByCode(roomCode);
    return tournament?.directorPin === pin;
  }

  async getTournamentBackup(tournamentId: number): Promise<{ tournament: Tournament; players: TournamentPlayer[]; scores: TournamentScore[] }> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) {
      throw new Error("Tournament not found");
    }
    const players = await this.getPlayersInTournament(tournamentId);
    const scores: TournamentScore[] = [];
    for (const player of players) {
      const playerScores = await this.getPlayerScores(player.id);
      scores.push(...playerScores);
    }
    return { tournament, players, scores };
  }

  async addPlayerToTournament(player: InsertTournamentPlayer): Promise<TournamentPlayer> {
    const [created] = await db.insert(tournamentPlayers).values(player).returning();
    return created;
  }

  async getPlayersInTournament(tournamentId: number): Promise<TournamentPlayer[]> {
    return db
      .select()
      .from(tournamentPlayers)
      .where(eq(tournamentPlayers.tournamentId, tournamentId));
  }

  async getPlayersByDevice(tournamentId: number, deviceId: string): Promise<TournamentPlayer[]> {
    return db
      .select()
      .from(tournamentPlayers)
      .where(
        and(
          eq(tournamentPlayers.tournamentId, tournamentId),
          eq(tournamentPlayers.deviceId, deviceId)
        )
      );
  }

  async assignDeviceToPlayer(playerId: number, deviceId: string): Promise<void> {
    await db
      .update(tournamentPlayers)
      .set({ deviceId })
      .where(eq(tournamentPlayers.id, playerId));
  }

  async unassignDeviceFromPlayer(playerId: number): Promise<void> {
    await db
      .update(tournamentPlayers)
      .set({ deviceId: null })
      .where(eq(tournamentPlayers.id, playerId));
  }

  async updatePlayer(playerId: number, data: Partial<Pick<TournamentPlayer, "playerName" | "groupName" | "universalId" | "contactInfo">>): Promise<TournamentPlayer> {
    const updateData: Record<string, string | null | undefined> = {};
    if (data.playerName !== undefined) updateData.playerName = data.playerName;
    if (data.groupName !== undefined) updateData.groupName = data.groupName;
    if (data.universalId !== undefined) updateData.universalId = data.universalId;
    if (data.contactInfo !== undefined) updateData.contactInfo = data.contactInfo;
    
    const [updated] = await db
      .update(tournamentPlayers)
      .set(updateData)
      .where(eq(tournamentPlayers.id, playerId))
      .returning();
    return updated;
  }

  async removePlayerFromTournament(playerId: number): Promise<void> {
    await db.delete(tournamentScores).where(eq(tournamentScores.tournamentPlayerId, playerId));
    await db.delete(tournamentPlayers).where(eq(tournamentPlayers.id, playerId));
  }

  async markPlayerDnf(playerId: number): Promise<void> {
    await db.update(tournamentPlayers).set({ isDnf: true, deviceId: null }).where(eq(tournamentPlayers.id, playerId));
  }

  async upsertScore(score: InsertTournamentScore): Promise<TournamentScore> {
    const existing = await db
      .select()
      .from(tournamentScores)
      .where(
        and(
          eq(tournamentScores.tournamentPlayerId, score.tournamentPlayerId),
          eq(tournamentScores.hole, score.hole)
        )
      );

    if (existing.length > 0) {
      const [updated] = await db
        .update(tournamentScores)
        .set({
          par: score.par,
          strokes: score.strokes,
          scratches: score.scratches,
          penalties: score.penalties,
        })
        .where(eq(tournamentScores.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(tournamentScores).values(score).returning();
    return created;
  }

  async getPlayerScores(tournamentPlayerId: number): Promise<TournamentScore[]> {
    return db
      .select()
      .from(tournamentScores)
      .where(eq(tournamentScores.tournamentPlayerId, tournamentPlayerId));
  }

  async getLeaderboard(tournamentId: number): Promise<LeaderboardEntry[]> {
    const players = await this.getPlayersInTournament(tournamentId);
    const leaderboard: LeaderboardEntry[] = [];

    for (const player of players) {
      if (player.isDnf) continue;
      const scores = await this.getPlayerScores(player.id);
      const uniqueHoles = new Set(scores.map(s => s.hole));
      const dedupedScores = Array.from(uniqueHoles).map(hole => {
        const holeScores = scores.filter(s => s.hole === hole);
        return holeScores[holeScores.length - 1];
      });
      const totalStrokes = dedupedScores.reduce((sum, s) => sum + s.strokes + s.scratches + s.penalties, 0);
      const totalPar = dedupedScores.reduce((sum, s) => sum + s.par, 0);
      const totalScratches = dedupedScores.reduce((sum, s) => sum + s.scratches, 0);
      const totalPenalties = dedupedScores.reduce((sum, s) => sum + s.penalties, 0);

      leaderboard.push({
        playerId: player.id,
        playerName: player.playerName,
        groupName: player.groupName,
        totalStrokes,
        totalPar,
        holesCompleted: uniqueHoles.size,
        relativeToPar: totalStrokes - totalPar,
        totalScratches,
        totalPenalties,
      });
    }

    return leaderboard.sort((a, b) => {
      if (a.relativeToPar !== b.relativeToPar) {
        return a.relativeToPar - b.relativeToPar;
      }
      if (a.totalStrokes !== b.totalStrokes) {
        return a.totalStrokes - b.totalStrokes;
      }
      return b.holesCompleted - a.holesCompleted;
    });
  }

  // Alias for routes.ts compatibility
  async getTournamentPlayers(tournamentId: number): Promise<TournamentPlayer[]> {
    return this.getPlayersInTournament(tournamentId);
  }

  // Universal player operations
  async getNextUniqueCode(): Promise<string> {
    // Use MAX to get the highest numeric code, then increment
    const result = await db.execute(sql`
      SELECT MAX(CAST(SUBSTRING(unique_code FROM 3) AS INTEGER)) as max_num 
      FROM universal_players 
      WHERE unique_code LIKE 'PC%'
    `);
    
    const maxNum = (result.rows?.[0] as any)?.max_num || 7000;
    return `PC${maxNum + 1}`;
  }

  async createUniversalPlayer(player: InsertUniversalPlayer): Promise<UniversalPlayer> {
    const [created] = await db.insert(universalPlayers).values(player).returning();
    return created;
  }

  async getAllUniversalPlayers(): Promise<UniversalPlayer[]> {
    return db.select().from(universalPlayers).orderBy(universalPlayers.name);
  }

  async getUniversalPlayer(id: number): Promise<UniversalPlayer | undefined> {
    const [player] = await db.select().from(universalPlayers).where(eq(universalPlayers.id, id));
    return player || undefined;
  }

  async getUniversalPlayerByCode(uniqueCode: string): Promise<UniversalPlayer | undefined> {
    const [player] = await db.select().from(universalPlayers).where(eq(universalPlayers.uniqueCode, uniqueCode.toUpperCase()));
    return player || undefined;
  }

  async searchUniversalPlayers(query: string): Promise<UniversalPlayer[]> {
    const searchPattern = `%${query}%`;
    return db
      .select()
      .from(universalPlayers)
      .where(
        or(
          ilike(universalPlayers.name, searchPattern),
          ilike(universalPlayers.email, searchPattern),
          ilike(universalPlayers.uniqueCode, searchPattern)
        )
      )
      .orderBy(universalPlayers.name)
      .limit(20);
  }

  async updateUniversalPlayer(id: number, data: Partial<Pick<UniversalPlayer, "name" | "email" | "phoneNumber" | "tShirtSize" | "contactInfo" | "handicap" | "isProvisional">>): Promise<UniversalPlayer> {
    const [updated] = await db
      .update(universalPlayers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(universalPlayers.id, id))
      .returning();
    return updated;
  }

  async updateUniversalPlayerPin(id: number, pin: string | null): Promise<void> {
    await db
      .update(universalPlayers)
      .set({ pin, updatedAt: new Date() })
      .where(eq(universalPlayers.id, id));
  }

  async deleteUniversalPlayer(id: number): Promise<void> {
    await db.update(tournamentPlayers).set({ universalPlayerId: null }).where(eq(tournamentPlayers.universalPlayerId, id));
    await db.delete(playerTournamentHistory).where(eq(playerTournamentHistory.universalPlayerId, id));
    await db.delete(universalPlayers).where(eq(universalPlayers.id, id));
  }

  async mergeUniversalPlayers(sourceId: number, targetId: number): Promise<UniversalPlayer> {
    await db.update(tournamentPlayers).set({ universalPlayerId: targetId }).where(eq(tournamentPlayers.universalPlayerId, sourceId));
    await db.update(playerTournamentHistory).set({ universalPlayerId: targetId }).where(eq(playerTournamentHistory.universalPlayerId, sourceId));
    await db.delete(universalPlayers).where(eq(universalPlayers.id, sourceId));
    const target = await this.recalculateHandicap(targetId);
    return target;
  }

  async linkTournamentPlayerToUniversal(tournamentPlayerId: number, universalPlayerId: number): Promise<TournamentPlayer> {
    const [updated] = await db
      .update(tournamentPlayers)
      .set({ universalPlayerId })
      .where(eq(tournamentPlayers.id, tournamentPlayerId))
      .returning();
    return updated;
  }

  async addTournamentHistory(history: InsertPlayerTournamentHistory): Promise<PlayerTournamentHistory> {
    const [created] = await db.insert(playerTournamentHistory).values(history).returning();
    return created;
  }

  async getPlayerTournamentHistory(universalPlayerId: number, limit?: number): Promise<PlayerTournamentHistory[]> {
    const query = db
      .select()
      .from(playerTournamentHistory)
      .where(eq(playerTournamentHistory.universalPlayerId, universalPlayerId))
      .orderBy(desc(playerTournamentHistory.completedAt));
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }

  async deleteTournamentHistory(historyId: number): Promise<void> {
    await db.delete(playerTournamentHistory).where(eq(playerTournamentHistory.id, historyId));
  }

  async recalculateHandicap(universalPlayerId: number): Promise<UniversalPlayer> {
    const history = await this.getPlayerTournamentHistory(universalPlayerId);
    
    if (history.length === 0) {
      const [updated] = await db
        .update(universalPlayers)
        .set({ 
          handicap: null, 
          isProvisional: true, 
          completedTournaments: 0,
          updatedAt: new Date()
        })
        .where(eq(universalPlayers.id, universalPlayerId))
        .returning();
      return updated;
    }
    
    const totalRelativeToPar = history.reduce((sum, r) => sum + r.relativeToPar, 0);
    const handicap = Math.round((totalRelativeToPar / history.length) * 10) / 10;
    
    const isProvisional = history.length < 5;
    
    const [updated] = await db
      .update(universalPlayers)
      .set({ 
        handicap,
        isProvisional,
        completedTournaments: history.length,
        updatedAt: new Date()
      })
      .where(eq(universalPlayers.id, universalPlayerId))
      .returning();
    
    return updated;
  }

  async getLiveTournamentStats(universalPlayerId: number): Promise<LiveTournamentStat[]> {
    const results = await db
      .select({
        tournamentId: tournaments.id,
        tournamentName: tournaments.name,
        roomCode: tournaments.roomCode,
        playerName: tournamentPlayers.playerName,
        tournamentPlayerId: tournamentPlayers.id,
      })
      .from(tournamentPlayers)
      .innerJoin(tournaments, eq(tournamentPlayers.tournamentId, tournaments.id))
      .where(
        and(
          eq(tournamentPlayers.universalPlayerId, universalPlayerId),
          eq(tournaments.isActive, true)
        )
      );

    const stats: LiveTournamentStat[] = [];
    for (const row of results) {
      const scores = await db
        .select()
        .from(tournamentScores)
        .where(eq(tournamentScores.tournamentPlayerId, row.tournamentPlayerId));

      if (scores.length === 0) continue;

      const uniqueHoles = new Set(scores.map(s => s.hole));
      const dedupedScores = Array.from(uniqueHoles).map(hole => {
        const holeScores = scores.filter(s => s.hole === hole);
        return holeScores[holeScores.length - 1];
      });

      let totalStrokes = 0;
      let totalPar = 0;
      let totalPenalties = 0;
      let totalScratches = 0;
      for (const s of dedupedScores) {
        totalStrokes += s.strokes + s.scratches + s.penalties;
        totalPar += s.par;
        totalPenalties += s.penalties;
        totalScratches += s.scratches;
      }

      stats.push({
        tournamentId: row.tournamentId,
        tournamentName: row.tournamentName,
        roomCode: row.roomCode,
        playerName: row.playerName,
        holesPlayed: uniqueHoles.size,
        totalStrokes,
        totalPar,
        relativeToPar: totalStrokes - totalPar,
        totalPenalties,
        totalScratches,
      });
    }
    return stats;
  }

  async upsertPushSubscription(sub: InsertPushSubscription): Promise<PushSubscription> {
    const [result] = await db
      .insert(pushSubscriptions)
      .values(sub)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          p256dh: sub.p256dh,
          auth: sub.auth,
          deviceId: sub.deviceId,
          tournamentRoomCode: sub.tournamentRoomCode,
          universalPlayerId: sub.universalPlayerId,
          isDirector: sub.isDirector ?? false,
        },
      })
      .returning();
    return result;
  }

  async removePushSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async getSubscriptionsForTournament(roomCode: string): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.tournamentRoomCode, roomCode));
  }

  async getDirectorSubscriptionsForTournament(roomCode: string): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions).where(
      and(
        eq(pushSubscriptions.tournamentRoomCode, roomCode),
        eq(pushSubscriptions.isDirector, true)
      )
    );
  }

  async getSubscriptionsForPlayer(universalPlayerId: number): Promise<PushSubscription[]> {
    const directSubs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.universalPlayerId, universalPlayerId));
    if (directSubs.length > 0) return directSubs;

    const linkedDevices = await db
      .selectDistinct({ deviceId: tournamentPlayers.deviceId })
      .from(tournamentPlayers)
      .where(and(
        eq(tournamentPlayers.universalPlayerId, universalPlayerId),
        sql`${tournamentPlayers.deviceId} IS NOT NULL`
      ));

    if (linkedDevices.length === 0) return [];

    const deviceIds = linkedDevices.map(d => d.deviceId).filter(Boolean) as string[];
    if (deviceIds.length === 0) return [];

    return db.select().from(pushSubscriptions).where(
      or(...deviceIds.map(id => eq(pushSubscriptions.deviceId, id)))!
    );
  }

  async getAllPushSubscriptions(): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions);
  }

  async upsertTournamentPayout(tournamentId: number, data: { numPlayers: number; entryFee: number; addedPrize: number; numSpots: number; percentages: number[] }): Promise<TournamentPayout> {
    const existing = await db.select().from(tournamentPayouts).where(eq(tournamentPayouts.tournamentId, tournamentId));
    if (existing.length > 0) {
      const [updated] = await db.update(tournamentPayouts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tournamentPayouts.tournamentId, tournamentId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(tournamentPayouts).values({ tournamentId, ...data }).returning();
    return created;
  }

  async getTournamentPayout(tournamentId: number): Promise<TournamentPayout | undefined> {
    const [payout] = await db.select().from(tournamentPayouts).where(eq(tournamentPayouts.tournamentId, tournamentId));
    return payout;
  }

  async deleteTournamentPayout(tournamentId: number): Promise<void> {
    await db.delete(tournamentPayouts).where(eq(tournamentPayouts.tournamentId, tournamentId));
  }
}

export const storage = new DatabaseStorage();
