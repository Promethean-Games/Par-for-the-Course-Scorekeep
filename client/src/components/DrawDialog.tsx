import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DrawDialogProps {
  onSelectPar: (par: number) => void;
}

export function DrawDialog({ onSelectPar }: DrawDialogProps) {
  const [selectedPar, setSelectedPar] = useState<number | null>(null);

  const handleConfirm = () => {
    if (!selectedPar) return;
    onSelectPar(selectedPar);
  };

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold" data-testid="text-draw-par-title">
            Draw Par Card
          </h1>
          <p className="text-muted-foreground text-sm">
            Select the par value from your drawn card
          </p>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((par) => (
            <button
              key={par}
              className={cn(
                "h-16 rounded-lg text-2xl font-bold border-2 transition-all",
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

        <Button
          className="w-full h-14 text-lg"
          onClick={handleConfirm}
          disabled={!selectedPar}
          data-testid="button-confirm-par"
        >
          Confirm Par {selectedPar ?? ""}
        </Button>
      </div>
    </div>
  );
}
