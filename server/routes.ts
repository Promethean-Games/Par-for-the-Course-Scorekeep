import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import bcrypt from "bcrypt";
import webpush from "web-push";
import { eq, sql } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { insertTournamentPlayerSchema, insertTournamentScoreSchema, batchUpdateGroupsSchema, insertUniversalPlayerSchema, universalPlayers, type TournamentScore } from "@shared/schema";
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

const faqItemSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(300),
  answer: z.string().trim().min(1, "Answer is required").max(4000),
});

const directorContentDefaultsSchema = z.object({
  directorPin: z.string().min(1, "Director PIN is required"),
  rulesText: z.string().trim().max(12000).nullable().optional(),
  faqItems: z.array(faqItemSchema).max(25).optional().default([]),
  directorName: z.string().trim().max(120).nullable().optional(),
  directorEmail: z.string().trim().email().nullable().optional(),
  directorPhone: z.string().trim().max(40).nullable().optional(),
  heroImageUrl: z.string().trim().url().nullable().optional(),
  youtubeUrl: z.string().trim().url().nullable().optional(),
  galleryImages: z.array(z.string().trim().url()).max(20).optional().default([]),
});

const DEFAULT_DIRECTOR_FAQ_ITEMS = [
  {
    question: "Do I need to own Par for the Course?",
    answer: "No. The tournament app supports quick participation and scoring without prior setup.",
  },
  {
    question: "Can beginners play?",
    answer: "Yes. Players of all skill levels are welcome.",
  },
  {
    question: "What equipment should I bring?",
    answer: "Bring weather-appropriate clothing and anything the venue recommends.",
  },
  {
    question: "Can I register on tournament day?",
    answer: "Day-of registration depends on remaining spots.",
  },
  {
    question: "What happens if I'm late?",
    answer: "Please contact the Tournament Director if you are delayed.",
  },
  {
    question: "Are refunds available?",
    answer: "Refund policies are set by the Tournament Director and shown in event updates.",
  },
];

const updateEventDetailsSchema = z.object({
  directorPin: z.string().min(1, "Director PIN is required"),
  eventVenue: z.string().trim().max(200).nullable().optional(),
  eventStartAt: z.string().datetime().nullable().optional(),
  eventDetailsUrl: z.string().url().nullable().optional(),
  eventRegistrationUrl: z.string().url().nullable().optional(),
  eventMaxPlayers: z.number().int().min(1).max(500).optional(),
  eventEntryFee: z.number().min(0).max(10000).nullable().optional(),
  eventEntryFeeDetails: z.string().trim().max(500).nullable().optional(),
});

const waitlistJoinSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Valid email is required").max(200),
});

type ImportConflictPolicy = "skip" | "replace" | "keep_both";

type ImportSections = {
  players: boolean;
  tournamentHistory: boolean;
  settings: boolean;
};

type ImportConflict = {
  key: string;
  importName: string;
  importUniqueCode: string | null;
  existingId: number;
  existingName: string;
  existingUniqueCode: string | null;
  matchReason: "uniqueCode" | "name";
  differingFields: string[];
};

function normalizeName(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeCode(value: unknown): string | null {
  const code = String(value || "").trim().toUpperCase();
  return code || null;
}

function getImportSections(input: any): ImportSections {
  return {
    players: input?.players !== false,
    tournamentHistory: input?.tournamentHistory !== false,
    settings: input?.settings !== false,
  };
}

function getImportCounts(data: any) {
  const importedPlayers = Array.isArray(data?.universalPlayers) ? data.universalPlayers : [];
  const historyCount = importedPlayers.reduce((sum: number, entry: any) => {
    return sum + (Array.isArray(entry?.history) ? entry.history.length : 0);
  }, 0);
  const settingsCount = data?.settings && typeof data.settings === "object" && !Array.isArray(data.settings)
    ? Object.keys(data.settings).length
    : 0;

  return {
    players: importedPlayers.length,
    tournamentHistory: historyCount,
    settings: settingsCount,
  };
}

function getDifferingPlayerFields(existing: any, incoming: any): string[] {
  const fields: Array<[string, unknown, unknown]> = [
    ["name", existing?.name ?? null, incoming?.name ?? null],
    ["email", existing?.email ?? null, incoming?.email ?? null],
    ["contactInfo", existing?.contactInfo ?? null, incoming?.contactInfo ?? null],
    ["phoneNumber", existing?.phoneNumber ?? null, incoming?.phoneNumber ?? null],
    ["tShirtSize", existing?.tShirtSize ?? null, incoming?.tShirtSize ?? null],
  ];
  return fields
    .filter(([, a, b]) => normalizeName(a) !== normalizeName(b))
    .map(([name]) => name);
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const DIRECTOR_PINS: Record<string, string> = {
  "3141": "Alan Acevedo",
  "3115": "Eric Berry",
};

function isValidDirectorPin(pin: string | undefined): boolean {
  if (!pin) return false;
  return pin in DIRECTOR_PINS;
}

function getDirectorName(pin: string): string {
  return DIRECTOR_PINS[pin] || "Tournament Director";
}

function getPortalBaseUrl(): string {
  return (process.env.TOURNAMENT_PORTAL_BASE_URL || "https://portal.parforthecourse.com").replace(/\/$/, "");
}

const STRIPE_PRODUCT_ID = "prod_UuWIcWhK26e0Z0";

function getStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return secretKey;
}

async function stripeApiRequest(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Stripe request failed with status ${response.status}`);
  }

  return payload;
}

function getRequestOrigin(req: Request): string {
  const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol || "https";
  const host = req.get("x-forwarded-host") || req.get("host");
  return `${protocol}://${host}`;
}

function getCheckoutUrls(req: Request, slug: string) {
  const origin = getRequestOrigin(req);

  const successTemplate = process.env.SUCCESS_URL || `${origin}/events/{slug}/register/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelTemplate = process.env.CANCEL_URL || `${origin}/events/{slug}/register/cancel`;

  const successUrlWithSlug = successTemplate.replaceAll("{slug}", slug);
  const cancelUrl = cancelTemplate.replaceAll("{slug}", slug);
  const successUrl = successUrlWithSlug.includes("{CHECKOUT_SESSION_ID}")
    ? successUrlWithSlug
    : `${successUrlWithSlug}${successUrlWithSlug.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;

  return { successUrl, cancelUrl };
}

function getPublicRegistrationStatus(options: {
  isActive: boolean;
  isStarted: boolean;
  completedAt: Date | null;
  registeredCount: number;
  maxPlayers: number;
  waitlistCount: number;
}): "open" | "waitlist" | "closed" | "in_progress" {
  if (!options.isActive || !!options.completedAt) return "closed";
  if (options.isStarted) return "in_progress";
  if (options.registeredCount < options.maxPlayers) return "open";
  if (options.waitlistCount < 10) return "waitlist";
  return "closed";
}

function addMinutes(dateIso: string, minutes: number): string {
  const date = new Date(dateIso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function verifyStripeWebhookSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(",").map((p) => p.trim());
  const timestampPart = parts.find((p) => p.startsWith("t="));
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestampPart || signatures.length === 0) return false;

  const timestamp = timestampPart.slice(2);
  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  return signatures.some((candidate) => {
    try {
      const left = Buffer.from(candidate, "hex");
      const right = Buffer.from(expected, "hex");
      return left.length === right.length && crypto.timingSafeEqual(left, right);
    } catch {
      return false;
    }
  });
}

async function getRegistrationCounts(tournamentId: number): Promise<{ paid: number; waitlist: number }> {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'paid') AS paid,
        COUNT(*) FILTER (WHERE status = 'waitlist') AS waitlist
      FROM tournament_registrations
      WHERE tournament_id = ${tournamentId}
    `);

    const row = ((result.rows ?? result) as any[])[0] || {};
    return {
      paid: parseInt(row.paid ?? "0", 10),
      waitlist: parseInt(row.waitlist ?? "0", 10),
    };
  } catch (error: any) {
    // Keep public event pages alive during partial deployments/migrations.
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("tournament_registrations") || message.includes("does not exist")) {
      return { paid: 0, waitlist: 0 };
    }
    throw error;
  }
}

function sanitizeGalleryImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((url) => !!url)
    .slice(0, 20);
}

function getEffectiveDirectorFaqItems(
  faqItems: unknown,
  hasSavedDefaults: boolean,
): Array<{ question: string; answer: string }> {
  const items = Array.isArray(faqItems)
    ? faqItems
        .map((item) => ({
          question: typeof item?.question === "string" ? item.question.trim() : "",
          answer: typeof item?.answer === "string" ? item.answer.trim() : "",
        }))
        .filter((item) => item.question && item.answer)
        .slice(0, 25)
    : [];

  if (items.length) return items;
  return hasSavedDefaults ? [] : DEFAULT_DIRECTOR_FAQ_ITEMS;
}

async function upsertRegistrationFromCheckoutSession(tournamentId: number, session: any): Promise<void> {
  const sessionId = String(session.id || "").trim();
  if (!sessionId) return;

  const paymentStatus = String(session.payment_status || "").toLowerCase();
  const nextStatus = paymentStatus === "paid" ? "paid" : "pending";
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const customerEmail = session.customer_details?.email || null;
  const amountTotal = typeof session.amount_total === "number" ? session.amount_total : null;
  const currency = typeof session.currency === "string" ? session.currency : null;

  await db.execute(sql`
    INSERT INTO tournament_registrations (
      tournament_id,
      stripe_session_id,
      stripe_payment_intent_id,
      customer_email,
      amount_total,
      currency,
      status,
      updated_at
    ) VALUES (
      ${tournamentId},
      ${sessionId},
      ${paymentIntentId},
      ${customerEmail},
      ${amountTotal},
      ${currency},
      ${nextStatus},
      NOW()
    )
    ON CONFLICT (stripe_session_id)
    DO UPDATE SET
      stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
      customer_email = EXCLUDED.customer_email,
      amount_total = EXCLUDED.amount_total,
      currency = EXCLUDED.currency,
      status = EXCLUDED.status,
      updated_at = NOW()
  `);
}

function parseWaitlistCustomerLabel(value: string | null | undefined): { name: string; email: string } {
  const label = String(value || "").trim();
  const match = label.match(/^(.*)\s<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim(),
      email: match[2].trim(),
    };
  }

  return {
    name: label || "Waitlist Entry",
    email: "",
  };
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

// Keep for backward compat — first/primary director pin
const MASTER_DIRECTOR_PIN = Object.keys(DIRECTOR_PINS)[0];

export async function registerRoutes(app: Express): Promise<Server> {
  // Public upcoming events feed for splash preview cards
  app.get("/api/events/upcoming", async (_req, res) => {
    try {
      // Use raw SQL so this never fails due to missing new columns
      const result = await db.execute(sql`
        SELECT
          t.id,
          t.room_code AS "roomCode",
          t.name,
          t.is_active AS "isActive",
          t.is_started AS "isStarted",
          t.created_at AS "createdAt",
          t.started_at AS "startedAt",
          t.completed_at AS "completedAt",
          (SELECT COUNT(*) FROM tournament_players tp WHERE tp.tournament_id = t.id) AS "playerCount",
          (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id AND tr.status = 'paid') AS "paidRegistrationCount",
          (SELECT COUNT(*) FROM tournament_registrations tr WHERE tr.tournament_id = t.id AND tr.status = 'waitlist') AS "waitlistCount",
          COALESCE(
            CASE WHEN column_exists.event_max_players_exists THEN
              (SELECT t2.event_max_players FROM tournaments t2 WHERE t2.id = t.id)
            ELSE 24 END,
            24
          ) AS "maxPlayers",
          CASE WHEN column_exists.event_venue_exists THEN
            (SELECT t2.event_venue FROM tournaments t2 WHERE t2.id = t.id)
          ELSE NULL END AS "eventVenue",
          CASE WHEN column_exists.event_start_at_exists THEN
            (SELECT t2.event_start_at FROM tournaments t2 WHERE t2.id = t.id)
          ELSE NULL END AS "eventStartAt",
          CASE WHEN column_exists.event_details_url_exists THEN
            (SELECT t2.event_details_url FROM tournaments t2 WHERE t2.id = t.id)
          ELSE NULL END AS "eventDetailsUrl",
          CASE WHEN column_exists.event_registration_url_exists THEN
            (SELECT t2.event_registration_url FROM tournaments t2 WHERE t2.id = t.id)
          ELSE NULL END AS "eventRegistrationUrl",
          CASE WHEN column_exists.event_hero_image_url_exists THEN
            (SELECT t2.event_hero_image_url FROM tournaments t2 WHERE t2.id = t.id)
          ELSE NULL END AS "eventHeroImageUrl"
        FROM tournaments t,
          LATERAL (
            SELECT
              EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tournaments' AND column_name='event_venue') AS event_venue_exists,
              EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tournaments' AND column_name='event_start_at') AS event_start_at_exists,
              EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tournaments' AND column_name='event_details_url') AS event_details_url_exists,
              EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tournaments' AND column_name='event_registration_url') AS event_registration_url_exists,
              EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tournaments' AND column_name='event_hero_image_url') AS event_hero_image_url_exists,
              EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tournaments' AND column_name='event_max_players') AS event_max_players_exists
          ) AS column_exists
        WHERE t.is_active = true AND t.completed_at IS NULL
        ORDER BY COALESCE(
          CASE WHEN column_exists.event_start_at_exists THEN (SELECT t2.event_start_at FROM tournaments t2 WHERE t2.id = t.id) ELSE NULL END,
          t.started_at,
          t.created_at
        ) ASC
      `);

      const rows = (result.rows ?? result) as any[];
      const events = rows.map((t: any) => {
        const playerCount = parseInt(t.playerCount ?? "0", 10);
        const paidRegistrationCount = parseInt(t.paidRegistrationCount ?? "0", 10);
        const waitlistCount = parseInt(t.waitlistCount ?? "0", 10);
        const maxPlayers = Math.max(1, parseInt(t.maxPlayers ?? "24", 10) || 24);
        const currentRegisteredPlayers = Math.max(playerCount, paidRegistrationCount);
        const remainingSpots = Math.max(0, maxPlayers - currentRegisteredPlayers);
        const dateIso = toIsoString(t.eventStartAt ?? t.startedAt ?? t.createdAt);
        const registrationStatus = getPublicRegistrationStatus({
          isActive: !!t.isActive,
          isStarted: !!t.isStarted,
          completedAt: t.completedAt ? new Date(t.completedAt) : null,
          registeredCount: currentRegisteredPlayers,
          maxPlayers,
          waitlistCount,
        });

        return {
          id: `td-${t.id}`,
          slug: t.roomCode.toLowerCase(),
          name: t.name,
          venue: (t.eventVenue as string | null) || `Room ${t.roomCode}`,
          dateIso,
          bannerImageUrl: (t.eventHeroImageUrl as string | null) || null,
          registrationStatus,
          currentRegisteredPlayers,
          maxPlayers,
          remainingSpots,
          waitlistCount,
          detailsUrl: `/events/${t.roomCode.toLowerCase()}`,
          registrationUrl: `/events/${t.roomCode.toLowerCase()}/register`,
        };
      });

      res.json(events);
    } catch (error) {
      console.error("Error getting upcoming events:", error);
      res.json([]); // Always return array — never 500 for public splash feed
    }
  });

  async function buildPublicEventBySlug(slug: string) {
    const roomCode = slug.trim().toUpperCase();
    const tournament = await storage.getTournamentByCode(roomCode);
    if (!tournament) return null;

    const players = await storage.getPlayersInTournament(tournament.id);
    const registrationCounts = await getRegistrationCounts(tournament.id);
    const sponsors = await storage.getSponsorsForTournament(tournament.id);
      const directorDefaults = await storage.getDirectorContentDefaults(tournament.directorPin);
    let payout: Awaited<ReturnType<typeof storage.getTournamentPayout>> = undefined;
    try {
      payout = await storage.getTournamentPayout(tournament.id);
    } catch (payoutError: any) {
      // Gracefully handle missing tournament_payouts table during partial migrations
      const msg = String(payoutError?.message || "").toLowerCase();
      if (!msg.includes("tournament_payouts") && !msg.includes("does not exist")) {
        throw payoutError;
      }
    }

    const dateIso = toIsoString(tournament.eventStartAt ?? tournament.startedAt ?? tournament.createdAt);
    const maxPlayers = tournament.eventMaxPlayers ?? 24;
    const currentRegisteredPlayers = Math.max(players.length, registrationCounts.paid);
    const remainingSpots = Math.max(0, maxPlayers - currentRegisteredPlayers);
    const waitlistCount = registrationCounts.waitlist;
    const registrationStatus = getPublicRegistrationStatus({
      isActive: tournament.isActive,
      isStarted: tournament.isStarted,
      completedAt: tournament.completedAt,
      registeredCount: currentRegisteredPlayers,
      maxPlayers,
      waitlistCount,
    });

    const displayEntryFee = tournament.eventEntryFee ?? payout?.entryFee ?? null;
    const prizePool = payout
      ? Math.max(0, (payout.entryFee - payout.greenFee) * payout.numPlayers + payout.addedPrize)
      : null;

      const effectiveFaqItems = getEffectiveDirectorFaqItems(directorDefaults?.faqItems, !!directorDefaults);
      const effectiveGalleryImages = sanitizeGalleryImages(
        directorDefaults?.galleryImages?.length ? directorDefaults.galleryImages : tournament.eventGalleryImages,
      );

      return {
      id: `td-${tournament.id}`,
      roomCode: tournament.roomCode,
      slug: tournament.roomCode.toLowerCase(),
      name: tournament.name,
      venue: tournament.eventVenue || `Room ${tournament.roomCode}`,
      dateIso,
        bannerImageUrl: directorDefaults?.heroImageUrl || tournament.eventHeroImageUrl || null,
      registrationStatus,
      currentRegisteredPlayers,
      maxPlayers,
      remainingSpots,
      waitlistCount,
      detailsUrl: `/events/${tournament.roomCode.toLowerCase()}`,
      registrationUrl: `/events/${tournament.roomCode.toLowerCase()}/register`,
      entryFee: displayEntryFee,
      entryFeeDetails: tournament.eventEntryFeeDetails || null,
        youtubeVideoUrl: directorDefaults?.youtubeUrl || tournament.eventYoutubeUrl || null,
      expectedDurationMinutes: 150,
      checkInTimeIso: addMinutes(dateIso, -45),
      playerMeetingTimeIso: addMinutes(dateIso, -15),
      tournamentStartTimeIso: dateIso,
      venueAddress: "Venue address to be announced",
      prizePool,
      payoutStructureNote: "Payout structure will be published closer to event day.",
      venueDescription: "Tournament venue details will be posted by the Tournament Director.",
      parkingInfo: "Parking guidance will be provided before check-in.",
      foodAndDrinksInfo: "Food and drink details will be shared in event updates.",
      accessibilityNotes: "Accessibility accommodations available upon request.",
      sponsors: sponsors
        .filter((s) => s.isActive)
        .map((s) => ({ name: s.sponsorName, websiteUrl: null, logoUrl: s.logoUrl || null })),
        galleryImages: effectiveGalleryImages,
      schedule: [
        { label: "Check-in", timeIso: addMinutes(dateIso, -45) },
        { label: "Opening announcements", timeIso: addMinutes(dateIso, -15) },
        { label: "Round begins", timeIso: dateIso },
        { label: "Awards ceremony", timeIso: addMinutes(dateIso, 135) },
        { label: "Estimated finish", timeIso: addMinutes(dateIso, 150) },
      ],
        faq: effectiveFaqItems,
      rules:
        directorDefaults?.rulesText ||
          tournament.eventRulesText ||
        "Official rules will be posted here by the Tournament Director.\n\nPlease check back before tournament day for complete details.",
      contact: {
        directorName: directorDefaults?.directorName || tournament.eventDirectorName || "Tournament Director",
        email: directorDefaults?.directorEmail || tournament.eventDirectorEmail || "director@parforthecourse.com",
        phone: directorDefaults?.directorPhone || tournament.eventDirectorPhone || "(000) 000-0000",
      },
    };
  }

  app.get("/api/public/events/:slug", async (req, res) => {
    try {
      const event = await buildPublicEventBySlug(req.params.slug);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error loading public event details:", error);
      res.status(500).json({ error: "Failed to load event details" });
    }
  });

  app.post("/api/public/events/:slug/waitlist", async (req, res) => {
    try {
      const parsed = waitlistJoinSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid waitlist request" });
      }

      const event = await buildPublicEventBySlug(req.params.slug);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      if (event.registrationStatus !== "waitlist") {
        return res.status(409).json({ error: "Waitlist is not available for this event" });
      }

      if ((event.waitlistCount ?? 0) >= 10) {
        return res.status(409).json({ error: "Waitlist is full" });
      }

      const tournament = await storage.getTournamentByCode(event.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Event not found" });
      }

      await db.execute(sql`
        INSERT INTO tournament_registrations (
          tournament_id,
          stripe_session_id,
          customer_email,
          status,
          updated_at
        ) VALUES (
          ${tournament.id},
          ${`waitlist-${tournament.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`},
          ${`${parsed.data.name} <${parsed.data.email}>`},
          'waitlist',
          NOW()
        )
      `);

      const counts = await getRegistrationCounts(tournament.id);
      res.json({ success: true, waitlistCount: counts.waitlist });
    } catch (error) {
      console.error("Error joining waitlist:", error);
      res.status(500).json({ error: "Could not join waitlist" });
    }
  });

  app.post("/api/public/events/:slug/checkout", async (req, res) => {
    try {
      const event = await buildPublicEventBySlug(req.params.slug);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      if (event.registrationStatus === "closed" || event.registrationStatus === "in_progress") {
        return res.status(409).json({ error: "Registration is no longer available for this tournament" });
      }

      if (event.registrationStatus === "waitlist") {
        return res.status(409).json({ error: "Tournament is full. Please join the waitlist.", code: "WAITLIST_ONLY" });
      }

      if (event.entryFee === null || event.entryFee <= 0) {
        return res.status(400).json({ error: "Entry fee is not configured for this event" });
      }

      const { successUrl, cancelUrl } = getCheckoutUrls(req, event.slug);
      const body = new URLSearchParams();
      body.set("mode", "payment");
      body.set("success_url", successUrl);
      body.set("cancel_url", cancelUrl);
      body.set("line_items[0][price_data][currency]", "usd");
      body.set("line_items[0][price_data][product]", STRIPE_PRODUCT_ID);
      body.set("line_items[0][price_data][unit_amount]", String(Math.round(event.entryFee * 100)));
      body.set("line_items[0][quantity]", "1");
      body.set("metadata[tournamentRoomCode]", event.roomCode);
      body.set("metadata[tournamentSlug]", event.slug);
      body.set("metadata[tournamentName]", event.name);

      const session = await stripeApiRequest("/checkout/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!session.url) {
        return res.status(500).json({ error: "Stripe did not return a checkout URL" });
      }

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to start checkout" });
    }
  });

  app.get("/api/public/events/:slug/checkout-status", async (req, res) => {
    try {
      const sessionId = String(req.query.session_id || "").trim();
      if (!sessionId) {
        return res.status(400).json({ error: "session_id is required" });
      }

      const session = await stripeApiRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
      const sessionSlug = session.metadata?.tournamentSlug;
      if (sessionSlug && sessionSlug !== req.params.slug.toLowerCase()) {
        return res.status(403).json({ error: "Checkout session does not match this event" });
      }

      const roomCode = String(session.metadata?.tournamentRoomCode || "").toUpperCase();
      const tournament = roomCode ? await storage.getTournamentByCode(roomCode) : undefined;
      if (tournament) {
        await upsertRegistrationFromCheckoutSession(tournament.id, session);
      }

      res.json({
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email || null,
        amountTotal: session.amount_total,
        currency: session.currency,
        sessionId: session.id,
      });
    } catch (error) {
      console.error("Error fetching checkout status:", error);
      res.status(500).json({ error: "Failed to fetch checkout status" });
    }
  });

  app.post("/api/public/stripe/webhook", async (req, res) => {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return res.status(400).json({ error: "Webhook secret is not configured" });
      }

      const signatureHeader = req.headers["stripe-signature"];
      if (!signatureHeader || typeof signatureHeader !== "string") {
        return res.status(400).json({ error: "Missing Stripe signature header" });
      }

      const rawBody = req.rawBody;
      if (!Buffer.isBuffer(rawBody)) {
        return res.status(400).json({ error: "Invalid webhook body" });
      }

      if (!verifyStripeWebhookSignature(rawBody, signatureHeader, webhookSecret)) {
        return res.status(400).json({ error: "Invalid Stripe webhook signature" });
      }

      const stripeEvent = JSON.parse(rawBody.toString("utf8"));
      if (
        stripeEvent?.type === "checkout.session.completed" ||
        stripeEvent?.type === "checkout.session.async_payment_succeeded"
      ) {
        const session = stripeEvent?.data?.object || {};
        const roomCode = String(session?.metadata?.tournamentRoomCode || "").toUpperCase();
        const tournament = roomCode ? await storage.getTournamentByCode(roomCode) : undefined;
        if (tournament) {
          await upsertRegistrationFromCheckoutSession(tournament.id, {
            ...session,
            payment_status: "paid",
          });
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error processing Stripe webhook:", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // Verify master director PIN
  app.post("/api/director/verify", async (req, res) => {
    try {
      const { pin } = req.body;
      if (isValidDirectorPin(pin)) {
        res.json({ isValid: true, directorName: getDirectorName(pin) });
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
      if (!isValidDirectorPin(directorPin)) {
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

  app.get("/api/director/content-defaults", async (req, res) => {
    try {
      const directorPin = String(req.query.directorPin || "");
      if (!isValidDirectorPin(directorPin)) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      const defaults = await storage.getDirectorContentDefaults(directorPin);
      res.json({
        rulesText: defaults?.rulesText || "",
        faqItems: getEffectiveDirectorFaqItems(defaults?.faqItems, !!defaults),
        directorName: defaults?.directorName || "",
        directorEmail: defaults?.directorEmail || "",
        directorPhone: defaults?.directorPhone || "",
        heroImageUrl: defaults?.heroImageUrl || "",
        youtubeUrl: defaults?.youtubeUrl || "",
        galleryImages: sanitizeGalleryImages(defaults?.galleryImages),
      });
    } catch (error) {
      console.error("Error getting director content defaults:", error);
      res.status(500).json({ error: "Failed to load content defaults" });
    }
  });

  app.patch("/api/director/content-defaults", async (req, res) => {
    try {
      const parsed = directorContentDefaultsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }

      if (!isValidDirectorPin(parsed.data.directorPin)) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      const sanitizedFaqItems = parsed.data.faqItems
        .map((item) => ({
          question: item.question.trim(),
          answer: item.answer.trim(),
        }))
        .filter((item) => item.question && item.answer);
      const sanitizedGalleryImages = sanitizeGalleryImages(parsed.data.galleryImages);

      const defaults = await storage.upsertDirectorContentDefaults(parsed.data.directorPin, {
        rulesText: parsed.data.rulesText?.trim() ? parsed.data.rulesText.trim() : null,
        faqItems: sanitizedFaqItems,
        directorName: parsed.data.directorName?.trim() ? parsed.data.directorName.trim() : null,
        directorEmail: parsed.data.directorEmail?.trim() ? parsed.data.directorEmail.trim() : null,
        directorPhone: parsed.data.directorPhone?.trim() ? parsed.data.directorPhone.trim() : null,
        heroImageUrl: parsed.data.heroImageUrl?.trim() ? parsed.data.heroImageUrl.trim() : null,
        youtubeUrl: parsed.data.youtubeUrl?.trim() ? parsed.data.youtubeUrl.trim() : null,
        galleryImages: sanitizedGalleryImages,
      });

      await storage.syncDirectorManagedEventContent(parsed.data.directorPin, {
        eventDirectorName: defaults.directorName || null,
        eventDirectorEmail: defaults.directorEmail || null,
        eventDirectorPhone: defaults.directorPhone || null,
        eventRulesText: defaults.rulesText || null,
        eventHeroImageUrl: defaults.heroImageUrl || null,
        eventYoutubeUrl: defaults.youtubeUrl || null,
        eventGalleryImages: defaults.galleryImages?.length ? defaults.galleryImages : null,
      });

      res.json({
        rulesText: defaults.rulesText || "",
        faqItems: getEffectiveDirectorFaqItems(defaults.faqItems, true),
        directorName: defaults.directorName || "",
        directorEmail: defaults.directorEmail || "",
        directorPhone: defaults.directorPhone || "",
        heroImageUrl: defaults.heroImageUrl || "",
        youtubeUrl: defaults.youtubeUrl || "",
        galleryImages: sanitizeGalleryImages(defaults.galleryImages),
      });
    } catch (error) {
      console.error("Error saving director content defaults:", error);
      res.status(500).json({ error: "Failed to save content defaults" });
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
      if (!isValidDirectorPin(parsed.data.directorPin)) {
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

      // Auto-populate event details from director's global defaults
      const directorDefaults = await storage.getDirectorContentDefaults(parsed.data.directorPin);
      if (directorDefaults && (
        directorDefaults.directorName ||
        directorDefaults.directorEmail ||
        directorDefaults.directorPhone ||
        directorDefaults.rulesText ||
        directorDefaults.heroImageUrl ||
        directorDefaults.youtubeUrl ||
        directorDefaults.galleryImages?.length
      )) {
        await storage.updateTournamentEventDetails(tournament.id, {
          eventVenue: null,
          eventStartAt: null,
          eventDetailsUrl: null,
          eventRegistrationUrl: null,
          eventHeroImageUrl: directorDefaults.heroImageUrl || null,
          eventMaxPlayers: 24,
          eventDirectorName: directorDefaults.directorName || null,
          eventDirectorEmail: directorDefaults.directorEmail || null,
          eventDirectorPhone: directorDefaults.directorPhone || null,
          eventRulesText: directorDefaults.rulesText || null,
          eventYoutubeUrl: directorDefaults.youtubeUrl || null,
          eventGalleryImages: directorDefaults.galleryImages?.length ? directorDefaults.galleryImages : null,
          eventEntryFee: null,
          eventEntryFeeDetails: null,
        });
        const populated = await storage.getTournament(tournament.id);
        return res.json(populated || tournament);
      }

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
      const isMasterDirector = isValidDirectorPin(directorPin);
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
      const isMasterDirector = isValidDirectorPin(directorPin);
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
      const isMasterDirector = isValidDirectorPin(directorPin);
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

  app.get("/api/tournaments/:roomCode/waitlist", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const directorPin = req.query.directorPin as string;
      const isMasterDirector = isValidDirectorPin(directorPin);
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      const result = await db.execute(sql`
        SELECT id, customer_email AS "customerEmail", status, created_at AS "createdAt"
        FROM tournament_registrations
        WHERE tournament_id = ${tournament.id} AND status = 'waitlist'
        ORDER BY created_at ASC
      `);

      const rows = (result.rows ?? result) as Array<{ id: number; customerEmail: string | null; status: string; createdAt: string | Date }>;
      const entries = rows.map((row) => {
        const parsed = parseWaitlistCustomerLabel(row.customerEmail);
        return {
          id: row.id,
          name: parsed.name,
          email: parsed.email,
          status: row.status,
          createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        };
      });

      res.json({ entries });
    } catch (error) {
      console.error("Error loading waitlist:", error);
      res.status(500).json({ error: "Failed to load waitlist" });
    }
  });

  app.delete("/api/tournaments/:roomCode/waitlist/:registrationId", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const directorPin = req.body?.directorPin as string | undefined;
      const isMasterDirector = isValidDirectorPin(directorPin);
      const isTournamentDirector = directorPin ? await storage.verifyDirectorPin(req.params.roomCode, directorPin) : false;
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      const registrationId = parseInt(req.params.registrationId, 10);
      if (Number.isNaN(registrationId)) {
        return res.status(400).json({ error: "Invalid waitlist entry ID" });
      }

      await db.execute(sql`
        DELETE FROM tournament_registrations
        WHERE id = ${registrationId} AND tournament_id = ${tournament.id} AND status = 'waitlist'
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing waitlist entry:", error);
      res.status(500).json({ error: "Failed to remove waitlist entry" });
    }
  });

  // Update tournament event details (date/time/location)
  app.patch("/api/tournaments/:roomCode/event-details", async (req, res) => {
    try {
      const parsed = updateEventDetailsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid request" });
      }

      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const {
        directorPin,
        eventVenue,
        eventStartAt,
        eventDetailsUrl,
        eventRegistrationUrl,
        eventMaxPlayers,
        eventEntryFee,
        eventEntryFeeDetails,
      } = parsed.data;
      const isMasterDirector = isValidDirectorPin(directorPin);
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      const directorDefaults = await storage.getDirectorContentDefaults(tournament.directorPin);

      // Public contact info, rules, and shared media are owned by the Settings tab.
      // Ignore any duplicate event-detail payload for those fields and keep the Settings-managed values.
      const updated = await storage.updateTournamentEventDetails(tournament.id, {
        eventVenue: eventVenue?.trim() ? eventVenue.trim() : null,
        eventStartAt: eventStartAt ? new Date(eventStartAt) : null,
        eventDetailsUrl: eventDetailsUrl?.trim() ? eventDetailsUrl.trim() : null,
        eventRegistrationUrl: eventRegistrationUrl?.trim() ? eventRegistrationUrl.trim() : null,
        eventHeroImageUrl: directorDefaults?.heroImageUrl || tournament.eventHeroImageUrl,
        eventMaxPlayers: eventMaxPlayers ?? tournament.eventMaxPlayers ?? 24,
        eventDirectorName: directorDefaults?.directorName || tournament.eventDirectorName,
        eventDirectorEmail: directorDefaults?.directorEmail || tournament.eventDirectorEmail,
        eventDirectorPhone: directorDefaults?.directorPhone || tournament.eventDirectorPhone,
        eventRulesText: directorDefaults?.rulesText || tournament.eventRulesText,
        eventYoutubeUrl: directorDefaults?.youtubeUrl || tournament.eventYoutubeUrl,
        eventGalleryImages: directorDefaults?.galleryImages?.length ? sanitizeGalleryImages(directorDefaults.galleryImages) : tournament.eventGalleryImages,
        eventEntryFee: typeof eventEntryFee === "number" ? eventEntryFee : null,
        eventEntryFeeDetails: eventEntryFeeDetails?.trim() ? eventEntryFeeDetails.trim() : null,
      });

      const { directorPin: _, ...safe } = updated;
      res.json(safe);
    } catch (error) {
      console.error("Error updating event details:", error);
      res.status(500).json({ error: "Failed to update event details" });
    }
  });

  // Save/update tournament payout
  app.put("/api/tournaments/:roomCode/payout", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      const { directorPin, numPlayers, entryFee, greenFee, addedPrize, numSpots, percentages } = req.body;
      const isMasterDirector = isValidDirectorPin(directorPin);
      const isTournamentDirector = await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isMasterDirector && !isTournamentDirector) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      if (!numPlayers || !numSpots || !percentages || !Array.isArray(percentages)) {
        return res.status(400).json({ error: "Missing required payout fields" });
      }
      const payout = await storage.upsertTournamentPayout(tournament.id, {
        numPlayers,
        entryFee: entryFee || 0,
        greenFee: greenFee || 0,
        addedPrize: addedPrize || 0,
        numSpots,
        percentages,
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
      const isMasterDirector = isValidDirectorPin(directorPin);
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
      const isMasterDirector = isValidDirectorPin(directorPin);
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
      const isMasterDirector = isValidDirectorPin(directorPin);
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
      if (!isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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
      const mode: "preview" | "apply" = req.body?.mode === "preview" ? "preview" : "apply";
      const selectedSections = getImportSections(req.body?.selectedSections);
      const conflictPolicy: ImportConflictPolicy = ["skip", "replace", "keep_both"].includes(req.body?.conflictPolicy)
        ? req.body.conflictPolicy
        : "skip";

      if (!isValidDirectorPin(directorPin)) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      if (!data || !data.universalPlayers) {
        return res.status(400).json({ error: "Invalid import format - expected universalPlayers array" });
      }

      const counts = getImportCounts(data);
      const importedPlayers = Array.isArray(data.universalPlayers) ? data.universalPlayers : [];
      const existingPlayers = await storage.getAllUniversalPlayers();
      const existingByCode = new Map<string, any>();
      const existingByName = new Map<string, any>();

      for (const p of existingPlayers) {
        if (p.uniqueCode) existingByCode.set(p.uniqueCode.toUpperCase(), p);
        const normalized = normalizeName(p.name);
        if (normalized && !existingByName.has(normalized)) {
          existingByName.set(normalized, p);
        }
      }

      const conflicts: ImportConflict[] = [];
      for (const entry of importedPlayers) {
        const incoming = entry?.player;
        if (!incoming?.name) continue;
        const incomingCode = normalizeCode(incoming.uniqueCode);
        const codeMatch = incomingCode ? existingByCode.get(incomingCode) : undefined;
        const nameMatch = existingByName.get(normalizeName(incoming.name));
        const matched = codeMatch || nameMatch;
        if (!matched) continue;

        const matchReason: "uniqueCode" | "name" = codeMatch ? "uniqueCode" : "name";
        const differingFields = getDifferingPlayerFields(matched, incoming);
        if (differingFields.length > 0 || (incomingCode && matched.uniqueCode !== incomingCode)) {
          conflicts.push({
            key: `${incomingCode || normalizeName(incoming.name)}-${matched.id}`,
            importName: incoming.name,
            importUniqueCode: incomingCode,
            existingId: matched.id,
            existingName: matched.name,
            existingUniqueCode: matched.uniqueCode,
            matchReason,
            differingFields: incomingCode && matched.uniqueCode !== incomingCode
              ? [...differingFields, "uniqueCode"]
              : differingFields,
          });
        }
      }

      if (mode === "preview") {
        return res.json({
          counts,
          conflicts,
          selectedSections,
        });
      }

      let playersImported = 0;
      let playersSkipped = 0;
      let historyImported = 0;
      let playersReplaced = 0;
      let playersDuplicated = 0;

      const resolveExistingPlayer = (incoming: any) => {
        const incomingCode = normalizeCode(incoming?.uniqueCode);
        if (incomingCode && existingByCode.has(incomingCode)) {
          return existingByCode.get(incomingCode);
        }
        const byName = existingByName.get(normalizeName(incoming?.name));
        return byName;
      };

      for (const entry of data.universalPlayers) {
        const p = entry.player;
        if (!p?.name) continue;

        let targetPlayer = resolveExistingPlayer(p);

        if (targetPlayer) {
          if (conflictPolicy === "skip") {
            playersSkipped++;
            continue;
          }

          if (conflictPolicy === "replace") {
            const incomingCode = normalizeCode(p.uniqueCode);
            await storage.updateUniversalPlayer(targetPlayer.id, {
              name: p.name,
              email: p.email ?? null,
              phoneNumber: p.phoneNumber ?? null,
              tShirtSize: p.tShirtSize ?? null,
              contactInfo: p.contactInfo ?? null,
              handicap: p.handicap ?? null,
              isProvisional: p.isProvisional ?? true,
            });

            if (incomingCode && targetPlayer.uniqueCode !== incomingCode) {
              const [updatedByCode] = await db
                .update(universalPlayers)
                .set({ uniqueCode: incomingCode })
                .where(eq(universalPlayers.id, targetPlayer.id))
                .returning();
              targetPlayer = updatedByCode;
            } else {
              targetPlayer = (await storage.getUniversalPlayer(targetPlayer.id))!;
            }

            playersReplaced++;
          }

          if (conflictPolicy === "keep_both") {
            const incomingCode = normalizeCode(p.uniqueCode);
            let uniqueCode = incomingCode;
            if (uniqueCode && existingByCode.has(uniqueCode)) {
              uniqueCode = await storage.getNextUniqueCode();
            }
            if (!uniqueCode) {
              uniqueCode = await storage.getNextUniqueCode();
            }

            targetPlayer = await storage.createUniversalPlayer({
              name: p.name,
              email: p.email || null,
              phoneNumber: p.phoneNumber || null,
              tShirtSize: p.tShirtSize || null,
              contactInfo: p.contactInfo || null,
              uniqueCode,
              handicap: p.handicap ?? null,
              isProvisional: p.isProvisional ?? true,
              completedTournaments: 0,
            });
            playersDuplicated++;
            playersImported++;
          }
        } else {
          const uniqueCode = normalizeCode(p.uniqueCode) || await storage.getNextUniqueCode();
          targetPlayer = await storage.createUniversalPlayer({
            name: p.name,
            email: p.email || null,
            phoneNumber: p.phoneNumber || null,
            tShirtSize: p.tShirtSize || null,
            contactInfo: p.contactInfo || null,
            uniqueCode,
            handicap: p.handicap ?? null,
            isProvisional: p.isProvisional ?? true,
            completedTournaments: 0,
          });
          playersImported++;
        }

        if (selectedSections.tournamentHistory && entry.history && Array.isArray(entry.history)) {
          const existingHistory = await storage.getPlayerTournamentHistory(targetPlayer.id);

          for (const h of entry.history) {
            const computedRelativeToPar = (h.totalStrokes ?? 0) - (h.totalPar ?? 0);
            const duplicate = existingHistory.find((eh) =>
              normalizeName(eh.tournamentName) === normalizeName(h.tournamentName) &&
              normalizeName(eh.courseName || "") === normalizeName(h.courseName || "") &&
              eh.totalStrokes === (h.totalStrokes ?? 0) &&
              eh.totalPar === (h.totalPar ?? 0) &&
              eh.holesPlayed === (h.holesPlayed ?? 0)
            );

            if (duplicate && conflictPolicy === "skip") {
              continue;
            }
            if (duplicate && conflictPolicy === "replace") {
              await storage.deleteTournamentHistory(duplicate.id);
            }

            await storage.addTournamentHistory({
              universalPlayerId: targetPlayer.id,
              tournamentId: null,
              tournamentName: h.tournamentName,
              courseName: h.courseName || null,
              totalStrokes: h.totalStrokes,
              totalPar: h.totalPar,
              holesPlayed: h.holesPlayed,
              relativeToPar: computedRelativeToPar,
              totalScratches: h.totalScratches ?? 0,
              totalPenalties: h.totalPenalties ?? 0,
              isManualEntry: h.isManualEntry ?? true,
            });
            historyImported++;
          }
        }

        await storage.recalculateHandicap(targetPlayer.id);

        if (targetPlayer.uniqueCode) {
          existingByCode.set(targetPlayer.uniqueCode.toUpperCase(), targetPlayer);
        }
        existingByName.set(normalizeName(targetPlayer.name), targetPlayer);
      }

      res.json({ 
        success: true, 
        counts,
        playersImported,
        playersSkipped, 
        historyImported,
        playersReplaced,
        playersDuplicated,
        conflictPolicy,
        selectedSections,
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
      const mode: "preview" | "apply" = req.body?.mode === "preview" ? "preview" : "apply";
      const selectedSections = getImportSections(req.body?.selectedSections);
      const conflictPolicy: ImportConflictPolicy = ["skip", "replace", "keep_both"].includes(req.body?.conflictPolicy)
        ? req.body.conflictPolicy
        : "skip";

      if (!isValidDirectorPin(directorPin)) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }

      if (!data || !data.universalPlayers) {
        return res.status(400).json({ error: "Invalid import format" });
      }

      const counts = getImportCounts(data);
      const importedPlayers = Array.isArray(data.universalPlayers) ? data.universalPlayers : [];
      const existingPlayers = await storage.getAllUniversalPlayers();
      const existingByCode = new Map<string, any>();
      const existingByName = new Map<string, any>();

      for (const p of existingPlayers) {
        if (p.uniqueCode) existingByCode.set(p.uniqueCode.toUpperCase(), p);
        const normalized = normalizeName(p.name);
        if (normalized && !existingByName.has(normalized)) {
          existingByName.set(normalized, p);
        }
      }

      const conflicts: ImportConflict[] = [];
      for (const entry of importedPlayers) {
        const incoming = entry?.player;
        if (!incoming?.name) continue;
        const incomingCode = normalizeCode(incoming.uniqueCode);
        const codeMatch = incomingCode ? existingByCode.get(incomingCode) : undefined;
        const nameMatch = existingByName.get(normalizeName(incoming.name));
        const matched = codeMatch || nameMatch;
        if (!matched) continue;

        const differingFields = getDifferingPlayerFields(matched, incoming);
        if (differingFields.length > 0 || (incomingCode && matched.uniqueCode !== incomingCode)) {
          conflicts.push({
            key: `${incomingCode || normalizeName(incoming.name)}-${matched.id}`,
            importName: incoming.name,
            importUniqueCode: incomingCode,
            existingId: matched.id,
            existingName: matched.name,
            existingUniqueCode: matched.uniqueCode,
            matchReason: codeMatch ? "uniqueCode" : "name",
            differingFields: incomingCode && matched.uniqueCode !== incomingCode
              ? [...differingFields, "uniqueCode"]
              : differingFields,
          });
        }
      }

      if (mode === "preview") {
        return res.json({
          counts,
          conflicts,
          selectedSections,
        });
      }

      let playersImported = 0;
      let playersSkipped = 0;
      let historyImported = 0;
      let playersReplaced = 0;
      let playersDuplicated = 0;
      let settingsImported = 0;
      const errors: string[] = [];

      const resolveExistingPlayer = (incoming: any) => {
        const incomingCode = normalizeCode(incoming?.uniqueCode);
        if (incomingCode && existingByCode.has(incomingCode)) {
          return existingByCode.get(incomingCode);
        }
        return existingByName.get(normalizeName(incoming?.name));
      };

      if (selectedSections.players) {
        for (const entry of data.universalPlayers) {
          try {
            const p = entry.player;
            if (!p?.name) { errors.push("Skipped player with missing name"); continue; }

            let targetPlayer = resolveExistingPlayer(p);

            if (targetPlayer) {
              if (conflictPolicy === "skip") {
                playersSkipped++;
                continue;
              }

              if (conflictPolicy === "replace") {
                const incomingCode = normalizeCode(p.uniqueCode);
                await storage.updateUniversalPlayer(targetPlayer.id, {
                  name: p.name,
                  email: p.email ?? null,
                  phoneNumber: p.phoneNumber ?? null,
                  tShirtSize: p.tShirtSize ?? null,
                  contactInfo: p.contactInfo ?? null,
                  handicap: p.handicap ?? null,
                  isProvisional: p.isProvisional ?? true,
                });

                if (incomingCode && targetPlayer.uniqueCode !== incomingCode) {
                  const [updatedByCode] = await db
                    .update(universalPlayers)
                    .set({ uniqueCode: incomingCode })
                    .where(eq(universalPlayers.id, targetPlayer.id))
                    .returning();
                  targetPlayer = updatedByCode;
                } else {
                  targetPlayer = (await storage.getUniversalPlayer(targetPlayer.id))!;
                }

                playersReplaced++;
              }

              if (conflictPolicy === "keep_both") {
                const incomingCode = normalizeCode(p.uniqueCode);
                let uniqueCode = incomingCode;
                if (uniqueCode && existingByCode.has(uniqueCode)) {
                  uniqueCode = await storage.getNextUniqueCode();
                }
                if (!uniqueCode) {
                  uniqueCode = await storage.getNextUniqueCode();
                }

                targetPlayer = await storage.createUniversalPlayer({
                  name: p.name,
                  email: p.email || null,
                  phoneNumber: p.phoneNumber || null,
                  tShirtSize: p.tShirtSize || null,
                  contactInfo: p.contactInfo || null,
                  uniqueCode,
                  handicap: p.handicap ?? null,
                  isProvisional: p.isProvisional ?? true,
                  completedTournaments: 0,
                });
                playersDuplicated++;
                playersImported++;
              }
            } else {
              const uniqueCode = normalizeCode(p.uniqueCode) || await storage.getNextUniqueCode();
              targetPlayer = await storage.createUniversalPlayer({
                name: p.name,
                email: p.email || null,
                phoneNumber: p.phoneNumber || null,
                tShirtSize: p.tShirtSize || null,
                contactInfo: p.contactInfo || null,
                uniqueCode,
                handicap: p.handicap ?? null,
                isProvisional: p.isProvisional ?? true,
                completedTournaments: 0,
              });
              playersImported++;
            }

            if (selectedSections.tournamentHistory && entry.history && Array.isArray(entry.history)) {
              const existingHistory = await storage.getPlayerTournamentHistory(targetPlayer.id);

              for (const h of entry.history) {
                try {
                  const totalStrokes = h.totalStrokes ?? 0;
                  const totalPar = h.totalPar ?? 0;

                  const duplicate = existingHistory.find((eh) =>
                    normalizeName(eh.tournamentName) === normalizeName(h.tournamentName) &&
                    normalizeName(eh.courseName || "") === normalizeName(h.courseName || "") &&
                    eh.totalStrokes === totalStrokes &&
                    eh.totalPar === totalPar &&
                    eh.holesPlayed === (h.holesPlayed ?? 0)
                  );

                  if (duplicate && conflictPolicy === "skip") {
                    continue;
                  }
                  if (duplicate && conflictPolicy === "replace") {
                    await storage.deleteTournamentHistory(duplicate.id);
                  }

                  await storage.addTournamentHistory({
                    universalPlayerId: targetPlayer.id,
                    tournamentId: null,
                    tournamentName: h.tournamentName || "Unknown Tournament",
                    courseName: h.courseName || null,
                    totalStrokes,
                    totalPar,
                    holesPlayed: h.holesPlayed ?? 0,
                    relativeToPar: totalStrokes - totalPar,
                    totalScratches: h.totalScratches ?? 0,
                    totalPenalties: h.totalPenalties ?? 0,
                    isManualEntry: h.isManualEntry ?? true,
                  });
                  historyImported++;
                } catch (hErr: any) {
                  errors.push(`History for ${p.name}: ${hErr?.message || hErr}`);
                }
              }
            }

            await storage.recalculateHandicap(targetPlayer.id);

            if (targetPlayer.uniqueCode) {
              existingByCode.set(targetPlayer.uniqueCode.toUpperCase(), targetPlayer);
            }
            existingByName.set(normalizeName(targetPlayer.name), targetPlayer);
          } catch (pErr: any) {
            errors.push(`Player ${entry?.player?.name || "unknown"}: ${pErr?.message || pErr}`);
          }
        }
      }

      if (selectedSections.settings && counts.settings > 0) {
        // Placeholder for future persisted settings import support.
        settingsImported = counts.settings;
      }

      res.json({
        success: true,
        counts,
        playersImported,
        playersSkipped,
        historyImported,
        playersReplaced,
        playersDuplicated,
        settingsImported,
        conflictPolicy,
        selectedSections,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("Error importing full data:", error);
      res.status(500).json({ error: error?.message || "Failed to import data" });
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
      if (!isValidDirectorPin(directorPin)) {
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

  // GET group starting holes for a tournament
  app.get("/api/tournaments/:roomCode/group-starting-holes", async (req, res) => {
    try {
      const holes = await storage.getTournamentStartingHoles(req.params.roomCode);
      res.json(holes);
    } catch (error) {
      res.json({});
    }
  });

  // PUT group starting holes (director only)
  app.put("/api/tournaments/:roomCode/group-starting-holes", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      const { directorPin, holes } = req.body;
      const masterPin = process.env.MASTER_DIRECTOR_PIN || "3141";
      const isValid = directorPin === masterPin || await storage.verifyDirectorPin(req.params.roomCode, directorPin);
      if (!isValid) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      if (typeof holes !== "object" || holes === null || Array.isArray(holes)) {
        return res.status(400).json({ error: "holes must be an object" });
      }
      await storage.setTournamentStartingHoles(req.params.roomCode, holes as Record<string, number>);
      res.json({ ok: true, holes });
    } catch (error) {
      console.error("Error setting group starting holes:", error);
      res.status(500).json({ error: "Failed to set group starting holes" });
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
      const isMasterDirector = isValidDirectorPin(directorPin);
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
      if (!isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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
      
      if (!isValidDirectorPin(parsed.data.directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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
      
      if (!isValidDirectorPin(parsed.data.directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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

  app.post("/api/recalculate-handicaps", async (req, res) => {
    try {
      const directorPin = req.body.directorPin;
      if (!isValidDirectorPin(directorPin)) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      
      const allPlayers = await storage.getAllUniversalPlayers();
      let updated = 0;
      
      for (const player of allPlayers) {
        await storage.recalculateHandicap(player.id);
        updated++;
      }
      
      res.json({ success: true, message: `Recalculated handicaps for ${updated} players` });
    } catch (error) {
      console.error("Error recalculating handicaps:", error);
      res.status(500).json({ error: "Failed to recalculate handicaps" });
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
      const isDirector = isValidDirectorPin(directorPin);
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
      if (!isValidDirectorPin(directorPin)) {
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
        if (isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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

  // Get push subscriber info for a tournament (deviceIds + universalPlayerIds that have subscriptions)
  app.get("/api/push/tournament-subscribers/:roomCode", async (req, res) => {
    try {
      const { directorPin } = req.query as { directorPin?: string };
      if (!isValidDirectorPin(directorPin)) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      const subs = await storage.getSubscriptionsForTournament(req.params.roomCode);
      const deviceIds = subs.map(s => s.deviceId).filter(Boolean) as string[];
      const universalPlayerIds = subs.map(s => s.universalPlayerId).filter(Boolean) as number[];
      res.json({ deviceIds, universalPlayerIds });
    } catch (error) {
      console.error("Error getting tournament subscribers:", error);
      res.status(500).json({ error: "Failed to get subscriber info" });
    }
  });

  // Send push notification to specific tournament players (by tournament player ID)
  app.post("/api/push/send-to-players", async (req, res) => {
    try {
      const { directorPin, tournamentRoomCode, tournamentPlayerIds, title, body } = req.body;
      if (!isValidDirectorPin(directorPin)) {
        return res.status(403).json({ error: "Invalid director credentials" });
      }
      if (!title || !body || !tournamentRoomCode || !Array.isArray(tournamentPlayerIds) || tournamentPlayerIds.length === 0) {
        return res.status(400).json({ error: "Title, body, room code, and player IDs are required" });
      }
      if (!pushEnabled) {
        return res.status(503).json({ error: "Push notifications are not configured" });
      }

      const tournament = await storage.getTournamentByCode(tournamentRoomCode);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });

      const allPlayers = await storage.getPlayersInTournament(tournament.id);
      const selected = allPlayers.filter(p => tournamentPlayerIds.includes(p.id));

      // Collect subscriptions, deduplicating by endpoint
      const seenEndpoints = new Set<string>();
      const allSubs: Awaited<ReturnType<typeof storage.getAllPushSubscriptions>> = [];

      for (const player of selected) {
        let subs: typeof allSubs = [];
        if (player.universalPlayerId) {
          subs = await storage.getSubscriptionsForPlayer(player.universalPlayerId);
        } else if (player.deviceId) {
          subs = await storage.getSubscriptionsForDevices([player.deviceId], tournamentRoomCode);
        }
        for (const sub of subs) {
          if (!seenEndpoints.has(sub.endpoint)) {
            seenEndpoints.add(sub.endpoint);
            allSubs.push(sub);
          }
        }
      }

      const payload = JSON.stringify({
        title,
        body,
        tag: `targeted-${Date.now()}`,
        url: `/?room=${tournamentRoomCode}`,
      });

      let sentCount = 0;
      await Promise.allSettled(
        allSubs.map(async (sub) => {
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
      console.error("Error sending to players:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  app.post("/api/push/send-to-player", async (req, res) => {
    try {
      const { directorPin, universalPlayerId, title, body } = req.body;
      if (!isValidDirectorPin(directorPin)) {
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
      if (!isValidDirectorPin(directorPin)) {
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

  // ─── Sponsor routes ────────────────────────────────────────────────────────

  // GET /api/tournaments/:roomCode/sponsors — public, returns sponsorPagesEnabled + sponsors
  app.get("/api/tournaments/:roomCode/sponsors", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      const sponsors = await storage.getSponsorsForTournament(tournament.id);
      res.json({ sponsorPagesEnabled: tournament.sponsorPagesEnabled ?? false, sponsors });
    } catch (error) {
      console.error("Error fetching sponsors:", error);
      res.status(500).json({ error: "Failed to fetch sponsors" });
    }
  });

  // POST /api/tournaments/:roomCode/sponsors — create a sponsor (TD auth)
  app.post("/api/tournaments/:roomCode/sponsors", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      const { directorPin, sponsorName, donationType, blurb, logoUrl } = req.body;
      if (!isValidDirectorPin(directorPin) && directorPin !== tournament.directorPin) {
        return res.status(403).json({ error: "Invalid director PIN" });
      }
      if (!sponsorName?.trim()) return res.status(400).json({ error: "sponsorName is required" });
      const sponsor = await storage.createSponsor({
        tournamentId: tournament.id,
        sponsorName: sponsorName.trim(),
        donationType: donationType || null,
        blurb: blurb || null,
        logoUrl: logoUrl || null,
        isActive: true,
        displayOrder: 0,
      });
      res.json({ sponsor });
    } catch (error) {
      console.error("Error creating sponsor:", error);
      res.status(500).json({ error: "Failed to create sponsor" });
    }
  });

  // PUT /api/tournaments/:roomCode/sponsors/:id — update a sponsor (TD auth)
  app.put("/api/tournaments/:roomCode/sponsors/:id", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      const { directorPin, sponsorName, donationType, blurb, logoUrl, isActive } = req.body;
      if (!isValidDirectorPin(directorPin) && directorPin !== tournament.directorPin) {
        return res.status(403).json({ error: "Invalid director PIN" });
      }
      const updateData: Record<string, unknown> = {};
      if (sponsorName !== undefined) updateData.sponsorName = sponsorName?.trim() || undefined;
      if (donationType !== undefined) updateData.donationType = donationType || null;
      if (blurb !== undefined) updateData.blurb = blurb || null;
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl || null;
      if (isActive !== undefined) updateData.isActive = isActive;
      const sponsor = await storage.updateSponsor(parseInt(req.params.id), updateData as any);
      res.json({ sponsor });
    } catch (error) {
      console.error("Error updating sponsor:", error);
      res.status(500).json({ error: "Failed to update sponsor" });
    }
  });

  // DELETE /api/tournaments/:roomCode/sponsors/:id — delete a sponsor (TD auth)
  app.delete("/api/tournaments/:roomCode/sponsors/:id", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      const { directorPin } = req.body;
      if (!isValidDirectorPin(directorPin) && directorPin !== tournament.directorPin) {
        return res.status(403).json({ error: "Invalid director PIN" });
      }
      await storage.deleteSponsor(parseInt(req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sponsor:", error);
      res.status(500).json({ error: "Failed to delete sponsor" });
    }
  });

  // PATCH /api/tournaments/:roomCode/sponsor-pages — enable/disable sponsor pages (TD auth)
  app.patch("/api/tournaments/:roomCode/sponsor-pages", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      const { directorPin, enabled } = req.body;
      if (!isValidDirectorPin(directorPin) && directorPin !== tournament.directorPin) {
        return res.status(403).json({ error: "Invalid director PIN" });
      }
      await storage.setSponsorPagesEnabled(tournament.id, Boolean(enabled));
      res.json({ success: true, sponsorPagesEnabled: Boolean(enabled) });
    } catch (error) {
      console.error("Error updating sponsor pages:", error);
      res.status(500).json({ error: "Failed to update sponsor pages setting" });
    }
  });

  // POST /api/tournaments/:roomCode/sponsors/reorder — reorder sponsors (TD auth)
  app.post("/api/tournaments/:roomCode/sponsors/reorder", async (req, res) => {
    try {
      const tournament = await storage.getTournamentByCode(req.params.roomCode);
      if (!tournament) return res.status(404).json({ error: "Tournament not found" });
      const { directorPin, orderedIds } = req.body;
      if (!isValidDirectorPin(directorPin) && directorPin !== tournament.directorPin) {
        return res.status(403).json({ error: "Invalid director PIN" });
      }
      if (!Array.isArray(orderedIds)) return res.status(400).json({ error: "orderedIds must be an array" });
      await storage.reorderSponsors(tournament.id, orderedIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering sponsors:", error);
      res.status(500).json({ error: "Failed to reorder sponsors" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
