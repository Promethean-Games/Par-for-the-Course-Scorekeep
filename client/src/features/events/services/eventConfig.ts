const DEFAULT_PORTAL_BASE_URL = "https://portal.parforthecourse.com";

export function getTournamentPortalBaseUrl(): string {
  const configured = import.meta.env.VITE_TOURNAMENT_PORTAL_BASE_URL as string | undefined;
  return (configured || DEFAULT_PORTAL_BASE_URL).replace(/\/$/, "");
}

export function buildEventDetailsUrl(slug: string): string {
  return `${getTournamentPortalBaseUrl()}/events/${slug}`;
}

