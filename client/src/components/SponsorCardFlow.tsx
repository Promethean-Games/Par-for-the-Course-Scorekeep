import { useState } from "react";
import { SponsorCard } from "./SponsorCard";

interface Sponsor {
  id: number;
  sponsorName: string;
  donationType?: string | null;
  blurb?: string | null;
  logoUrl?: string | null;
}

interface SponsorCardFlowProps {
  sponsors: Sponsor[];
  onComplete: () => void;
}

export function SponsorCardFlow({ sponsors, onComplete }: SponsorCardFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const handleNext = () => {
    if (currentIndex < sponsors.length - 1) {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setVisible(true);
      }, 200);
    } else {
      setVisible(false);
      setTimeout(onComplete, 200);
    }
  };

  const sponsor = sponsors[currentIndex];
  if (!sponsor) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-background flex flex-col"
      data-testid="sponsor-card-flow"
    >
      <div
        className="flex-1 flex flex-col transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <SponsorCard
          sponsorName={sponsor.sponsorName}
          donationType={sponsor.donationType}
          blurb={sponsor.blurb}
          logoUrl={sponsor.logoUrl}
          cardIndex={currentIndex}
          totalCards={sponsors.length}
          onNext={handleNext}
        />
      </div>
    </div>
  );
}
