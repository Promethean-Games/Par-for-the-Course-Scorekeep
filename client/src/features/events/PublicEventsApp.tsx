import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { RegistrationCancelPage } from "./pages/RegistrationCancelPage";
import { RegistrationSuccessPage } from "./pages/RegistrationSuccessPage";
import { TournamentDetailsPage } from "./pages/TournamentDetailsPage";
import { TournamentRegistrationPage } from "./pages/TournamentRegistrationPage";

type PublicRoute =
  | { kind: "details"; slug: string }
  | { kind: "register"; slug: string }
  | { kind: "success"; slug: string }
  | { kind: "cancel"; slug: string }
  | { kind: "notFound" };

function parseRoute(pathname: string): PublicRoute {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const parts = clean.split("/").filter(Boolean);

  if (parts.length >= 2 && parts[0] === "events") {
    const slug = parts[1];

    if (parts.length === 2) {
      return { kind: "details", slug };
    }

    if (parts.length === 3 && parts[2] === "register") {
      return { kind: "register", slug };
    }

    if (parts.length === 4 && parts[2] === "register" && parts[3] === "success") {
      return { kind: "success", slug };
    }

    if (parts.length === 4 && parts[2] === "register" && parts[3] === "cancel") {
      return { kind: "cancel", slug };
    }
  }

  return { kind: "notFound" };
}

/** Public route shell for tournament details and Stripe registration pages. */
export function PublicEventsApp() {
  const route = parseRoute(window.location.pathname);

  let body: JSX.Element;

  switch (route.kind) {
    case "details":
      body = <TournamentDetailsPage slug={route.slug} />;
      break;
    case "register":
      body = <TournamentRegistrationPage slug={route.slug} />;
      break;
    case "success":
      body = <RegistrationSuccessPage slug={route.slug} />;
      break;
    case "cancel":
      body = <RegistrationCancelPage slug={route.slug} />;
      break;
    default:
      body = (
        <main className="mx-auto max-w-xl p-4">
          <p className="text-sm text-destructive mb-3">Tournament page not found.</p>
          <Button variant="outline" onClick={() => window.location.assign("/")}>Return Home</Button>
        </main>
      );
  }

  return (
    <TooltipProvider>
      <ThemeProvider>
        {body}
        <Toaster />
      </ThemeProvider>
    </TooltipProvider>
  );
}

