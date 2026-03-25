import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HOLE_PARS } from "@/lib/constants";

interface DrawDialogProps {
  onSelectPar: (par: number) => void;
  onSelectStartingHole?: (hole: number) => void;
}

export function DrawDialog({ onSelectPar, onSelectStartingHole }: DrawDialogProps) {
  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [revealPar, setRevealPar] = useState<number | null>(null);

  const handleConfirm = () => {
    if (!selectedHole) return;
    const par = HOLE_PARS[selectedHole - 1];
    setRevealPar(par);
  };

  useEffect(() => {
    if (revealPar === null || selectedHole === null) return;
    const par = revealPar;
    const hole = selectedHole;
    const timer = setTimeout(() => {
      onSelectStartingHole?.(hole);
      onSelectPar(par);
    }, 2000);
    return () => clearTimeout(timer);
  }, [revealPar]);

  if (revealPar !== null) {
    return (
      <div className="fixed inset-0 bg-background/95 z-50 flex flex-col items-center justify-center pointer-events-none">
        <div className="par-overlay-anim text-center">
          <div
            className="font-bold tracking-widest text-muted-foreground uppercase"
            style={{ fontSize: "2rem", fontFamily: "'Architects Daughter', cursive" }}
            data-testid="text-par-overlay-label"
          >
            Par
          </div>
          <div
            className="font-extrabold leading-none text-foreground"
            style={{ fontSize: "14rem", fontFamily: "'Architects Daughter', cursive", lineHeight: 1 }}
            data-testid="text-par-overlay-number"
          >
            {revealPar}
          </div>
        </div>
      </div>
    );
  }

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
          onClick={handleConfirm}
          disabled={!selectedHole}
          data-testid="button-confirm-hole"
        >
          Begin Game
        </Button>
      </div>
    </div>
  );
}
