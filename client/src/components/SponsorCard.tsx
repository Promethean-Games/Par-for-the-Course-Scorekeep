import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface SponsorCardProps {
  sponsorName: string;
  donationType?: string | null;
  blurb?: string | null;
  logoUrl?: string | null;
  cardIndex: number;
  totalCards: number;
  onNext: () => void;
  countdownSeconds?: number;
}

export function SponsorCard({
  sponsorName,
  donationType,
  blurb,
  logoUrl,
  cardIndex,
  totalCards,
  onNext,
  countdownSeconds = 5,
}: SponsorCardProps) {
  const [countdown, setCountdown] = useState(countdownSeconds);

  useEffect(() => {
    setCountdown(countdownSeconds);
  }, [cardIndex, countdownSeconds]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const isLast = cardIndex === totalCards - 1;
  const canProceed = countdown <= 0;

  return (
    <div className="flex flex-col items-center justify-between h-full px-6 py-8 text-center">
      {/* Progress */}
      <div className="w-full flex items-center justify-between mb-6">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Our Sponsors
        </span>
        <span className="text-xs text-muted-foreground">
          {cardIndex + 1} of {totalCards}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: totalCards }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === cardIndex ? "w-6 bg-primary" : i < cardIndex ? "w-3 bg-primary/40" : "w-3 bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Logo */}
      <div className="flex-1 flex items-center justify-center w-full mb-6">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${sponsorName} logo`}
            className="max-h-48 max-w-full object-contain rounded-md"
            data-testid={`sponsor-logo-${cardIndex}`}
          />
        ) : (
          <div className="w-40 h-40 rounded-xl bg-muted flex items-center justify-center">
            <span className="text-4xl font-bold text-muted-foreground/40">
              {sponsorName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Sponsor info */}
      <div className="space-y-3 mb-8 w-full">
        {donationType && (
          <Badge variant="secondary" className="text-xs" data-testid={`sponsor-type-${cardIndex}`}>
            {donationType}
          </Badge>
        )}
        <h2
          className="text-2xl font-bold leading-tight"
          data-testid={`sponsor-name-${cardIndex}`}
        >
          {sponsorName}
        </h2>
        {blurb && (
          <p
            className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto"
            data-testid={`sponsor-blurb-${cardIndex}`}
          >
            {blurb}
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm">
        <p className="text-xs text-muted-foreground mb-3">
          Thank you to our sponsors for supporting this tournament!
        </p>
        <Button
          className="w-full gap-2"
          disabled={!canProceed}
          onClick={onNext}
          data-testid={`button-sponsor-next-${cardIndex}`}
        >
          {isLast ? "Start Playing" : "Next"}
          {canProceed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="ml-1 tabular-nums text-sm opacity-70">({countdown})</span>
          )}
        </Button>
      </div>
    </div>
  );
}
