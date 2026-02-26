import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Users, Check, Play, RefreshCw, Eye } from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";

interface PlayerSelectionDialogProps {
  onClose: () => void;
  onStartGame?: () => void;
  onViewOnly?: () => void;
}

export function PlayerSelectionDialog({ onClose, onStartGame, onViewOnly }: PlayerSelectionDialogProps) {
  const tournament = useTournament();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasAssigned, setHasAssigned] = useState(false);
  const [assignedPlayerNames, setAssignedPlayerNames] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const groupedPlayers = tournament.allPlayers.reduce((acc, player) => {
    const group = player.groupName || "Unassigned";
    if (!acc[group]) acc[group] = [];
    acc[group].push(player);
    return acc;
  }, {} as Record<string, typeof tournament.allPlayers>);

  useEffect(() => {
    if (tournament.myPlayers.length > 0) {
      setHasAssigned(true);
      setAssignedPlayerNames(tournament.myPlayers.map(p => p.playerName));
      const firstGroup = tournament.myPlayers[0]?.groupName || "Unassigned";
      setSelectedGroup(firstGroup);
    }
  }, [tournament.myPlayers]);

  useEffect(() => {
    const interval = setInterval(() => {
      tournament.refreshPlayers();
    }, 3000);
    return () => clearInterval(interval);
  }, [tournament]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await tournament.refreshPlayers();
    setIsRefreshing(false);
  };

  const handleSelectGroup = (groupName: string) => {
    const players = groupedPlayers[groupName] || [];
    const allAssignedToOther = players.every(p => p.deviceId && p.deviceId !== tournament.deviceId);
    if (allAssignedToOther) return;
    setSelectedGroup(selectedGroup === groupName ? null : groupName);
  };

  const getSelectedPlayerIds = (): number[] => {
    if (!selectedGroup) return [];
    return (groupedPlayers[selectedGroup] || []).map(p => p.id);
  };

  const handleConfirm = async () => {
    const playerIds = getSelectedPlayerIds();
    if (playerIds.length === 0) return;
    setIsSaving(true);
    const selectedNames = tournament.allPlayers
      .filter(p => playerIds.includes(p.id))
      .map(p => p.playerName);
    setAssignedPlayerNames(selectedNames);
    await tournament.assignPlayersToDevice(playerIds);
    setIsSaving(false);
    setHasAssigned(true);
  };

  if (hasAssigned) {
    const playerNames = tournament.myPlayers.length > 0 
      ? tournament.myPlayers.map(p => p.playerName)
      : assignedPlayerNames;
    
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <div className="mb-4">
            <Play className="w-16 h-16 mx-auto text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Ready to Play!</h2>
          <p className="text-muted-foreground mb-4">
            Head to your starting hole and begin when ready.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-muted-foreground">Your group:</p>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {playerNames.map((name, idx) => (
                <span key={idx} className="px-2 py-1 bg-green-500/20 text-green-600 rounded text-sm font-medium">
                  {name}
                </span>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Tournament: <span className="font-mono font-bold">{tournament.roomCode}</span>
          </p>
          <Button 
            onClick={onStartGame}
            className="w-full bg-green-600 hover:bg-green-700 mb-2"
            data-testid="button-begin-playing"
          >
            <Play className="w-4 h-4 mr-2" />
            Begin Playing
          </Button>
          <Button 
            variant="outline" 
            onClick={onClose}
            className="w-full"
          >
            Leave Tournament
          </Button>
        </Card>
      </div>
    );
  }

  const selectedPlayerIds = getSelectedPlayerIds();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Select Your Group</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh-players"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {onViewOnly && (
            <Button
              variant="outline"
              className="w-full mb-4 border-dashed"
              onClick={onViewOnly}
              data-testid="button-view-only"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Only (Spectator)
            </Button>
          )}

          <p className="text-sm text-muted-foreground mb-4">
            Tap your group to score for all players in it.
          </p>

          {Object.entries(groupedPlayers).map(([groupName, players]) => {
            const isSelected = selectedGroup === groupName;
            const someAssignedToOther = players.some(p => p.deviceId && p.deviceId !== tournament.deviceId);
            const allAssignedToOther = players.every(p => p.deviceId && p.deviceId !== tournament.deviceId);
            
            return (
              <div
                key={groupName}
                className={`mb-3 rounded-lg border-2 transition-colors cursor-pointer ${
                  isSelected
                    ? "border-green-500 bg-green-500/10"
                    : allAssignedToOther
                    ? "border-muted bg-muted/50 opacity-50 cursor-not-allowed"
                    : "border-muted hover:border-green-500/50"
                }`}
                onClick={() => handleSelectGroup(groupName)}
                data-testid={`group-option-${groupName}`}
              >
                <div className="flex items-center justify-between p-3 pb-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-green-500" : "bg-muted-foreground/50"}`} />
                    {groupName} ({players.length})
                  </h3>
                  {isSelected && <Check className="w-5 h-5 text-green-500" />}
                  {allAssignedToOther && !isSelected && (
                    <span className="text-xs text-muted-foreground">On another device</span>
                  )}
                </div>
                <div className="px-3 pb-3 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    {players.map(player => {
                      const isAssignedToOther = player.deviceId && player.deviceId !== tournament.deviceId;
                      return (
                        <span
                          key={player.id}
                          className={`px-2 py-0.5 rounded text-sm ${
                            isSelected
                              ? "bg-green-500/20 text-green-700 dark:text-green-400 font-medium"
                              : isAssignedToOther
                              ? "bg-muted text-muted-foreground line-through"
                              : "bg-muted text-foreground"
                          }`}
                          data-testid={`player-option-${player.id}`}
                        >
                          {player.playerName}
                        </span>
                      );
                    })}
                  </div>
                  {someAssignedToOther && !allAssignedToOther && (
                    <p className="text-xs text-muted-foreground mt-1.5">Some players assigned to another device</p>
                  )}
                </div>
              </div>
            );
          })}

          {tournament.allPlayers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No players registered yet.</p>
              <p className="text-sm">Wait for the Tournament Director to add players.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSaving || selectedPlayerIds.length === 0}
            className="flex-1"
            data-testid="button-confirm-players"
          >
            {isSaving ? "Saving..." : selectedGroup ? `Score for ${selectedGroup} (${selectedPlayerIds.length})` : "Select a Group"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
