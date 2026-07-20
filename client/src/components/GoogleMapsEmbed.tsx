import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GoogleMapsEmbedProps {
  mapUrl: string | null | undefined;
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
 *   - maps.app.goo.gl short links (returned as-is; browser will follow redirect)
 *
 * Returns null when the input is empty or unrecognizable.
 */
function toEmbedUrl(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const url = input.trim();

  // Already an embed URL — use directly
  if (url.includes("google.com/maps/embed")) return url;

  // Already has output=embed — use directly
  if (url.includes("output=embed")) return url;

  // maps.google.com/maps?q=... or google.com/maps?q=...
  if (/(?:maps\.)?google\.com\/maps\?/.test(url)) {
    return url.includes("output=embed") ? url : url + (url.includes("?") ? "&" : "?") + "output=embed";
  }

  // google.com/maps/place/NAME/@LAT,LNG,ZOOMz/...
  const placeMatch = url.match(/google\.com\/maps\/place\/([^/@?]+)/);
  if (placeMatch) {
    const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+)/);
    if (coordMatch) {
      return `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[2]}&output=embed`;
    }
    const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    return `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&output=embed`;
  }

  // Short links (goo.gl / maps.app.goo.gl) — pass through; browser will follow redirect
  if (/goo\.gl\/|maps\.app\.goo\.gl/.test(url)) return url;

  return null;
}

export function GoogleMapsEmbed({ mapUrl, title, height = "300px" }: GoogleMapsEmbedProps) {
  const embedSrc = toEmbedUrl(mapUrl);

  if (!embedSrc) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No map link provided. Paste a Google Maps URL in the venue settings.
        </AlertDescription>
      </Alert>
    );
  }

  return (
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
  );
}

