import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import bcrypt from "bcrypt";
import webpush from "web-push";
import { storage } from "./storage";
import { insertTournamentSchema, insertTournamentPlayerSchema, insertTournamentScoreSchema, batchUpdateGroupsSchema, insertUniversalPlayerSchema, type TournamentScore } from "@shared/schema";
import { z } from "zod";

const SALT_ROUNDS = 10;

const playerSessions = new Map<string, { playerCode: string; createdAt: number }>();

function createPlayerSession(playerCode: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  playerSessions.set(token, { playerCode, createdAt: Date.now() });
  return token;
}

function getPlayerSession(token: string): string | null {
  const session = playerSessions.get(token);
  if (!session) return null;
  const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - session.createdAt > MAX_AGE) {
    playerSessions.delete(token);
    return null;
  }
  return session.playerCode;
}

function deletePlayerSession(token: string) {
  playerSessions.delete(token);
}

type AlertType = "par_with_scratch" | "below_par_with_scratch" | "rapid_scoring" | "score_reduction";

interface CheatAlert {
  id: number;
  roomCode: string;
  playerName: string;
  hole: number;
  par: number;
  scratches: number;
  alertType: AlertType;
  message: string;
  timestamp: Date;
  dismissed: boolean;
}

let cheatAlertIdCounter = 0;
const cheatAlerts: CheatAlert[] = [];

const playerScoreTimestamps = new Map<string, number[]>();

function addCheatAlert(roomCode: string, playerName: string, hole: number, par: number, scratches: number, alertType: AlertType, message: string) {
  cheatAlerts.push({
    id: ++cheatAlertIdCounter,
    roomCode,
    playerName,
    hole,
    par,
    scratches,
    alertType,
    message,
    timestamp: new Date(),
    dismissed: false,
  });
  if (cheatAlerts.length > 500) {
    cheatAlerts.splice(0, cheatAlerts.length - 500);
  }
}

function trackScoreTiming(playerId: number, roomCode: string): boolean {
  const key = `${roomCode}-${playerId}`;
  const now = Date.now();
  const timestamps = playerScoreTimestamps.get(key) || [];
  timestamps.push(now);
  const twoMinutesAgo = now - 2 * 60 * 1000;
  const recent = timestamps.filter(t => t > twoMinutesAgo);
  playerScoreTimestamps.set(key, recent);
  return recent.length >= 3;
}

function getCheatAlertsForTournament(roomCode: string): CheatAlert[] {
  return cheatAlerts.filter(a => a.roomCode === roomCode && !a.dismissed);
}

function getAllCheatAlerts(): CheatAlert[] {
  return cheatAlerts.filter(a => !a.dismissed);
}

function dismissCheatAlert(id: number) {
  const alert = cheatAlerts.find(a => a.id === id);
  if (alert) alert.dismissed = true;
}

async function runCheatDetection(
  roomCode: string,
  tournamentId: number,
  tournamentPlayerId: number,
  hole: number,
  par: number,
  strokes: number,
  scratches: number,
  playersCache?: any[]
) {
  try {
    let players = playersCache;
    if (!players) {
      players = await storage.getPlayersInTournament(tournamentId);
    }
    const player = players.find(p => p.id === tournamentPlayerId);
    const playerName = player?.playerName || "Unknown player";
    const total = strokes + scratches;

    if (scratches > 0 && par > 0 && total < par) {
      addCheatAlert(roomCode, playerName, hole, par, scratches, "below_par_with_scratch",
        `Scored ${total} (below par ${par}) with ${scratches} scratch${scratches > 1 ? "es" : ""}. Highly suspicious.`);
    } else if (scratches > 0 && par > 0 && total === par) {
      addCheatAlert(roomCode, playerName, hole, par, scratches, "par_with_scratch",
        `Scored par (${par}) with ${scratches} scratch${scratches > 1 ? "es" : ""}. Please verify.`);
    }

    const existingScores = await storage.getPlayerScores(tournamentPlayerId);
    const existingForHole = existingScores.find(s => s.hole === hole);
    if (existingForHole) {
      const oldTotal = existingForHole.strokes + existingForHole.scratches;
      const newTotal = strokes + scratches;
      if (newTotal < oldTotal) {
        addCheatAlert(roomCode, playerName, hole, par, scratches, "score_reduction",
          `Reduced hole ${hole} score from ${oldTotal} to ${newTotal}. Was this a legitimate correction?`);
      }
    }

    if (trackScoreTiming(tournamentPlayerId, roomCode)) {
      const alreadyFlagged = cheatAlerts.some(a =>
        !a.dismissed && a.alertType === "rapid_scoring" &&
        a.playerName === playerName && a.roomCode === roomCode &&
        (Date.now() - a.timestamp.getTime()) < 2 * 60 * 1000
      );
      if (!alreadyFlagged) {
        addCheatAlert(roomCode, playerName, hole, par, scratches, "rapid_scoring",
          `Submitted 3+ hole scores within 2 minutes. Possible bulk entry or suspicious pace.`);
      }
    }
  } catch (err) {
    console.error("Error in cheat detection:", err);
  }
}

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@parforthecourse.app";

let pushEnabled = false;
if (VAPID_PUBLIC_KEY) {
  const candidates = [
    (process.env.VAPID_PRIVATE_KEY || "").trim().replace(/^[:\s\n]+/, ''),
    (process.env.VAPID_PRIVATE_KEY_BACKUP || "").trim(),
  ].filter(Boolean);

  for (const key of candidates) {
    try {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, key);
      pushEnabled = true;
      console.log("Web push notifications enabled");
      break;
    } catch {
      // try next candidate
    }
  }
  if (!pushEnabled) {
    console.warn("Failed to initialize web push - no valid VAPID private key found");
  }
}

async function sendPushToSubs(subs: { endpoint: string; p256dh: string; auth: string }[], roomCode: string, title: string, body: string, tag?: string) {
  const payload = JSON.stringify({ title, body, tag: tag || roomCode, url: `/?room=${roomCode}` });
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await storage.removePushSubscription(sub.endpoint);
        }
      }
    })
  );
}

async function sendPushToTournament(roomCode: string, title: string, body: string, tag?: string) {
  if (!pushEnabled) return;
  try {
    const subs = await storage.getSubscriptionsForTournament(roomCode);
    await sendPushToSubs(subs, roomCode, title, body, tag);
  } catch (err) {
    console.error("Error sending push notifications:", err);
  }
}

async function sendPushToDirectors(roomCode: string, title: string, body: string, tag?: string) {
  if (!pushEnabled) return;
  try {
    const subs = await storage.getDirectorSubscriptionsForTournament(roomCode);
    await sendPushToSubs(subs, roomCode, title, body, tag);
  } catch (err) {
    console.error("Error sending push to directors:", err);
  }
}

const createUniversalPlayerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().nullable().optional(),
  contactInfo: z.string().nullable().optional(),
  uniqueCode: z.string().regex(/^PC\d+$/, "Code must be in format PC followed by numbers").optional(),
});

const searchUniversalPlayerSchema = z.object({
  query: z.string().min(1, "Search query is required"),
});

const linkUniversalPlayerSchema = z.object({
  universalPlayerId: z.number().int().positive(),
});

const updateUniversalPlayerSchema = z.object({
  directorPin: z.string().min(1, "Director PIN is required"),
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  contactInfo: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  tShirtSize: z.string().nullable().optional(),
  handicap: z.number().nullable().optional(),
  isProvisional: z.boolean().optional(),
});

const mergeUniversalPlayersSchema = z.object({
  directorPin: z.string().min(1, "Director PIN is required"),
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
});

const createTournamentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  directorPin: z.string().min(1, "Director PIN is required"),
  isHandicapped: z.boolean().optional().default(false),
});

const addPlayerSchema = z.object({
  playerName: z.string().min(1, "Player name is required"),
  deviceId: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  universalId: z.string().nullable().optional(),
  contactInfo: z.string().nullable().optional(),
});

const syncScoreSchema = z.object({
  tournamentPlayerId: z.number().int().positive(),
  hole: z.number().int().positive(),
  par: z.number().int().min(0),
  strokes: z.number().int().min(0),
  scratches: z.number().int().min(0).optional(),
  penalties: z.number().int().min(0).optional(),
});

const verifyDirectorSchema = z.object({
  pin: z.string().min(1, "PIN is required"),
});

const assignDeviceSchema = z.object({
  deviceId: z.string().min(1, "Device ID is required"),
});

const batchScoreSchema = z.object({
  scores: z.array(syncScoreSchema),
});

const directorActionSchema = z.object({
  directorPin: z.string().min(1, "Director PIN is required"),
});

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const MASTER_DIRECTOR_PIN = "3141";

export async function registerRoutes(app: Express): Promise<Server> {
  // Verify master director PIN
  app.post("/api/director/verify", async (req, res) => {
    try {
      const { pin } = req.body;
      if (pin === MASTER_DIRECTOR_PIN) {
        res.json({ isValid: true });
      } else {
        res.json({ isValid: false });
      }
    } catch (error) {
      console.error("Error verifying director:", error);
      res.status(500).json({ error: "Failed to verify" });
    }
  });

  // List all tournaments (requires master director PIN)
  app.get("/api/tournaments", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const tournaments = await storage.getAllTournamentsWithStats();
      const safeTournaments = tournaments.map(t => {
        const { directorPin: _, ...safe } = t;
        return safe;
      });
      res.json(safeTournaments);
    } catch (error) {
      console.error("Error listing tournaments:", error);
      res.status(500).json({ error: "Failed to list tournaments" });
    }
  });

  // Create a new tournament room (requires master director PIN)
  app.post("/api/tournaments", async (req, res) => {
    try {
      const parsed = createTournamentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }

      // Verify master director PIN for creation
      if (parsed.data.directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      let roomCode = generateRoomCode();
      let attempts = 0;
      while (await storage.getTournamentByCode(roomCode) && attempts < 10) {
        roomCode = generateRoomCode();
        attempts++;
      }
      if (attempts >= 10 && await storage.getTournamentByCode(roomCode)) {
        return res.status(500).json({ error: "Failed to generate unique room code" });
      }

      const tournament = await storage.createTournament({
        roomCode,
        name: parsed.data.name,
        directorPin: parsed.data.directorPin,
        isActive: true,
        isHandicapped: parsed.data.isHandicapped,
      });

      res.json(tournament);
    } catch (error) {
      console.error("Error creating tournament:", error);
      res.status(500).json({ error: "Failed to create tournament" });
    }
  });

  // Get tournament by room code
  app.get("/api/tournaments/:roomCode", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      const { directorPin, ...safe } = tournament;
      res.json(safe);
    } catch (error) {
      console.error("Error getting tournament:", error);
      res.status(500).json({ error: "Failed to get tournament" });
    }
  });

  // Verify director PIN
  app.post("/api/tournaments/:roomCode/verify-director", async (req, res) => {
    try {
      const parsed = verifyDirectorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      const isValid = await storage.verifyDirectorPin(req.params.roomCode, parsed.data.pin);
      res.json({ isValid });
    } catch (error) {
      console.error("Error verifying PIN:", error);
      res.status(500).json({ error: "Failed to verify PIN" });
    }
  });

  // Delete tournament (director only - master PIN or tournament PIN)
  app.delete("/api/tournaments/:roomCode", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const { directorPin } = req.body;
      const isMasterDirector = directorPin === MASTER_DIRECTOR_PIN;
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      await storage.deleteTournament(tournament.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tournament:", error);
      res.status(500).json({ error: "Failed to delete tournament" });
    }
  });

  // Get tournament backup (director only)
  app.get("/api/tournaments/:roomCode/backup", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const directorPin = req.query.directorPin as string;
      const isMasterDirector = directorPin === MASTER_DIRECTOR_PIN;
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const backup = await storage.getTournamentBackup(tournament.id);
      const { directorPin: _, ...safeTournament } = backup.tournament;
      res.json({
        ...backup,
        tournament: safeTournament,
        exportedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error getting tournament backup:", error);
      res.status(500).json({ error: "Failed to get backup" });
    }
  });

  // Get tournament payout
  app.get("/api/tournaments/:roomCode/payout", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      const directorPin = req.query.directorPin as string;
      const isMasterDirector = directorPin === MASTER_DIRECTOR_PIN;
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      const payout = await storage.getTournamentPayout(tournament.id);
      res.json(payout || null);
    } catch (error) {
      console.error("Error getting payout:", error);
      res.status(500).json({ error: "Failed to get payout" });
    }
  });

  // Save/update tournament payout
  app.put("/api/tournaments/:roomCode/payout", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      const { directorPin, numPlayers, entryFee, addedPrize, numSpots, percentages } = req.body;
      const isMasterDirector = directorPin === MASTER_DIRECTOR_PIN;
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      if (!numPlayers || !numSpots || !percentages || !Array.isArray(percentages)) {
        return res.status(400).json({ error: "Missing required payout fields" });
      }
      const payout = await storage.upsertTournamentPayout(tournament.id, {
        numPlayers, entryFee: entryFee || 0, addedPrize: addedPrize || 0, numSpots, percentages,
      });
      res.json(payout);
    } catch (error) {
      console.error("Error saving payout:", error);
      res.status(500).json({ error: "Failed to save payout" });
    }
  });

  // Delete tournament payout
  app.delete("/api/tournaments/:roomCode/payout", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      const directorPin = req.query.directorPin as string;
      const isMasterDirector = directorPin === MASTER_DIRECTOR_PIN;
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      await storage.deleteTournamentPayout(tournament.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting payout:", error);
      res.status(500).json({ error: "Failed to delete payout" });
    }
  });

  // Start tournament (director only - master PIN or tournament PIN)
  app.post("/api/tournaments/:roomCode/start", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const { directorPin } = req.body;
      const isMasterDirector = directorPin === MASTER_DIRECTOR_PIN;
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      await storage.startTournament(tournament.id);
      sendPushToTournament(req.params.roomCode, "Tournament Started!", `${tournament.name} is now live. Good luck!`, `start-${req.params.roomCode}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error starting tournament:", error);
      res.status(500).json({ error: "Failed to start tournament" });
    }
  });

  // Close tournament (director only - master PIN or tournament PIN)
  app.post("/api/tournaments/:roomCode/close", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const { directorPin } = req.body;
      const isMasterDirector = directorPin === MASTER_DIRECTOR_PIN;
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      await storage.closeTournament(tournament.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error closing tournament:", error);
      res.status(500).json({ error: "Failed to close tournament" });
    }
  });

  // Reopen/unarchive tournament (director only)
  app.post("/api/tournaments/:roomCode/reopen", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const { directorPin } = req.body;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      await storage.reopenTournament(tournament.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reopening tournament:", error);
      res.status(500).json({ error: "Failed to reopen tournament" });
    }
  });

  // Import tournament from backup JSON
  app.post("/api/tournaments/import", async (req, res) => {
    try {
      const { directorPin, backup } = req.body;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      if (!backup || !backup.tournament || !backup.players) {
        return res.status(400).json({ error: "Invalid backup format" });
      }

      let roomCode = generateRoomCode();
      let attempts = 0;
      while (await storage.getTournamentByCode(roomCode) && attempts < 10) {
        roomCode = generateRoomCode();
        attempts++;
      }

      const newTournament = await storage.createTournament({
        roomCode,
        name: backup.tournament.name + " (Imported)",
        directorPin: MASTER_DIRECTOR_PIN,
        isActive: backup.tournament.isActive ?? false,
        isHandicapped: backup.tournament.isHandicapped ?? false,
        isStarted: backup.tournament.isStarted ?? false,
      });

      const playerIdMap: Record<number, number> = {};

      for (const player of backup.players) {
        const newPlayer = await storage.addPlayerToTournament({
          tournamentId: newTournament.id,
          playerName: player.playerName,
          deviceId: null,
          groupName: player.groupName || null,
          universalId: player.universalId || null,
          universalPlayerId: player.universalPlayerId || null,
          contactInfo: player.contactInfo || null,
        });
        playerIdMap[player.id] = newPlayer.id;
      }

      if (backup.scores && Array.isArray(backup.scores)) {
        for (const score of backup.scores) {
          const newPlayerId = playerIdMap[score.tournamentPlayerId];
          if (newPlayerId) {
            await storage.upsertScore({
              tournamentPlayerId: newPlayerId,
              hole: score.hole,
              par: score.par,
              strokes: score.strokes,
              scratches: score.scratches ?? 0,
              penalties: score.penalties ?? 0,
            });
          }
        }
      }

      res.json({ 
        success: true, 
        roomCode: newTournament.roomCode,
        name: newTournament.name,
        playersImported: Object.keys(playerIdMap).length,
        scoresImported: backup.scores?.length || 0,
      });
    } catch (error) {
      console.error("Error importing tournament:", error);
      res.status(500).json({ error: "Failed to import tournament" });
    }
  });

  // Full data export (all tournaments + all universal players)
  app.get("/api/export/full", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      const allTournaments = await storage.getAllTournaments();
      const tournamentData = [];
      for (const t of allTournaments) {
        const backup = await storage.getTournamentBackup(t.id);
        const { directorPin: _, ...safeTournament } = backup.tournament;
        tournamentData.push({
          tournament: safeTournament,
          players: backup.players,
          scores: backup.scores,
        });
      }

      const allPlayers = await storage.getAllUniversalPlayers();
      const playerData = [];
      for (const p of allPlayers) {
        const history = await storage.getPlayerTournamentHistory(p.id);
        const { pin: _, ...safePlayer } = p;
        playerData.push({
          player: safePlayer,
          history,
        });
      }

      res.json({
        exportedAt: new Date().toISOString(),
        version: 1,
        tournaments: tournamentData,
        universalPlayers: playerData,
      });
    } catch (error) {
      console.error("Error exporting full data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Player-only export (all universal players + history)
  app.get("/api/export/players", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      const allPlayers = await storage.getAllUniversalPlayers();
      const playerData = [];
      for (const p of allPlayers) {
        const history = await storage.getPlayerTournamentHistory(p.id);
        const { pin: _, ...safePlayer } = p;
        playerData.push({
          player: safePlayer,
          history,
        });
      }

      res.json({
        exportedAt: new Date().toISOString(),
        version: 1,
        type: "players",
        universalPlayers: playerData,
      });
    } catch (error) {
      console.error("Error exporting player data:", error);
      res.status(500).json({ error: "Failed to export player data" });
    }
  });

  // Player-only import (universal players + history)
  app.post("/api/import/players", async (req, res) => {
    try {
      const { directorPin, data } = req.body;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      if (!data || !data.universalPlayers) {
        return res.status(400).json({ error: "Invalid import format - expected universalPlayers array" });
      }

      let playersImported = 0;
      let playersSkipped = 0;
      let historyImported = 0;

      for (const entry of data.universalPlayers) {
        const p = entry.player;
        const existing = p.uniqueCode ? await storage.getUniversalPlayerByCode(p.uniqueCode) : null;
        
        if (existing) {
          playersSkipped++;
          continue;
        }

        const uniqueCode = p.uniqueCode || await storage.getNextUniqueCode();
        const newPlayer = await storage.createUniversalPlayer({
          name: p.name,
          email: p.email || null,
          phoneNumber: p.phoneNumber || null,
          tShirtSize: p.tShirtSize || null,
          contactInfo: p.contactInfo || null,
          uniqueCode,
          handicap: p.handicap,
          isProvisional: p.isProvisional ?? true,
          completedTournaments: p.completedTournaments ?? 0,
        });

        if (entry.history && Array.isArray(entry.history)) {
          for (const h of entry.history) {
            await storage.addTournamentHistory({
              universalPlayerId: newPlayer.id,
              tournamentName: h.tournamentName,
              courseName: h.courseName || null,
              totalStrokes: h.totalStrokes,
              totalPar: h.totalPar,
              holesPlayed: h.holesPlayed,
              relativeToPar: h.relativeToPar,
              totalScratches: h.totalScratches ?? 0,
              totalPenalties: h.totalPenalties ?? 0,
              isManualEntry: h.isManualEntry ?? true,
            });
            historyImported++;
          }
        }
        playersImported++;
      }

      res.json({ 
        success: true, 
        playersImported, 
        playersSkipped, 
        historyImported 
      });
    } catch (error) {
      console.error("Error importing player data:", error);
      res.status(500).json({ error: "Failed to import player data" });
    }
  });

  // Full data import (universal players + tournament history)
  app.post("/api/import/full", async (req, res) => {
    try {
      const { directorPin, data } = req.body;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      if (!data || !data.universalPlayers) {
        return res.status(400).json({ error: "Invalid import format" });
      }

      let playersImported = 0;
      let historyImported = 0;
      let tournamentsImported = 0;

      for (const entry of data.universalPlayers) {
        const p = entry.player;
        const existing = p.uniqueCode ? await storage.getUniversalPlayerByCode(p.uniqueCode) : null;
        
        if (!existing) {
          const uniqueCode = p.uniqueCode || await storage.getNextUniqueCode();
          const newPlayer = await storage.createUniversalPlayer({
            name: p.name,
            email: p.email || null,
            phoneNumber: p.phoneNumber || null,
            tShirtSize: p.tShirtSize || null,
            contactInfo: p.contactInfo || null,
            uniqueCode,
            handicap: p.handicap,
            isProvisional: p.isProvisional ?? true,
            completedTournaments: p.completedTournaments ?? 0,
          });

          if (entry.history && Array.isArray(entry.history)) {
            for (const h of entry.history) {
              await storage.addTournamentHistory({
                universalPlayerId: newPlayer.id,
                tournamentName: h.tournamentName,
                courseName: h.courseName || null,
                totalStrokes: h.totalStrokes,
                totalPar: h.totalPar,
                holesPlayed: h.holesPlayed,
                relativeToPar: h.relativeToPar,
                totalScratches: h.totalScratches ?? 0,
                totalPenalties: h.totalPenalties ?? 0,
                isManualEntry: h.isManualEntry ?? true,
              });
              historyImported++;
            }
          }
          playersImported++;
        }
      }

      if (data.tournaments && Array.isArray(data.tournaments)) {
        for (const entry of data.tournaments) {
          let roomCode = generateRoomCode();
          let attempts = 0;
          while (await storage.getTournamentByCode(roomCode) && attempts < 10) {
            roomCode = generateRoomCode();
            attempts++;
          }

          const newTournament = await storage.createTournament({
            roomCode,
            name: entry.tournament.name + " (Imported)",
            directorPin: MASTER_DIRECTOR_PIN,
            isActive: false,
            isHandicapped: entry.tournament.isHandicapped ?? false,
            isStarted: entry.tournament.isStarted ?? false,
          });

          const playerIdMap: Record<number, number> = {};
          if (entry.players) {
            for (const player of entry.players) {
              const newPlayer = await storage.addPlayerToTournament({
                tournamentId: newTournament.id,
                playerName: player.playerName,
                deviceId: null,
                groupName: player.groupName || null,
                universalId: player.universalId || null,
                universalPlayerId: player.universalPlayerId || null,
                contactInfo: player.contactInfo || null,
              });
              playerIdMap[player.id] = newPlayer.id;
            }
          }

          if (entry.scores) {
            for (const score of entry.scores) {
              const newPlayerId = playerIdMap[score.tournamentPlayerId];
              if (newPlayerId) {
                await storage.upsertScore({
                  tournamentPlayerId: newPlayerId,
                  hole: score.hole,
                  par: score.par,
                  strokes: score.strokes,
                  scratches: score.scratches ?? 0,
                  penalties: score.penalties ?? 0,
                });
              }
            }
          }
          tournamentsImported++;
        }
      }

      res.json({
        success: true,
        playersImported,
        historyImported,
        tournamentsImported,
      });
    } catch (error) {
      console.error("Error importing full data:", error);
      res.status(500).json({ error: "Failed to import data" });
    }
  });

  // Get players in tournament
  app.get("/api/tournaments/:roomCode/players", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      const players = await storage.getPlayersInTournament(tournament.id);
      res.json(players);
    } catch (error) {
      console.error("Error getting players:", error);
      res.status(500).json({ error: "Failed to get players" });
    }
  });

  // Add player to tournament
  app.post("/api/tournaments/:roomCode/players", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const parsed = addPlayerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }

      let universalPlayerId: number | null = null;
      if (parsed.data.universalId) {
        const universalPlayer = await storage.getUniversalPlayerByCode(parsed.data.universalId);
        if (universalPlayer) {
          universalPlayerId = universalPlayer.id;
        }
      }

      const player = await storage.addPlayerToTournament({
        tournamentId: tournament.id,
        playerName: parsed.data.playerName,
        deviceId: parsed.data.deviceId || null,
        groupName: parsed.data.groupName || null,
        universalId: parsed.data.universalId || null,
        universalPlayerId,
        contactInfo: parsed.data.contactInfo || null,
      });

      res.json(player);
    } catch (error) {
      console.error("Error adding player:", error);
      res.status(500).json({ error: "Failed to add player" });
    }
  });

  // Assign device to player
  app.post("/api/tournaments/:roomCode/players/:playerId/assign", async (req, res) => {
    try {
      const parsed = assignDeviceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      const playerId = parseInt(req.params.playerId);
      const playersBefore = await storage.getPlayersInTournament(tournament.id);
      const playerBefore = playersBefore.find(p => p.id === playerId);
      const wasUnassigned = playerBefore && !playerBefore.deviceId;
      const allAssignedBefore = playersBefore.length > 0 && playersBefore.every(p => p.deviceId);

      await storage.assignDeviceToPlayer(playerId, parsed.data.deviceId);

      if (wasUnassigned && playerBefore) {
        sendPushToTournament(req.params.roomCode, tournament.name, `${playerBefore.playerName} has joined the tournament.`, `join-${req.params.roomCode}`);
      }

      if (!allAssignedBefore && wasUnassigned) {
        const playersAfter = await storage.getPlayersInTournament(tournament.id);
        const allAssignedNow = playersAfter.length > 0 && playersAfter.every(p => p.deviceId);
        if (allAssignedNow) {
          sendPushToDirectors(req.params.roomCode, tournament.name, "All groups have been assigned to a device.", `allassigned-${req.params.roomCode}`);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error assigning device:", error);
      res.status(500).json({ error: "Failed to assign device" });
    }
  });

  // Unassign device from player (director only)
  app.post("/api/tournaments/:roomCode/players/:playerId/unassign-device", async (req, res) => {
    try {
      const directorPin = req.body.directorPin;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        const tournament = await storage.getTournamentByCode(req.params.roomCode);
        if (!tournament || tournament.directorPin !== directorPin) {
          return res.status(403).json({ error: "Invalid director credentials" });
        }
      }
      
      await storage.unassignDeviceFromPlayer(parseInt(req.params.playerId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error unassigning device:", error);
      res.status(500).json({ error: "Failed to unassign device" });
    }
  });

  // Get players assigned to this device
  app.get("/api/tournaments/:roomCode/my-players", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const deviceId = req.query.deviceId as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }

      const players = await storage.getPlayersByDevice(tournament.id, deviceId);
      res.json(players);
    } catch (error) {
      console.error("Error getting device players:", error);
      res.status(500).json({ error: "Failed to get players" });
    }
  });

  // Get scores for players assigned to this device (for session restoration)
  app.get("/api/tournaments/:roomCode/my-scores", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const deviceId = req.query.deviceId as string;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }

      const players = await storage.getPlayersByDevice(tournament.id, deviceId);
      const allScores: Record<number, TournamentScore[]> = {};
      
      for (const player of players) {
        const scores = await storage.getPlayerScores(player.id);
        allScores[player.id] = scores;
      }

      res.json({ players, scores: allScores });
    } catch (error) {
      console.error("Error getting device scores:", error);
      res.status(500).json({ error: "Failed to get scores" });
    }
  });

  // Update player info (director only)
  app.patch("/api/tournaments/:roomCode/players/:playerId", async (req, res) => {
    try {
      // Get tournament and verify director PIN
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const { directorPin, ...playerData } = req.body;
      const isDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      // Verify player belongs to this tournament
      const players = await storage.getPlayersInTournament(tournament.id);
      const playerId = parseInt(req.params.playerId);
      const playerExists = players.some(p => p.id === playerId);
      if (!playerExists) {
        return res.status(404).json({ error: "Player not found in this tournament" });
      }
      
      const parsed = addPlayerSchema.partial().safeParse(playerData);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      const player = await storage.updatePlayer(playerId, {
        playerName: parsed.data.playerName,
        groupName: parsed.data.groupName,
        universalId: parsed.data.universalId,
        contactInfo: parsed.data.contactInfo,
      });
      res.json(player);
    } catch (error) {
      console.error("Error updating player:", error);
      res.status(500).json({ error: "Failed to update player" });
    }
  });

  // Batch update player groups (director only)
  app.post("/api/tournaments/:roomCode/players/batch-update-groups", async (req, res) => {
    try {
      // Validate request body with Zod schema
      const parsed = batchUpdateGroupsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const { directorPin, updates } = parsed.data;
      const isDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      // Verify all players belong to this tournament
      const players = await storage.getPlayersInTournament(tournament.id);
      const playerIds = new Set(players.map(p => p.id));
      
      for (const update of updates) {
        if (!playerIds.has(update.playerId)) {
          return res.status(404).json({ error: `Player ${update.playerId} not found in this tournament` });
        }
      }
      
      // Apply all updates (convert empty string to null for consistency)
      const results = [];
      for (const update of updates) {
        const groupName = update.groupName || null;
        const player = await storage.updatePlayer(update.playerId, { groupName });
        results.push(player);
      }
      
      res.json({ success: true, players: results });
    } catch (error) {
      console.error("Error batch updating players:", error);
      res.status(500).json({ error: "Failed to update players" });
    }
  });

  // Remove player from tournament (director only)
  app.delete("/api/tournaments/:roomCode/players/:playerId", async (req, res) => {
    try {
      // Get tournament and verify director PIN
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const directorPin = req.query.directorPin as string;
      const isDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      // Verify player belongs to this tournament
      const players = await storage.getPlayersInTournament(tournament.id);
      const playerId = parseInt(req.params.playerId);
      const playerExists = players.some(p => p.id === playerId);
      if (!playerExists) {
        return res.status(404).json({ error: "Player not found in this tournament" });
      }
      
      if (tournament.isStarted) {
        await storage.markPlayerDnf(playerId);
      } else {
        await storage.removePlayerFromTournament(playerId);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing player:", error);
      res.status(500).json({ error: "Failed to remove player" });
    }
  });

  // Player leaves tournament (unassign device and notify)
  app.post("/api/tournaments/:roomCode/leave", async (req, res) => {
    try {
      const { deviceId } = req.body;
      if (!deviceId) {
        return res.status(400).json({ error: "deviceId is required" });
      }
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      const players = await storage.getPlayersInTournament(tournament.id);
      const devicePlayers = players.filter(p => p.deviceId === deviceId);
      for (const player of devicePlayers) {
        await storage.unassignDeviceFromPlayer(player.id);
        sendPushToDirectors(req.params.roomCode, tournament.name, `${player.playerName} has left the tournament.`, `leave-${req.params.roomCode}`);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error leaving tournament:", error);
      res.status(500).json({ error: "Failed to leave tournament" });
    }
  });

  // Update/sync score
  app.post("/api/tournaments/:roomCode/scores", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const parsed = syncScoreSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const scratches = parsed.data.scratches || 0;
      const strokes = parsed.data.strokes;
      const par = parsed.data.par;
      const hole = parsed.data.hole;
      const playerId = parsed.data.tournamentPlayerId;

      if (hole > 18) {
        return res.status(400).json({ error: "Maximum of 18 holes allowed" });
      }

      await runCheatDetection(req.params.roomCode, tournament.id, playerId, hole, par, strokes, scratches);

      const score = await storage.upsertScore({
        tournamentPlayerId: playerId,
        hole,
        par,
        strokes,
        scratches,
        penalties: parsed.data.penalties || 0,
      });

      res.json(score);
    } catch (error) {
      console.error("Error syncing score:", error);
      res.status(500).json({ error: "Failed to sync score" });
    }
  });

  // Get player scores (for retroactive score entry - director only)
  app.get("/api/tournaments/:roomCode/players/:playerId/scores", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      // Validate director PIN
      const directorPin = req.query.directorPin as string;
      const isMasterDirector = directorPin === MASTER_DIRECTOR_PIN;
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      const playerId = parseInt(req.params.playerId);
      if (isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid player ID" });
      }

      // Verify the player belongs to this tournament
      const players = await storage.getPlayersInTournament(tournament.id);
      const playerBelongsToTournament = players.some(p => p.id === playerId);
      if (!playerBelongsToTournament) {
        return res.status(404).json({ error: "Player not found in this tournament" });
      }

      const scores = await storage.getPlayerScores(playerId);
      res.json(scores);
    } catch (error) {
      console.error("Error getting player scores:", error);
      res.status(500).json({ error: "Failed to get player scores" });
    }
  });

  // Get player scores (public - for spectators)
  app.get("/api/tournaments/:roomCode/players/:playerId/box-score", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const playerId = parseInt(req.params.playerId);
      if (isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid player ID" });
      }

      const players = await storage.getPlayersInTournament(tournament.id);
      const player = players.find(p => p.id === playerId);
      if (!player) {
        return res.status(404).json({ error: "Player not found in this tournament" });
      }

      const scores = await storage.getPlayerScores(playerId);
      const uniqueHoles = new Set(scores.map(s => s.hole));
      const dedupedScores = Array.from(uniqueHoles).map(hole => {
        const holeScores = scores.filter(s => s.hole === hole);
        return holeScores[holeScores.length - 1];
      }).sort((a, b) => a.hole - b.hole);

      res.json({
        playerId: player.id,
        playerName: player.playerName,
        groupName: player.groupName,
        scores: dedupedScores.map(s => ({
          hole: s.hole,
          par: s.par,
          strokes: s.strokes,
          scratches: s.scratches,
          penalties: s.penalties,
        })),
      });
    } catch (error) {
      console.error("Error getting player box score:", error);
      res.status(500).json({ error: "Failed to get player box score" });
    }
  });

  // Get leaderboard
  app.get("/api/tournaments/:roomCode/leaderboard", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const leaderboard = await storage.getLeaderboard(tournament.id);
      res.json({
        tournament: {
          id: tournament.id,
          name: tournament.name,
          roomCode: tournament.roomCode,
          isActive: tournament.isActive,
          isStarted: tournament.isStarted,
          startedAt: tournament.startedAt,
          completedAt: tournament.completedAt,
        },
        leaderboard,
      });
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      res.status(500).json({ error: "Failed to get leaderboard" });
    }
  });

  // Batch sync multiple scores at once
  app.post("/api/tournaments/:roomCode/scores/batch", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const parsed = batchScoreSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const results = [];
      let tournamentPlayersCache: any[] | null = null;

      for (const score of parsed.data.scores) {
        if (score.hole > 18) continue;
        const sc = score.scratches || 0;

        if (!tournamentPlayersCache) {
          tournamentPlayersCache = await storage.getPlayersInTournament(tournament.id);
        }
        await runCheatDetection(req.params.roomCode, tournament.id, score.tournamentPlayerId, score.hole, score.par, score.strokes, sc, tournamentPlayersCache);

        const saved = await storage.upsertScore({
          tournamentPlayerId: score.tournamentPlayerId,
          hole: score.hole,
          par: score.par,
          strokes: score.strokes,
          scratches: sc,
          penalties: score.penalties || 0,
        });
        results.push(saved);
      }

      res.json(results);
    } catch (error) {
      console.error("Error batch syncing scores:", error);
      res.status(500).json({ error: "Failed to batch sync scores" });
    }
  });

  // ===== CHEAT DETECTION ALERTS API =====

  app.get("/api/alerts", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director PIN" });
      }
      const roomCode = req.query.roomCode as string | undefined;
      const alerts = roomCode ? getCheatAlertsForTournament(roomCode) : getAllCheatAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.post("/api/alerts/:id/dismiss", async (req, res) => {
    try {
      const directorPin = req.body.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director PIN" });
      }
      dismissCheatAlert(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error dismissing alert:", error);
      res.status(500).json({ error: "Failed to dismiss alert" });
    }
  });

  // ===== UNIVERSAL PLAYERS API =====

  // Get all universal players (requires master director PIN)
  app.get("/api/universal-players", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const players = await storage.getAllUniversalPlayers();
      const playersWithStats = await Promise.all(players.map(async (player) => {
        const history = await storage.getPlayerTournamentHistory(player.id);
        let totalPenalties = 0;
        let totalScratches = 0;
        let totalHoles = 0;
        for (const entry of history) {
          totalPenalties += entry.totalPenalties ?? 0;
          totalScratches += entry.totalScratches ?? 0;
          totalHoles += entry.holesPlayed;
        }
        const infractions = totalPenalties + totalScratches;
        const tournamentCount = history.length;
        const ppt = tournamentCount > 0 ? infractions / tournamentCount : null;
        const ppc = totalHoles > 0 ? infractions / totalHoles : null;
        return { ...player, ppt, ppc };
      }));
      res.json(playersWithStats);
    } catch (error) {
      console.error("Error getting universal players:", error);
      res.status(500).json({ error: "Failed to get universal players" });
    }
  });

  // Search universal players by name/email
  app.get("/api/universal-players/search", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const query = req.query.query as string;
      if (!query || query.length < 1) {
        return res.status(400).json({ error: "Search query required" });
      }
      
      const players = await storage.searchUniversalPlayers(query);
      res.json(players);
    } catch (error) {
      console.error("Error searching universal players:", error);
      res.status(500).json({ error: "Failed to search universal players" });
    }
  });

  // Create a universal player
  app.post("/api/universal-players", async (req, res) => {
    try {
      const directorPin = req.body.directorPin;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const parsed = createUniversalPlayerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      let uniqueCode: string;
      if (parsed.data.uniqueCode) {
        const existing = await storage.getUniversalPlayerByCode(parsed.data.uniqueCode);
        if (existing) {
          return res.status(409).json({ error: `Player code ${parsed.data.uniqueCode} is already in use` });
        }
        uniqueCode = parsed.data.uniqueCode.toUpperCase();
      } else {
        uniqueCode = await storage.getNextUniqueCode();
      }
      
      const player = await storage.createUniversalPlayer({
        uniqueCode,
        name: parsed.data.name,
        email: parsed.data.email || null,
        contactInfo: parsed.data.contactInfo || null,
      });
      
      res.json(player);
    } catch (error) {
      console.error("Error creating universal player:", error);
      res.status(500).json({ error: "Failed to create universal player" });
    }
  });

  // Update a universal player
  app.patch("/api/universal-players/:id", async (req, res) => {
    try {
      const parsed = updateUniversalPlayerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      if (parsed.data.directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const playerId = parseInt(req.params.id);
      if (isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid player ID" });
      }
      
      const { name, email, contactInfo, phoneNumber, tShirtSize, handicap, isProvisional } = parsed.data;
      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (contactInfo !== undefined) updateData.contactInfo = contactInfo;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (tShirtSize !== undefined) updateData.tShirtSize = tShirtSize;
      if (handicap !== undefined) updateData.handicap = handicap;
      if (isProvisional !== undefined) updateData.isProvisional = isProvisional;
      
      const player = await storage.updateUniversalPlayer(playerId, updateData);
      res.json(player);
    } catch (error) {
      console.error("Error updating universal player:", error);
      res.status(500).json({ error: "Failed to update universal player" });
    }
  });

  // Delete a universal player
  app.delete("/api/universal-players/:id", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const playerId = parseInt(req.params.id);
      if (isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid player ID" });
      }
      
      await storage.deleteUniversalPlayer(playerId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting universal player:", error);
      res.status(500).json({ error: "Failed to delete universal player" });
    }
  });

  // Merge two universal players (source into target)
  app.post("/api/universal-players/merge", async (req, res) => {
    try {
      const parsed = mergeUniversalPlayersSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      if (parsed.data.directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      if (parsed.data.sourceId === parsed.data.targetId) {
        return res.status(400).json({ error: "Cannot merge a player into themselves" });
      }
      
      const mergedPlayer = await storage.mergeUniversalPlayers(parsed.data.sourceId, parsed.data.targetId);
      res.json(mergedPlayer);
    } catch (error) {
      console.error("Error merging universal players:", error);
      res.status(500).json({ error: "Failed to merge universal players" });
    }
  });

  // Get universal player by ID with handicap info
  app.get("/api/universal-players/:id", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const playerId = parseInt(req.params.id);
      if (isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid player ID" });
      }
      
      const player = await storage.getUniversalPlayer(playerId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      const history = await storage.getPlayerTournamentHistory(playerId);
      const liveTournaments = await storage.getLiveTournamentStats(playerId);
      
      res.json({ ...player, recentHistory: history, liveTournaments });
    } catch (error) {
      console.error("Error getting universal player:", error);
      res.status(500).json({ error: "Failed to get universal player" });
    }
  });

  // Manually add tournament history for a player (TD only)
  app.post("/api/universal-players/:playerId/history", async (req, res) => {
    try {
      const directorPin = req.body.directorPin;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      const playerId = parseInt(req.params.playerId);
      if (isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid player ID" });
      }

      const player = await storage.getUniversalPlayer(playerId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }

      const { tournamentName, courseName, totalStrokes, totalPar, holesPlayed, completedAt, totalScratches, totalPenalties } = req.body;
      
      if (!tournamentName || totalStrokes == null || totalPar == null || holesPlayed == null) {
        return res.status(400).json({ error: "Missing required fields: tournamentName, totalStrokes, totalPar, holesPlayed" });
      }

      const relativeToPar = totalStrokes - totalPar;

      const history = await storage.addTournamentHistory({
        universalPlayerId: playerId,
        tournamentId: null as any,
        tournamentName,
        courseName: courseName || null,
        totalStrokes,
        totalPar,
        holesPlayed,
        relativeToPar,
        totalScratches: totalScratches ?? 0,
        totalPenalties: totalPenalties ?? 0,
        isManualEntry: true,
      });

      // Recalculate handicap after adding history
      await storage.recalculateHandicap(playerId);

      res.json(history);
    } catch (error) {
      console.error("Error adding tournament history:", error);
      res.status(500).json({ error: "Failed to add tournament history" });
    }
  });

  // Delete tournament history entry (TD only)
  app.delete("/api/universal-players/:playerId/history/:historyId", async (req, res) => {
    try {
      const directorPin = req.body.directorPin;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      const playerId = parseInt(req.params.playerId);
      const historyId = parseInt(req.params.historyId);
      
      if (isNaN(playerId) || isNaN(historyId)) {
        return res.status(400).json({ error: "Invalid IDs" });
      }

      await storage.deleteTournamentHistory(historyId);
      
      // Recalculate handicap after deleting history
      await storage.recalculateHandicap(playerId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tournament history:", error);
      res.status(500).json({ error: "Failed to delete tournament history" });
    }
  });

  // Link a tournament player to a universal player
  app.post("/api/tournaments/:roomCode/players/:playerId/link-universal", async (req, res) => {
    try {
      const directorPin = req.body.directorPin;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const playerId = parseInt(req.params.playerId);
      if (isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid player ID" });
      }
      
      const parsed = linkUniversalPlayerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }
      
      const updated = await storage.linkTournamentPlayerToUniversal(playerId, parsed.data.universalPlayerId);
      res.json(updated);
    } catch (error) {
      console.error("Error linking universal player:", error);
      res.status(500).json({ error: "Failed to link universal player" });
    }
  });

  // Complete tournament - saves results to history and updates handicaps
  app.post("/api/tournaments/:roomCode/complete", async (req, res) => {
    try {
      const directorPin = req.body.directorPin;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const players = await storage.getTournamentPlayers(tournament.id);
      const leaderboard = await storage.getLeaderboard(tournament.id);
      
      console.log(`Completing tournament ${tournament.name} (${req.params.roomCode}): ${players.length} players, ${leaderboard.length} leaderboard entries`);
      
      const saved: string[] = [];
      const skipped: string[] = [];
      const alreadyRecorded: string[] = [];
      
      for (const entry of leaderboard) {
        const player = players.find(p => p.id === entry.playerId);
        
        console.log(`  Player: ${entry.playerName} (id=${entry.playerId}) universalPlayerId=${player?.universalPlayerId} universalId=${player?.universalId} holes=${entry.holesCompleted} strokes=${entry.totalStrokes}`);
        
        let resolvedUniversalPlayerId = player?.universalPlayerId || null;
        if (!resolvedUniversalPlayerId && player?.universalId) {
          const universalPlayer = await storage.getUniversalPlayerByCode(player.universalId);
          if (universalPlayer) {
            resolvedUniversalPlayerId = universalPlayer.id;
            await storage.linkTournamentPlayerToUniversal(player.id, universalPlayer.id);
            console.log(`    Resolved universalId ${player.universalId} -> universalPlayerId ${universalPlayer.id}`);
          } else {
            console.log(`    Could not resolve universalId ${player.universalId} to any universal player`);
          }
        }
        
        if (!resolvedUniversalPlayerId || entry.holesCompleted === 0) {
          skipped.push(entry.playerName + (!resolvedUniversalPlayerId ? " (no universal ID)" : " (no scores)"));
          console.log(`    SKIPPED: ${!resolvedUniversalPlayerId ? "no universal ID" : "no scores"}`);
          continue;
        }
        
        const existingHistory = await storage.getPlayerTournamentHistory(resolvedUniversalPlayerId);
        const alreadyHas = existingHistory.some(h => h.tournamentId === tournament.id);
        if (alreadyHas) {
          alreadyRecorded.push(entry.playerName);
          console.log(`    ALREADY RECORDED`);
          continue;
        }
        
        await storage.addTournamentHistory({
          universalPlayerId: resolvedUniversalPlayerId,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          totalStrokes: entry.totalStrokes,
          totalPar: entry.totalPar,
          holesPlayed: entry.holesCompleted,
          relativeToPar: entry.relativeToPar,
          totalScratches: entry.totalScratches,
          totalPenalties: entry.totalPenalties,
        });
        
        await storage.recalculateHandicap(resolvedUniversalPlayerId);
        saved.push(entry.playerName);
        console.log(`    SAVED to history`);
      }
      
      await storage.closeTournament(tournament.id);
      
      console.log(`Tournament complete: saved=${saved.length} skipped=${skipped.length} alreadyRecorded=${alreadyRecorded.length}`);
      
      sendPushToTournament(req.params.roomCode, "Tournament Complete!", `${tournament.name} has finished. Check the final leaderboard!`, `complete-${req.params.roomCode}`);
      res.json({ 
        success: true, 
        message: "Tournament completed and handicaps updated",
        saved,
        skipped,
        alreadyRecorded,
      });
    } catch (error) {
      console.error("Error completing tournament:", error);
      res.status(500).json({ error: "Failed to complete tournament" });
    }
  });

  // ==================== PLAYER LOGIN ENDPOINTS ====================

  // Player login - verify player code + PIN
  app.post("/api/player/login", async (req, res) => {
    try {
      const { playerCode, pin } = req.body;
      
      if (!playerCode || !pin) {
        return res.status(400).json({ error: "Player code and PIN are required" });
      }
      
      const player = await storage.getUniversalPlayerByCode(playerCode.toUpperCase());
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      if (!player.pin) {
        return res.status(400).json({ error: "No PIN set. Please ask a Tournament Director to set up your login." });
      }
      
      // Verify PIN using bcrypt
      const isPinValid = await bcrypt.compare(pin, player.pin);
      if (!isPinValid) {
        return res.status(401).json({ error: "Invalid PIN" });
      }
      
      // Return player profile without the PIN hash
      const { pin: _, ...safePlayer } = player;
      const history = await storage.getPlayerTournamentHistory(player.id, 5);
      const sessionToken = createPlayerSession(player.uniqueCode!);
      
      res.json({ player: safePlayer, recentHistory: history, sessionToken });
    } catch (error) {
      console.error("Error during player login:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.post("/api/player/session", async (req, res) => {
    try {
      const { sessionToken } = req.body;
      if (!sessionToken) {
        return res.status(400).json({ error: "Session token required" });
      }
      
      const playerCode = getPlayerSession(sessionToken);
      if (!playerCode) {
        return res.status(401).json({ error: "Session expired" });
      }
      
      const player = await storage.getUniversalPlayerByCode(playerCode);
      if (!player) {
        deletePlayerSession(sessionToken);
        return res.status(404).json({ error: "Player not found" });
      }
      
      const { pin: _, ...safePlayer } = player;
      const history = await storage.getPlayerTournamentHistory(player.id, 5);
      
      res.json({ player: safePlayer, history });
    } catch (error) {
      console.error("Error restoring session:", error);
      res.status(500).json({ error: "Failed to restore session" });
    }
  });

  app.post("/api/player/logout", async (req, res) => {
    const { sessionToken } = req.body;
    if (sessionToken) {
      deletePlayerSession(sessionToken);
    }
    res.json({ success: true });
  });

  app.patch("/api/player/:code/profile", async (req, res) => {
    try {
      const { pin, sessionToken, email, phoneNumber, tShirtSize, name } = req.body;
      const code = req.params.code.toUpperCase();
      
      if (!pin && !sessionToken) {
        return res.status(400).json({ error: "Authentication required" });
      }
      
      const player = await storage.getUniversalPlayerByCode(code);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      let authenticated = false;
      
      if (sessionToken) {
        const sessionCode = getPlayerSession(sessionToken);
        if (sessionCode && sessionCode.toUpperCase() === code) {
          authenticated = true;
        }
      }
      
      if (!authenticated && pin) {
        if (!player.pin) {
          return res.status(400).json({ error: "No PIN set" });
        }
        const isPinValid = await bcrypt.compare(pin, player.pin);
        if (isPinValid) {
          authenticated = true;
        }
      }
      
      if (!authenticated) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const updateData: Record<string, string | null> = {};
      if (email !== undefined) updateData.email = email || null;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber || null;
      if (tShirtSize !== undefined) updateData.tShirtSize = tShirtSize || null;
      if (name !== undefined && name.trim()) updateData.name = name.trim();
      
      const updated = await storage.updateUniversalPlayer(player.id, updateData);
      const { pin: _, ...safePlayer } = updated;
      
      res.json({ player: safePlayer });
    } catch (error) {
      console.error("Error updating player profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Set or update player PIN (by player code, authenticated with current PIN or director PIN)
  app.post("/api/player/set-pin", async (req, res) => {
    try {
      const { playerCode, currentPin, newPin, directorPin } = req.body;
      
      if (!playerCode || !newPin) {
        return res.status(400).json({ error: "Player code and new PIN are required" });
      }
      
      if (!/^\d{4}$/.test(newPin)) {
        return res.status(400).json({ error: "PIN must be exactly 4 digits" });
      }
      
      const player = await storage.getUniversalPlayerByCode(playerCode.toUpperCase());
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Verify authorization: director PIN, current PIN (hashed), or no PIN set yet
      const isDirector = directorPin === MASTER_DIRECTOR_PIN;
      let isCurrentPinValid = false;
      if (player.pin && currentPin) {
        isCurrentPinValid = await bcrypt.compare(currentPin, player.pin);
      }
      const noPinSet = !player.pin;
      
      if (!isDirector && !isCurrentPinValid && !noPinSet) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Hash the new PIN before storing
      const hashedPin = await bcrypt.hash(newPin, SALT_ROUNDS);
      await storage.updateUniversalPlayerPin(player.id, hashedPin);
      
      res.json({ success: true, message: "PIN updated successfully" });
    } catch (error) {
      console.error("Error setting player PIN:", error);
      res.status(500).json({ error: "Failed to set PIN" });
    }
  });

  // Remove player PIN (director only)
  app.post("/api/player/:code/remove-pin", async (req, res) => {
    try {
      const { directorPin } = req.body;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      const player = await storage.getUniversalPlayerByCode(req.params.code.toUpperCase());
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }

      await storage.updateUniversalPlayerPin(player.id, null);
      res.json({ success: true, message: "PIN removed successfully" });
    } catch (error) {
      console.error("Error removing player PIN:", error);
      res.status(500).json({ error: "Failed to remove PIN" });
    }
  });

  // Get player profile by code (public info only - for display)
  app.get("/api/player/:code/profile", async (req, res) => {
    try {
      const player = await storage.getUniversalPlayerByCode(req.params.code.toUpperCase());
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Return public profile info (no PIN)
      const { pin: _, ...safePlayer } = player;
      const history = await storage.getPlayerTournamentHistory(player.id, 5);
      
      res.json({ player: safePlayer, recentHistory: history });
    } catch (error) {
      console.error("Error getting player profile:", error);
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  // Check if player has PIN set (for login flow)
  app.get("/api/player/:code/has-pin", async (req, res) => {
    try {
      const player = await storage.getUniversalPlayerByCode(req.params.code.toUpperCase());
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      res.json({ hasPin: !!player.pin, playerName: player.name });
    } catch (error) {
      console.error("Error checking player PIN:", error);
      res.status(500).json({ error: "Failed to check PIN status" });
    }
  });

  // === Push Notification Routes ===

  app.get("/api/push/vapid-key", (_req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { subscription, deviceId, tournamentRoomCode, universalPlayerId, directorPin } = req.body;
      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ error: "Invalid subscription object" });
      }
      let isDirector = false;
      if (tournamentRoomCode && directorPin) {
        if (directorPin === MASTER_DIRECTOR_PIN) {
          isDirector = true;
        } else {
          isDirector = await storage.verifyDirectorPin(tournamentRoomCode, directorPin);
        }
      }
      await storage.upsertPushSubscription({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        deviceId: deviceId || null,
        tournamentRoomCode: tournamentRoomCode || null,
        universalPlayerId: universalPlayerId || null,
        isDirector,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving push subscription:", error);
      res.status(500).json({ error: "Failed to save subscription" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ error: "Endpoint required" });
      }
      await storage.removePushSubscription(endpoint);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing push subscription:", error);
      res.status(500).json({ error: "Failed to remove subscription" });
    }
  });

  app.get("/api/push/player-status/:playerId", async (req, res) => {
    try {
      const directorPin = req.query.directorPin as string;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      const playerId = parseInt(req.params.playerId);
      if (isNaN(playerId)) {
        return res.status(400).json({ error: "Invalid player ID" });
      }
      const subs = await storage.getSubscriptionsForPlayer(playerId);
      res.json({ hasSubscription: subs.length > 0, subscriptionCount: subs.length });
    } catch (error) {
      console.error("Error checking player push status:", error);
      res.status(500).json({ error: "Failed to check subscription status" });
    }
  });

  app.post("/api/push/send-to-player", async (req, res) => {
    try {
      const { directorPin, universalPlayerId, title, body } = req.body;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      if (!title || !body || !universalPlayerId) {
        return res.status(400).json({ error: "Title, body, and player ID are required" });
      }
      if (!pushEnabled) {
        return res.status(503).json({ error: "Push notifications are not configured" });
      }

      const subs = await storage.getSubscriptionsForPlayer(universalPlayerId);
      if (subs.length === 0) {
        return res.status(404).json({ error: "Player has no active subscriptions" });
      }

      const payload = JSON.stringify({
        title,
        body,
        tag: `player-${universalPlayerId}-${Date.now()}`,
        url: "/",
      });

      let sentCount = 0;
      await Promise.allSettled(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            sentCount++;
          } catch (err: any) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              await storage.removePushSubscription(sub.endpoint);
            }
          }
        })
      );

      res.json({ success: true, sentCount, message: `Sent to ${sentCount} device(s)` });
    } catch (error) {
      console.error("Error sending player notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  app.post("/api/push/send", async (req, res) => {
    try {
      const { directorPin, title, body, tournamentRoomCode } = req.body;
      if (directorPin !== MASTER_DIRECTOR_PIN) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      if (!title || !body) {
        return res.status(400).json({ error: "Title and body are required" });
      }
      if (!pushEnabled) {
        return res.status(503).json({ error: "Push notifications are not configured" });
      }

      let subs;
      if (tournamentRoomCode) {
        subs = await storage.getSubscriptionsForTournament(tournamentRoomCode);
      } else {
        subs = await storage.getAllPushSubscriptions();
      }

      const payload = JSON.stringify({
        title,
        body,
        tag: `custom-${Date.now()}`,
        url: tournamentRoomCode ? `/?room=${tournamentRoomCode}` : "/",
      });

      let sentCount = 0;
      await Promise.allSettled(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            sentCount++;
          } catch (err: any) {
            if (err.statusCode === 404 || err.statusCode === 410) {
              await storage.removePushSubscription(sub.endpoint);
            }
          }
        })
      );

      res.json({ success: true, sentCount, message: `Sent to ${sentCount} device(s)` });
    } catch (error) {
      console.error("Error sending custom notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
