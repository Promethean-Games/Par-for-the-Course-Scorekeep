import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEventCheckoutSession, fetchPublicEvent, joinEventWaitlist } from "../services/publicEventApi";
import type { PublicTournamentEvent } from "../types/event";
import {
  ContactSection,
  EventInformationSection,
  FAQSection,
  GallerySection,
  HeroSection,
  PrizeInformationSection,
  RulesSection,
  ScheduleSection,
  SponsorsSection,
  StickyRegistrationFooter,
  TournamentFormatSection,
  VenueSection,
  VideoSection,
} from "../components/TournamentDetailsSections";

interface TournamentDetailsPageProps {
  slug: string;
}

/** Renders the public tournament details experience for a specific event slug. */
export function TournamentDetailsPage({ slug }: TournamentDetailsPageProps) {
  const [event, setEvent] = useState<PublicTournamentEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [isWaitlistSubmitting, setIsWaitlistSubmitting] = useState(false);
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = () => {
      fetchPublicEvent(slug)
        .then((data) => {
          if (!isMounted) return;
          setEvent(data);
          setError(null);
        })
        .catch((err: unknown) => {
          console.error("[TournamentDetailsPage] Failed to load event", err);
          if (!isMounted) return;
          setError("Could not load tournament details.");
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    };

    load();

    // Refetch when the user switches back to this tab so sponsor/event
    // changes made in the TD portal are immediately visible.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [slug]);

  const handleRegister = async () => {
    if (event && event.registrationStatus === "waitlist") {
      document.getElementById("waitlist-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (event && (event.registrationStatus === "closed" || event.registrationStatus === "in_progress")) {
      return;
    }
    setIsRegistering(true);
    try {
      const session = await createEventCheckoutSession(slug);
      window.location.assign(session.url);
    } catch (err) {
      console.error("[TournamentDetailsPage] Checkout start failed", err);
      setError(err instanceof Error ? err.message : "Could not start registration");
      setIsRegistering(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!event) return;
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
      console.error("[TournamentDetailsPage] Waitlist submit failed", err);
      setError(err instanceof Error ? err.message : "Could not join waitlist");
    } finally {
      setIsWaitlistSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading tournament details...</div>;
  }

  if (!event) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-destructive">{error || "Tournament not found"}</p>
        <Button variant="outline" onClick={() => window.location.assign("/")}>Return Home</Button>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-28">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <HeroSection event={event} onRegister={handleRegister} isRegistering={isRegistering} />
      {event.registrationStatus === "waitlist" && (
        <Card id="waitlist-card" className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">Join the Waitlist</h2>
          <p className="text-sm text-muted-foreground">
            Registration is currently full. Submit your info and we will contact you if a slot opens. Waitlist capacity is 10.
          </p>
          <div className="space-y-2">
            <Label htmlFor="waitlist-name">Name</Label>
            <Input id="waitlist-name" value={waitlistName} onChange={(e) => setWaitlistName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="waitlist-email">Email</Label>
            <Input id="waitlist-email" type="email" value={waitlistEmail} onChange={(e) => setWaitlistEmail(e.target.value)} />
          </div>
          {waitlistMessage && <p className="text-sm text-green-600">{waitlistMessage}</p>}
          <Button onClick={handleJoinWaitlist} disabled={isWaitlistSubmitting || !waitlistName.trim() || !waitlistEmail.trim()}>
            {isWaitlistSubmitting ? "Submitting..." : "Join Waitlist"}
          </Button>
        </Card>
      )}
      <EventInformationSection event={event} />
      <TournamentFormatSection event={event} />
      <PrizeInformationSection event={event} />
      <ScheduleSection event={event} />
      <VenueSection event={event} />
      <VideoSection event={event} />
      <SponsorsSection event={event} />
      <GallerySection event={event} />
      <FAQSection event={event} />
      <RulesSection event={event} />
      <ContactSection event={event} />
      <StickyRegistrationFooter event={event} onRegister={handleRegister} isRegistering={isRegistering} />
    </main>
  );
}

