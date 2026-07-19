import { useEffect, useState } from "react";
import { eventService } from "../services/eventService";
import type { EventSummary } from "../types/event";

export function useFeaturedEvent() {
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    eventService
      .getFeaturedEvent()
      .then((nextEvent) => {
        if (!mounted) return;
        setEvent(nextEvent);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        console.error("[useFeaturedEvent] Failed to load event:", err);
        setError("Could not load event");
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { event, isLoading, error };
}

