import type { CheckoutStatusResponse, PublicTournamentEvent } from "../types/event";

/** Fetches public tournament details for a given event slug. */
export async function fetchPublicEvent(slug: string): Promise<PublicTournamentEvent> {
  const response = await fetch(`/api/public/events/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || "Could not load tournament details");
  }
  return response.json();
}

/** Creates a Stripe Checkout Session for an event and returns the hosted checkout URL. */
export async function createEventCheckoutSession(slug: string): Promise<{ url: string }> {
  const response = await fetch(`/api/public/events/${encodeURIComponent(slug)}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || "Could not start checkout");
  }

  return response.json();
}

/** Adds a player to the public waitlist when registration capacity is full. */
export async function joinEventWaitlist(slug: string, payload: { name: string; email: string }): Promise<{ waitlistCount: number }> {
  const response = await fetch(`/api/public/events/${encodeURIComponent(slug)}/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || "Could not join waitlist");
  }

  return response.json();
}

/** Retrieves Stripe Checkout status for the success page confirmation UI. */
export async function fetchCheckoutStatus(slug: string, sessionId: string): Promise<CheckoutStatusResponse> {
  const response = await fetch(
    `/api/public/events/${encodeURIComponent(slug)}/checkout-status?session_id=${encodeURIComponent(sessionId)}`,
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || "Could not verify payment status");
  }

  return response.json();
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || Number.isNaN(amount)) {
    return "TBD";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function formatEventDateTime(dateIso: string): string {
  return new Date(dateIso).toLocaleString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

