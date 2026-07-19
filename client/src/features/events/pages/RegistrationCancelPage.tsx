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
        <h1 className="text-xl font-semibold">Registration Canceled</h1>
        <p className="text-sm text-muted-foreground">
          No payment was taken. You can return to tournament details and register again at any time.
        </p>

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

