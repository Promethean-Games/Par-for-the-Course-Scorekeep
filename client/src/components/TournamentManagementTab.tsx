import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Trophy, 
  Users, 
  Trash2, 
  Download, 
  Upload,
  Play,
  Calendar,
  Target,
  TrendingUp,
  BarChart3,
  Archive,
  RotateCcw,
  FileDown,
  FileUp,
  Clock,
} from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";
import { DirectorPortal } from "./DirectorPortal";

interface TournamentManagementTabProps {
  directorPin: string;
}

interface TournamentStats {
  playerCount: number;
  mostHolesCompleted: number;
  leastHolesCompleted: number;
  averageScore: number | null;
  averageRelativeToPar: number | null;
  playersWithScores: number;
}

interface TournamentSummary {
  id: number;
  roomCode: string;
  name: string;
  isActive: boolean;
  isStarted?: boolean;
  isHandicapped?: boolean;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  stats: TournamentStats;
}

export function TournamentManagementTab({ directorPin }: TournamentManagementTabProps) {
  const tournament = useTournament();
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState<string | null>(null);
  const [isHandicapped, setIsHandicapped] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const hasActiveStarted = tournaments.some(t => t.isActive && t.startedAt && !t.completedAt);
    if (hasActiveStarted) {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [tournaments]);

  const formatRuntime = (startedAt: string | null, completedAt: string | null): string | null => {
    if (!startedAt) return null;
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : now;
    const elapsed = Math.max(0, Math.floor((end - start) / 1000));
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

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

  const handleSelectTournament = async (roomCode: string, allowInactive?: boolean) => {
    const success = await tournament.joinRoom(roomCode, allowInactive);
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

  const handleArchiveTournament = async (roomCode: string) => {
    try {
      const response = await fetch(`/api/tournaments/${roomCode}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directorPin }),
      });
      if (response.ok) {
        toast({ title: "Tournament Archived", description: "Tournament has been moved to archives" });
        await fetchTournaments();
        setShowArchiveConfirm(null);
      }
    } catch (err) {
      console.error("Failed to archive tournament:", err);
    }
  };

  const handleUnarchiveTournament = async (roomCode: string) => {
    try {
      const response = await fetch(`/api/tournaments/${roomCode}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directorPin }),
      });
      if (response.ok) {
        toast({ title: "Tournament Restored", description: "Tournament is now live again" });
        await fetchTournaments();
      }
    } catch (err) {
      console.error("Failed to unarchive tournament:", err);
    }
  };

  const handleImportTournament = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsImporting(true);
      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        const response = await fetch("/api/tournaments/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directorPin, backup }),
        });
        if (response.ok) {
          const result = await response.json();
          toast({ 
            title: "Tournament Imported", 
            description: `${result.playersImported} players, ${result.scoresImported} scores imported` 
          });
          await fetchTournaments();
        } else {
          const err = await response.json();
          toast({ title: "Import Failed", description: err.error || "Invalid file format", variant: "destructive" });
        }
      } catch (err) {
        toast({ title: "Import Failed", description: "Could not read the file", variant: "destructive" });
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/export/full?directorPin=${encodeURIComponent(directorPin)}`);
      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `par-for-the-course-export-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Export Complete", description: "Full data backup downloaded" });
      }
    } catch (err) {
      toast({ title: "Export Failed", description: "Could not export data", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFull = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const response = await fetch("/api/import/full", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directorPin, data }),
        });
        if (response.ok) {
          const result = await response.json();
          toast({ 
            title: "Import Complete", 
            description: `${result.playersImported} players, ${result.historyImported} history entries, ${result.tournamentsImported} tournaments imported` 
          });
          await fetchTournaments();
        } else {
          const err = await response.json();
          toast({ title: "Import Failed", description: err.error || "Invalid file format", variant: "destructive" });
        }
      } catch (err) {
        toast({ title: "Import Failed", description: "Could not read the file", variant: "destructive" });
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

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
    <div className="flex flex-col p-4 space-y-6">
      <div className="flex gap-2">
        <Button 
          onClick={() => setShowCreateDialog(true)}
          className="h-14 text-lg gap-2 flex-1"
          data-testid="button-create-tournament"
        >
          <Plus className="w-5 h-5" />
          Create Tournament
        </Button>
        <Button 
          variant="outline"
          onClick={handleImportTournament}
          disabled={isImporting}
          className="h-14"
          data-testid="button-import-tournament"
        >
          <Upload className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex gap-2">
        <Button 
          variant="outline"
          onClick={handleExportAll}
          disabled={isExporting}
          className="flex-1 gap-2"
          data-testid="button-export-all"
        >
          <FileDown className="w-4 h-4" />
          {isExporting ? "Exporting..." : "Export All Data"}
        </Button>
        <Button 
          variant="outline"
          onClick={handleImportFull}
          disabled={isImporting}
          className="flex-1 gap-2"
          data-testid="button-import-all"
        >
          <FileUp className="w-4 h-4" />
          {isImporting ? "Importing..." : "Import Data"}
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <h3 className="font-semibold truncate">{t.name}</h3>
                        {t.isHandicapped && (
                          <span className="text-xs bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded">HC</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span className="font-mono">{t.roomCode}</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {t.stats.playerCount} players
                        </span>
                        {t.startedAt && (
                          <span className="flex items-center gap-1" data-testid={`text-runtime-${t.roomCode}`}>
                            <Clock className="w-3 h-3" />
                            {formatRuntime(t.startedAt, t.completedAt)}
                          </span>
                        )}
                      </div>
                      {t.stats.playersWithScores > 0 && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1" title="Holes completed range">
                            <Target className="w-3 h-3" />
                            {t.stats.leastHolesCompleted === t.stats.mostHolesCompleted 
                              ? `${t.stats.mostHolesCompleted} holes`
                              : `${t.stats.leastHolesCompleted}-${t.stats.mostHolesCompleted} holes`}
                          </span>
                          {t.stats.averageScore !== null && (
                            <span className="flex items-center gap-1" title="Average score">
                              <BarChart3 className="w-3 h-3" />
                              Avg: {t.stats.averageScore}
                            </span>
                          )}
                          {t.stats.averageRelativeToPar !== null && (
                            <span className={`flex items-center gap-1 ${t.stats.averageRelativeToPar <= 0 ? 'text-green-600' : 'text-red-500'}`} title="Average relative to par">
                              <TrendingUp className="w-3 h-3" />
                              {t.stats.averageRelativeToPar > 0 ? '+' : ''}{t.stats.averageRelativeToPar}
                            </span>
                          )}
                        </div>
                      )}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowArchiveConfirm(t.roomCode);
                        }}
                        data-testid={`button-archive-${t.roomCode}`}
                      >
                        <Archive className="w-4 h-4" />
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
                <Archive className="w-5 h-5" />
                Archived Tournaments ({archivedTournaments.length})
              </h2>
              {archivedTournaments.map(t => (
                <Card 
                  key={t.id} 
                  className="p-4 opacity-70 hover-elevate cursor-pointer"
                  onClick={() => handleSelectTournament(t.roomCode, true)}
                  data-testid={`card-archived-${t.roomCode}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{t.name}</h3>
                        {t.isHandicapped && (
                          <span className="text-xs bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded">HC</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span className="font-mono">{t.roomCode}</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {t.stats.playerCount} players
                        </span>
                        {t.startedAt && (
                          <span className="flex items-center gap-1" data-testid={`text-runtime-archived-${t.roomCode}`}>
                            <Clock className="w-3 h-3" />
                            {formatRuntime(t.startedAt, t.completedAt)}
                          </span>
                        )}
                      </div>
                      {t.stats.playersWithScores > 0 && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {t.stats.mostHolesCompleted} holes
                          </span>
                          {t.stats.averageScore !== null && (
                            <span className="flex items-center gap-1">
                              <BarChart3 className="w-3 h-3" />
                              Avg: {t.stats.averageScore}
                            </span>
                          )}
                          {t.stats.averageRelativeToPar !== null && (
                            <span className={`flex items-center gap-1 ${t.stats.averageRelativeToPar <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              <TrendingUp className="w-3 h-3" />
                              {t.stats.averageRelativeToPar > 0 ? '+' : ''}{t.stats.averageRelativeToPar}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleUnarchiveTournament(t.roomCode); }}
                        data-testid={`button-unarchive-${t.roomCode}`}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleDownloadBackup(t.roomCode); }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(t.roomCode); }}
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

      <Dialog open={!!showArchiveConfirm} onOpenChange={() => setShowArchiveConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Archive Tournament?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>
              This will mark the tournament as archived. Players will no longer be able to submit scores.
            </p>
            <p className="text-sm text-muted-foreground">
              You can restore it later from the Archived section.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowArchiveConfirm(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => showArchiveConfirm && handleArchiveTournament(showArchiveConfirm)}
                className="flex-1"
                data-testid="button-confirm-archive"
              >
                Archive
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
