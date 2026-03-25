import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardGrid } from "./DashboardGrid";
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
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Bug,
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
  GripHorizontal,
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

  // Mobile carousel state
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [mobileCardIndex, setMobileCardIndex] = useState(0);
  const touchStartX = useRef<number>(0);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Group starting holes state
  const [groupStartingHoles, setGroupStartingHoles] = useState<Record<string, number>>({});
  const [isSavingStartingHoles, setIsSavingStartingHoles] = useState(false);

  useEffect(() => {
    if (!tournament.roomCode) return;
    apiRequest("GET", `/api/tournaments/${tournament.roomCode}/group-starting-holes`)
      .then(r => r.json())
      .then(data => setGroupStartingHoles(data || {}))
      .catch(() => {});
  }, [tournament.roomCode]);

  const handleUpdateGroupStartingHole = async (groupName: string, hole: number) => {
    const updated = { ...groupStartingHoles, [groupName]: hole };
    setGroupStartingHoles(updated);
    setIsSavingStartingHoles(true);
    try {
      await apiRequest("PUT", `/api/tournaments/${tournament.roomCode}/group-starting-holes`, {
        directorPin: "3141",
        holes: updated,
      });
    } catch (e) {
      console.error("Failed to save starting holes", e);
    } finally {
      setIsSavingStartingHoles(false);
    }
  };

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

  const MOBILE_PANELS = [
    { id: "debug" as const,      label: "Debug" },
    { id: "status" as const,     label: "Status" },
    { id: "controls" as const,   label: "Controls" },
    { id: "stats" as const,      label: "Stats" },
    { id: "leaderboard" as const,label: "Leaderboard" },
    { id: "groups" as const,     label: "Group Tools" },
    { id: "addplayer" as const,  label: "Add Player" },
    { id: "players" as const,    label: `Players (${tournament.allPlayers.length})` },
    { id: "payout" as const,     label: "Payout" },
  ];
  type MobilePanelId = typeof MOBILE_PANELS[number]["id"];

  const renderMobileCard = (panelId: MobilePanelId) => {
    switch (panelId) {
      case "debug": return (
        <div className="p-4 space-y-1 font-mono text-sm">
          <p className="text-xs font-sans text-muted-foreground uppercase tracking-wider pb-3">Live Connection Debug</p>
          {([
            ["Room Code",   tournament.roomCode || "—"],
            ["Connected",   tournament.isConnected ? "YES" : "NO"],
            ["Is Director", tournament.isDirector ? "YES" : "NO"],
            ["Players",     String(tournament.allPlayers.length)],
            ["Leaderboard", `${tournament.leaderboard.length} entries`],
            ["Name",        tournament.tournamentInfo?.name || "—"],
            ["Status",      tournament.tournamentInfo?.isStarted ? "STARTED"
                            : tournament.tournamentInfo?.isActive ? "ACTIVE (setup)"
                            : tournament.tournamentInfo ? "ENDED" : "NO INFO"],
            ["Error",       tournament.error || "none"],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2 py-1.5 border-b border-border/30 last:border-0">
              <span className="text-muted-foreground shrink-0">{label}</span>
              <span className={cn(
                "text-right break-all",
                label === "Error" && value !== "none" ? "text-destructive" : "",
                label === "Connected" && value === "YES" ? "text-green-600 dark:text-green-400" : "",
                label === "Connected" && value === "NO" ? "text-destructive" : "",
              )}>{value}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground text-center pt-3">{new Date().toLocaleTimeString()}</p>
        </div>
      );
      case "status": return (
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tournament Status</p>
              <p className={cn("text-xl font-bold", tournament.tournamentInfo?.isStarted ? "text-green-600 dark:text-green-400" : tournament.tournamentInfo?.isActive ? "text-amber-600 dark:text-amber-400" : "")}>
                {tournament.tournamentInfo?.isStarted ? "IN PROGRESS" : tournament.tournamentInfo?.isActive ? "SETUP" : "Ended"}
              </p>
            </div>
            <div className={`w-4 h-4 rounded-full ${tournament.tournamentInfo?.isStarted ? "bg-green-500 animate-pulse" : tournament.tournamentInfo?.isActive ? "bg-amber-500" : "bg-gray-400"}`} />
          </div>
          {tournament.tournamentInfo?.isActive && !tournament.tournamentInfo?.isStarted && (
            <Button onClick={handleStartTournament} disabled={isStarting || tournament.allPlayers.length === 0} className="w-full bg-green-600 hover:bg-green-700" data-testid="button-start-tournament-mobile">
              <Play className="w-4 h-4 mr-2" />{isStarting ? "Starting..." : "Start Tournament"}
            </Button>
          )}
          {tournament.tournamentInfo?.isStarted && (
            <p className="text-center text-green-600 dark:text-green-400 font-medium py-2">Players are playing!</p>
          )}
          {tournament.tournamentInfo?.startedAt && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{formatRuntime(tournament.tournamentInfo.startedAt, tournament.tournamentInfo.completedAt, now)}</span>
            </div>
          )}
        </div>
      );
      case "controls": return (
        <div className="p-3 space-y-3">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Room Code</p>
            <p className="text-5xl font-mono font-bold tracking-widest">{tournament.roomCode || "—"}</p>
          </div>
          {showConfirmComplete ? (
            <div className="space-y-2 p-3 border border-destructive/30 rounded-lg bg-destructive/5">
              <p className="font-medium text-destructive">End Tournament?</p>
              <p className="text-sm text-muted-foreground">Saves all scores and updates handicaps.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirmComplete(false)} disabled={isCompleting}>Cancel</Button>
                <Button variant="destructive" className="flex-1" onClick={handleCompleteTournament} disabled={isCompleting} data-testid="button-confirm-complete-tournament-mobile">
                  {isCompleting ? "Saving..." : "End & Save"}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="destructive" className="w-full gap-2" onClick={() => setShowConfirmComplete(true)} disabled={!tournament.tournamentInfo?.isStarted} data-testid="button-complete-tournament-mobile">
              <Trophy className="w-4 h-4" />
              {tournament.tournamentInfo?.isActive ? "End Tournament" : "Re-Save Scores"}
            </Button>
          )}
        </div>
      );
      case "stats": return (
        <div className="grid grid-cols-2 gap-3 p-3">
          {[
            { label: "Players", value: tournament.allPlayers.length },
            { label: "Groups",  value: Object.keys(groupedPlayers).length },
            { label: "Lagging", value: laggingHole },
            { label: "Leading", value: leadingHole },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center justify-center rounded-lg bg-muted/40 py-8">
              <p className="text-4xl font-bold leading-none">{value}</p>
              <p className="text-sm text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      );
      case "leaderboard": return (
        <div>
          {tournament.leaderboard.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No scores yet</p>
          ) : tournament.leaderboard.map((entry, index) => (
            <div key={entry.playerId} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
              <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                index === 0 ? "bg-yellow-500 text-yellow-950" :
                index === 1 ? "bg-gray-300 text-gray-700" :
                index === 2 ? "bg-amber-600 text-amber-50" : "bg-muted text-muted-foreground"
              }`}>{index + 1}</span>
              <span className="flex-1 truncate">{entry.playerName}</span>
              <span className="font-mono font-bold shrink-0">
                {entry.relativeToPar === 0 ? "E" : entry.relativeToPar > 0 ? `+${entry.relativeToPar}` : entry.relativeToPar}
              </span>
            </div>
          ))}
        </div>
      );
      case "groups": return (
        <div className="p-3 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Tables</span>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setNumTables(Math.max(2, numTables - 1))} disabled={numTables <= 2} data-testid="button-decrease-num-tables-mobile">-</Button>
              <span className="w-8 text-center font-bold text-lg">{numTables}</span>
              <Button variant="outline" size="icon" onClick={() => setNumTables(Math.min(12, numTables + 1))} disabled={numTables >= 12} data-testid="button-increase-num-tables-mobile">+</Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Players",   value: tournament.allPlayers.length },
              { label: "Tables",    value: Math.min(numTables, tournament.allPlayers.length) },
              { label: "Per Table", value: tournament.allPlayers.length > 0 ? Math.ceil(tournament.allPlayers.length / Math.min(numTables, tournament.allPlayers.length)) : 0 },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-muted/40 py-3">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleAutoAssignGroups} disabled={isAutoAssigning || tournament.allPlayers.length === 0} className="gap-2" data-testid="button-auto-assign-groups-mobile">
              <Grid3X3 className="w-4 h-4" />{isAutoAssigning ? "Assigning..." : "Auto-Assign"}
            </Button>
            <Button variant="outline" onClick={handleShuffleGroups} disabled={isShuffling || tournament.allPlayers.length === 0} className="gap-2" data-testid="button-shuffle-groups-mobile">
              <Shuffle className="w-4 h-4" />{isShuffling ? "Shuffling..." : "Shuffle"}
            </Button>
          </div>
          <Button variant="ghost" onClick={handleClearGroups} disabled={tournament.allPlayers.length === 0} className="w-full text-destructive" data-testid="button-clear-groups-mobile">
            Clear All Groups
          </Button>
          {tournament.allPlayers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-1">
              <AlertCircle className="w-4 h-4" />Add players first
            </p>
          )}
          {/* Starting holes per group */}
          {Object.keys(groupedPlayers).filter(g => g !== "Unassigned").length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground font-medium">Starting Hole per Group {isSavingStartingHoles && <span className="ml-1 opacity-50">(saving…)</span>}</p>
              {Object.keys(groupedPlayers).filter(g => g !== "Unassigned").sort().map(groupName => (
                <div key={groupName} className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate">{groupName}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleUpdateGroupStartingHole(groupName, Math.max(1, (groupStartingHoles[groupName] ?? 1) - 1))} disabled={(groupStartingHoles[groupName] ?? 1) <= 1} data-testid={`button-dec-hole-${groupName}-mobile`} className="px-2">−</Button>
                    <span className="w-5 text-center text-sm font-bold">{groupStartingHoles[groupName] ?? 1}</span>
                    <Button variant="outline" size="sm" onClick={() => handleUpdateGroupStartingHole(groupName, Math.min(18, (groupStartingHoles[groupName] ?? 1) + 1))} disabled={(groupStartingHoles[groupName] ?? 1) >= 18} data-testid={`button-inc-hole-${groupName}-mobile`} className="px-2">+</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
      case "addplayer": return (
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant={showUniversalSearch ? "default" : "outline"} size="sm" onClick={() => setShowUniversalSearch(!showUniversalSearch)} className="gap-1">
              <Search className="w-3 h-3" />{showUniversalSearch ? "Hide Search" : "Find Existing"}
            </Button>
            {selectedUniversalPlayer && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-700 dark:text-green-400 rounded text-sm">
                <Link2 className="w-3 h-3" />
                <span className="truncate max-w-32">{selectedUniversalPlayer.name}</span>
                <button onClick={() => setSelectedUniversalPlayer(null)} className="hover:text-destructive ml-1">×</button>
              </div>
            )}
          </div>
          {showUniversalSearch && (
            <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                <Input value={universalSearchQuery} onChange={(e) => handleSearchUniversalPlayers(e.target.value)} placeholder="Search name or email..." className="pl-9" data-testid="input-universal-search-mobile" />
              </div>
              {isSearching && <p className="text-sm text-muted-foreground">Searching...</p>}
              {universalSearchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {universalSearchResults.map(player => (
                    <button key={player.id} onClick={() => handleSelectUniversalPlayer(player)} className="w-full text-left p-2 rounded-lg hover:bg-muted flex items-center gap-2" data-testid={`button-select-universal-mobile-${player.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{player.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{player.email || "No email"}</p>
                      </div>
                      {player.handicap !== null && (
                        <span className="font-mono font-bold shrink-0 text-sm">
                          {player.isProvisional && <Star className="w-3 h-3 inline mr-0.5 text-amber-500" />}{player.handicap.toFixed(1)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {universalSearchQuery.length >= 2 && universalSearchResults.length === 0 && !isSearching && (
                <p className="text-sm text-muted-foreground text-center">No players found</p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Input value={newPlayerName} onChange={(e) => { setNewPlayerName(e.target.value); if (selectedUniversalPlayer && e.target.value !== selectedUniversalPlayer.name) setSelectedUniversalPlayer(null); }} placeholder="Player name *" className="flex-1" data-testid="input-director-player-name-mobile" />
            <Input value={newPlayerGroup} onChange={(e) => setNewPlayerGroup(e.target.value)} placeholder="Group" className="w-20" data-testid="input-director-player-group-mobile" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
              <Input value={newPlayerUniversalId} onChange={(e) => setNewPlayerUniversalId(e.target.value)} placeholder="Universal ID" className="pl-9" data-testid="input-director-player-uid-mobile" />
            </div>
            <div className="flex-1 relative">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
              <Input value={newPlayerContact} onChange={(e) => setNewPlayerContact(e.target.value)} placeholder="Contact" className="pl-9" data-testid="input-director-player-contact-mobile" />
            </div>
          </div>
          <Button onClick={handleAddPlayer} disabled={isAdding || !newPlayerName.trim()} className="w-full" data-testid="button-director-add-player-mobile">
            {isAdding ? "Adding..." : selectedUniversalPlayer ? "Add (Linked)" : "Add Player"}
          </Button>
        </div>
      );
      case "players": return (
        <div>
          <div className="flex gap-2 px-3 py-2 border-b">
            <span className="text-sm text-muted-foreground self-center">Sort:</span>
            {(["name", "hole", "score"] as const).map(opt => (
              <button key={opt} onClick={() => setPlayerSortBy(opt)} className={cn("text-sm px-2 py-1 rounded", playerSortBy === opt ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} data-testid={`button-sort-${opt}-mobile`}>
                {opt}
              </button>
            ))}
          </div>
          {tournament.allPlayers.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No players yet</p>
          ) : Object.entries(groupedPlayers).map(([groupName, players]) => (
            <div key={groupName}>
              <div className="sticky top-0 px-3 py-1.5 bg-muted/80 text-sm font-medium flex items-center gap-2 z-10">
                <span className="w-2 h-2 rounded-full bg-green-500" />{groupName} ({players.length})
              </div>
              {players.map(player => {
                const entry = leaderboardMap.get(player.id);
                return (
                  <div key={player.id} className={cn("flex items-center gap-2 px-3 py-3 border-b last:border-0", player.isDnf && "opacity-50")}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={cn("font-medium truncate", player.isDnf && "line-through")}>{player.playerName}</p>
                        {player.isDnf && <span className="text-xs bg-destructive/20 text-destructive px-1 rounded shrink-0">DNF</span>}
                        {player.universalPlayerId ? <Link2 className="w-3 h-3 text-green-600 dark:text-green-400 shrink-0" /> : <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {player.deviceId ? "Device assigned" : "No device"}
                        {entry && <> · H{entry.holesCompleted} · <span className={entry.relativeToPar < 0 ? "text-green-600 dark:text-green-400" : entry.relativeToPar > 0 ? "text-red-500" : ""}>{entry.relativeToPar === 0 ? "E" : entry.relativeToPar > 0 ? `+${entry.relativeToPar}` : entry.relativeToPar}</span></>}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {player.deviceId && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-600" onClick={() => handleUnassignDevice(player.id)} data-testid={`button-unassign-device-mobile-${player.id}`}>
                          <Unlink className="w-4 h-4" />
                        </Button>
                      )}
                      {!player.universalPlayerId && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => handleLinkPlayer(player)} data-testid={`button-link-player-mobile-${player.id}`}>
                          <Link2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleOpenScoreEntry(player)} data-testid={`button-enter-scores-mobile-${player.id}`}>
                        <ClipboardList className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditPlayer(player)} data-testid={`button-edit-player-mobile-${player.id}`}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      {!player.isDnf && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (tournament.tournamentInfo?.isStarted) { setDnfPlayer({ id: player.id, name: player.playerName }); } else { handleRemovePlayer(player.id); } }} data-testid={`button-remove-player-mobile-${player.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
      case "payout": return (
        <div className="p-3">
          <PayoutCalculator
            directorPin={localStorage.getItem("directorPin") || "3141"}
            linkedRoomCode={tournament.roomCode || undefined}
          />
        </div>
      );
      default: return null;
    }
  };

  return (
    <div 
      id="director-portal"
      className={`flex flex-col h-screen overflow-hidden ${themeClasses[directorTheme]}`}
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

      {/* Mobile carousel: dashboard panels as swipeable cards */}
      {isMobile && activeTab === "dashboard" && (
        <div
          className="flex-1 flex flex-col overflow-hidden"
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const diff = touchStartX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) {
              if (diff > 0) setMobileCardIndex(i => Math.min(MOBILE_PANELS.length - 1, i + 1));
              else setMobileCardIndex(i => Math.max(0, i - 1));
            }
          }}
        >
          {/* Panel label bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
            <span className="font-semibold text-sm">{MOBILE_PANELS[mobileCardIndex].label}</span>
            <span className="text-xs text-muted-foreground">{mobileCardIndex + 1} / {MOBILE_PANELS.length}</span>
          </div>
          {/* Panel content */}
          <div className="flex-1 overflow-y-auto">
            {renderMobileCard(MOBILE_PANELS[mobileCardIndex].id)}
          </div>
          {/* Bottom nav: prev/dots/next */}
          <div className="flex items-center justify-between px-3 py-2 border-t shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setMobileCardIndex(i => Math.max(0, i - 1))} disabled={mobileCardIndex === 0}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex gap-1.5 flex-wrap justify-center">
              {MOBILE_PANELS.map((panel, i) => (
                <button
                  key={panel.id}
                  onClick={() => setMobileCardIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === mobileCardIndex ? "bg-primary scale-125" : "bg-muted-foreground/30"}`}
                  aria-label={`Go to ${panel.label}`}
                />
              ))}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setMobileCardIndex(i => Math.min(MOBILE_PANELS.length - 1, i + 1))} disabled={mobileCardIndex === MOBILE_PANELS.length - 1}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Desktop dashboard + all tabs on mobile (leaderboard/notify) */}
      {!(isMobile && activeTab === "dashboard") && (
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {/* Dashboard Tab — desktop only */}
        {activeTab === "dashboard" && (
          <DashboardGrid storageKey={`dp-layout-${localStorage.getItem("directorPin") || "default"}`}>

            {/* Status Panel */}
            <div key="status" className="h-full">
              <Card className="h-full flex flex-col overflow-hidden">
                <div className="drag-handle flex items-center justify-between px-2 py-1 border-b bg-muted/30 cursor-grab active:cursor-grabbing select-none shrink-0">
                  <span className="text-xs font-semibold opacity-60">Status</span>
                  <GripHorizontal className="w-3 h-3 opacity-30" />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs opacity-60">Tournament</p>
                      <p className={cn("text-base font-bold leading-tight",
                        tournament.tournamentInfo?.isStarted ? "text-green-600 dark:text-green-400" :
                        tournament.tournamentInfo?.isActive ? "text-amber-600 dark:text-amber-400" : ""
                      )}>
                        {tournament.tournamentInfo?.isStarted ? "IN PROGRESS" :
                         tournament.tournamentInfo?.isActive ? "SETUP" : "Ended"}
                      </p>
                    </div>
                    <div className={`w-3 h-3 rounded-full shrink-0 ${
                      tournament.tournamentInfo?.isStarted ? "bg-green-500 animate-pulse" :
                      tournament.tournamentInfo?.isActive ? "bg-amber-500" : "bg-gray-400"
                    }`} />
                  </div>
                  {tournament.tournamentInfo?.isActive && !tournament.tournamentInfo?.isStarted && (
                    <Button
                      onClick={handleStartTournament}
                      disabled={isStarting || tournament.allPlayers.length === 0}
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700"
                      data-testid="button-start-tournament"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      {isStarting ? "Starting..." : "Start Tournament"}
                    </Button>
                  )}
                  {tournament.tournamentInfo?.isStarted && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium text-center">
                      Players are playing!
                    </p>
                  )}
                </div>
              </Card>
            </div>

            {/* Controls Panel */}
            <div key="controls" className="h-full">
              <Card className="h-full flex flex-col overflow-hidden">
                <div className="drag-handle flex items-center justify-between px-2 py-1 border-b bg-muted/30 cursor-grab active:cursor-grabbing select-none shrink-0">
                  <span className="text-xs font-semibold opacity-60 flex items-center gap-1">
                    <Power className="w-3 h-3" />Controls
                  </span>
                  <GripHorizontal className="w-3 h-3 opacity-30" />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  <div className="px-2 py-1 rounded bg-muted/50">
                    <p className="text-xs opacity-60">Room Code</p>
                    <p className="text-xl font-mono font-bold tracking-widest">{tournament.roomCode || "—"}</p>
                  </div>
                  {showConfirmComplete ? (
                    <div className="space-y-1 p-2 border border-destructive/30 rounded bg-destructive/5">
                      <p className="text-xs font-medium text-destructive">End Tournament?</p>
                      <p className="text-xs opacity-70">Saves all scores and updates handicaps.</p>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowConfirmComplete(false)} disabled={isCompleting}>Cancel</Button>
                        <Button variant="destructive" size="sm" className="flex-1" onClick={handleCompleteTournament} disabled={isCompleting} data-testid="button-confirm-complete-tournament">
                          {isCompleting ? "Saving..." : "End & Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full gap-1"
                      onClick={() => setShowConfirmComplete(true)}
                      disabled={!tournament.tournamentInfo?.isStarted}
                      data-testid="button-complete-tournament"
                    >
                      <Trophy className="w-3 h-3" />
                      {tournament.tournamentInfo?.isActive ? "End Tournament" : "Re-Save Scores"}
                    </Button>
                  )}
                </div>
              </Card>
            </div>

            {/* Stats Panel */}
            <div key="stats" className="h-full">
              <Card className="h-full flex flex-col overflow-hidden">
                <div className="drag-handle flex items-center justify-between px-2 py-1 border-b bg-muted/30 cursor-grab active:cursor-grabbing select-none shrink-0">
                  <span className="text-xs font-semibold opacity-60">Stats</span>
                  <GripHorizontal className="w-3 h-3 opacity-30" />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-1 p-2 content-start">
                  {[
                    { label: "Players", value: tournament.allPlayers.length },
                    { label: "Groups", value: Object.keys(groupedPlayers).length },
                    { label: "Lagging", value: laggingHole },
                    { label: "Leading", value: leadingHole },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center justify-center rounded bg-muted/40 py-1.5">
                      <p className="text-2xl font-bold leading-none">{value}</p>
                      <p className="text-xs opacity-60 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Leaderboard Panel */}
            <div key="leaderboard" className="h-full">
              <Card className="h-full flex flex-col overflow-hidden">
                <div className="drag-handle flex items-center justify-between px-2 py-1 border-b bg-muted/30 cursor-grab active:cursor-grabbing select-none shrink-0">
                  <span className="text-xs font-semibold opacity-60 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-yellow-500" />Leaderboard
                  </span>
                  <GripHorizontal className="w-3 h-3 opacity-30" />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {tournament.leaderboard.length === 0 ? (
                    <p className="text-center opacity-40 py-4 text-sm">No scores yet</p>
                  ) : tournament.leaderboard.map((entry, index) => (
                    <div key={entry.playerId} className="flex items-center gap-2 px-2 py-1.5 border-b last:border-0">
                      <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? "bg-yellow-500 text-yellow-950" :
                        index === 1 ? "bg-gray-300 text-gray-700" :
                        index === 2 ? "bg-amber-600 text-amber-50" : "bg-muted text-muted-foreground"
                      }`}>{index + 1}</span>
                      <span className="flex-1 text-sm truncate">{entry.playerName}</span>
                      <span className="font-mono text-sm font-bold shrink-0">
                        {entry.relativeToPar === 0 ? "E" : entry.relativeToPar > 0 ? `+${entry.relativeToPar}` : entry.relativeToPar}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Group Tools Panel */}
            <div key="groups" className="h-full">
              <Card className="h-full flex flex-col overflow-hidden">
                <div className="drag-handle flex items-center justify-between px-2 py-1 border-b bg-muted/30 cursor-grab active:cursor-grabbing select-none shrink-0">
                  <span className="text-xs font-semibold opacity-60 flex items-center gap-1">
                    <Wand2 className="w-3 h-3" />Group Tools
                  </span>
                  <GripHorizontal className="w-3 h-3 opacity-30" />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-60 whitespace-nowrap">Tables:</span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setNumTables(Math.max(2, numTables - 1))} disabled={numTables <= 2} data-testid="button-decrease-num-tables">-</Button>
                      <span className="w-6 text-center font-bold text-sm">{numTables}</span>
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setNumTables(Math.min(12, numTables + 1))} disabled={numTables >= 12} data-testid="button-increase-num-tables">+</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {[
                      { label: "Players", value: tournament.allPlayers.length },
                      { label: "Tables", value: Math.min(numTables, tournament.allPlayers.length) },
                      { label: "Per Table", value: tournament.allPlayers.length > 0 ? Math.ceil(tournament.allPlayers.length / Math.min(numTables, tournament.allPlayers.length)) : 0 },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded bg-muted/40 py-1">
                        <p className="text-lg font-bold leading-none">{value}</p>
                        <p className="text-xs opacity-60">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <Button variant="outline" size="sm" onClick={handleAutoAssignGroups} disabled={isAutoAssigning || tournament.allPlayers.length === 0} className="gap-1 text-xs" data-testid="button-auto-assign-groups">
                      <Grid3X3 className="w-3 h-3" />{isAutoAssigning ? "Assigning..." : "Auto-Assign"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleShuffleGroups} disabled={isShuffling || tournament.allPlayers.length === 0} className="gap-1 text-xs" data-testid="button-shuffle-groups">
                      <Shuffle className="w-3 h-3" />{isShuffling ? "Shuffling..." : "Shuffle"}
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearGroups} disabled={tournament.allPlayers.length === 0} className="w-full text-destructive text-xs" data-testid="button-clear-groups">
                    Clear All Groups
                  </Button>
                  {tournament.allPlayers.length === 0 && (
                    <p className="text-xs opacity-50 text-center flex items-center justify-center gap-1">
                      <AlertCircle className="w-3 h-3" />Add players first
                    </p>
                  )}
                  {/* Starting holes per group */}
                  {Object.keys(groupedPlayers).filter(g => g !== "Unassigned").length > 0 && (
                    <div className="space-y-1 pt-2 border-t">
                      <p className="text-xs opacity-60 mb-1">Start Hole {isSavingStartingHoles && <span className="opacity-50">(saving…)</span>}</p>
                      {Object.keys(groupedPlayers).filter(g => g !== "Unassigned").sort().map(groupName => (
                        <div key={groupName} className="flex items-center gap-1">
                          <span className="text-xs truncate flex-1">{groupName}</span>
                          <Button variant="outline" size="sm" onClick={() => handleUpdateGroupStartingHole(groupName, Math.max(1, (groupStartingHoles[groupName] ?? 1) - 1))} disabled={(groupStartingHoles[groupName] ?? 1) <= 1} data-testid={`button-dec-hole-${groupName}`} className="px-1.5">−</Button>
                          <span className="w-4 text-center text-xs font-bold">{groupStartingHoles[groupName] ?? 1}</span>
                          <Button variant="outline" size="sm" onClick={() => handleUpdateGroupStartingHole(groupName, Math.min(18, (groupStartingHoles[groupName] ?? 1) + 1))} disabled={(groupStartingHoles[groupName] ?? 1) >= 18} data-testid={`button-inc-hole-${groupName}`} className="px-1.5">+</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Add Player Panel */}
            <div key="addplayer" className="h-full">
              <Card className="h-full flex flex-col overflow-hidden">
                <div className="drag-handle flex items-center justify-between px-2 py-1 border-b bg-muted/30 cursor-grab active:cursor-grabbing select-none shrink-0">
                  <span className="text-xs font-semibold opacity-60 flex items-center gap-1">
                    <UserPlus className="w-3 h-3" />Add Player
                  </span>
                  <GripHorizontal className="w-3 h-3 opacity-30" />
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant={showUniversalSearch ? "default" : "outline"} size="sm" onClick={() => setShowUniversalSearch(!showUniversalSearch)} className="gap-1 text-xs" data-testid="button-toggle-universal-search">
                      <Search className="w-3 h-3" />{showUniversalSearch ? "Hide Search" : "Find Existing"}
                    </Button>
                    {selectedUniversalPlayer && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-700 dark:text-green-400 rounded text-xs">
                        <Link2 className="w-3 h-3" />
                        <span className="truncate max-w-24">{selectedUniversalPlayer.name}</span>
                        <button onClick={() => setSelectedUniversalPlayer(null)} className="hover:text-destructive ml-1">×</button>
                      </div>
                    )}
                  </div>
                  {showUniversalSearch && (
                    <div className="border rounded p-2 space-y-1 bg-muted/30">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 opacity-50" />
                        <Input value={universalSearchQuery} onChange={(e) => handleSearchUniversalPlayers(e.target.value)} placeholder="Search name or email..." className="pl-7 h-8 text-sm" data-testid="input-universal-search" />
                      </div>
                      {isSearching && <p className="text-xs opacity-60">Searching...</p>}
                      {universalSearchResults.length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-0.5">
                          {universalSearchResults.map(player => (
                            <button key={player.id} onClick={() => handleSelectUniversalPlayer(player)} className="w-full text-left p-1.5 rounded hover:bg-muted flex items-center gap-2 text-xs" data-testid={`button-select-universal-${player.id}`}>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{player.name}</p>
                                <p className="opacity-60 truncate">{player.email || "No email"}</p>
                              </div>
                              {player.handicap !== null && (
                                <span className="font-mono font-bold shrink-0">
                                  {player.isProvisional && <Star className="w-2 h-2 inline mr-0.5 text-amber-500" />}
                                  {player.handicap.toFixed(1)}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {universalSearchQuery.length >= 2 && universalSearchResults.length === 0 && !isSearching && (
                        <p className="text-xs opacity-60 text-center py-1">No players found</p>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Input ref={playerNameInputRef} autoFocus value={newPlayerName} onChange={(e) => { setNewPlayerName(e.target.value); if (selectedUniversalPlayer && e.target.value !== selectedUniversalPlayer.name) setSelectedUniversalPlayer(null); }} placeholder="Player name *" className="flex-1 h-8 text-sm" data-testid="input-director-player-name" />
                    <Input value={newPlayerGroup} onChange={(e) => setNewPlayerGroup(e.target.value)} placeholder="Group" className="w-16 h-8 text-sm" data-testid="input-director-player-group" />
                  </div>
                  <div className="flex gap-1">
                    <div className="flex-1 relative">
                      <Hash className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 opacity-50" />
                      <Input value={newPlayerUniversalId} onChange={(e) => setNewPlayerUniversalId(e.target.value)} placeholder="Universal ID" className="pl-7 h-8 text-sm" data-testid="input-director-player-uid" />
                    </div>
                    <div className="flex-1 relative">
                      <Mail className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 opacity-50" />
                      <Input value={newPlayerContact} onChange={(e) => setNewPlayerContact(e.target.value)} placeholder="Contact" className="pl-7 h-8 text-sm" data-testid="input-director-player-contact" />
                    </div>
                  </div>
                  <Button onClick={handleAddPlayer} disabled={isAdding || !newPlayerName.trim()} size="sm" className="w-full" data-testid="button-director-add-player">
                    {isAdding ? "Adding..." : selectedUniversalPlayer ? "Add (Linked)" : "Add Player"}
                  </Button>
                </div>
              </Card>
            </div>

            {/* Players Panel */}
            <div key="players" className="h-full">
              <Card className="h-full flex flex-col overflow-hidden">
                <div className="drag-handle flex items-center justify-between px-2 py-1 border-b bg-muted/30 cursor-grab active:cursor-grabbing select-none shrink-0">
                  <span className="text-xs font-semibold opacity-60 flex items-center gap-1">
                    <Users className="w-3 h-3" />Players ({tournament.allPlayers.length})
                  </span>
                  <div className="flex items-center gap-1">
                    {(["name", "hole", "score"] as const).map(opt => (
                      <button key={opt} onClick={() => setPlayerSortBy(opt)} className={cn("text-xs px-1 py-0.5 rounded", playerSortBy === opt ? "bg-primary text-primary-foreground" : "opacity-50 hover:opacity-80")} data-testid={`button-sort-${opt}`}>
                        {opt}
                      </button>
                    ))}
                    <GripHorizontal className="w-3 h-3 opacity-30 ml-1" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {tournament.allPlayers.length === 0 ? (
                    <p className="text-center opacity-40 py-4 text-sm">No players yet</p>
                  ) : Object.entries(groupedPlayers).map(([groupName, players]) => (
                    <div key={groupName}>
                      <div className="sticky top-0 px-2 py-0.5 bg-muted/80 text-xs font-medium opacity-70 flex items-center gap-1 z-10">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{groupName} ({players.length})
                      </div>
                      {players.map(player => {
                        const entry = leaderboardMap.get(player.id);
                        return (
                          <div key={player.id} className={cn("flex items-center gap-1 px-2 py-1.5 border-b last:border-0", player.isDnf && "opacity-50")}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <p className={cn("text-sm truncate", player.isDnf && "line-through")}>{player.playerName}</p>
                                {player.isDnf && <span className="text-xs bg-destructive/20 text-destructive px-1 rounded shrink-0">DNF</span>}
                                {player.universalPlayerId
                                  ? <Link2 className="w-3 h-3 text-green-600 dark:text-green-400 shrink-0" />
                                  : <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />}
                              </div>
                              <p className="text-xs opacity-50">
                                {player.deviceId ? "Device" : "No device"}
                                {entry && <> · H{entry.holesCompleted} · <span className={entry.relativeToPar < 0 ? "text-green-600 dark:text-green-400" : entry.relativeToPar > 0 ? "text-red-600 dark:text-red-400" : ""}>{entry.relativeToPar === 0 ? "E" : entry.relativeToPar > 0 ? `+${entry.relativeToPar}` : entry.relativeToPar}</span></>}
                              </p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {player.deviceId && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-600" onClick={() => handleUnassignDevice(player.id)} title="Unassign device" data-testid={`button-unassign-device-${player.id}`}>
                                  <Unlink className="w-3 h-3" />
                                </Button>
                              )}
                              {!player.universalPlayerId && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" onClick={() => handleLinkPlayer(player)} title="Link for handicap" data-testid={`button-link-player-${player.id}`}>
                                  <Link2 className="w-3 h-3" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => handleOpenScoreEntry(player)} title="Enter scores" data-testid={`button-enter-scores-${player.id}`}>
                                <ClipboardList className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditPlayer(player)} data-testid={`button-edit-player-${player.id}`}>
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              {!player.isDnf && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (tournament.tournamentInfo?.isStarted) { setDnfPlayer({ id: player.id, name: player.playerName }); } else { handleRemovePlayer(player.id); } }} title={tournament.tournamentInfo?.isStarted ? "Mark DNF" : "Remove"} data-testid={`button-remove-player-${player.id}`}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Payout Calculator Panel */}
            <div key="payout" className="h-full">
              <Card className="h-full flex flex-col overflow-hidden">
                <div className="drag-handle flex items-center justify-between px-2 py-1 border-b bg-muted/30 cursor-grab active:cursor-grabbing select-none shrink-0">
                  <span className="text-xs font-semibold opacity-60 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />Payout Calculator
                  </span>
                  <GripHorizontal className="w-3 h-3 opacity-30" />
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <PayoutCalculator
                    directorPin={localStorage.getItem("directorPin") || "3141"}
                    linkedRoomCode={tournament.roomCode || undefined}
                  />
                </div>
              </Card>
            </div>

          </DashboardGrid>
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
      )}

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
