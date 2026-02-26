import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Plus, 
  Users, 
  Trash2, 
  Merge,
  Edit3,
  Search,
  Trophy,
  Target,
  AlertTriangle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UniversalPlayer } from "@shared/schema";

interface UniversalPlayerPortalProps {
  onClose: () => void;
  directorPin: string;
}

export function UniversalPlayerPortal({ onClose, directorPin }: UniversalPlayerPortalProps) {
  const { toast } = useToast();
  const [players, setPlayers] = useState<UniversalPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState<UniversalPlayer | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<UniversalPlayer | null>(null);
  const [showMergeDialog, setShowMergeDialog] = useState<UniversalPlayer | null>(null);
  const [showHandicapDialog, setShowHandicapDialog] = useState<UniversalPlayer | null>(null);
  
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerEmail, setNewPlayerEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [handicapValue, setHandicapValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const nameInputRef = useRef<HTMLInputElement>(null);

  const fetchPlayers = async () => {
    try {
      const response = await fetch(`/api/universal-players?directorPin=${encodeURIComponent(directorPin)}`);
      if (response.ok) {
        const data = await response.json();
        setPlayers(data);
      }
    } catch (err) {
      console.error("Failed to fetch players:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.uniqueCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    setIsSaving(true);
    
    try {
      await apiRequest("POST", "/api/universal-players", {
        directorPin,
        name: newPlayerName.trim(),
        email: newPlayerEmail.trim() || null,
      });
      setShowAddDialog(false);
      setNewPlayerName("");
      setNewPlayerEmail("");
      toast({ title: "Player added!", description: "Welcome to the roster." });
      await fetchPlayers();
    } catch (err) {
      console.error("Failed to add player:", err);
      toast({ title: "Failed to add player", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditPlayer = async () => {
    if (!showEditDialog || !editName.trim()) return;
    setIsSaving(true);
    
    try {
      await apiRequest("PATCH", `/api/universal-players/${showEditDialog.id}`, {
        directorPin,
        name: editName.trim(),
        email: editEmail.trim() || null,
      });
      setShowEditDialog(null);
      toast({ title: "Player updated!" });
      await fetchPlayers();
    } catch (err) {
      console.error("Failed to update player:", err);
      toast({ title: "Failed to update player", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlayer = async () => {
    if (!showDeleteDialog) return;
    setIsSaving(true);
    
    try {
      const res = await fetch(`/api/universal-players/${showDeleteDialog.id}?directorPin=${encodeURIComponent(directorPin)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setShowDeleteDialog(null);
      toast({ title: "Player deleted", description: "Gone but not forgotten... actually, totally forgotten." });
      await fetchPlayers();
    } catch (err) {
      console.error("Failed to delete player:", err);
      toast({ title: "Failed to delete player", description: "They're sticking around for now.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMergePlayers = async () => {
    if (!showMergeDialog || !mergeTargetId) return;
    setIsSaving(true);
    
    try {
      await apiRequest("POST", "/api/universal-players/merge", {
        directorPin,
        sourceId: showMergeDialog.id,
        targetId: mergeTargetId,
      });
      setShowMergeDialog(null);
      setMergeTargetId(null);
      toast({ title: "Players merged!", description: "Two become one." });
      await fetchPlayers();
    } catch (err) {
      console.error("Failed to merge players:", err);
      toast({ title: "Failed to merge players", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetHandicap = async () => {
    if (!showHandicapDialog) return;
    setIsSaving(true);
    
    const handicap = handicapValue.trim() ? parseFloat(handicapValue) : null;
    
    try {
      await apiRequest("PATCH", `/api/universal-players/${showHandicapDialog.id}`, {
        directorPin,
        handicap,
        isProvisional: false,
      });
      setShowHandicapDialog(null);
      setHandicapValue("");
      toast({ title: "Handicap updated!", description: handicap !== null ? `Set to ${handicap}` : "Handicap cleared" });
      await fetchPlayers();
    } catch (err) {
      console.error("Failed to set handicap:", err);
      toast({ title: "Failed to set handicap", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (player: UniversalPlayer) => {
    setEditName(player.name);
    setEditEmail(player.email || "");
    setShowEditDialog(player);
  };

  const openHandicapDialog = (player: UniversalPlayer) => {
    setHandicapValue(player.handicap?.toString() || "");
    setShowHandicapDialog(player);
  };

  const getHandicapDisplay = (player: UniversalPlayer) => {
    if (player.handicap === null || player.handicap === undefined) {
      return "—";
    }
    const sign = player.handicap >= 0 ? "+" : "";
    return `${sign}${player.handicap.toFixed(1)}${player.isProvisional ? "*" : ""}`;
  };

  const getStatusBadge = (player: UniversalPlayer) => {
    if (player.completedTournaments >= 5) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600">
          Established
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600">
        Provisional ({player.completedTournaments}/5)
      </span>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b bg-background">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Player Directory</h1>
            <p className="text-sm text-muted-foreground">Manage universal player IDs</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-players"
            />
          </div>
          <Button 
            onClick={() => setShowAddDialog(true)}
            data-testid="button-add-player"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Player
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading players...</div>
        ) : filteredPlayers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? "No Players Found" : "No Players Yet"}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery ? "Try a different search term" : "Add your first player to get started"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPlayers.map(player => (
              <Card 
                key={player.id} 
                className="p-4"
                data-testid={`card-player-${player.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
                        {player.uniqueCode}
                      </span>
                      <h3 className="font-semibold">{player.name}</h3>
                      {getStatusBadge(player)}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        {player.completedTournaments} tournaments
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Handicap: {getHandicapDisplay(player)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openHandicapDialog(player)}
                      title="Set Handicap"
                      data-testid={`button-handicap-${player.id}`}
                    >
                      <Target className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(player)}
                      title="Edit Player"
                      data-testid={`button-edit-${player.id}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowMergeDialog(player)}
                      title="Merge with Another Player"
                      data-testid={`button-merge-${player.id}`}
                    >
                      <Merge className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setShowDeleteDialog(player)}
                      title="Delete Player"
                      data-testid={`button-delete-${player.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground pt-4">
          {players.length} total players in directory
        </div>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Add New Player
            </DialogTitle>
            <DialogDescription>
              Fresh meat for the leaderboard! A unique ID will be generated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="player-name">Player Name</Label>
              <Input
                id="player-name"
                ref={nameInputRef}
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="e.g., Tiger Woods Jr."
                onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
                data-testid="input-new-player-name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="player-email">Email (optional)</Label>
              <Input
                id="player-email"
                value={newPlayerEmail}
                onChange={(e) => setNewPlayerEmail(e.target.value)}
                placeholder="golfer@example.com"
                type="email"
                data-testid="input-new-player-email"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAddDialog(false)}
                className="flex-1"
              >
                Never Mind
              </Button>
              <Button 
                onClick={handleAddPlayer}
                disabled={isSaving || !newPlayerName.trim()}
                className="flex-1"
                data-testid="button-confirm-add"
              >
                {isSaving ? "Adding..." : "Welcome Aboard!"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showEditDialog} onOpenChange={() => setShowEditDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-600" />
              Edit Player
            </DialogTitle>
            <DialogDescription>
              Typo in the name? We won't tell anyone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <span className="font-mono text-lg">{showEditDialog?.uniqueCode}</span>
              <p className="text-xs text-muted-foreground mt-1">This ID cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Player Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEditPlayer()}
                data-testid="input-edit-name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email (optional)</Label>
              <Input
                id="edit-email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                type="email"
                data-testid="input-edit-email"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowEditDialog(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEditPlayer}
                disabled={isSaving || !editName.trim()}
                className="flex-1"
                data-testid="button-confirm-edit"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Player?
            </DialogTitle>
            <DialogDescription>
              You're about to send <span className="font-semibold">{showDeleteDialog?.name}</span> to the shadow realm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-destructive/10 rounded-lg p-4 text-sm">
              <p className="font-medium text-destructive mb-2">This will permanently delete:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Player ID: <span className="font-mono">{showDeleteDialog?.uniqueCode}</span></li>
                <li>All {showDeleteDialog?.completedTournaments || 0} tournament history records</li>
                <li>Their handicap data (if any)</li>
              </ul>
            </div>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. Like, seriously. Gone forever.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteDialog(null)}
                className="flex-1"
              >
                Keep Them Around
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeletePlayer}
                disabled={isSaving}
                className="flex-1"
                data-testid="button-confirm-delete"
              >
                {isSaving ? "Deleting..." : "Yeet Them!"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showMergeDialog} onOpenChange={() => { setShowMergeDialog(null); setMergeTargetId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="w-5 h-5 text-purple-600" />
              Merge Players
            </DialogTitle>
            <DialogDescription>
              Duplicate entries? Let's fix that. <span className="font-semibold">{showMergeDialog?.name}</span> will be absorbed into another player.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground mb-2">Merging from:</p>
              <p className="font-semibold">{showMergeDialog?.name}</p>
              <p className="text-sm font-mono text-muted-foreground">{showMergeDialog?.uniqueCode}</p>
            </div>
            <div className="space-y-2">
              <Label>Merge into (keep this player):</Label>
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                {players
                  .filter(p => p.id !== showMergeDialog?.id)
                  .map(player => (
                    <div
                      key={player.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        mergeTargetId === player.id 
                          ? "bg-purple-500/20 border border-purple-500" 
                          : "hover:bg-muted"
                      }`}
                      onClick={() => setMergeTargetId(player.id)}
                      data-testid={`merge-target-${player.id}`}
                    >
                      <span className="font-mono text-xs">{player.uniqueCode}</span>
                      <span className="flex-1">{player.name}</span>
                    </div>
                  ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              All tournament history from {showMergeDialog?.name} will be transferred to the selected player, and their handicap will be recalculated.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => { setShowMergeDialog(null); setMergeTargetId(null); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleMergePlayers}
                disabled={isSaving || !mergeTargetId}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                data-testid="button-confirm-merge"
              >
                {isSaving ? "Merging..." : "Combine Forces!"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showHandicapDialog} onOpenChange={() => { setShowHandicapDialog(null); setHandicapValue(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-600" />
              Set Handicap
            </DialogTitle>
            <DialogDescription>
              Override the calculated handicap for <span className="font-semibold">{showHandicapDialog?.name}</span>. 
              Power move, but we trust you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-3 flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Current:</p>
                <p className="text-lg font-semibold">
                  {showHandicapDialog && getHandicapDisplay(showHandicapDialog)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Tournaments:</p>
                <p className="text-lg font-semibold">{showHandicapDialog?.completedTournaments || 0}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="handicap-value">New Handicap (strokes over par)</Label>
              <Input
                id="handicap-value"
                value={handicapValue}
                onChange={(e) => setHandicapValue(e.target.value)}
                placeholder="e.g., 3.5 or -2"
                type="number"
                step="0.1"
                onKeyDown={(e) => e.key === "Enter" && handleSetHandicap()}
                data-testid="input-handicap"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to clear the handicap. Setting this manually marks the player as "Established" (non-provisional).
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => { setShowHandicapDialog(null); setHandicapValue(""); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSetHandicap}
                disabled={isSaving}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                data-testid="button-confirm-handicap"
              >
                {isSaving ? "Saving..." : "Lock It In!"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
