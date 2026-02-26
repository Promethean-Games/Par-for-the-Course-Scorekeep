import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Lock, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PlayerLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (player: PlayerProfile, history: TournamentHistoryEntry[], pin: string) => void;
}

export interface PlayerProfile {
  id: number;
  uniqueCode: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  tShirtSize: string | null;
  contactInfo: string | null;
  handicap: string;
  isProvisional: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentHistoryEntry {
  id: number;
  universalPlayerId: number;
  tournamentName: string;
  courseName: string | null;
  totalStrokes: number;
  totalPar: number;
  relativeToPar: number;
  holesPlayed: number;
  totalScratches: number | null;
  totalPenalties: number | null;
  completedAt: string;
}

export function PlayerLoginDialog({ isOpen, onClose, onLoginSuccess }: PlayerLoginDialogProps) {
  const [step, setStep] = useState<"code" | "pin" | "setup">("code");
  const [playerCode, setPlayerCode] = useState("");
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const resetState = () => {
    setStep("code");
    setPlayerCode("");
    setPin("");
    setNewPin("");
    setConfirmPin("");
    setPlayerName("");
    setError(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleCheckCode = async () => {
    if (!playerCode.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/player/${playerCode.toUpperCase()}/has-pin`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Player not found");
        return;
      }

      setPlayerName(data.playerName);
      if (data.hasPin) {
        setStep("pin");
      } else {
        setStep("setup");
      }
    } catch (err) {
      setError("Failed to check player code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (pinOverride?: string) => {
    const pinToUse = pinOverride || pin;
    if (!pinToUse.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest("POST", "/api/player/login", {
        playerCode: playerCode.toUpperCase(),
        pin: pinToUse
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid PIN");
        return;
      }

      if (data.sessionToken) {
        localStorage.setItem("playerSessionToken", data.sessionToken);
      }
      onLoginSuccess(data.player, data.recentHistory, pinToUse);
      handleClose();
    } catch (err) {
      setError("Failed to login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupPin = async () => {
    if (!newPin.trim() || !confirmPin.trim()) return;
    
    if (newPin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    if (!/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest("POST", "/api/player/set-pin", {
        playerCode: playerCode.toUpperCase(),
        newPin
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to set PIN");
        return;
      }

      setPin(newPin);
      await handleLogin(newPin);
    } catch (err) {
      setError("Failed to set PIN");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Player Login
          </DialogTitle>
          <DialogDescription>
            {step === "code" && "Enter your player code to sign in"}
            {step === "pin" && `Welcome back, ${playerName}`}
            {step === "setup" && `Set up a PIN for ${playerName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === "code" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="playerCode">Player Code</Label>
                <Input
                  id="playerCode"
                  value={playerCode}
                  onChange={(e) => setPlayerCode(e.target.value.toUpperCase())}
                  placeholder="e.g., PC7001"
                  className="font-mono text-center tracking-widest text-lg"
                  maxLength={10}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCheckCode();
                  }}
                  data-testid="input-player-code-login"
                />
                <p className="text-xs text-muted-foreground">
                  Your unique player code (ask Tournament Director if unsure)
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button
                className="w-full"
                onClick={handleCheckCode}
                disabled={isLoading || !playerCode.trim()}
                data-testid="button-check-code"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Continue
              </Button>
            </>
          )}

          {step === "pin" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pin">Enter Your PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="4-digit PIN"
                  className="font-mono text-center tracking-widest text-2xl"
                  maxLength={4}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pin.length === 4) handleLogin();
                  }}
                  data-testid="input-pin-login"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("code");
                    setError(null);
                  }}
                  data-testid="button-back-login"
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleLogin()}
                  disabled={isLoading || pin.length !== 4}
                  data-testid="button-login"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                  Sign In
                </Button>
              </div>
            </>
          )}

          {step === "setup" && (
            <>
              <p className="text-sm text-muted-foreground">
                No PIN has been set for this account. Create a 4-digit PIN to secure your profile.
              </p>

              <div className="space-y-2">
                <Label htmlFor="newPin">Create PIN</Label>
                <Input
                  id="newPin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="4-digit PIN"
                  className="font-mono text-center tracking-widest text-xl"
                  maxLength={4}
                  data-testid="input-new-pin"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPin">Confirm PIN</Label>
                <Input
                  id="confirmPin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="Re-enter PIN"
                  className="font-mono text-center tracking-widest text-xl"
                  maxLength={4}
                  data-testid="input-confirm-pin"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("code");
                    setError(null);
                  }}
                  data-testid="button-back-setup"
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSetupPin}
                  disabled={isLoading || newPin.length !== 4 || confirmPin.length !== 4}
                  data-testid="button-create-pin"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create PIN & Sign In
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
