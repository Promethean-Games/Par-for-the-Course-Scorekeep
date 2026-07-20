import { AlertCircle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface GoogleMapsEmbedProps {
  mapUrl: string | null | undefined;
  fallbackQuery?: string | null | undefined;
  title?: string;
  height?: string;
}

/**
 * Converts a regular Google Maps share URL into an embeddable iframe src.
 *
 * Supported input formats:
 *   - Already an embed URL  (https://www.google.com/maps/embed?pb=...)
 *   - maps.google.com/maps?q=...
 *   - www.google.com/maps?q=...
 *   - www.google.com/maps/place/NAME/@LAT,LNG,ZOOMz/...
 *   - Browser URLs with q/query/search terms
 *
 * Returns null when the input is empty or unrecognizable.
 */
function buildEmbedFromQuery(query: string | null | undefined): string | null {
  const value = query?.trim();
  if (!value) return null;
  // Use the search query format with output=embed which is more reliably supported
  return `https://maps.google.com/maps?q=${encodeURIComponent(value)}&output=embed`;
}

function buildOpenMapsUrl(query: string | null | undefined): string | null {
  const value = query?.trim();
  if (!value) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
}

function toEmbedUrl(input: string | null | undefined, fallbackQuery?: string | null | undefined): string | null {
  if (!input?.trim()) return buildEmbedFromQuery(fallbackQuery);

  const rawUrl = input.trim();

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    if (host === "maps.app.goo.gl" || host === "goo.gl") {
      return buildEmbedFromQuery(fallbackQuery);
    }

    if (host.includes("google.com") || host === "maps.google.com") {
      if (pathname.includes("/maps/embed")) {
        return parsed.toString();
      }

      const q = parsed.searchParams.get("q")
        || parsed.searchParams.get("query")
        || parsed.searchParams.get("destination")
        || parsed.searchParams.get("near");
      if (q) {
        return buildEmbedFromQuery(q);
      }

      const coordMatch = rawUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (coordMatch) {
        return buildEmbedFromQuery(`${coordMatch[1]},${coordMatch[2]}`);
      }

      const placeMatch = rawUrl.match(/\/maps\/place\/([^/?#]+)/);
      if (placeMatch?.[1]) {
        const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
        return buildEmbedFromQuery(placeName);
      }
    }
  } catch {
    // If it's not a valid URL, fall back to address-based embed.
  }

  return buildEmbedFromQuery(fallbackQuery);
}

function toOpenMapsUrl(input: string | null | undefined, fallbackQuery?: string | null | undefined): string | null {
  const rawUrl = input?.trim();
  if (rawUrl) {
    return rawUrl;
  }
  return buildOpenMapsUrl(fallbackQuery);
}

export function GoogleMapsEmbed({ mapUrl, fallbackQuery, title, height = "300px" }: GoogleMapsEmbedProps) {
  const embedSrc = toEmbedUrl(mapUrl, fallbackQuery);
  const openMapUrl = toOpenMapsUrl(mapUrl, fallbackQuery);

  if (!embedSrc) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No embeddable map could be generated. Add a venue address or paste a full Google Maps browser URL.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="w-full overflow-hidden rounded-md border">
        <iframe
          title={title || "Venue Map"}
          src={embedSrc}
          style={{ width: "100%", height, border: "none" }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      {openMapUrl ? (
        <Button asChild variant="outline" size="sm">
          <a href={openMapUrl} target="_blank" rel="noreferrer noopener">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open in Google Maps
          </a>
        </Button>
      ) : null}
    </div>
  );
}

