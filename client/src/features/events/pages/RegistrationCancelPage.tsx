import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface RegistrationCancelPageProps {
  slug: string;
}

/** Displays cancellation feedback when a Stripe checkout session is canceled. */
export function RegistrationCancelPage({ slug }: RegistrationCancelPageProps) {
  return (
    <main className="mx-auto max-w-xl p-4">
      <Card className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xl">
            ×
          </div>
          <div>
            <h1 className="text-xl font-semibold">Registration Canceled</h1>
            <p className="text-sm text-muted-foreground mt-1">
              No payment was taken. Your spot has not been reserved.
            </p>
          </div>
        </div>

        <div className="rounded border p-3 text-sm text-muted-foreground space-y-1">
          <p>You can return to the tournament details page and try again at any time.</p>
          <p>If you experienced a problem during checkout, please contact the Tournament Director.</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => window.location.assign(`/events/${slug}`)}>
            Back to Details
          </Button>
          <Button className="flex-1" onClick={() => window.location.assign(`/events/${slug}/register`)}>
            Try Registration Again
          </Button>
        </div>
      </Card>
    </main>
  );
}
