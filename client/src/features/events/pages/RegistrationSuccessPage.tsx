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

  const sessionId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("session_id") || "";
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchPublicEvent(slug)
      .then((data) => {
        if (!mounted) return;
        setEvent(data);
      })
      .catch((err: unknown) => {
        console.error("[RegistrationSuccessPage] Failed to load event", err);
      });

    if (!sessionId) {
      setError("Missing Stripe session ID. Payment confirmation may be incomplete.");
      return () => {
        mounted = false;
      };
    }

    fetchCheckoutStatus(slug, sessionId)
      .then((status) => {
        if (!mounted) return;
        setCheckoutStatus(status);
      })
      .catch((err: unknown) => {
        console.error("[RegistrationSuccessPage] Failed to verify checkout", err);
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Could not verify payment status");
      });

    return () => {
      mounted = false;
    };
  }, [sessionId, slug]);

  const isPaid = checkoutStatus?.paymentStatus === "paid";

  return (
    <main className="mx-auto max-w-2xl p-4">
      <Card className="space-y-4 p-5">
        <h1 className="text-2xl font-bold">Registration Successful</h1>
        <p className="text-sm text-muted-foreground">
          Thank you for registering. Your payment and registration details are confirmed below.
        </p>

        <div className="space-y-2 rounded border p-3 text-sm">
          <p><strong>Tournament:</strong> {event?.name || "Loading..."}</p>
          <p><strong>Date:</strong> {event ? formatEventDateTime(event.dateIso) : "Loading..."}</p>
          <p><strong>Venue:</strong> {event?.venue || "Loading..."}</p>
          <p>
            <strong>Payment confirmation:</strong>{" "}
            {checkoutStatus ? (
              <Badge variant={isPaid ? "default" : "secondary"}>{isPaid ? "Paid" : checkoutStatus.paymentStatus || "Pending"}</Badge>
            ) : (
              "Verifying..."
            )}
          </p>
          {checkoutStatus?.amountTotal !== null && (
            <p><strong>Amount:</strong> {formatCurrency((checkoutStatus?.amountTotal || 0) / 100)}</p>
          )}
          {checkoutStatus?.customerEmail && <p><strong>Email:</strong> {checkoutStatus.customerEmail}</p>}
          {checkoutStatus?.sessionId && <p><strong>Confirmation ID:</strong> {checkoutStatus.sessionId}</p>}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Card className="p-4 space-y-2 bg-muted/40">
          <p className="font-medium text-sm">Coming soon</p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Confirmation email</li>
            <li>QR code check-in pass</li>
            <li>Calendar download</li>
            <li>Player account linkage</li>
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

