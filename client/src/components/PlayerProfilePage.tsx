import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Trophy, Target, TrendingUp, Lock, Calendar, LogOut, Loader2, AlertTriangle, Ban, Mail, Phone, Shirt, Pencil, Save, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { PlayerProfile, TournamentHistoryEntry } from "./PlayerLoginDialog";

interface PlayerProfilePageProps {
  player: PlayerProfile;
  history: TournamentHistoryEntry[];
  playerPin: string;
  onLogout: () => void;
  onBack: () => void;
  onPlayerUpdated?: (player: PlayerProfile) => void;
}

const T_SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

export function PlayerProfilePage({ player, history, playerPin, onLogout, onBack, onPlayerUpdated }: PlayerProfilePageProps) {
  const [showChangePinDialog, setShowChangePinDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(player.name);
  const [editEmail, setEditEmail] = useState(player.email || "");
  const [editPhone, setEditPhone] = useState(player.phoneNumber || "");
  const [editShirtSize, setEditShirtSize] = useState(player.tShirtSize || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const formatRelativeToPar = (rel: number) => {
    if (rel === 0) return "E";
    return rel > 0 ? `+${rel}` : rel.toString();
  };

  const handleStartEdit = () => {
    setEditName(player.name);
    setEditEmail(player.email || "");
    setEditPhone(player.phoneNumber || "");
    setEditShirtSize(player.tShirtSize || "");
    setSaveError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const sessionToken = localStorage.getItem("playerSessionToken");
      const response = await apiRequest("PATCH", `/api/player/${player.uniqueCode}/profile`, {
        pin: sessionToken ? undefined : playerPin,
        sessionToken: sessionToken || undefined,
        name: editName.trim() || undefined,
        email: editEmail.trim() || undefined,
        phoneNumber: editPhone.trim() || undefined,
        tShirtSize: editShirtSize || undefined,
      });
      const data = await response.json();

      if (!response.ok) {
        setSaveError(data.error || "Failed to update profile");
        return;
      }

      if (onPlayerUpdated) {
        onPlayerUpdated(data.player);
      }
      setIsEditing(false);
    } catch (err) {
      setSaveError("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const avgStrokes = history.length > 0
    ? Math.round(history.reduce((sum, h) => sum + h.totalStrokes, 0) / history.length)
    : 0;
  const avgRelPar = history.length > 0
    ? (history.reduce((sum, h) => sum + h.relativeToPar, 0) / history.length).toFixed(1)
    : "0";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-profile">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg">My Profile</h1>
          <Button variant="ghost" size="icon" onClick={onLogout} data-testid="button-logout">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xl">{player.name}</CardTitle>
              <Badge variant="outline" className="font-mono text-lg" data-testid="badge-player-code">
                {player.uniqueCode}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold" data-testid="text-handicap">
                  {player.handicap}
                </p>
                <p className="text-xs text-muted-foreground">
                  Handicap
                  {player.isProvisional && (
                    <Badge variant="secondary" className="ml-1 text-xs">Prov</Badge>
                  )}
                </p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Trophy className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                <p className="text-2xl font-bold" data-testid="text-tournaments-played">
                  {history.length}
                </p>
                <p className="text-xs text-muted-foreground">Tournaments</p>
              </div>
            </div>

            {history.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-lg font-bold">{avgStrokes}</p>
                  <p className="text-xs text-muted-foreground">Avg Strokes</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-lg font-bold">{avgRelPar}</p>
                  <p className="text-xs text-muted-foreground">Avg vs Par</p>
                </div>
              </div>
            )}

            {!isEditing ? (
              <div className="space-y-2">
                {player.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{player.email}</span>
                  </div>
                )}
                {player.phoneNumber && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{player.phoneNumber}</span>
                  </div>
                )}
                {player.tShirtSize && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shirt className="w-4 h-4" />
                    <span>T-Shirt: {player.tShirtSize}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleStartEdit}
                    data-testid="button-edit-profile"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowChangePinDialog(true)}
                    data-testid="button-change-pin"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Change PIN
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t">
                <div className="space-y-1">
                  <Label htmlFor="editName">Name</Label>
                  <Input
                    id="editName"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Your name"
                    data-testid="input-edit-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editEmail">Email</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="your@email.com"
                    data-testid="input-edit-email"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editPhone">Phone</Label>
                  <Input
                    id="editPhone"
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    data-testid="input-edit-phone"
                  />
                </div>
                <div className="space-y-1">
                  <Label>T-Shirt Size</Label>
                  <Select value={editShirtSize} onValueChange={setEditShirtSize}>
                    <SelectTrigger data-testid="select-shirt-size">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {T_SHIRT_SIZES.map(size => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {saveError && (
                  <p className="text-sm text-destructive text-center">{saveError}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    data-testid="button-cancel-edit"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSaveProfile}
                    disabled={isSaving || !editName.trim()}
                    data-testid="button-save-profile"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5" />
              Tournament History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No tournament history yet
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-2 p-3 bg-muted rounded-lg"
                    data-testid={`history-entry-${entry.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{entry.tournamentName}</p>
                      {entry.courseName && (
                        <p className="text-xs text-muted-foreground truncate">{entry.courseName}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(entry.completedAt)}
                        </span>
                        <span>{entry.holesPlayed} holes</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold">{entry.totalStrokes}</p>
                      <Badge
                        variant={entry.relativeToPar <= 0 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {formatRelativeToPar(entry.relativeToPar)}
                      </Badge>
                      {((entry.totalScratches ?? 0) > 0 || (entry.totalPenalties ?? 0) > 0) && (
                        <div className="flex items-center justify-end gap-2 mt-1 text-xs text-muted-foreground">
                          {(entry.totalScratches ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5" title="Scratches">
                              <Ban className="w-3 h-3" />
                              {entry.totalScratches}
                            </span>
                          )}
                          {(entry.totalPenalties ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5" title="Penalties">
                              <AlertTriangle className="w-3 h-3" />
                              {entry.totalPenalties}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ChangePinDialog
        isOpen={showChangePinDialog}
        onClose={() => setShowChangePinDialog(false)}
        playerCode={player.uniqueCode}
      />
    </div>
  );
}

interface ChangePinDialogProps {
  isOpen: boolean;
  onClose: () => void;
  playerCode: string;
}

function ChangePinDialog({ isOpen, onClose, playerCode }: ChangePinDialogProps) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const resetState = () => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setError(null);
    setSuccess(false);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
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
        playerCode,
        currentPin,
        newPin
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to change PIN");
        return;
      }

      setSuccess(true);
      setTimeout(() => handleClose(), 1500);
    } catch (err) {
      setError("Failed to change PIN");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Change PIN
          </DialogTitle>
          <DialogDescription>
            Enter your current PIN and choose a new 4-digit PIN
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-4">
            <p className="text-green-600 font-medium">PIN changed successfully!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPinChange">Current PIN</Label>
              <Input
                id="currentPinChange"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Current PIN"
                className="font-mono text-center tracking-widest"
                maxLength={4}
                data-testid="input-current-pin"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPinChange">New PIN</Label>
              <Input
                id="newPinChange"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="New 4-digit PIN"
                className="font-mono text-center tracking-widest"
                maxLength={4}
                data-testid="input-new-pin-change"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPinChange">Confirm New PIN</Label>
              <Input
                id="confirmPinChange"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Re-enter new PIN"
                className="font-mono text-center tracking-widest"
                maxLength={4}
                data-testid="input-confirm-pin-change"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} data-testid="button-cancel-pin-change">
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={isLoading || currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4}
                data-testid="button-save-new-pin"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save New PIN
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
