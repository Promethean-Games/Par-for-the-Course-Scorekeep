import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield } from "lucide-react";

interface TDSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void;
}

export function TDSignInModal({ isOpen, onClose, onSuccess }: TDSignInModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handlePinSubmit = async () => {
    if (!pin.trim()) {
      setError("Please enter the director PIN");
      return;
    }
    
    setIsVerifying(true);
    setError(null);
    
    try {
      const response = await fetch("/api/director/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.isValid) {
          handleClose();
          onSuccess(pin);
        } else {
          setError("Invalid PIN");
        }
      } else {
        setError("Verification failed");
      }
    } catch (err) {
      setError("Connection error");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setPin("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Tournament Director
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="director-pin">Director PIN</Label>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <Input
                id="director-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                  setError(null);
                }}
                placeholder="Enter 4-digit PIN"
                className="flex-1 text-center tracking-widest text-2xl font-mono"
                onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                data-testid="input-td-pin"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Enter your 4-digit director access code
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handlePinSubmit}
              disabled={pin.length < 4 || isVerifying}
              className="flex-1"
              data-testid="button-td-signin"
            >
              {isVerifying ? "Verifying..." : "Sign In"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
