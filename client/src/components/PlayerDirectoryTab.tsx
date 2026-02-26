import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Users, 
  Trash2, 
  Merge,
  Search,
  Trophy,
  Target,
  AlertTriangle,
  History,
  User,
  Mail,
  Phone,
  Shirt,
  ChevronRight,
  BarChart3,
  CircleSlash,
  OctagonAlert,
  ArrowUpDown,
  Activity,
  Radio,
  KeyRound,
  Bell,
  Send,
  BellOff,
  Download,
  Upload
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UniversalPlayer, PlayerTournamentHistory } from "@shared/schema";

interface PlayerDirectoryTabProps {
  directorPin: string;
  onNotifyPlayer?: (playerId: number, playerName: string) => void;
}

interface LiveTournamentStat {
  tournamentId: number;
  tournamentName: string;
  roomCode: string;
  playerName: string;
  holesPlayed: number;
  totalStrokes: number;
  totalPar: number;
  relativeToPar: number;
  totalPenalties: number;
  totalScratches: number;
}

interface PlayerWithHistory extends UniversalPlayer {
  recentHistory?: PlayerTournamentHistory[];
  liveTournaments?: LiveTournamentStat[];
  ppt?: number | null;
  ppc?: number | null;
}

export function PlayerDirectoryTab({ directorPin, onNotifyPlayer }: PlayerDirectoryTabProps) {
  const { toast } = useToast();
  const [players, setPlayers] = useState<PlayerWithHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<UniversalPlayer | null>(null);
  const [showMergeDialog, setShowMergeDialog] = useState<UniversalPlayer | null>(null);
  const [showPlayerDialog, setShowPlayerDialog] = useState<PlayerWithHistory | null>(null);
  const [showAddHistoryDialog, setShowAddHistoryDialog] = useState(false);
  
  const [sortBy, setSortBy] = useState<"name" | "handicap" | "code" | "tournaments" | "ppt" | "ppc">("name");
  
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerEmail, setNewPlayerEmail] = useState("");
  const [newPlayerCode, setNewPlayerCode] = useState("");
  const importFileRef = useRef<HTMLInputElement>(null);
  
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editShirtSize, setEditShirtSize] = useState("");
  const [handicapValue, setHandicapValue] = useState("");
  
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [historyTournamentName, setHistoryTournamentName] = useState("");
  const [historyCourseName, setHistoryCourseName] = useState("");
  const [historyTotalStrokes, setHistoryTotalStrokes] = useState("");
  const [historyTotalPar, setHistoryTotalPar] = useState("");
  const [historyHolesPlayed, setHistoryHolesPlayed] = useState("18");
  const [historyPenalties, setHistoryPenalties] = useState("0");
  const [historyScratches, setHistoryScratches] = useState("0");
  
  const [playerPushEnabled, setPlayerPushEnabled] = useState(false);
  const [playerPushLoading, setPlayerPushLoading] = useState(false);
  const [playerNotifTitle, setPlayerNotifTitle] = useState("");
  const [playerNotifBody, setPlayerNotifBody] = useState("");
  const [sendingPlayerNotif, setSendingPlayerNotif] = useState(false);
  
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

  const playerDialogIdRef = useRef<number | null>(null);
  playerDialogIdRef.current = showPlayerDialog?.id ?? null;

  useEffect(() => {
    if (!showPlayerDialog) return;
    const interval = setInterval(() => {
      const id = playerDialogIdRef.current;
      if (id !== null) {
        refreshPlayerDialog(id);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [showPlayerDialog?.id]);

  const filteredPlayers = players
    .filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.uniqueCode && p.uniqueCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "handicap": {
          const ha = a.handicap ?? 999;
          const hb = b.handicap ?? 999;
          return ha - hb;
        }
        case "code": {
          const na = parseInt(a.uniqueCode?.replace("PC", "") ?? "0", 10);
          const nb = parseInt(b.uniqueCode?.replace("PC", "") ?? "0", 10);
          return na - nb;
        }
        case "tournaments":
          return (b.completedTournaments ?? 0) - (a.completedTournaments ?? 0);
        case "ppt": {
          const pa = a.ppt ?? Infinity;
          const pb = b.ppt ?? Infinity;
          return pa - pb;
        }
        case "ppc": {
          const ca = a.ppc ?? Infinity;
          const cb = b.ppc ?? Infinity;
          return ca - cb;
        }
        default:
          return 0;
      }
    });

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    setIsSaving(true);
    
    try {
      const body: any = {
        directorPin,
        name: newPlayerName.trim(),
        email: newPlayerEmail.trim() || null,
      };
      if (newPlayerCode.trim()) {
        const code = newPlayerCode.trim().toUpperCase();
        if (!/^PC\d+$/.test(code)) {
          toast({ title: "Invalid code format. Use PC followed by numbers (e.g., PC7000)", variant: "destructive" });
          setIsSaving(false);
          return;
        }
        body.uniqueCode = code;
      }
      await apiRequest("POST", "/api/universal-players", body);
      setShowAddDialog(false);
      setNewPlayerName("");
      setNewPlayerEmail("");
      setNewPlayerCode("");
      toast({ title: "Player added!" });
      await fetchPlayers();
    } catch (err: any) {
      console.error("Failed to add player:", err);
      const msg = err?.message || "Failed to add player";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPlayers = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/export/players?directorPin=${encodeURIComponent(directorPin)}`);
      if (!response.ok) throw new Error("Export failed");
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `players-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: `Exported ${data.universalPlayers.length} players` });
    } catch (err) {
      console.error("Export failed:", err);
      toast({ title: "Failed to export players", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportPlayers = async (file: File) => {
    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.universalPlayers || !Array.isArray(data.universalPlayers)) {
        toast({ title: "Invalid file format - expected player export JSON", variant: "destructive" });
        return;
      }
      const response = await fetch("/api/import/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directorPin, data }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Import failed");
      }
      const result = await response.json();
      toast({ title: `Imported ${result.playersImported} players (${result.playersSkipped} skipped, ${result.historyImported} history entries)` });
      await fetchPlayers();
    } catch (err: any) {
      console.error("Import failed:", err);
      toast({ title: err?.message || "Failed to import player data", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const checkPlayerPushStatus = async (playerId: number) => {
    setPlayerPushLoading(true);
    try {
      const response = await fetch(`/api/push/player-status/${playerId}?directorPin=${encodeURIComponent(directorPin)}`);
      if (response.ok) {
        const data = await response.json();
        setPlayerPushEnabled(data.hasSubscription);
      } else {
        setPlayerPushEnabled(false);
      }
    } catch {
      setPlayerPushEnabled(false);
    } finally {
      setPlayerPushLoading(false);
    }
  };

  const handleSendPlayerNotification = async () => {
    if (!showPlayerDialog || !playerNotifTitle.trim() || !playerNotifBody.trim()) return;
    setSendingPlayerNotif(true);
    try {
      await apiRequest("POST", "/api/push/send-to-player", {
        directorPin,
        universalPlayerId: showPlayerDialog.id,
        title: playerNotifTitle.trim(),
        body: playerNotifBody.trim(),
      });
      toast({ title: "Notification sent", description: `Sent to ${showPlayerDialog.name}` });
      setPlayerNotifTitle("");
      setPlayerNotifBody("");
    } catch (err) {
      console.error("Failed to send notification:", err);
      toast({ title: "Failed to send notification", variant: "destructive" });
    } finally {
      setSendingPlayerNotif(false);
    }
  };

  const openPlayerDialog = async (player: UniversalPlayer) => {
    try {
      setPlayerNotifTitle("");
      setPlayerNotifBody("");
      const response = await fetch(`/api/universal-players/${player.id}?directorPin=${encodeURIComponent(directorPin)}`);
      if (response.ok) {
        const data: PlayerWithHistory = await response.json();
        setEditName(data.name);
        setEditEmail(data.email || "");
        setEditPhone(data.phoneNumber || "");
        setEditShirtSize(data.tShirtSize || "");
        setHandicapValue(data.handicap?.toString() || "");
        setShowPlayerDialog(data);
        checkPlayerPushStatus(data.id);
      }
    } catch (err) {
      console.error("Failed to fetch player:", err);
      toast({ title: "Failed to load player", variant: "destructive" });
    }
  };

  const refreshPlayerDialog = async (playerId: number) => {
    try {
      const response = await fetch(`/api/universal-players/${playerId}?directorPin=${encodeURIComponent(directorPin)}`);
      if (response.ok) {
        const data: PlayerWithHistory = await response.json();
        setShowPlayerDialog(data);
      }
    } catch (err) {
      console.error("Failed to refresh player:", err);
    }
  };

  const handleSaveProfile = async () => {
    if (!showPlayerDialog || !editName.trim()) return;
    setIsSaving(true);
    
    try {
      await apiRequest("PATCH", `/api/universal-players/${showPlayerDialog.id}`, {
        directorPin,
        name: editName.trim(),
        email: editEmail.trim() || null,
        phoneNumber: editPhone.trim() || null,
        tShirtSize: editShirtSize || null,
      });
      toast({ title: "Profile saved!" });
      await fetchPlayers();
      await refreshPlayerDialog(showPlayerDialog.id);
    } catch (err) {
      console.error("Failed to save profile:", err);
      toast({ title: "Failed to save profile", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetHandicap = async () => {
    if (!showPlayerDialog) return;
    setIsSaving(true);
    
    const handicap = handicapValue.trim() ? parseFloat(handicapValue) : null;
    
    try {
      await apiRequest("PATCH", `/api/universal-players/${showPlayerDialog.id}`, {
        directorPin,
        handicap,
        isProvisional: false,
      });
      toast({ title: "Handicap updated!", description: handicap !== null ? `Set to ${handicap}` : "Handicap cleared" });
      await fetchPlayers();
      await refreshPlayerDialog(showPlayerDialog.id);
    } catch (err) {
      console.error("Failed to set handicap:", err);
      toast({ title: "Failed to set handicap", variant: "destructive" });
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
      setShowPlayerDialog(null);
      toast({ title: "Player deleted" });
      await fetchPlayers();
    } catch (err) {
      console.error("Failed to delete player:", err);
      toast({ title: "Failed to delete player", variant: "destructive" });
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
      setShowPlayerDialog(null);
      toast({ title: "Players merged!" });
      await fetchPlayers();
    } catch (err) {
      console.error("Failed to merge players:", err);
      toast({ title: "Failed to merge players", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddHistory = async () => {
    if (!showPlayerDialog) return;
    if (!historyTournamentName.trim() || !historyTotalStrokes || !historyTotalPar || !historyHolesPlayed) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    
    try {
      await apiRequest("POST", `/api/universal-players/${showPlayerDialog.id}/history`, {
        directorPin,
        tournamentName: historyTournamentName.trim(),
        courseName: historyCourseName.trim() || null,
        totalStrokes: parseInt(historyTotalStrokes),
        totalPar: parseInt(historyTotalPar),
        holesPlayed: parseInt(historyHolesPlayed),
        totalPenalties: parseInt(historyPenalties) || 0,
        totalScratches: parseInt(historyScratches) || 0,
      });
      setShowAddHistoryDialog(false);
      resetHistoryForm();
      toast({ title: "Tournament history added!" });
      await fetchPlayers();
      await refreshPlayerDialog(showPlayerDialog.id);
    } catch (err) {
      console.error("Failed to add history:", err);
      toast({ title: "Failed to add history", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHistory = async (historyId: number) => {
    if (!showPlayerDialog) return;
    setIsSaving(true);
    
    try {
      await apiRequest("DELETE", `/api/universal-players/${showPlayerDialog.id}/history/${historyId}`, {
        directorPin,
      });
      toast({ title: "History entry deleted" });
      await fetchPlayers();
      await refreshPlayerDialog(showPlayerDialog.id);
    } catch (err) {
      console.error("Failed to delete history:", err);
      toast({ title: "Failed to delete history", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const resetHistoryForm = () => {
    setHistoryTournamentName("");
    setHistoryCourseName("");
    setHistoryTotalStrokes("");
    setHistoryTotalPar("");
    setHistoryHolesPlayed("18");
    setHistoryPenalties("0");
    setHistoryScratches("0");
  };

  const getHandicapDisplay = (player: UniversalPlayer) => {
    if (player.handicap === null || player.handicap === undefined) {
      return "\u2014";
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

  const computeStats = (history?: PlayerTournamentHistory[], live?: LiveTournamentStat[]) => {
    const hasHistory = history && history.length > 0;
    const hasLive = live && live.length > 0;
    if (!hasHistory && !hasLive) {
      return { ppt: null, ppc: null, totalPenalties: 0, totalScratches: 0, totalHoles: 0 };
    }
    let totalPenalties = 0;
    let totalScratches = 0;
    let totalHoles = 0;
    let tournamentCount = 0;
    if (hasHistory) {
      for (const entry of history) {
        totalPenalties += entry.totalPenalties ?? 0;
        totalScratches += entry.totalScratches ?? 0;
        totalHoles += entry.holesPlayed;
      }
      tournamentCount += history.length;
    }
    if (hasLive) {
      for (const entry of live) {
        totalPenalties += entry.totalPenalties;
        totalScratches += entry.totalScratches;
        totalHoles += entry.holesPlayed;
      }
      tournamentCount += live.length;
    }
    const infractions = totalPenalties + totalScratches;
    const ppt = tournamentCount > 0 ? infractions / tournamentCount : null;
    const ppc = totalHoles > 0 ? infractions / totalHoles : null;
    return { ppt, ppc, totalPenalties, totalScratches, totalHoles };
  };

  return (
    <div className="flex flex-col p-4 space-y-4">
      <input
        type="file"
        ref={importFileRef}
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportPlayers(file);
          e.target.value = "";
        }}
        data-testid="input-import-file"
      />
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
          Add
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleExportPlayers}
          disabled={isExporting}
          title="Export players"
          data-testid="button-export-players"
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => importFileRef.current?.click()}
          disabled={isImporting}
          title="Import players"
          data-testid="button-import-players"
        >
          <Upload className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-[180px]" data-testid="select-sort">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name" data-testid="sort-option-name">Name (A-Z)</SelectItem>
            <SelectItem value="code" data-testid="sort-option-code">Player Number</SelectItem>
            <SelectItem value="handicap" data-testid="sort-option-handicap">Handicap</SelectItem>
            <SelectItem value="tournaments" data-testid="sort-option-tournaments">Tournaments Played</SelectItem>
            <SelectItem value="ppt" data-testid="sort-option-ppt">PPT (Lowest)</SelectItem>
            <SelectItem value="ppc" data-testid="sort-option-ppc">PPC (Lowest)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filteredPlayers.length} players</span>
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
              className="p-4 cursor-pointer hover-elevate"
              onClick={() => openPlayerDialog(player)}
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
                    <span className="flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      PPT: {player.ppt !== null && player.ppt !== undefined ? player.ppt.toFixed(1) : "\u2014"}
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      PPC: {player.ppc !== null && player.ppc !== undefined ? player.ppc.toFixed(2) : "\u2014"}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="text-center text-sm text-muted-foreground pt-4">
        {players.length} total players in directory
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Add New Player
            </DialogTitle>
            <DialogDescription>
              A unique ID will be generated automatically, or enter a custom code.
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
              <Label htmlFor="player-code">Player Code (optional)</Label>
              <Input
                id="player-code"
                value={newPlayerCode}
                onChange={(e) => setNewPlayerCode(e.target.value)}
                placeholder="e.g., PC7000 (auto-generated if blank)"
                data-testid="input-new-player-code"
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
                Cancel
              </Button>
              <Button 
                onClick={handleAddPlayer}
                disabled={isSaving || !newPlayerName.trim()}
                className="flex-1"
                data-testid="button-confirm-add"
              >
                {isSaving ? "Adding..." : "Add Player"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showPlayerDialog} onOpenChange={() => setShowPlayerDialog(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {showPlayerDialog && (
            <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {showPlayerDialog.name}
            </DialogTitle>
            <DialogDescription>
              <span className="font-mono">{showPlayerDialog.uniqueCode}</span>
              {" \u2022 "}
              {getStatusBadge(showPlayerDialog)}
            </DialogDescription>
          </DialogHeader>
          
            <Tabs defaultValue="profile" className="mt-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
                <TabsTrigger value="stats" data-testid="tab-stats">Stats</TabsTrigger>
                <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
              </TabsList>
              
              <TabsContent value="profile" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-name" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="w-3 h-3" /> Name
                    </Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      data-testid="input-edit-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-email" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="w-3 h-3" /> Email
                    </Label>
                    <Input
                      id="edit-email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      type="email"
                      placeholder="Optional"
                      data-testid="input-edit-email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-phone" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" /> Phone
                    </Label>
                    <Input
                      id="edit-phone"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      type="tel"
                      placeholder="Optional"
                      data-testid="input-edit-phone"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-shirt" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Shirt className="w-3 h-3" /> T-Shirt Size
                    </Label>
                    <Select value={editShirtSize} onValueChange={setEditShirtSize}>
                      <SelectTrigger data-testid="select-shirt-size">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="XS">XS</SelectItem>
                        <SelectItem value="S">S</SelectItem>
                        <SelectItem value="M">M</SelectItem>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="XL">XL</SelectItem>
                        <SelectItem value="2XL">2XL</SelectItem>
                        <SelectItem value="3XL">3XL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="handicap-value" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Target className="w-3 h-3" /> Handicap Override
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="handicap-value"
                        value={handicapValue}
                        onChange={(e) => setHandicapValue(e.target.value)}
                        placeholder="e.g., 2.5"
                        type="number"
                        step="0.1"
                        className="flex-1"
                        data-testid="input-handicap"
                      />
                      <Button
                        variant="outline"
                        onClick={handleSetHandicap}
                        disabled={isSaving}
                        data-testid="button-set-handicap"
                      >
                        {isSaving ? "..." : "Set"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Current: {getHandicapDisplay(showPlayerDialog)} | Leave blank to clear
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving || !editName.trim()}
                  className="w-full"
                  data-testid="button-save-profile"
                >
                  {isSaving ? "Saving..." : "Save Profile"}
                </Button>

                <div className="border-t pt-3 space-y-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {playerPushLoading ? (
                        <Bell className="w-4 h-4 text-muted-foreground animate-pulse" />
                      ) : playerPushEnabled ? (
                        <Bell className="w-4 h-4 text-green-500" />
                      ) : (
                        <BellOff className="w-4 h-4 text-muted-foreground" />
                      )}
                      Push Notifications
                      {!playerPushLoading && !playerPushEnabled && (
                        <span className="text-xs text-muted-foreground">(not enabled)</span>
                      )}
                    </div>
                    {onNotifyPlayer ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          if (showPlayerDialog) {
                            setShowPlayerDialog(null);
                            onNotifyPlayer(showPlayerDialog.id, showPlayerDialog.name);
                          }
                        }}
                        disabled={!playerPushEnabled || playerPushLoading}
                        data-testid="button-notify-player-shortcut"
                      >
                        <Send className="w-4 h-4 mr-1.5" />
                        Send Notification
                      </Button>
                    ) : (
                      <>
                        <Input
                          placeholder="Notification title"
                          value={playerNotifTitle}
                          onChange={(e) => setPlayerNotifTitle(e.target.value)}
                          disabled={!playerPushEnabled || sendingPlayerNotif}
                          data-testid="input-player-notif-title"
                        />
                        <Input
                          placeholder="Notification message"
                          value={playerNotifBody}
                          onChange={(e) => setPlayerNotifBody(e.target.value)}
                          disabled={!playerPushEnabled || sendingPlayerNotif}
                          data-testid="input-player-notif-body"
                        />
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handleSendPlayerNotification}
                          disabled={!playerPushEnabled || !playerNotifTitle.trim() || !playerNotifBody.trim() || sendingPlayerNotif}
                          data-testid="button-send-player-notif"
                        >
                          <Send className="w-4 h-4 mr-1.5" />
                          {sendingPlayerNotif ? "Sending..." : "Send Notification"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      if (!showPlayerDialog?.uniqueCode) return;
                      try {
                        setIsSaving(true);
                        await apiRequest("POST", `/api/player/${showPlayerDialog.uniqueCode}/remove-pin`, {
                          directorPin,
                        });
                        toast({ title: "PIN removed", description: "Player can now set a new PIN on their next login." });
                      } catch (err) {
                        console.error("Failed to remove PIN:", err);
                        toast({ title: "Failed to remove PIN", variant: "destructive" });
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving}
                    data-testid="button-remove-pin"
                  >
                    <KeyRound className="w-4 h-4 mr-1.5" />
                    Remove PIN
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowMergeDialog(showPlayerDialog);
                      }}
                      data-testid="button-merge"
                    >
                      <Merge className="w-4 h-4 mr-1.5" />
                      Merge
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-destructive"
                      onClick={() => setShowDeleteDialog(showPlayerDialog)}
                      data-testid="button-delete"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="stats" className="space-y-4 mt-4">
                {(() => {
                  const stats = computeStats(showPlayerDialog.recentHistory, showPlayerDialog.liveTournaments);
                  const liveTournaments = showPlayerDialog.liveTournaments || [];
                  return (
                    <>
                      {liveTournaments.length > 0 && (
                        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-1.5">
                            <Radio className="w-4 h-4 text-green-500 animate-pulse" />
                            Live Tournaments
                          </h4>
                          {liveTournaments.map(lt => {
                            const relSign = lt.relativeToPar >= 0 ? "+" : "";
                            return (
                              <div key={lt.tournamentId} className="flex items-center justify-between gap-2 text-sm bg-background/50 rounded-md p-2" data-testid={`live-tournament-${lt.tournamentId}`}>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{lt.tournamentName}</p>
                                  <p className="text-xs text-muted-foreground">{lt.holesPlayed} holes played</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={`font-bold ${lt.relativeToPar > 0 ? "text-red-500" : lt.relativeToPar < 0 ? "text-green-500" : ""}`}>
                                    {relSign}{lt.relativeToPar}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{lt.totalStrokes} strokes</p>
                                  {(lt.totalPenalties > 0 || lt.totalScratches > 0) && (
                                    <p className="text-[10px] text-muted-foreground">
                                      {lt.totalPenalties}P / {lt.totalScratches}S
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <p className="text-[10px] text-muted-foreground text-center">Updates every 10 seconds</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                          <Trophy className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                          <p className="text-2xl font-bold">
                            {showPlayerDialog.completedTournaments}
                            {liveTournaments.length > 0 && (
                              <span className="text-sm text-green-500 ml-1">+{liveTournaments.length}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">Tournaments</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                          <Target className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                          <p className="text-2xl font-bold">{getHandicapDisplay(showPlayerDialog)}</p>
                          <p className="text-xs text-muted-foreground">Handicap</p>
                        </div>
                      </div>

                      <div className="border-t pt-3">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4" />
                          Infractions
                          {liveTournaments.length > 0 && (
                            <span className="text-[10px] text-green-500 font-normal">(incl. live)</span>
                          )}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <OctagonAlert className="w-5 h-5 mx-auto mb-1 text-red-500" />
                            <p className="text-2xl font-bold">{stats.totalPenalties}</p>
                            <p className="text-xs text-muted-foreground">Total Penalties</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <CircleSlash className="w-5 h-5 mx-auto mb-1 text-orange-500" />
                            <p className="text-2xl font-bold">{stats.totalScratches}</p>
                            <p className="text-xs text-muted-foreground">Total Scratches</p>
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-3">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4" />
                          Averages
                          {liveTournaments.length > 0 && (
                            <span className="text-[10px] text-green-500 font-normal">(incl. live)</span>
                          )}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-muted/50 rounded-lg p-3 text-center" data-testid="stat-ppt">
                            <p className="text-2xl font-bold">
                              {stats.ppt !== null ? stats.ppt.toFixed(1) : "\u2014"}
                            </p>
                            <p className="text-xs text-muted-foreground">PPT</p>
                            <p className="text-[10px] text-muted-foreground">(Penalties Per Tournament)</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center" data-testid="stat-ppc">
                            <p className="text-2xl font-bold">
                              {stats.ppc !== null ? stats.ppc.toFixed(2) : "\u2014"}
                            </p>
                            <p className="text-xs text-muted-foreground">PPC</p>
                            <p className="text-[10px] text-muted-foreground">(Penalties Per Course Hole)</p>
                          </div>
                        </div>
                      </div>

                      {(showPlayerDialog.recentHistory?.length || 0) + liveTournaments.length > 0 && (
                        <div className="border-t pt-3">
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                            Scoring Average
                            {liveTournaments.length > 0 && (
                              <span className="text-[10px] text-green-500 font-normal">(incl. live)</span>
                            )}
                          </h4>
                          {(() => {
                            const hist = showPlayerDialog.recentHistory || [];
                            const allEntries = [
                              ...hist.map(e => ({ relativeToPar: e.relativeToPar, totalStrokes: e.totalStrokes })),
                              ...liveTournaments.map(e => ({ relativeToPar: e.relativeToPar, totalStrokes: e.totalStrokes })),
                            ];
                            if (allEntries.length === 0) return null;
                            const avgRelative = allEntries.reduce((s, e) => s + e.relativeToPar, 0) / allEntries.length;
                            const avgStrokes = allEntries.reduce((s, e) => s + e.totalStrokes, 0) / allEntries.length;
                            return (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-muted/50 rounded-lg p-3 text-center">
                                  <p className={`text-2xl font-bold ${avgRelative > 0 ? "text-red-500" : avgRelative < 0 ? "text-green-500" : ""}`}>
                                    {avgRelative >= 0 ? "+" : ""}{avgRelative.toFixed(1)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">Avg vs Par</p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-3 text-center">
                                  <p className="text-2xl font-bold">{avgStrokes.toFixed(1)}</p>
                                  <p className="text-xs text-muted-foreground">Avg Strokes</p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  );
                })()}
              </TabsContent>
              
              <TabsContent value="history" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {showPlayerDialog.recentHistory?.length || 0} tournaments
                  </span>
                  <Button 
                    size="sm"
                    onClick={() => {
                      resetHistoryForm();
                      setShowAddHistoryDialog(true);
                    }}
                    data-testid="button-add-history"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Entry
                  </Button>
                </div>
                
                {showPlayerDialog.recentHistory && showPlayerDialog.recentHistory.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {showPlayerDialog.recentHistory.map((entry) => (
                      <div 
                        key={entry.id} 
                        className="flex items-center justify-between gap-2 p-3 border rounded-lg"
                        data-testid={`history-entry-${entry.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{entry.tournamentName}</span>
                            {entry.isManualEntry && (
                              <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-600 rounded">
                                Manual
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {entry.courseName && <span>{entry.courseName} {"\u2022"} </span>}
                            {entry.holesPlayed} holes {"\u2022"} {entry.totalStrokes} strokes (par {entry.totalPar})
                            <span className={entry.relativeToPar > 0 ? "text-red-500" : entry.relativeToPar < 0 ? "text-green-500" : ""}>
                              {" "}({entry.relativeToPar >= 0 ? "+" : ""}{entry.relativeToPar})
                            </span>
                          </div>
                          {((entry.totalPenalties ?? 0) > 0 || (entry.totalScratches ?? 0) > 0) && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {(entry.totalPenalties ?? 0) > 0 && (
                                <span className="text-red-500 mr-2">
                                  {entry.totalPenalties} {entry.totalPenalties === 1 ? "penalty" : "penalties"}
                                </span>
                              )}
                              {(entry.totalScratches ?? 0) > 0 && (
                                <span className="text-orange-500">
                                  {entry.totalScratches} {entry.totalScratches === 1 ? "scratch" : "scratches"}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(entry.completedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDeleteHistory(entry.id)}
                          disabled={isSaving}
                          data-testid={`button-delete-history-${entry.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No tournament history yet
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAddHistoryDialog && !!showPlayerDialog} onOpenChange={setShowAddHistoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Add Tournament History
            </DialogTitle>
            <DialogDescription>
              Manually add a past tournament result for <span className="font-semibold">{showPlayerDialog?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="history-tournament-name">Tournament Name *</Label>
              <Input
                id="history-tournament-name"
                value={historyTournamentName}
                onChange={(e) => setHistoryTournamentName(e.target.value)}
                placeholder="e.g., Spring Classic 2024"
                data-testid="input-history-tournament-name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-course-name">Course Name (optional)</Label>
              <Input
                id="history-course-name"
                value={historyCourseName}
                onChange={(e) => setHistoryCourseName(e.target.value)}
                placeholder="e.g., Riverside Mini Golf"
                data-testid="input-history-course-name"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="history-strokes">Strokes *</Label>
                <Input
                  id="history-strokes"
                  value={historyTotalStrokes}
                  onChange={(e) => setHistoryTotalStrokes(e.target.value)}
                  placeholder="54"
                  type="number"
                  data-testid="input-history-strokes"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="history-par">Par *</Label>
                <Input
                  id="history-par"
                  value={historyTotalPar}
                  onChange={(e) => setHistoryTotalPar(e.target.value)}
                  placeholder="54"
                  type="number"
                  data-testid="input-history-par"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="history-holes">Holes *</Label>
                <Input
                  id="history-holes"
                  value={historyHolesPlayed}
                  onChange={(e) => setHistoryHolesPlayed(e.target.value)}
                  placeholder="18"
                  type="number"
                  data-testid="input-history-holes"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="history-penalties" className="flex items-center gap-1">
                  <OctagonAlert className="w-3 h-3 text-red-500" /> Penalties
                </Label>
                <Input
                  id="history-penalties"
                  value={historyPenalties}
                  onChange={(e) => setHistoryPenalties(e.target.value)}
                  placeholder="0"
                  type="number"
                  min="0"
                  data-testid="input-history-penalties"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="history-scratches" className="flex items-center gap-1">
                  <CircleSlash className="w-3 h-3 text-orange-500" /> Scratches
                </Label>
                <Input
                  id="history-scratches"
                  value={historyScratches}
                  onChange={(e) => setHistoryScratches(e.target.value)}
                  placeholder="0"
                  type="number"
                  min="0"
                  data-testid="input-history-scratches"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This will be marked as a manual entry and will affect handicap calculation.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAddHistoryDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddHistory}
                disabled={isSaving || !historyTournamentName.trim() || !historyTotalStrokes || !historyTotalPar || !historyHolesPlayed}
                className="flex-1"
                data-testid="button-confirm-add-history"
              >
                {isSaving ? "Adding..." : "Add Entry"}
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
              Delete <span className="font-semibold">{showDeleteDialog?.name}</span> permanently.
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
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteDialog(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeletePlayer}
                disabled={isSaving}
                className="flex-1"
                data-testid="button-confirm-delete"
              >
                {isSaving ? "Deleting..." : "Delete"}
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
              <span className="font-semibold">{showMergeDialog?.name}</span> will be merged into another player.
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
              All tournament history from {showMergeDialog?.name} will be transferred and handicap recalculated.
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
                className="flex-1"
                data-testid="button-confirm-merge"
              >
                {isSaving ? "Merging..." : "Merge"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
