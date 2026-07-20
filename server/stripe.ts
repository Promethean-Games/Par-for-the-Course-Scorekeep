/**
 * Stripe Service Module
 *
 * Centralizes all Stripe SDK initialization and API interactions.
 * This module is BACKEND-ONLY. Never expose STRIPE_SECRET_KEY to the client.
 *
 * Uses Stripe's REST API directly (no npm package dependency) via the
 * application/x-www-form-urlencoded encoding that the Stripe API requires.
 */

import crypto from "crypto";

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured. Set this environment variable in Render.");
  }
  return key;
}

async function stripeRequest(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = payload?.error?.message || `Stripe API error (HTTP ${response.status})`;
    throw new Error(msg);
  }

  return payload;
}

export interface CreateCheckoutSessionOptions {
  /** Display name of the event shown on the Stripe-hosted page. */
  eventName: string;
  /** Entry fee in dollars. Required when stripePriceId is not set. */
  entryFee: number | null;
  /**
   * Pre-created Stripe Price ID (e.g. price_abc123).
   * When set, overrides dynamic price_data pricing.
   * Create prices in the Stripe Dashboard or via the Prices API.
   */
  stripePriceId: string | null;
  /** Stripe success_url — supports {CHECKOUT_SESSION_ID} template. */
  successUrl: string;
  /** Stripe cancel_url. */
  cancelUrl: string;
  /** Tournament room code stored in Stripe metadata for webhook reconciliation. */
  tournamentRoomCode: string;
  /** URL slug for the tournament event. */
  tournamentSlug: string;
  /** Human-readable tournament name stored in metadata. */
  tournamentName: string;
}

export interface CheckoutSessionResult {
  /** Stripe-hosted checkout URL to redirect the player to. */
  url: string;
  /** Stripe checkout session ID for status tracking. */
  sessionId: string;
}

/**
 * Creates a Stripe Checkout Session for a tournament entry.
 *
 * Pricing priority:
 *   1. stripePriceId — uses a pre-created Stripe Price (preferred, shows in Stripe analytics)
 *   2. entryFee     — creates a one-off price on-the-fly via price_data
 */
export async function createCheckoutSession(
  options: CreateCheckoutSessionOptions,
): Promise<CheckoutSessionResult> {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", options.successUrl);
  body.set("cancel_url", options.cancelUrl);
  body.set("metadata[tournamentRoomCode]", options.tournamentRoomCode);
  body.set("metadata[tournamentSlug]", options.tournamentSlug);
  body.set("metadata[tournamentName]", options.tournamentName);

  if (options.stripePriceId && options.stripePriceId.trim()) {
    // ── Pre-configured Price ID (preferred) ──────────────────────────────────
    body.set("line_items[0][price]", options.stripePriceId.trim());
    body.set("line_items[0][quantity]", "1");
  } else if (options.entryFee != null && options.entryFee > 0) {
    // ── Dynamic price_data from entry fee ─────────────────────────────────────
    const unitAmount = String(Math.round(options.entryFee * 100));
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][product_data][name]", `${options.eventName} – Tournament Entry`);
    body.set("line_items[0][price_data][unit_amount]", unitAmount);
    body.set("line_items[0][quantity]", "1");
  } else {
    throw new Error(
      "Cannot create checkout session: event has no Stripe Price ID and no entry fee configured.",
    );
  }

  const session = await stripeRequest("/checkout/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!session?.url) {
    throw new Error("Stripe did not return a checkout URL. Check your Stripe account configuration.");
  }

  return { url: session.url, sessionId: session.id };
}

/**
 * Retrieves an existing Stripe Checkout Session by ID.
 * Used on the success page to confirm payment status.
 */
export async function retrieveCheckoutSession(sessionId: string): Promise<any> {
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

/**
 * Returns true if the raw webhook signature header matches the secret.
 * Stripe sends a `stripe-signature` header with a HMAC-SHA256 digest.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
): boolean {
  const parts = signatureHeader.split(",").map((p) => p.trim());
  const timestampPart = parts.find((p) => p.startsWith("t="));
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));

  if (!timestampPart || signatures.length === 0) return false;

  const timestamp = timestampPart.slice(2);
  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  return signatures.some((candidate) => {
    try {
      const a = Buffer.from(candidate, "hex");
      const b = Buffer.from(expected, "hex");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}



