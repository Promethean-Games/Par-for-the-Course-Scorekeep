import { Button } from "@/components/ui/button";

interface TableSetupDialogProps {
  hole: number;
  par: number;
  onConfirm: () => void;
}

export function TableSetupDialog({ hole, par, onConfirm }: TableSetupDialogProps) {
  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold" data-testid="text-setup-title">
            Hole {hole} - Par {par}
          </h1>
          <p className="text-xl text-muted-foreground" data-testid="text-setup-instruction">
            Set up the course according to the card.
          </p>
        </div>
        
        <p className="text-lg" data-testid="text-setup-confirm-prompt">
          Press the button below when the table matches the card.
        </p>

        <Button
          className="w-full h-16 text-xl"
          onClick={onConfirm}
          data-testid="button-table-ready"
        >
          Table is Ready!
        </Button>
      </div>
    </div>
  );
}
