import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import drawImage from "@assets/draw-image.png";

interface DrawDialogProps {
  onSelectPar: (par: number) => void;
  onSelectStartingHole?: (hole: number) => void;
  isFirstDraw?: boolean;
  isTournament?: boolean;
}

export function DrawDialog({ onSelectPar, onSelectStartingHole, isFirstDraw = false, isTournament = false }: DrawDialogProps) {
  const showHoleStep = isFirstDraw && !isTournament;
  const [step, setStep] = useState<"hole" | "par">(showHoleStep ? "hole" : "par");
  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [selectedPar, setSelectedPar] = useState<number | null>(null);

  const handleConfirmHole = () => {
    if (selectedHole) setStep("par");
  };

  const handleConfirm = () => {
    if (!selectedPar) return;
    if (showHoleStep && selectedHole) onSelectStartingHole?.(selectedHole);
    onSelectPar(selectedPar);
  };

  if (step === "hole") {
    return (
      <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold" data-testid="text-which-hole">Which hole are you starting on?</h1>
            <p className="text-muted-foreground text-sm">Select your group's starting hole for round-robin play</p>
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

          <Button
            className="w-full h-14 text-lg"
            onClick={handleConfirmHole}
            disabled={!selectedHole}
            data-testid="button-confirm-hole"
          >
            Next: Select Par
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-8">
        {isFirstDraw && (
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
        )}

        {isFirstDraw ? (
          <img
            src={drawImage}
            alt="DRAW!"
            className="w-full max-w-sm mx-auto rounded-lg"
            data-testid="img-draw-first"
          />
        ) : (
          <div className="space-y-2">
            <h1 className="text-8xl font-extrabold" data-testid="text-draw">DRAW!</h1>
            <p className="text-muted-foreground text-lg" data-testid="text-lowest-score-tip">
              Select par for the next course. (The player with the lowest score plays first)
            </p>
          </div>
        )}

        {showHoleStep && selectedHole && (
          <p className="text-sm font-medium text-muted-foreground" data-testid="text-selected-hole">
            Starting from hole {selectedHole}
          </p>
        )}

        <div className="space-y-4">
          <label className="text-xl font-semibold block">
            Select Par for This Hole
          </label>
          {isTournament ? (
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((par) => (
                <button
                  key={par}
                  className={cn(
                    "h-20 rounded-lg text-3xl font-bold border-2 transition-all",
                    selectedPar === par
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 bg-muted/50"
                  )}
                  onClick={() => setSelectedPar(par)}
                  data-testid={`button-par-${par}`}
                >
                  {par}
                </button>
              ))}
            </div>
          ) : (
            <Select value={selectedPar?.toString() || ""} onValueChange={(v) => setSelectedPar(parseInt(v))}>
              <SelectTrigger className="w-full h-14 text-xl" id="par-select-draw" data-testid="select-par-draw">
                <SelectValue placeholder="Select Par" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 15 }, (_, i) => i + 1).map((par) => (
                  <SelectItem key={par} value={par.toString()}>
                    Par {par}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Button
          className="w-full h-14 text-lg"
          onClick={handleConfirm}
          disabled={!selectedPar}
          data-testid="button-confirm-draw"
        >
          Confirm Par
        </Button>
      </div>
    </div>
  );
}
