import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LOGO_URL } from "@/lib/constants";
import { CalendarDays, MapPin, Timer } from "lucide-react";
import { useFeaturedEvent } from "../hooks/useFeaturedEvent";
import { useEventCountdown } from "../hooks/useEventCountdown";
import type { EventSummary, RegistrationStatus } from "../types/event";

interface UpcomingEventCardProps {
  className?: string;
}

function getStatusLabel(status: RegistrationStatus): string {
  switch (status) {
    case "planned":      return "Upcoming";
    case "in_progress":  return "In Progress";
    case "open":         return "Registration Open";
    case "waitlist":     return "Waitlist";
    case "closed":       return "Closed";
    case "coming_soon":  return "Coming Soon";
    default:             return "Status Unknown";
  }
}

function getStatusClassName(status: RegistrationStatus): string {
  switch (status) {
    case "planned":      return "bg-blue-600 hover:bg-blue-600 text-white";
    case "in_progress":  return "bg-purple-600 hover:bg-purple-600 text-white";
    case "open":         return "bg-green-600 hover:bg-green-600 text-white";
    case "waitlist":     return "bg-amber-600 hover:bg-amber-600 text-white";
    case "closed":       return "bg-zinc-600 hover:bg-zinc-600 text-white";
    case "coming_soon":  return "bg-blue-600 hover:bg-blue-600 text-white";
    default:             return "";
  }
}

function formatEventDate(dateIso: string): string {
  return new Date(dateIso).toLocaleString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EventEntry({ event }: { event: EventSummary }) {
  const countdown = useEventCountdown(event.dateIso);

  const capacityText = `${event.currentRegisteredPlayers}/${event.maxPlayers} registered`;
  const remainingSpotsText = `${Math.max(0, event.remainingSpots ?? 0)} open spots`;
  const waitlistText = (event.remainingSpots ?? 0) <= 0
    ? `Waitlist active${event.waitlistCount ? ` (${event.waitlistCount})` : ""}`
    : null;

  const countdownText = countdown
    ? countdown.isComplete
      ? "Live now"
      : `${countdown.days}d ${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`
    : null;

  const canRegister = event.registrationStatus === "open" || event.registrationStatus === "planned";
  const canJoinWaitlist = event.registrationStatus === "waitlist";

  return (
    <Card className="w-full overflow-hidden" data-testid="card-upcoming-event">
      <img
        src={event.bannerImageUrl || LOGO_URL}
        alt={`${event.name} banner`}
        className="h-28 w-full object-cover bg-muted"
      />
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-tight">{event.name}</h3>
          <Badge className={cn("shrink-0 text-xs", getStatusClassName(event.registrationStatus))}>
            {getStatusLabel(event.registrationStatus)}
          </Badge>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {event.venue}
          </p>
          <p className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {formatEventDate(event.dateIso)}
          </p>
          {countdownText && (
            <p className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5 shrink-0" />
              {countdownText}
            </p>
          )}
          <p>{capacityText}</p>
          <p>{remainingSpotsText}</p>
          {waitlistText && <p className="text-amber-600">{waitlistText}</p>}
        </div>

        <div className="flex gap-2">
          {canRegister && (event.remainingSpots ?? 0) > 0 && (
            <Button
              className="flex-1"
              onClick={() => window.location.assign(`/events/${event.slug}/register`)}
              data-testid="button-register-now"
            >
              Register Now
            </Button>
          )}
          {canJoinWaitlist && (
            <Button
              className="flex-1"
              onClick={() => window.location.assign(`/events/${event.slug}`)}
              data-testid="button-join-waitlist"
            >
              Join Waitlist
            </Button>
          )}
          <Button
            variant={canRegister ? "outline" : "default"}
            className="flex-1"
            onClick={() => window.location.assign(`/events/${event.slug}`)}
            data-testid="button-see-tournament-details"
          >
            See Tournament Details
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function UpcomingEventCard({ className }: UpcomingEventCardProps) {
  const { event, isLoading } = useFeaturedEvent();

  if (isLoading) {
    return (
      <div className={cn("w-full max-w-md", className)}>
        <Card className="p-4 animate-pulse">
          <div className="h-28 rounded bg-muted mb-3" />
          <div className="h-4 bg-muted rounded w-3/4 mb-2" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </Card>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className={cn("w-full max-w-md", className)}>
      <EventEntry event={event} />
    </div>
  );
}

