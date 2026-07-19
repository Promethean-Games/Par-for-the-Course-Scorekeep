import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEventCheckoutSession, fetchPublicEvent, formatCurrency, formatEventDateTime, joinEventWaitlist } from "../services/publicEventApi";
import type { PublicTournamentEvent } from "../types/event";

interface TournamentRegistrationPageProps {
  slug: string;
}

/** Starts Stripe checkout for a tournament and redirects users to Stripe-hosted checkout. */
export function TournamentRegistrationPage({ slug }: TournamentRegistrationPageProps) {
  const startedRef = useRef(false);
  const [event, setEvent] = useState<PublicTournamentEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [isWaitlistSubmitting, setIsWaitlistSubmitting] = useState(false);
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);

  const startCheckout = async () => {
    setIsRedirecting(true);
    setError(null);
    try {
      if (event && (event.registrationStatus === "waitlist" || event.registrationStatus === "closed" || event.registrationStatus === "in_progress")) {
        setIsRedirecting(false);
        return;
      }
      const session = await createEventCheckoutSession(slug);
      window.location.assign(session.url);
    } catch (err) {
      console.error("[TournamentRegistrationPage] Checkout start failed", err);
      setError(err instanceof Error ? err.message : "Could not start registration");
      setIsRedirecting(false);
    }
  };

  useEffect(() => {
    fetchPublicEvent(slug)
      .then(setEvent)
      .catch((err: unknown) => {
        console.error("[TournamentRegistrationPage] Failed to load event", err);
      });
  }, [slug]);

  useEffect(() => {
    if (!event) {
      return;
    }
    if (event && (event.registrationStatus === "waitlist" || event.registrationStatus === "closed" || event.registrationStatus === "in_progress")) {
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    startCheckout();
  }, [event]);

  const handleWaitlistJoin = async () => {
    setIsWaitlistSubmitting(true);
    setError(null);
    setWaitlistMessage(null);
    try {
      const result = await joinEventWaitlist(slug, { name: waitlistName, email: waitlistEmail });
      setWaitlistMessage(`You're on the waitlist. Current waitlist count: ${result.waitlistCount}`);
      const refreshed = await fetchPublicEvent(slug);
      setEvent(refreshed);
      setWaitlistName("");
      setWaitlistEmail("");
    } catch (err) {
      console.error("[TournamentRegistrationPage] Waitlist join failed", err);
      setError(err instanceof Error ? err.message : "Could not join waitlist");
    } finally {
      setIsWaitlistSubmitting(false);
    }
  };

  const pageTitle = event?.registrationStatus === "waitlist"
    ? "Tournament Waitlist"
    : event?.registrationStatus === "closed" || event?.registrationStatus === "in_progress"
      ? "Registration Closed"
      : "Redirecting to secure registration";

  const pageDescription = event?.registrationStatus === "waitlist"
    ? "Registration is full. Join the waitlist below and we will reach out if a spot opens."
    : event?.registrationStatus === "closed" || event?.registrationStatus === "in_progress"
      ? "This tournament is not currently accepting online registrations."
      : "We are preparing your Stripe Checkout session now.";

  return (
    <main className="mx-auto max-w-xl p-4">
      <Card className="space-y-4 p-5">
        <h1 className="text-xl font-semibold">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{pageDescription}</p>

        {event && (
          <div className="rounded border p-3 text-sm space-y-1">
            <p><strong>{event.name}</strong></p>
            <p>{formatEventDateTime(event.dateIso)}</p>
            <p>{event.venue}</p>
            <p>Entry Fee: {formatCurrency(event.entryFee)}</p>
            <p>Registered: {event.currentRegisteredPlayers}/{event.maxPlayers ?? 24}</p>
          </div>
        )}

        {event && event.registrationStatus === "waitlist" && (
          <div className="space-y-3 rounded border p-3">
            <p className="text-sm text-amber-600">
              Registration is full. Submit your info to join the waitlist (max 10).
            </p>
            <div className="space-y-2">
              <Label htmlFor="waitlist-register-name">Name</Label>
              <Input id="waitlist-register-name" value={waitlistName} onChange={(e) => setWaitlistName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waitlist-register-email">Email</Label>
              <Input id="waitlist-register-email" type="email" value={waitlistEmail} onChange={(e) => setWaitlistEmail(e.target.value)} />
            </div>
            {waitlistMessage && <p className="text-sm text-green-600">{waitlistMessage}</p>}
            <Button onClick={handleWaitlistJoin} disabled={isWaitlistSubmitting || !waitlistName.trim() || !waitlistEmail.trim()}>
              {isWaitlistSubmitting ? "Submitting..." : "Join Waitlist"}
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => window.location.assign(`/events/${slug}`)}>
            Back to Details
          </Button>
          <Button className="flex-1" onClick={startCheckout} disabled={isRedirecting || event?.registrationStatus === "closed" || event?.registrationStatus === "in_progress"}>
            {isRedirecting ? "Redirecting..." : event?.registrationStatus === "waitlist" ? "Join Waitlist Above" : event?.registrationStatus === "closed" || event?.registrationStatus === "in_progress" ? "Registration Closed" : "Try Again"}
          </Button>
        </div>
      </Card>
    </main>
  );
}

