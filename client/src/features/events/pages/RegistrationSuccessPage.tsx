import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchCheckoutStatus, fetchPublicEvent, formatCurrency, formatEventDateTime } from "../services/publicEventApi";
import type { CheckoutStatusResponse, PublicTournamentEvent } from "../types/event";

interface RegistrationSuccessPageProps {
  slug: string;
}

/** Displays post-checkout confirmation details for successful tournament registration. */
export function RegistrationSuccessPage({ slug }: RegistrationSuccessPageProps) {
  const [event, setEvent] = useState<PublicTournamentEvent | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sessionId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("session_id") || "";
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetchPublicEvent(slug).catch((err: unknown) => {
        console.error("[RegistrationSuccessPage] Failed to load event", err);
        return null;
      }),
      sessionId
        ? fetchCheckoutStatus(slug, sessionId).catch((err: unknown) => {
            console.error("[RegistrationSuccessPage] Failed to verify checkout", err);
            if (mounted) setError(err instanceof Error ? err.message : "Could not verify payment status");
            return null;
          })
        : Promise.resolve(null),
    ]).then(([eventData, statusData]) => {
      if (!mounted) return;
      if (eventData) setEvent(eventData);
      if (statusData) setCheckoutStatus(statusData as CheckoutStatusResponse);
      if (!sessionId) setError("Missing Stripe session ID. Payment confirmation may be incomplete.");
      setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [sessionId, slug]);

  const isPaid = checkoutStatus?.paymentStatus === "paid";

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl p-4">
        <Card className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">Confirming your registration…</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <Card className="space-y-4 p-5">
        {/* Status header */}
        <div className="flex items-start gap-3">
          {isPaid ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-xl">
              ✓
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 text-xl">
              ⏳
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {isPaid ? "Registration Confirmed!" : "Registration Received"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isPaid
                ? "Your payment has been processed. You are officially registered."
                : "Your registration is being processed. Payment confirmation may take a moment."}
            </p>
          </div>
        </div>

        {/* Event + payment details */}
        <div className="space-y-2 rounded border p-3 text-sm">
          <p><strong>Tournament:</strong> {event?.name || "Loading…"}</p>
          <p><strong>Date:</strong> {event ? formatEventDateTime(event.dateIso) : "Loading…"}</p>
          <p><strong>Venue:</strong> {event?.venue || "Loading…"}</p>
          <p>
            <strong>Payment status:</strong>{" "}
            {checkoutStatus ? (
              <Badge variant={isPaid ? "default" : "secondary"}>
                {isPaid ? "Paid ✓" : checkoutStatus.paymentStatus || "Pending"}
              </Badge>
            ) : (
              "Verifying…"
            )}
          </p>
          {checkoutStatus?.amountTotal != null && (
            <p><strong>Amount charged:</strong> {formatCurrency((checkoutStatus.amountTotal) / 100)}</p>
          )}
          {checkoutStatus?.customerEmail && (
            <p><strong>Confirmation sent to:</strong> {checkoutStatus.customerEmail}</p>
          )}
          {checkoutStatus?.sessionId && (
            <p className="text-xs text-muted-foreground"><strong>Confirmation ID:</strong> {checkoutStatus.sessionId}</p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* What's next */}
        <Card className="p-4 space-y-2 bg-muted/40">
          <p className="font-medium text-sm">What's next</p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Check-in opens 45 minutes before tee time</li>
            <li>Player meeting begins 15 minutes before tee time</li>
            {event?.venueAddress && <li>Venue: {event.venueAddress}</li>}
            <li>Questions? Contact the Tournament Director</li>
          </ul>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => window.location.assign(`/events/${slug}`)}>
            Back to Tournament Details
          </Button>
          <Button className="flex-1" onClick={() => window.location.assign("/")}>Return Home</Button>
        </div>
      </Card>
    </main>
  );
}
