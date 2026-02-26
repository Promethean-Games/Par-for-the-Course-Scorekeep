import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Users, 
  Trophy, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Power, 
  BarChart3, 
  Bell,
  Edit2,
  Mail,
  Hash,
  Shuffle,
  Grid3X3,
  Wand2,
  ChevronDown,
  ChevronUp,
  UserPlus,
  AlertCircle,
  Play,
  Search,
  Link2,
  Star,
  Smartphone,
  Unlink,
  ClipboardList,
  Save,
  ArrowUpDown,
  Clock,
  DollarSign,
} from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";
import { apiRequest } from "@/lib/queryClient";
import { NotificationsTab } from "./NotificationsTab";
import { PayoutCalculator } from "./PayoutCalculator";

interface UniversalPlayer {
  id: number;
  name: string;
  email: string | null;
  contactInfo: string | null;
  uniqueCode: string;
  handicap: number | null;
  isProvisional: boolean;
  completedTournaments: number;
}

interface DirectorPortalProps {
  onClose: () => void;
}

type NavTab = "dashboard" | "leaderboard" | "notify";

interface EditPlayerData {
  id: number;
  playerName: string;
  groupName: string;
  universalId: string;
  contactInfo: string;
}

interface HoleScore {
  hole: number;
  par: number;
  strokes: number;
  scratches: number;
  penalties: number;
}

interface ScoreEntryData {
  playerId: number;
  playerName: string;
  scores: HoleScore[];
}

function formatRuntime(startedAt: string | null, completedAt: string | null, now: number): string | null {
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
}

export function DirectorPortal({ onClose }: DirectorPortalProps) {
  const tournament = useTournament();
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [showPayout, setShowPayout] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerGroup, setNewPlayerGroup] = useState("");
  const [newPlayerUniversalId, setNewPlayerUniversalId] = useState("");
  const [newPlayerContact, setNewPlayerContact] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const playerNameInputRef = useRef<HTMLInputElement>(null);
  const [editingPlayer, setEditingPlayer] = useState<EditPlayerData | null>(null);
  
  // Theme settings - synced from localStorage (TDDashboard owns persistence)
  type DirectorTheme = "default" | "dark-green" | "dark-blue" | "light";
  const parseTheme = (val: string | null): DirectorTheme => {
    if (val === "dark-green" || val === "dark-blue" || val === "light") return val;
    return "default";
  };
  const [directorTheme, setDirectorTheme] = useState<DirectorTheme>(() =>
    parseTheme(localStorage.getItem("directorTheme"))
  );
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "directorTheme") setDirectorTheme(parseTheme(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Group management settings
  const [numTables, setNumTables] = useState(4);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showGroupTools, setShowGroupTools] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [playerSortBy, setPlayerSortBy] = useState<"name" | "hole" | "score">("name");
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [dnfPlayer, setDnfPlayer] = useState<{ id: number; name: string } | null>(null);

  // Universal player search
  const [universalSearchQuery, setUniversalSearchQuery] = useState("");
  const [universalSearchResults, setUniversalSearchResults] = useState<UniversalPlayer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUniversalPlayer, setSelectedUniversalPlayer] = useState<UniversalPlayer | null>(null);
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  // Score entry state
  const [scoreEntryPlayer, setScoreEntryPlayer] = useState<ScoreEntryData | null>(null);
  const [isSavingScores, setIsSavingScores] = useState(false);
  const [numHoles, setNumHoles] = useState(18);
  
  // Leaderboard sorting
  type LeaderboardSort = "score" | "name" | "id" | "handicap";
  const [leaderboardSort, setLeaderboardSort] = useState<LeaderboardSort>("score");

  // Live tournament runtime timer
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const info = tournament.tournamentInfo;
    if (info?.startedAt && !info.completedAt) {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [tournament.tournamentInfo?.startedAt, tournament.tournamentInfo?.completedAt]);
  const [leaderboardSortAsc, setLeaderboardSortAsc] = useState(true);
  const [universalPlayersMap, setUniversalPlayersMap] = useState<Map<number, UniversalPlayer>>(new Map());

  const handleSearchUniversalPlayers = async (query: string) => {
    setUniversalSearchQuery(query);
    if (query.length < 2) {
      setUniversalSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const directorPin = localStorage.getItem("directorPin") || "3141";
      const res = await fetch(`/api/universal-players/search?query=${encodeURIComponent(query)}&directorPin=${directorPin}`);
      if (res.ok) {
        const data = await res.json();
        setUniversalSearchResults(data);
      }
    } catch (err) {
      console.error("Search error:", err);
    }
    setIsSearching(false);
  };

  const handleSelectUniversalPlayer = (player: UniversalPlayer) => {
    setSelectedUniversalPlayer(player);
    setNewPlayerName(player.name);
    setNewPlayerContact(player.email || player.contactInfo || "");
    setUniversalSearchQuery("");
    setUniversalSearchResults([]);
    setShowUniversalSearch(false);
  };

  const handleCreateUniversalPlayer = async (): Promise<UniversalPlayer | null> => {
    if (!newPlayerName.trim()) return null;
    try {
      const directorPin = localStorage.getItem("directorPin") || "3141";
      const res = await apiRequest("POST", "/api/universal-players", {
        name: newPlayerName.trim(),
        email: newPlayerContact.includes("@") ? newPlayerContact.trim() : null,
        contactInfo: !newPlayerContact.includes("@") ? newPlayerContact.trim() : null,
        directorPin,
      });
      const player = await res.json();
      setSelectedUniversalPlayer(player);
      return player;
    } catch (err) {
      console.error("Failed to create universal player:", err);
      return null;
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      tournament.refreshLeaderboard();
    }, 5000);
    return () => clearInterval(interval);
  }, [tournament]);

  useEffect(() => {
    const fetchUniversalPlayers = async () => {
      try {
        const directorPin = localStorage.getItem("directorPin") || "3141";
        const res = await fetch(`/api/universal-players?directorPin=${directorPin}`);
        if (res.ok) {
          const data: UniversalPlayer[] = await res.json();
          const map = new Map<number, UniversalPlayer>();
          data.forEach(p => map.set(p.id, p));
          setUniversalPlayersMap(map);
        }
      } catch (err) {
        console.error("Failed to fetch universal players:", err);
      }
    };
    fetchUniversalPlayers();
  }, []);

  const toggleLeaderboardSort = (col: LeaderboardSort) => {
    if (leaderboardSort === col) {
      setLeaderboardSortAsc(!leaderboardSortAsc);
    } else {
      setLeaderboardSort(col);
      setLeaderboardSortAsc(col === "name" || col === "id");
    }
  };

  const sortedLeaderboard = [...tournament.leaderboard].sort((a, b) => {
    const dir = leaderboardSortAsc ? 1 : -1;
    switch (leaderboardSort) {
      case "name":
        return dir * a.playerName.localeCompare(b.playerName);
      case "id": {
        const pA = tournament.allPlayers.find(p => p.id === a.playerId);
        const pB = tournament.allPlayers.find(p => p.id === b.playerId);
        const codeA = pA?.universalId || "";
        const codeB = pB?.universalId || "";
        return dir * codeA.localeCompare(codeB);
      }
      case "handicap": {
        const pA = tournament.allPlayers.find(p => p.id === a.playerId);
        const pB = tournament.allPlayers.find(p => p.id === b.playerId);
        const hcA = pA?.universalPlayerId ? (universalPlayersMap.get(pA.universalPlayerId)?.handicap ?? 999) : 999;
        const hcB = pB?.universalPlayerId ? (universalPlayersMap.get(pB.universalPlayerId)?.handicap ?? 999) : 999;
        return dir * (hcA - hcB);
      }
      case "score":
      default:
        return dir * (a.relativeToPar - b.relativeToPar || a.totalStrokes - b.totalStrokes || b.holesCompleted - a.holesCompleted);
    }
  });


  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    setIsAdding(true);
    
    // Get or create universal player - use returned value directly to avoid async state issues
    let universalPlayerId = selectedUniversalPlayer?.id;
    if (!universalPlayerId && newPlayerName.trim()) {
      const createdPlayer = await handleCreateUniversalPlayer();
      universalPlayerId = createdPlayer?.id;
    }
    
    const newPlayer = await tournament.addPlayerToTournament(
      newPlayerName.trim(),
      newPlayerGroup.trim() || undefined,
      newPlayerUniversalId.trim() || undefined,
      newPlayerContact.trim() || undefined
    );
    
    // Link to universal player using the universalPlayerId FK
    if (newPlayer && universalPlayerId) {
      try {
        const directorPin = localStorage.getItem("directorPin") || "3141";
        await apiRequest("POST", `/api/tournaments/${tournament.roomCode}/players/${newPlayer.id}/link-universal`, {
          universalPlayerId,
          directorPin,
        });
      } catch (err) {
        console.error("Failed to link universal player:", err);
      }
    }
    
    setNewPlayerName("");
    setNewPlayerGroup("");
    setNewPlayerUniversalId("");
    setNewPlayerContact("");
    setSelectedUniversalPlayer(null);
    setIsAdding(false);
    
    // Refocus the player name input for smooth flow
    setTimeout(() => playerNameInputRef.current?.focus(), 0);
  };

  const handleRemovePlayer = async (playerId: number) => {
    await tournament.removePlayerFromTournament(playerId);
  };

  const handleUnassignDevice = async (playerId: number) => {
    try {
      const directorPin = localStorage.getItem("directorPin") || "3141";
      await apiRequest("POST", `/api/tournaments/${tournament.roomCode}/players/${playerId}/unassign-device`, {
        directorPin,
      });
      await tournament.refreshPlayers();
    } catch (err) {
      console.error("Failed to unassign device:", err);
    }
  };

  const handleCompleteTournament = async () => {
    setIsCompleting(true);
    try {
      const directorPin = localStorage.getItem("directorPin") || "3141";
      const res = await apiRequest("POST", `/api/tournaments/${tournament.roomCode}/complete`, {
        directorPin,
      });
      const data = await res.json();
      setShowConfirmComplete(false);
      
      const savedCount = data.saved?.length || 0;
      const skippedCount = data.skipped?.length || 0;
      const duplicateCount = data.alreadyRecorded?.length || 0;
      const totalCount = savedCount + skippedCount + duplicateCount;
      
      const parts: string[] = [];
      parts.push(`Records saved: ${savedCount}/${totalCount}. ${duplicateCount} duplicate${duplicateCount !== 1 ? "s" : ""}.`);
      if (data.saved?.length > 0) parts.push(`Saved: ${data.saved.join(", ")}`);
      if (data.skipped?.length > 0) parts.push(`Skipped: ${data.skipped.join(", ")}`);
      if (data.alreadyRecorded?.length > 0) parts.push(`Already recorded: ${data.alreadyRecorded.join(", ")}`);
      alert(parts.join("\n\n"));
      await tournament.refreshPlayers();
      await tournament.refreshLeaderboard();
    } catch (err) {
      console.error("Failed to complete tournament:", err);
      alert("Failed to complete tournament. Please try again.");
    }
    setIsCompleting(false);
  };

  const handleEditPlayer = (player: typeof tournament.allPlayers[0]) => {
    setEditingPlayer({
      id: player.id,
      playerName: player.playerName,
      groupName: player.groupName || "",
      universalId: "",
      contactInfo: "",
    });
  };

  const handleLinkPlayer = async (player: typeof tournament.allPlayers[0]) => {
    try {
      const directorPin = localStorage.getItem("directorPin") || "3141";
      
      const res = await apiRequest("POST", "/api/universal-players", {
        name: player.playerName,
        email: null,
        contactInfo: null,
        directorPin,
      });
      const universalPlayer = await res.json();
      
      await apiRequest("POST", `/api/tournaments/${tournament.roomCode}/players/${player.id}/link-universal`, {
        universalPlayerId: universalPlayer.id,
        directorPin,
      });
      
      await tournament.refreshPlayers();
    } catch (err) {
      console.error("Failed to link player:", err);
    }
  };

  const handleSavePlayer = async () => {
    if (editingPlayer) {
      await tournament.updatePlayer(editingPlayer.id, {
        playerName: editingPlayer.playerName,
        groupName: editingPlayer.groupName || undefined,
        universalId: editingPlayer.universalId || undefined,
        contactInfo: editingPlayer.contactInfo || undefined,
      });
      setEditingPlayer(null);
    }
  };

  // Open score entry for a player
  const handleOpenScoreEntry = async (player: typeof tournament.allPlayers[0]) => {
    try {
      const directorPin = localStorage.getItem("directorPin") || "3141";
      const res = await fetch(`/api/tournaments/${tournament.roomCode}/players/${player.id}/scores?directorPin=${encodeURIComponent(directorPin)}`);
      const existingScores = res.ok ? await res.json() : [];
      
      // Determine number of holes from existing scores or default to 18
      const maxHole = existingScores.length > 0 
        ? Math.max(...existingScores.map((s: HoleScore) => s.hole)) 
        : 18;
      const holesCount = Math.max(maxHole, 18);
      setNumHoles(holesCount);
      
      // Initialize scores for all holes
      const scores: HoleScore[] = [];
      for (let i = 1; i <= holesCount; i++) {
        const existing = existingScores.find((s: HoleScore) => s.hole === i);
        scores.push({
          hole: i,
          par: existing?.par || 0,
          strokes: existing?.strokes || 0,
          scratches: existing?.scratches || 0,
          penalties: existing?.penalties || 0,
        });
      }
      
      setScoreEntryPlayer({
        playerId: player.id,
        playerName: player.playerName,
        scores,
      });
    } catch (err) {
      console.error("Failed to load player scores:", err);
    }
  };

  // Update a single hole score
  const handleUpdateHoleScore = (hole: number, field: keyof HoleScore, value: number) => {
    if (!scoreEntryPlayer) return;
    setScoreEntryPlayer({
      ...scoreEntryPlayer,
      scores: scoreEntryPlayer.scores.map(s => 
        s.hole === hole ? { ...s, [field]: value } : s
      ),
    });
  };

  // Save all scores for a player
  const handleSaveScores = async () => {
    if (!scoreEntryPlayer) return;
    setIsSavingScores(true);
    
    try {
      // Filter out holes with no scores entered
      const scoresToSave = scoreEntryPlayer.scores.filter(s => s.par > 0 && s.strokes > 0);
      
      if (scoresToSave.length > 0) {
        await apiRequest("POST", `/api/tournaments/${tournament.roomCode}/scores/batch`, {
          scores: scoresToSave.map(s => ({
            tournamentPlayerId: scoreEntryPlayer.playerId,
            hole: s.hole,
            par: s.par,
            strokes: s.strokes,
            scratches: s.scratches,
            penalties: s.penalties,
          })),
        });
      }
      
      await tournament.refreshLeaderboard();
      setScoreEntryPlayer(null);
    } catch (err) {
      console.error("Failed to save scores:", err);
    }
    
    setIsSavingScores(false);
  };

  // Distribute players evenly across the set number of tables
  const distributePlayersToGroups = (players: { id: number }[], tables: number) => {
    const updates: { playerId: number; groupName: string }[] = [];
    players.forEach((player, index) => {
      const groupNum = (index % tables) + 1;
      updates.push({ 
        playerId: player.id, 
        groupName: `Group ${groupNum}` 
      });
    });
    return updates;
  };

  // Auto-assign players to groups evenly across tables
  const handleAutoAssignGroups = async () => {
    if (tournament.allPlayers.length === 0) return;
    setIsAutoAssigning(true);
    
    const players = [...tournament.allPlayers];
    const tables = Math.min(numTables, players.length);
    const updates = distributePlayersToGroups(players, tables);
    
    await tournament.batchUpdatePlayerGroups(updates);
    setIsAutoAssigning(false);
  };

  // Shuffle players randomly into groups
  const handleShuffleGroups = async () => {
    if (tournament.allPlayers.length === 0) return;
    setIsShuffling(true);
    
    // Fisher-Yates shuffle
    const players = [...tournament.allPlayers];
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
    
    const tables = Math.min(numTables, players.length);
    const updates = distributePlayersToGroups(players, tables);
    
    await tournament.batchUpdatePlayerGroups(updates);
    setIsShuffling(false);
  };

  // Clear all group assignments
  const handleClearGroups = async () => {
    if (tournament.allPlayers.length === 0) return;
    const updates = tournament.allPlayers.map(player => ({
      playerId: player.id,
      groupName: null as string | null,
    }));
    await tournament.batchUpdatePlayerGroups(updates);
  };

  // Start tournament
  const handleStartTournament = async () => {
    setIsStarting(true);
    await tournament.startTournament();
    setIsStarting(false);
  };

  const leaderboardMap = new Map(
    tournament.leaderboard.map(e => [e.playerId, e])
  );

  const sortPlayers = (players: typeof tournament.allPlayers) => {
    return [...players].sort((a, b) => {
      const aEntry = leaderboardMap.get(a.id);
      const bEntry = leaderboardMap.get(b.id);
      if (playerSortBy === "name") {
        return a.playerName.localeCompare(b.playerName);
      } else if (playerSortBy === "hole") {
        return (bEntry?.holesCompleted ?? 0) - (aEntry?.holesCompleted ?? 0);
      } else {
        return (aEntry?.relativeToPar ?? 0) - (bEntry?.relativeToPar ?? 0);
      }
    });
  };

  const groupedPlayers = tournament.allPlayers.reduce((acc, player) => {
    const group = player.groupName || "Unassigned";
    if (!acc[group]) acc[group] = [];
    acc[group].push(player);
    return acc;
  }, {} as Record<string, typeof tournament.allPlayers>);

  Object.keys(groupedPlayers).forEach(key => {
    groupedPlayers[key] = sortPlayers(groupedPlayers[key]);
  });

  // Calculate stats
  const leadingHole = tournament.leaderboard.length > 0
    ? Math.max(...tournament.leaderboard.map(e => e.holesCompleted))
    : 0;
  const laggingHole = tournament.leaderboard.length > 0
    ? Math.min(...tournament.leaderboard.map(e => e.holesCompleted))
    : 0;

  const themeClasses: Record<DirectorTheme, string> = {
    "default": "bg-background text-foreground",
    "dark-green": "bg-emerald-950 text-emerald-50",
    "dark-blue": "bg-slate-900 text-slate-50",
    "light": "bg-background text-foreground",
  };

  useEffect(() => {
    const portal = document.getElementById("director-portal");
    if (!portal) return;
    if (directorTheme === "light") {
      portal.style.colorScheme = "light";
      portal.setAttribute("data-theme", "light");
    } else if (directorTheme === "dark-green" || directorTheme === "dark-blue") {
      portal.style.colorScheme = "dark";
      portal.setAttribute("data-theme", "dark");
    } else {
      portal.style.colorScheme = "";
      portal.removeAttribute("data-theme");
    }
  }, [directorTheme]);

  return (
    <div 
      id="director-portal"
      className={`flex flex-col min-h-screen ${themeClasses[directorTheme]}`}
    >
      {/* Fixed Header */}
      <div className="sticky top-0 z-20 border-b bg-inherit">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-portal">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">Tournament Director</h1>
              {tournament.roomCode && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-base font-bold tracking-wider" data-testid="text-room-code-header">
                  {tournament.roomCode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm opacity-70 truncate">
                {tournament.tournamentInfo?.name || "New Tournament"}
              </p>
              {tournament.tournamentInfo?.startedAt && (
                <span className="inline-flex items-center gap-1 text-xs opacity-70" data-testid="text-tournament-runtime">
                  <Clock className="w-3 h-3" />
                  {formatRuntime(tournament.tournamentInfo.startedAt, tournament.tournamentInfo.completedAt, now)}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowPayout(!showPayout)}
            title="Payout Calculator"
            data-testid="button-toggle-payout"
          >
            <DollarSign className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => tournament.refreshLeaderboard()}
            data-testid="button-refresh-leaderboard"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>

        {/* Fixed Nav Tabs */}
        <div className="flex border-t">
          <button
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
              activeTab === "dashboard" 
                ? "border-b-2 border-green-500 text-green-600" 
                : "opacity-60 hover:opacity-100"
            }`}
            onClick={() => setActiveTab("dashboard")}
            data-testid="tab-dashboard"
          >
            <BarChart3 className="w-5 h-5" />
            Dashboard
          </button>
          <button
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
              activeTab === "leaderboard" 
                ? "border-b-2 border-green-500 text-green-600" 
                : "opacity-60 hover:opacity-100"
            }`}
            onClick={() => setActiveTab("leaderboard")}
            data-testid="tab-leaderboard"
          >
            <Trophy className="w-5 h-5" />
            Leaderboard
          </button>
          <button
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
              activeTab === "notify" 
                ? "border-b-2 border-green-500 text-green-600" 
                : "opacity-60 hover:opacity-100"
            }`}
            onClick={() => setActiveTab("notify")}
            data-testid="tab-notify"
          >
            <Bell className="w-5 h-5" />
            Notify
          </button>
        </div>
      </div>

      {/* Payout Calculator Panel */}
      {showPayout && (
        <div className="border-b p-4 bg-muted/30">
          <PayoutCalculator
            directorPin={localStorage.getItem("directorPin") || "3141"}
            linkedRoomCode={tournament.roomCode || undefined}
            onClose={() => setShowPayout(false)}
          />
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            {/* Tournament Status */}
            <Card className="p-4 border-green-500/30 bg-green-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-70">Tournament Status</p>
                  <p className="text-2xl font-bold">
                    {tournament.tournamentInfo?.isStarted ? "IN PROGRESS" : 
                     tournament.tournamentInfo?.isActive ? "SETUP" : "Ended"}
                  </p>
                </div>
                <div className={`w-4 h-4 rounded-full ${
                  tournament.tournamentInfo?.isStarted ? "bg-green-500 animate-pulse" : 
                  tournament.tournamentInfo?.isActive ? "bg-amber-500" : "bg-gray-400"
                }`} />
              </div>
              {tournament.tournamentInfo?.isActive && !tournament.tournamentInfo?.isStarted && (
                <Button
                  onClick={handleStartTournament}
                  disabled={isStarting || tournament.allPlayers.length === 0}
                  className="w-full mt-3 bg-green-600 hover:bg-green-700"
                  data-testid="button-start-tournament"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isStarting ? "Starting..." : "Start Tournament"}
                </Button>
              )}
              {tournament.tournamentInfo?.isStarted && (
                <p className="text-sm text-green-600 mt-2 text-center font-medium">
                  Players have been notified and are playing!
                </p>
              )}
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold">{tournament.allPlayers.length}</p>
                <p className="text-xs opacity-70">Total Players</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold">{Object.keys(groupedPlayers).length}</p>
                <p className="text-xs opacity-70">Groups</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold">{laggingHole}</p>
                <p className="text-xs opacity-70">Lagging Hole</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold">{leadingHole}</p>
                <p className="text-xs opacity-70">Leading Hole</p>
              </Card>
            </div>

            {/* Top 3 Leaderboard Preview */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                Top 3
              </h3>
              <div className="space-y-2">
                {tournament.leaderboard.slice(0, 3).map((entry, index) => (
                  <div
                    key={entry.playerId}
                    className="flex items-center gap-3 p-2 rounded-lg"
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? "bg-yellow-500 text-yellow-950" :
                      index === 1 ? "bg-gray-300 text-gray-700" :
                      "bg-amber-600 text-amber-50"
                    }`}>
                      {index + 1}
                    </span>
                    <span className="flex-1 font-medium truncate">{entry.playerName}</span>
                    <span className="font-mono font-bold">
                      {entry.relativeToPar > 0 ? "+" : ""}{entry.relativeToPar}
                    </span>
                  </div>
                ))}
                {tournament.leaderboard.length === 0 && (
                  <p className="text-center opacity-50 py-2">No scores yet</p>
                )}
              </div>
            </Card>

            {/* Tournament Controls */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Power className="w-4 h-4" />
                Tournament Controls
              </h3>
              
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-black/5 dark:bg-white/5">
                  <p className="text-sm opacity-70 mb-1">Room Code</p>
                  <p className="text-2xl font-mono font-bold tracking-wider">
                    {tournament.roomCode || "—"}
                  </p>
                </div>

                {showConfirmComplete ? (
                  <div className="space-y-2 p-3 border border-destructive/30 rounded-lg bg-destructive/5">
                    <p className="text-sm font-medium text-destructive">
                      End Tournament?
                    </p>
                    <p className="text-sm opacity-70">
                      This will end the tournament, save all player scores to their history, and update handicaps. Players will no longer be able to submit scores.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowConfirmComplete(false)}
                        disabled={isCompleting}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={handleCompleteTournament}
                        disabled={isCompleting}
                        data-testid="button-confirm-complete-tournament"
                      >
                        {isCompleting ? "Saving..." : "End & Save Scores"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => setShowConfirmComplete(true)}
                    disabled={!tournament.tournamentInfo?.isStarted}
                    data-testid="button-complete-tournament"
                  >
                    <Trophy className="w-4 h-4" />
                    {tournament.tournamentInfo?.isActive ? "End Tournament & Save Scores" : "Re-Save Scores to Player History"}
                  </Button>
                )}
              </div>
            </Card>

            {/* Player Management */}
            <Card className="p-4">
              <button
                onClick={() => setShowGroupTools(!showGroupTools)}
                className="w-full flex items-center justify-between"
                data-testid="button-toggle-group-tools"
              >
                <h3 className="font-semibold flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  Group Management Tools
                </h3>
                {showGroupTools ? (
                  <ChevronUp className="w-4 h-4 opacity-60" />
                ) : (
                  <ChevronDown className="w-4 h-4 opacity-60" />
                )}
              </button>
              
              {showGroupTools && (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <Label htmlFor="num-tables" className="text-sm whitespace-nowrap">
                      Number of tables:
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setNumTables(Math.max(2, numTables - 1))}
                        disabled={numTables <= 2}
                        data-testid="button-decrease-num-tables"
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-bold text-lg">{numTables}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setNumTables(Math.min(12, numTables + 1))}
                        disabled={numTables >= 12}
                        data-testid="button-increase-num-tables"
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                      <p className="text-2xl font-bold">{tournament.allPlayers.length}</p>
                      <p className="text-xs opacity-60">Players</p>
                    </div>
                    <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                      <p className="text-2xl font-bold">{Math.min(numTables, tournament.allPlayers.length)}</p>
                      <p className="text-xs opacity-60">Tables</p>
                    </div>
                    <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                      <p className="text-2xl font-bold">
                        {tournament.allPlayers.length > 0 ? Math.ceil(tournament.allPlayers.length / Math.min(numTables, tournament.allPlayers.length)) : 0}
                      </p>
                      <p className="text-xs opacity-60">Per Table</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={handleAutoAssignGroups}
                      disabled={isAutoAssigning || tournament.allPlayers.length === 0}
                      className="flex items-center gap-2"
                      data-testid="button-auto-assign-groups"
                    >
                      <Grid3X3 className="w-4 h-4" />
                      {isAutoAssigning ? "Assigning..." : "Auto-Assign"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleShuffleGroups}
                      disabled={isShuffling || tournament.allPlayers.length === 0}
                      className="flex items-center gap-2"
                      data-testid="button-shuffle-groups"
                    >
                      <Shuffle className="w-4 h-4" />
                      {isShuffling ? "Shuffling..." : "Shuffle"}
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearGroups}
                    disabled={tournament.allPlayers.length === 0}
                    className="w-full text-destructive hover:text-destructive"
                    data-testid="button-clear-groups"
                  >
                    Clear All Groups
                  </Button>

                  {tournament.allPlayers.length === 0 && (
                    <div className="flex items-center gap-2 text-sm opacity-60 justify-center">
                      <AlertCircle className="w-4 h-4" />
                      Add players first to use group tools
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Add Player Form */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Add Player
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant={showUniversalSearch ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowUniversalSearch(!showUniversalSearch)}
                    className="gap-2"
                    data-testid="button-toggle-universal-search"
                  >
                    <Search className="w-4 h-4" />
                    {showUniversalSearch ? "Hide Search" : "Find Existing Player"}
                  </Button>
                  {selectedUniversalPlayer && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-green-500/20 text-green-700 dark:text-green-400 rounded text-sm">
                      <Link2 className="w-3 h-3" />
                      <span className="truncate max-w-32">{selectedUniversalPlayer.name}</span>
                      {selectedUniversalPlayer.handicap !== null && (
                        <span className="font-mono text-xs">
                          ({selectedUniversalPlayer.isProvisional ? "P" : ""}{selectedUniversalPlayer.handicap?.toFixed(1)})
                        </span>
                      )}
                      <button 
                        onClick={() => setSelectedUniversalPlayer(null)}
                        className="hover:text-destructive"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {showUniversalSearch && (
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                      <Input
                        value={universalSearchQuery}
                        onChange={(e) => handleSearchUniversalPlayers(e.target.value)}
                        placeholder="Search by name or email..."
                        className="pl-9"
                        data-testid="input-universal-search"
                      />
                    </div>
                    {isSearching && <p className="text-xs opacity-60">Searching...</p>}
                    {universalSearchResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {universalSearchResults.map(player => (
                          <button
                            key={player.id}
                            onClick={() => handleSelectUniversalPlayer(player)}
                            className="w-full text-left p-2 rounded hover:bg-muted flex items-center gap-2"
                            data-testid={`button-select-universal-${player.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{player.name}</p>
                              <p className="text-xs opacity-60 truncate">{player.email || "No email"}</p>
                            </div>
                            {player.handicap !== null ? (
                              <div className="text-right">
                                <span className="font-mono text-sm font-bold">
                                  {player.isProvisional && <Star className="w-3 h-3 inline mr-1 text-amber-500" />}
                                  {player.handicap.toFixed(1)}
                                </span>
                                <p className="text-xs opacity-60">{player.completedTournaments} tournaments</p>
                              </div>
                            ) : (
                              <span className="text-xs opacity-60">New</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {universalSearchQuery.length >= 2 && universalSearchResults.length === 0 && !isSearching && (
                      <p className="text-xs opacity-60 text-center py-2">No matching players found</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    ref={playerNameInputRef}
                    autoFocus
                    value={newPlayerName}
                    onChange={(e) => {
                      setNewPlayerName(e.target.value);
                      if (selectedUniversalPlayer && e.target.value !== selectedUniversalPlayer.name) {
                        setSelectedUniversalPlayer(null);
                      }
                    }}
                    placeholder="Player name *"
                    className="flex-1"
                    data-testid="input-director-player-name"
                  />
                  <Input
                    value={newPlayerGroup}
                    onChange={(e) => setNewPlayerGroup(e.target.value)}
                    placeholder="Group"
                    className="w-24"
                    data-testid="input-director-player-group"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                    <Input
                      value={newPlayerUniversalId}
                      onChange={(e) => setNewPlayerUniversalId(e.target.value)}
                      placeholder="Universal ID"
                      className="pl-9"
                      data-testid="input-director-player-uid"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                    <Input
                      value={newPlayerContact}
                      onChange={(e) => setNewPlayerContact(e.target.value)}
                      placeholder="Contact info"
                      className="pl-9"
                      data-testid="input-director-player-contact"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddPlayer}
                  disabled={isAdding || !newPlayerName.trim()}
                  className="w-full"
                  data-testid="button-director-add-player"
                >
                  {isAdding ? "Adding..." : selectedUniversalPlayer ? "Add Player (Linked)" : "Add Player (New)"}
                </Button>
              </div>
            </Card>

            {/* Player List */}
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  All Players ({tournament.allPlayers.length})
                </h3>
                <div className="flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                  {(["name", "hole", "score"] as const).map(opt => (
                    <Button
                      key={opt}
                      variant={playerSortBy === opt ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setPlayerSortBy(opt)}
                      data-testid={`button-sort-${opt}`}
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
              {Object.entries(groupedPlayers).map(([groupName, players]) => (
                <div key={groupName} className="mb-4">
                  <h4 className="text-sm font-medium opacity-70 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {groupName} ({players.length})
                  </h4>
                  <div className="space-y-1">
                    {players.map(player => {
                      const entry = leaderboardMap.get(player.id);
                      return (
                      <div
                        key={player.id}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5",
                          player.isDnf && "opacity-50"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn("font-medium truncate", player.isDnf && "line-through")}>{player.playerName}</p>
                            {player.isDnf && (
                              <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded font-medium">DNF</span>
                            )}
                            {player.universalPlayerId ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400" title="Linked for handicapping">
                                <Link2 className="w-3 h-3" />
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" title="Not linked - no handicap tracking">
                                <AlertCircle className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs opacity-60 flex items-center gap-2 flex-wrap">
                            {player.deviceId ? (
                              <span className="flex items-center gap-1">
                                <Smartphone className="w-3 h-3" />
                                Device
                              </span>
                            ) : (
                              <span>No device</span>
                            )}
                            {entry ? (
                              <>
                                <span>Hole {entry.holesCompleted}/18</span>
                                <span className={entry.relativeToPar < 0 ? "text-green-600 dark:text-green-400 font-medium" : entry.relativeToPar > 0 ? "text-red-600 dark:text-red-400 font-medium" : "font-medium"}>
                                  {entry.relativeToPar === 0 ? "E" : entry.relativeToPar > 0 ? `+${entry.relativeToPar}` : entry.relativeToPar}
                                </span>
                              </>
                            ) : (
                              <span>No scores</span>
                            )}
                          </p>
                        </div>
                        {player.deviceId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-orange-600 hover:text-orange-700"
                            onClick={() => handleUnassignDevice(player.id)}
                            title="Unassign device"
                            data-testid={`button-unassign-device-${player.id}`}
                          >
                            <Unlink className="w-4 h-4" />
                          </Button>
                        )}
                        {!player.universalPlayerId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700"
                            onClick={() => handleLinkPlayer(player)}
                            title="Link for handicap tracking"
                            data-testid={`button-link-player-${player.id}`}
                          >
                            <Link2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600 hover:text-blue-700"
                          onClick={() => handleOpenScoreEntry(player)}
                          title="Enter scores"
                          data-testid={`button-enter-scores-${player.id}`}
                        >
                          <ClipboardList className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditPlayer(player)}
                          data-testid={`button-edit-player-${player.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {!player.isDnf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (tournament.tournamentInfo?.isStarted) {
                              setDnfPlayer({ id: player.id, name: player.playerName });
                            } else {
                              handleRemovePlayer(player.id);
                            }
                          }}
                          title={tournament.tournamentInfo?.isStarted ? "Mark as DNF" : "Remove player"}
                          data-testid={`button-remove-player-${player.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        )}
                      </div>
                    );
                    })}
                  </div>
                </div>
              ))}
              {tournament.allPlayers.length === 0 && (
                <p className="text-center opacity-50 py-4">No players added yet</p>
              )}
            </Card>
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Full Leaderboard
              </h3>
              <div className="flex gap-1 mb-3 flex-wrap">
                {(["score", "name", "id", "handicap"] as LeaderboardSort[]).map(col => (
                  <Button
                    key={col}
                    variant={leaderboardSort === col ? "default" : "outline"}
                    size="sm"
                    className="gap-1"
                    onClick={() => toggleLeaderboardSort(col)}
                    data-testid={`sort-leaderboard-${col}`}
                  >
                    {col === "score" ? "Score" : col === "name" ? "Name" : col === "id" ? "ID" : "Handicap"}
                    {leaderboardSort === col && (
                      leaderboardSortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </Button>
                ))}
              </div>
              <div className="space-y-1">
                {sortedLeaderboard.map((entry, index) => {
                  const tp = tournament.allPlayers.find(p => p.id === entry.playerId);
                  const up = tp?.universalPlayerId ? universalPlayersMap.get(tp.universalPlayerId) : null;
                  const originalRank = tournament.leaderboard.findIndex(e => e.playerId === entry.playerId) + 1;
                  return (
                    <div
                      key={entry.playerId}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                      data-testid={`leaderboard-row-${entry.playerId}`}
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        originalRank === 1 ? "bg-yellow-500 text-yellow-950" :
                        originalRank === 2 ? "bg-gray-300 text-gray-700" :
                        originalRank === 3 ? "bg-amber-600 text-amber-50" :
                        "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      }`}>
                        {originalRank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{entry.playerName}</p>
                        <p className="text-xs opacity-60">
                          {tp?.universalId || ""}{tp?.universalId ? " • " : ""}{entry.groupName || "No group"} • {entry.holesCompleted} holes
                          {up?.handicap != null ? ` • HC: ${up.handicap}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono text-lg font-bold ${
                          entry.relativeToPar < 0 ? "text-green-600" :
                          entry.relativeToPar > 0 ? "text-red-500" : ""
                        }`}>
                          {entry.relativeToPar > 0 ? "+" : ""}{entry.relativeToPar}
                        </p>
                        <p className="text-xs opacity-60">{entry.totalStrokes} strokes</p>
                      </div>
                    </div>
                  );
                })}
                {tournament.leaderboard.length === 0 && (
                  <p className="text-center opacity-50 py-8">No scores recorded yet</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Notify Tab */}
        {activeTab === "notify" && (
          <NotificationsTab directorPin={localStorage.getItem("directorPin") || "3141"} />
        )}
      </div>

      {/* Edit Player Dialog */}
      <Dialog open={!!editingPlayer} onOpenChange={(open) => !open && setEditingPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
          </DialogHeader>
          {editingPlayer && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Player Name</Label>
                <Input
                  value={editingPlayer.playerName}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, playerName: e.target.value })}
                  data-testid="input-edit-player-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Group</Label>
                <Input
                  value={editingPlayer.groupName}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, groupName: e.target.value })}
                  placeholder="Optional"
                  data-testid="input-edit-player-group"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Universal ID
                </Label>
                <Input
                  value={editingPlayer.universalId}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, universalId: e.target.value })}
                  placeholder="Unique identifier"
                  data-testid="input-edit-player-uid"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Contact Info
                </Label>
                <Input
                  value={editingPlayer.contactInfo}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, contactInfo: e.target.value })}
                  placeholder="Email or phone"
                  data-testid="input-edit-player-contact"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingPlayer(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSavePlayer}
                  data-testid="button-save-player"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Score Entry Dialog */}
      <Dialog open={!!scoreEntryPlayer} onOpenChange={(open) => !open && setScoreEntryPlayer(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Enter Scores: {scoreEntryPlayer?.playerName}
            </DialogTitle>
          </DialogHeader>
          {scoreEntryPlayer && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <Label className="text-sm whitespace-nowrap">Number of holes:</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newNum = Math.max(1, numHoles - 1);
                      setNumHoles(newNum);
                      setScoreEntryPlayer({
                        ...scoreEntryPlayer,
                        scores: scoreEntryPlayer.scores.slice(0, newNum),
                      });
                    }}
                    disabled={numHoles <= 1}
                    data-testid="button-decrease-holes"
                  >
                    -
                  </Button>
                  <span className="w-8 text-center font-bold">{numHoles}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newNum = Math.min(36, numHoles + 1);
                      setNumHoles(newNum);
                      if (scoreEntryPlayer.scores.length < newNum) {
                        setScoreEntryPlayer({
                          ...scoreEntryPlayer,
                          scores: [
                            ...scoreEntryPlayer.scores,
                            { hole: newNum, par: 0, strokes: 0, scratches: 0, penalties: 0 },
                          ],
                        });
                      }
                    }}
                    disabled={numHoles >= 36}
                    data-testid="button-increase-holes"
                  >
                    +
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 text-xs font-medium opacity-70 sticky top-0 bg-background py-1">
                  <span className="w-12 text-center">Hole</span>
                  <span className="text-center">Par</span>
                  <span className="text-center">Strokes</span>
                  <span className="text-center">Scratch</span>
                  <span className="text-center">Penalty</span>
                </div>
                {scoreEntryPlayer.scores.map((score) => (
                  <div 
                    key={score.hole} 
                    className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 items-center"
                  >
                    <span className="w-12 text-center font-bold text-sm bg-muted rounded py-1">
                      {score.hole}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={15}
                      value={score.par || ""}
                      onChange={(e) => handleUpdateHoleScore(score.hole, "par", parseInt(e.target.value) || 0)}
                      className="text-center h-9"
                      placeholder="0"
                      data-testid={`input-par-${score.hole}`}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={score.strokes || ""}
                      onChange={(e) => handleUpdateHoleScore(score.hole, "strokes", parseInt(e.target.value) || 0)}
                      className="text-center h-9"
                      placeholder="0"
                      data-testid={`input-strokes-${score.hole}`}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={score.scratches || ""}
                      onChange={(e) => handleUpdateHoleScore(score.hole, "scratches", parseInt(e.target.value) || 0)}
                      className="text-center h-9"
                      placeholder="0"
                      data-testid={`input-scratches-${score.hole}`}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={score.penalties || ""}
                      onChange={(e) => handleUpdateHoleScore(score.hole, "penalties", parseInt(e.target.value) || 0)}
                      className="text-center h-9"
                      placeholder="0"
                      data-testid={`input-penalties-${score.hole}`}
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t mt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="opacity-70">Total Par:</span>
                  <span className="font-mono font-bold">
                    {scoreEntryPlayer.scores.reduce((sum, s) => sum + s.par, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="opacity-70">Total Score:</span>
                  <span className="font-mono font-bold">
                    {scoreEntryPlayer.scores.reduce((sum, s) => sum + s.strokes + s.scratches + s.penalties, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="opacity-70">Relative to Par:</span>
                  <span className={`font-mono font-bold ${
                    scoreEntryPlayer.scores.reduce((sum, s) => sum + s.strokes + s.scratches + s.penalties - s.par, 0) < 0 
                      ? "text-green-600" 
                      : scoreEntryPlayer.scores.reduce((sum, s) => sum + s.strokes + s.scratches + s.penalties - s.par, 0) > 0 
                        ? "text-red-500" 
                        : ""
                  }`}>
                    {scoreEntryPlayer.scores.reduce((sum, s) => sum + s.strokes + s.scratches + s.penalties - s.par, 0) > 0 ? "+" : ""}
                    {scoreEntryPlayer.scores.reduce((sum, s) => sum + s.strokes + s.scratches + s.penalties - s.par, 0)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setScoreEntryPlayer(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleSaveScores}
                    disabled={isSavingScores}
                    data-testid="button-save-scores"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingScores ? "Saving..." : "Save Scores"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!dnfPlayer} onOpenChange={() => setDnfPlayer(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark {dnfPlayer?.name} as DNF?</DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <span className="block font-semibold text-destructive">
                This action is irreversible.
              </span>
              <span className="block">
                This player will be removed from the active tournament. Their scores up to this point will be lost.
              </span>
              <span className="block">
                Only use this for players who cannot continue playing (Did Not Finish).
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setDnfPlayer(null)}
              data-testid="button-dnf-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (dnfPlayer) {
                  handleRemovePlayer(dnfPlayer.id);
                }
                setDnfPlayer(null);
              }}
              data-testid="button-dnf-confirm"
            >
              Confirm DNF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
