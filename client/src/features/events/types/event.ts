export type RegistrationStatus =
  | "open"
  | "waitlist"
  | "closed"
  | "coming_soon"
  | "planned"
  | "in_progress";

export interface EventSummary {
  id: string;
  slug: string;
  name: string;
  venue: string;
  dateIso: string;
  bannerImageUrl?: string | null;
  registrationStatus: RegistrationStatus;
  currentRegisteredPlayers: number;
  maxPlayers: number;
  remainingSpots: number | null;
  waitlistCount?: number;
  detailsUrl?: string | null;
  registrationUrl: string;
}

export interface EventScheduleItem {
  label: string;
  timeIso: string;
}

export interface EventContact {
  directorName: string;
  email: string;
  phone: string;
}

export interface EventFaqItem {
  question: string;
  answer: string;
}

export interface PublicTournamentEvent extends EventSummary {
  roomCode: string;
  entryFee: number | null;
  entryFeeDetails?: string | null;
  youtubeVideoUrl?: string | null;
  maxPlayers: number;
  currentRegisteredPlayers: number;
  remainingSpots: number | null;
  waitlistCount: number;
  expectedDurationMinutes: number;
  checkInTimeIso: string;
  playerMeetingTimeIso: string;
  tournamentStartTimeIso: string;
  venueAddress: string;
  prizePool: number | null;
  payoutStructureNote: string;
  venueDescription: string;
  parkingInfo: string;
  foodAndDrinksInfo: string;
  accessibilityNotes: string;
  sponsors: Array<{ name: string; websiteUrl: string | null; logoUrl: string | null }>;
  galleryImages: string[];
  schedule: EventScheduleItem[];
  faq: EventFaqItem[];
  rules: string;
  contact: EventContact;
}

export interface CheckoutStatusResponse {
  status: "open" | "complete" | "expired";
  paymentStatus: "paid" | "unpaid" | "no_payment_required" | null;
  customerEmail: string | null;
  amountTotal: number | null;
  currency: string | null;
  sessionId: string;
}

