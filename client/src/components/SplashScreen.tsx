import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Trophy, Settings, Shield, User } from "lucide-react";
import { LOGO_URL } from "@/lib/constants";
import { useTournament } from "@/contexts/TournamentContext";
import { PlayerSelectionDialog } from "./PlayerSelectionDialog";
import { TDSignInModal } from "./TDSignInModal";
import { TDDashboard } from "./TDDashboard";
import { PlayerLoginDialog, type PlayerProfile, type TournamentHistoryEntry } from "./PlayerLoginDialog";
import { PlayerProfilePage } from "./PlayerProfilePage";

interface SplashScreenProps {
  onNewGame: () => void;
  onLoadGame: () => void;
  onStartTournamentGame?: () => void;
  onViewOnly?: () => void;
}

export function SplashScreen({ onNewGame, onLoadGame, onStartTournamentGame, onViewOnly }: SplashScreenProps) {
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [showPlayerSelection, setShowPlayerSelection] = useState(false);
  const [showTDSignIn, setShowTDSignIn] = useState(false);
  const [showTournamentManagement, setShowTournamentManagement] = useState(false);
  const [verifiedPin, setVerifiedPin] = useState<string | null>(null);
  const [showPlayerLogin, setShowPlayerLogin] = useState(false);
  const [loggedInPlayer, setLoggedInPlayer] = useState<PlayerProfile | null>(null);
  const [playerHistory, setPlayerHistory] = useState<TournamentHistoryEntry[]>([]);
  const [playerPin, setPlayerPin] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const tournament = useTournament();

  useEffect(() => {
    const sessionToken = localStorage.getItem("playerSessionToken");
    if (sessionToken) {
      fetch("/api/player/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Session expired");
          return res.json();
        })
        .then((data) => {
          setLoggedInPlayer(data.player);
          setPlayerHistory(data.history || []);
          setPlayerPin("session");
        })
        .catch(() => {
          localStorage.removeItem("playerSessionToken");
        })
        .finally(() => setIsRestoringSession(false));
    } else {
      setIsRestoringSession(false);
    }
  }, []);

  const handleTDSignInSuccess = (pin: string) => {
    setVerifiedPin(pin);
    setShowTournamentManagement(true);
  };

  const handlePlayerLoginSuccess = (player: PlayerProfile, history: TournamentHistoryEntry[], pin: string) => {
    setLoggedInPlayer(player);
    setPlayerHistory(history);
    setPlayerPin(pin);
  };

  const handlePlayerLogout = () => {
    const sessionToken = localStorage.getItem("playerSessionToken");
    if (sessionToken) {
      fetch("/api/player/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      }).catch(() => {});
    }
    setLoggedInPlayer(null);
    setPlayerHistory([]);
    setPlayerPin(null);
    localStorage.removeItem("playerSessionToken");
  };

  if (isRestoringSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <img src={LOGO_URL} alt="Par for the Course" className="w-32 h-32 mb-4" />
      </div>
    );
  }

  if (loggedInPlayer && playerPin) {
    return (
      <PlayerProfilePage
        player={loggedInPlayer}
        history={playerHistory}
        playerPin={playerPin}
        onLogout={handlePlayerLogout}
        onBack={handlePlayerLogout}
        onPlayerUpdated={(updatedPlayer) => setLoggedInPlayer(updatedPlayer)}
      />
    );
  }

  if (showTournamentManagement && verifiedPin) {
    return (
      <TDDashboard 
        onClose={() => {
          setShowTournamentManagement(false);
          setVerifiedPin(null);
        }} 
        directorPin={verifiedPin}
      />
    );
  }

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim()) return;
    setJoinError(null);
    const success = await tournament.joinRoom(roomCodeInput.trim());
    if (success) {
      setRoomCodeInput("");
      setShowPlayerSelection(true);
    } else {
      setJoinError(tournament.error || "Failed to join");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative">
      {/* TD Sign-In Gear Icon - Upper Right */}
      <div className="absolute top-4 right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
              data-testid="button-td-menu"
            >
              <Settings className="w-6 h-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={() => setShowPlayerLogin(true)}
              data-testid="menu-item-player-login"
            >
              <User className="w-4 h-4 mr-2 text-blue-600" />
              Player Login
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setShowTDSignIn(true)}
              data-testid="menu-item-td-signin"
            >
              <Shield className="w-4 h-4 mr-2 text-green-600" />
              TD Sign-In
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mb-8">
        <img 
          src={LOGO_URL} 
          alt="Par for the Course" 
          className="w-full max-w-[280px] h-auto"
        />
      </div>
      
      <div className="w-full max-w-md space-y-4">
        <Button 
          size="lg"
          className="w-full text-lg h-14"
          onClick={onNewGame}
          data-testid="button-new-game"
        >
          New Game
        </Button>
        <Button 
          size="lg"
          variant="outline"
          className="w-full text-lg h-14"
          onClick={onLoadGame}
          data-testid="button-load-game"
        >
          Load Game
        </Button>

        {/* Tournament Join Section */}
        {tournament.isConnected ? (
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-md">
              <div>
                <p className="font-medium">{tournament.tournamentInfo?.name}</p>
                <p className="text-sm text-muted-foreground">
                  Room: {tournament.roomCode}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPlayerSelection(true)}
                data-testid="button-manage-players-splash"
              >
                Manage Players
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => tournament.leaveRoom()}
              data-testid="button-leave-room-splash"
            >
              Leave Tournament
            </Button>
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {!showJoinInput ? (
              <Button
                size="lg"
                className="w-full text-lg h-14 bg-emerald-800 hover:bg-emerald-900 text-white border-emerald-900"
                onClick={() => setShowJoinInput(true)}
                data-testid="button-join-tournament"
              >
                <Trophy className="w-5 h-5 mr-2" />
                Join Tournament
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="Enter room code"
                    className="flex-1 font-mono text-center tracking-widest text-lg h-14"
                    maxLength={6}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoinRoom();
                    }}
                    data-testid="input-room-code-splash"
                  />
                  <Button
                    size="lg"
                    className="h-14 bg-emerald-800 hover:bg-emerald-900 text-white border-emerald-900"
                    onClick={handleJoinRoom}
                    disabled={tournament.isLoading || !roomCodeInput.trim()}
                    data-testid="button-join-room-splash"
                  >
                    {tournament.isLoading ? "..." : "Join"}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => { setShowJoinInput(false); setJoinError(null); setRoomCodeInput(""); }}
                  data-testid="button-cancel-join"
                >
                  Cancel
                </Button>
                {joinError && (
                  <p className="text-sm text-destructive text-center">{joinError}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showPlayerSelection && tournament.isConnected && (
        <PlayerSelectionDialog
          onClose={() => setShowPlayerSelection(false)}
          onStartGame={() => {
            setShowPlayerSelection(false);
            if (onStartTournamentGame) {
              onStartTournamentGame();
            }
          }}
          onViewOnly={() => {
            setShowPlayerSelection(false);
            if (onViewOnly) {
              onViewOnly();
            }
          }}
        />
      )}

      <TDSignInModal
        isOpen={showTDSignIn}
        onClose={() => setShowTDSignIn(false)}
        onSuccess={handleTDSignInSuccess}
      />

      <PlayerLoginDialog
        isOpen={showPlayerLogin}
        onClose={() => setShowPlayerLogin(false)}
        onLoginSuccess={handlePlayerLoginSuccess}
      />
    </div>
  );
}
