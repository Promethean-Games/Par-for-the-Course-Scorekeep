import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Plus, 
  Trophy, 
  Users, 
  Trash2, 
  Download, 
  Play,
  Calendar,
  BookUser
} from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";
import { DirectorPortal } from "./DirectorPortal";
import { UniversalPlayerPortal } from "./UniversalPlayerPortal";

interface TournamentManagementPageProps {
  onClose: () => void;
  directorPin: string;
}

interface TournamentSummary {
  id: number;
  roomCode: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  playerCount?: number;
}

export function TournamentManagementPage({ onClose, directorPin }: TournamentManagementPageProps) {
  const tournament = useTournament();
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showPlayerDirectory, setShowPlayerDirectory] = useState(false);
  const [isHandicapped, setIsHandicapped] = useState(false);

  const fetchTournaments = async () => {
    try {
      const response = await fetch(`/api/tournaments?directorPin=${encodeURIComponent(directorPin)}`);
      if (response.ok) {
        const data = await response.json();
        setTournaments(data);
      }
    } catch (err) {
      console.error("Failed to fetch tournaments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const handleCreateTournament = async () => {
    if (!newTournamentName.trim()) return;
    setIsCreating(true);
    
    try {
      const result = await tournament.createTournament(newTournamentName.trim(), directorPin, isHandicapped);
      if (result) {
        setShowCreateDialog(false);
        setNewTournamentName("");
        setIsHandicapped(false);
        await fetchTournaments();
        setSelectedTournament(result.roomCode);
      }
    } catch (err) {
      console.error("Failed to create tournament:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectTournament = async (roomCode: string) => {
    const success = await tournament.joinRoom(roomCode);
    if (success) {
      tournament.setIsDirector(true);
      tournament.setDirectorCredentials(directorPin);
      setSelectedTournament(roomCode);
    }
  };

  const handleDeleteTournament = async (roomCode: string) => {
    try {
      const response = await fetch(`/api/tournaments/${roomCode}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directorPin }),
      });
      if (response.ok) {
        await fetchTournaments();
        setShowDeleteConfirm(null);
      }
    } catch (err) {
      console.error("Failed to delete tournament:", err);
    }
  };

  const handleDownloadBackup = async (roomCode: string) => {
    try {
      const response = await fetch(`/api/tournaments/${roomCode}/backup?directorPin=${encodeURIComponent(directorPin)}`);
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tournament-${roomCode}-backup.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to download backup:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("directorAuthenticated");
    onClose();
  };

  if (showPlayerDirectory) {
    return (
      <UniversalPlayerPortal 
        onClose={() => setShowPlayerDirectory(false)}
        directorPin={directorPin}
      />
    );
  }

  if (selectedTournament) {
    return (
      <DirectorPortal 
        onClose={() => {
          setSelectedTournament(null);
          tournament.leaveRoom();
          fetchTournaments();
        }} 
      />
    );
  }

  const activeTournaments = tournaments.filter(t => t.isActive);
  const archivedTournaments = tournaments.filter(t => !t.isActive);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b bg-background">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Tournament Director</h1>
            <p className="text-sm text-muted-foreground">Manage your tournaments</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-6">
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="flex-1 h-14 text-lg gap-2"
            data-testid="button-create-tournament"
          >
            <Plus className="w-5 h-5" />
            Create Tournament
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowPlayerDirectory(true)}
            className="h-14 px-4"
            data-testid="button-player-directory"
          >
            <BookUser className="w-5 h-5" />
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading tournaments...</div>
        ) : (
          <>
            {activeTournaments.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Play className="w-5 h-5 text-green-600" />
                  Live Tournaments
                </h2>
                {activeTournaments.map(t => (
                  <Card 
                    key={t.id} 
                    className="p-4 hover-elevate cursor-pointer"
                    onClick={() => handleSelectTournament(t.roomCode)}
                    data-testid={`card-tournament-${t.roomCode}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-500" />
                          <h3 className="font-semibold truncate">{t.name}</h3>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="font-mono">{t.roomCode}</span>
                          {t.playerCount !== undefined && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {t.playerCount} players
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadBackup(t.roomCode);
                          }}
                          data-testid={`button-backup-${t.roomCode}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(t.roomCode);
                          }}
                          data-testid={`button-delete-${t.roomCode}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {archivedTournaments.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-5 h-5" />
                  Archived Tournaments
                </h2>
                {archivedTournaments.map(t => (
                  <Card 
                    key={t.id} 
                    className="p-4 opacity-70"
                    data-testid={`card-archived-${t.roomCode}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{t.name}</h3>
                        <span className="text-sm text-muted-foreground font-mono">{t.roomCode}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadBackup(t.roomCode)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setShowDeleteConfirm(t.roomCode)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {tournaments.length === 0 && (
              <div className="text-center py-12">
                <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Tournaments Yet</h3>
                <p className="text-muted-foreground">
                  Create your first tournament to get started
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Create Tournament
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tournament-name">Tournament Name</Label>
              <Input
                id="tournament-name"
                value={newTournamentName}
                onChange={(e) => setNewTournamentName(e.target.value)}
                placeholder="e.g., Summer Championship 2025"
                onKeyDown={(e) => e.key === "Enter" && handleCreateTournament()}
                data-testid="input-tournament-name"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-0.5">
                <Label htmlFor="handicapped-toggle" className="cursor-pointer">Handicapped Tournament</Label>
                <p className="text-xs text-muted-foreground">
                  {isHandicapped 
                    ? "Scores will be adjusted using player handicaps" 
                    : "All players compete without handicap adjustments"}
                </p>
              </div>
              <Switch
                id="handicapped-toggle"
                checked={isHandicapped}
                onCheckedChange={setIsHandicapped}
                data-testid="switch-handicapped"
              />
            </div>
            {isHandicapped && (
              <div className="bg-amber-500/10 rounded-lg p-3 text-sm">
                <p className="text-amber-600 font-medium">Heads up!</p>
                <p className="text-muted-foreground mt-1">
                  Players need 5 completed tournaments for an established handicap. 
                  Provisional players can still join, but their handicap may be less accurate.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowCreateDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTournament}
                disabled={isCreating || !newTournamentName.trim()}
                className="flex-1"
                data-testid="button-confirm-create"
              >
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Tournament?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>
              Are you sure you want to delete this tournament? This action cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground">
              Consider downloading a backup first.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => showDeleteConfirm && handleDeleteTournament(showDeleteConfirm)}
                className="flex-1"
                data-testid="button-confirm-delete"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
