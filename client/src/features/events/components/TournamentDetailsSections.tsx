import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CalendarDays, Clock3, Trophy, Users, MapPin, Award, Phone, Mail, PlayCircle } from "lucide-react";
import { LOGO_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useEventCountdown } from "../hooks/useEventCountdown";
import type { PublicTournamentEvent, RegistrationStatus } from "../types/event";
import { formatCurrency, formatEventDateTime } from "../services/publicEventApi";

interface SectionProps {
  event: PublicTournamentEvent;
}

interface RegisterProps {
  onRegister: () => void;
  isRegistering: boolean;
}

function getStatusLabel(status: RegistrationStatus): string {
  switch (status) {
    case "open":
      return "Registration Open";
    case "planned":
      return "Upcoming";
    case "in_progress":
      return "In Progress";
    case "waitlist":
      return "Waitlist";
    case "closed":
      return "Closed";
    case "coming_soon":
      return "Coming Soon";
    default:
      return "Status Unknown";
  }
}

function getStatusClassName(status: RegistrationStatus): string {
  switch (status) {
    case "open":
      return "bg-green-600 text-white";
    case "planned":
      return "bg-blue-600 text-white";
    case "in_progress":
      return "bg-purple-600 text-white";
    case "waitlist":
      return "bg-amber-600 text-white";
    case "closed":
      return "bg-zinc-600 text-white";
    case "coming_soon":
      return "bg-sky-600 text-white";
    default:
      return "bg-muted";
  }
}

function formatCountdown(targetIso: string): string {
  const date = new Date(targetIso).getTime();
  const diffMs = date - Date.now();
  if (diffMs <= 0) return "Live now";
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function toYoutubeEmbedUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;

  const idMatch = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  if (idMatch?.[1]) {
    return `https://www.youtube.com/embed/${idMatch[1]}`;
  }

  if (/^[A-Za-z0-9_-]{11}$/.test(value)) {
    return `https://www.youtube.com/embed/${value}`;
  }

  return null;
}

export function HeroSection({ event, onRegister, isRegistering }: SectionProps & RegisterProps) {
  const countdown = useEventCountdown(event.dateIso);
  const isFull = (event.remainingSpots ?? 0) <= 0;
  const isWaitlist = event.registrationStatus === "waitlist";
  const isClosed = event.registrationStatus === "closed" || event.registrationStatus === "in_progress";

  return (
    <Card className="overflow-hidden" data-testid="card-tournament-details-hero">
      <img
        src={event.bannerImageUrl || LOGO_URL}
        alt={`${event.name} banner`}
        className="h-48 w-full object-cover bg-muted"
      />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn(getStatusClassName(event.registrationStatus))}>
            {getStatusLabel(event.registrationStatus)}
          </Badge>
          <span className="text-sm text-muted-foreground">{event.roomCode}</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold leading-tight">{event.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" /> {formatEventDateTime(event.dateIso)}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> {event.venue}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" /> {countdown ? formatCountdown(event.dateIso) : "Countdown loading..."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {event.currentRegisteredPlayers}/{event.maxPlayers ?? 24} registered | {event.remainingSpots ?? 0} open spots
          </p>
          {isWaitlist && (
            <p className="mt-1 text-sm text-amber-600">
              Registration is full. New entries will be added to the waitlist ({event.waitlistCount}/10).
            </p>
          )}
          {isClosed && isFull && (
            <p className="mt-1 text-sm text-muted-foreground">
              Registration is closed.
            </p>
          )}
        </div>

        <Button className="w-full" onClick={onRegister} disabled={isRegistering || isClosed}>
          {isRegistering ? "Redirecting..." : isClosed ? "Registration Closed" : isWaitlist ? "Join Waitlist" : "Register Now"}
        </Button>
      </div>
    </Card>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </Card>
  );
}

export function EventInformationSection({ event }: SectionProps) {
  return (
    <SectionCard title="Event Information" icon={<CalendarDays className="h-5 w-5" />}>
      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <p><strong>Date:</strong> {formatEventDateTime(event.dateIso)}</p>
        <p><strong>Check-in:</strong> {formatEventDateTime(event.checkInTimeIso)}</p>
        <p><strong>Player meeting:</strong> {formatEventDateTime(event.playerMeetingTimeIso)}</p>
        <p><strong>Tournament start:</strong> {formatEventDateTime(event.tournamentStartTimeIso)}</p>
        <p><strong>Venue:</strong> {event.venue}</p>
        <p><strong>Address:</strong> {event.venueAddress}</p>
      </div>
      <Button variant="outline" className="w-full" disabled>
        Google Maps (coming soon)
      </Button>
    </SectionCard>
  );
}

export function TournamentFormatSection({ event }: SectionProps) {
  return (
    <SectionCard title="Tournament Format" icon={<Trophy className="h-5 w-5" />}>
      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <p><strong>Format:</strong> {event.formatDescription}</p>
        <p><strong>Entry fee:</strong> {formatCurrency(event.entryFee)}</p>
        <p><strong>Entry fee details:</strong> {event.entryFeeDetails || "Details will be posted by the Tournament Director."}</p>
        <p><strong>Maximum players:</strong> {event.maxPlayers ?? "TBD"}</p>
        <p><strong>Current registered players:</strong> {event.currentRegisteredPlayers}</p>
        <p><strong>Remaining spots:</strong> {event.remainingSpots ?? "TBD"}</p>
        <p><strong>Expected duration:</strong> {Math.round(event.expectedDurationMinutes / 60)} hours</p>
      </div>
    </SectionCard>
  );
}

export function PrizeInformationSection({ event }: SectionProps) {
  return (
    <SectionCard title="Prize Information" icon={<Award className="h-5 w-5" />}>
      <div className="space-y-2 text-sm">
        <p><strong>Prize pool:</strong> {formatCurrency(event.prizePool)}</p>
        <p><strong>Payout structure:</strong> {event.payoutStructureNote}</p>
        <p><strong>Recognition:</strong> 1st place, 2nd place, 3rd place</p>
        <p><strong>Optional awards:</strong> Closest to Pin and special awards (coming soon)</p>
      </div>
    </SectionCard>
  );
}

export function ScheduleSection({ event }: SectionProps) {
  return (
    <SectionCard title="Schedule" icon={<Clock3 className="h-5 w-5" />}>
      <div className="space-y-2 text-sm">
        {event.schedule.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0">
            <span>{item.label}</span>
            <span className="text-muted-foreground">{formatEventDateTime(item.timeIso)}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function VenueSection({ event }: SectionProps) {
  return (
    <SectionCard title="Venue" icon={<MapPin className="h-5 w-5" />}>
      <div className="space-y-2 text-sm">
        <p>{event.venueDescription}</p>
        <p><strong>Parking:</strong> {event.parkingInfo}</p>
        <p><strong>Food & drinks:</strong> {event.foodAndDrinksInfo}</p>
        <p><strong>Accessibility:</strong> {event.accessibilityNotes}</p>
      </div>
    </SectionCard>
  );
}

export function VideoSection({ event }: SectionProps) {
  const embedUrl = toYoutubeEmbedUrl(event.youtubeVideoUrl);
  if (!embedUrl) return null;

  return (
    <SectionCard title="Event Video" icon={<PlayCircle className="h-5 w-5" />}>
      <div className="overflow-hidden rounded-md border">
        <iframe
          src={embedUrl}
          title={`${event.name} preview video`}
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </SectionCard>
  );
}

export function SponsorsSection({ event }: SectionProps) {
  if (!event.sponsors.length) return null;

  return (
    <SectionCard title="Sponsors" icon={<Users className="h-5 w-5" />}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {event.sponsors.map((sponsor) => (
          <Card key={sponsor.name} className="p-3 text-center text-sm">
            <div className="h-12 rounded bg-muted mb-2 flex items-center justify-center overflow-hidden">
              {sponsor.logoUrl ? <img src={sponsor.logoUrl} alt={`${sponsor.name} logo`} className="h-full w-full object-contain" /> : null}
            </div>
            <p className="font-medium">{sponsor.name}</p>
          </Card>
        ))}
      </div>
    </SectionCard>
  );
}

export function GallerySection({ event }: SectionProps) {
  if (!event.galleryImages.length) return null;

  return (
    <SectionCard title="Gallery">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {event.galleryImages.map((image, index) => (
          <div key={`${image}-${index}`} className="h-32 rounded-md bg-muted overflow-hidden">
            <img src={image} alt={`Tournament gallery placeholder ${index + 1}`} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function FAQSection({ event }: SectionProps) {
  if (!event.faq.length) return null;

  return (
    <SectionCard title="Frequently Asked Questions">
      <div className="space-y-3">
        {event.faq.map((item) => (
          <div key={item.question} className="rounded border p-3">
            <p className="font-medium text-sm">{item.question}</p>
            <p className="text-sm text-muted-foreground mt-1">{item.answer}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export function RulesSection({ event }: SectionProps) {
  return (
    <SectionCard title="Tournament Rules">
      <Accordion type="single" collapsible>
        <AccordionItem value="official-rules">
          <AccordionTrigger>View official rules</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground whitespace-pre-wrap">
            {event.rules}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </SectionCard>
  );
}

export function ContactSection({ event }: SectionProps) {
  return (
    <SectionCard title="Contact">
      <div className="space-y-2 text-sm">
        <p><strong>Tournament Director:</strong> {event.contact.directorName}</p>
        <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {event.contact.email}</p>
        <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {event.contact.phone}</p>
      </div>
    </SectionCard>
  );
}

export function StickyRegistrationFooter({ event, onRegister, isRegistering }: SectionProps & RegisterProps) {
  const isFull = (event.remainingSpots ?? 0) <= 0;
  const isWaitlist = event.registrationStatus === "waitlist";
  const isClosed = event.registrationStatus === "closed" || event.registrationStatus === "in_progress";

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 p-3">
        <div className="text-xs sm:text-sm">
          <p><strong>Date:</strong> {formatEventDateTime(event.dateIso)}</p>
          <p><strong>Entry Fee:</strong> {formatCurrency(event.entryFee)} | <strong>Registered:</strong> {event.currentRegisteredPlayers}/{event.maxPlayers ?? 24}</p>
          <p><strong>Open:</strong> {event.remainingSpots ?? "TBD"} {isFull ? "(waitlist active)" : ""}</p>
        </div>
        <Button onClick={onRegister} disabled={isRegistering || isClosed}>
          {isRegistering ? "Redirecting..." : isClosed ? "Registration Closed" : isWaitlist ? "Join Waitlist" : "Register Now"}
        </Button>
      </div>
    </div>
  );
}


