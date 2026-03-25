import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HOLE_PARS } from "@/lib/constants";
import drawImage from "@assets/draw-image.png";

interface DrawDialogProps {
  onSelectPar: (par: number) => void;
  onSelectStartingHole?: (hole: number) => void;
  currentHole: number;
  isFirstDraw?: boolean;
  isTournament?: boolean;
}

export function DrawDialog({
  onSelectPar,
  onSelectStartingHole,
  currentHole,
  isFirstDraw = false,
  isTournament = false,
}: DrawDialogProps) {
  const showHoleStep = isFirstDraw && !isTournament;
  const [step, setStep] = useState<"hole" | "draw">(showHoleStep ? "hole" : "draw");
  const [selectedHole, setSelectedHole] = useState<number | null>(null);

  const handleConfirmHole = () => {
    if (!selectedHole) return;
    setStep("draw");
  };

  const handleBegin = () => {
    const hole = showHoleStep && selectedHole ? selectedHole : currentHole;
    if (showHoleStep && selectedHole) onSelectStartingHole?.(selectedHole);
    onSelectPar(HOLE_PARS[hole - 1]);
  };

  if (step === "hole") {
    return (
      <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold" data-testid="text-which-hole">
              Which hole are you starting on?
            </h1>
            <p className="text-muted-foreground text-sm">
              Select your group's starting hole for round-robin play
            </p>
          </div>

          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => (
              <button
                key={hole}
                className={cn(
                  "h-14 rounded-lg text-xl font-bold border-2 transition-all",
                  selectedHole === hole
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 bg-muted/50"
                )}
                onClick={() => setSelectedHole(hole)}
                data-testid={`button-hole-${hole}`}
              >
                {hole}
              </button>
            ))}
          </div>

          {selectedHole && (
            <p className="text-sm text-muted-foreground" data-testid="text-hole-par-preview">
              Hole {selectedHole} · Par {HOLE_PARS[selectedHole - 1]}
            </p>
          )}

          <Button
            className="w-full h-14 text-lg"
            onClick={handleConfirmHole}
            disabled={!selectedHole}
            data-testid="button-confirm-hole"
          >
            Next: Draw a Card
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-8">
        {isFirstDraw ? (
          <>
            <div className="space-y-2">
              <p className="text-muted-foreground text-lg" data-testid="text-first-draw-tip">
                To begin, the tallest player draws a card at random.
              </p>
              <a
                href="https://www.thegamecrafter.com/games/par-for-the-course-classic"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline text-sm"
                data-testid="link-buy-cards"
              >
                I don't have cards yet.
              </a>
            </div>
            <img
              src={drawImage}
              alt="DRAW!"
              className="w-full max-w-sm mx-auto rounded-lg"
              data-testid="img-draw-first"
            />
          </>
        ) : (
          <div className="space-y-2">
            <h1 className="text-8xl font-extrabold" data-testid="text-draw">DRAW!</h1>
            <p className="text-muted-foreground text-lg" data-testid="text-lowest-score-tip">
              The player with the lowest score draws first.
            </p>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-sm text-muted-foreground" data-testid="text-hole-info">
            Hole {showHoleStep && selectedHole ? selectedHole : currentHole}
          </p>
          <p className="text-2xl font-bold" data-testid="text-auto-par">
            Par {HOLE_PARS[(showHoleStep && selectedHole ? selectedHole : currentHole) - 1]}
          </p>
        </div>

        <Button
          className="w-full h-14 text-lg"
          onClick={handleBegin}
          data-testid="button-confirm-draw"
        >
          {isFirstDraw ? "Begin Game" : "Begin Hole"}
        </Button>
      </div>
    </div>
  );
}
