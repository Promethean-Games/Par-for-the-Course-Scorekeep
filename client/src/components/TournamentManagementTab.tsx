import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
  GripVertical,
} from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";
import { SponsorSettingsPanel } from "@/components/SponsorSettingsPanel";

interface TournamentManagementTabProps {
  directorPin: string;
  onTournamentSelected: () => void;
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
  eventVenue?: string | null;
  eventStartAt?: string | null;
  eventDetailsUrl?: string | null;
  eventRegistrationUrl?: string | null;
  eventHeroImageUrl?: string | null;
  eventMaxPlayers?: number;
  eventDirectorName?: string | null;
  eventDirectorEmail?: string | null;
  eventDirectorPhone?: string | null;
  eventRulesText?: string | null;
  eventYoutubeUrl?: string | null;
  eventGalleryImages?: string[] | null;
  eventEntryFee?: number | null;
  eventEntryFeeDetails?: string | null;
  isActive: boolean;
  isStarted?: boolean;
  isHandicapped?: boolean;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  stats?: TournamentStats;
}

type ImportConflictPolicy = "skip" | "replace" | "keep_both";

type ImportSections = {
  players: boolean;
  tournamentHistory: boolean;
  settings: boolean;
};

type ImportCounts = {
  players: number;
  tournamentHistory: number;
  settings: number;
};

type ImportConflict = {
  key: string;
  importName: string;
  importUniqueCode: string | null;
  existingName: string;
  existingUniqueCode: string | null;
  matchReason: "uniqueCode" | "name";
  differingFields: string[];
};

type WaitlistEntry = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  status: string;
};

export function TournamentManagementTab({ directorPin, onTournamentSelected }: TournamentManagementTabProps) {
  const tournament = useTournament();
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState<string | null>(null);
  const [showEventDetailsFor, setShowEventDetailsFor] = useState<string | null>(null);
  const [eventVenueInput, setEventVenueInput] = useState("");
  const [eventStartAtInput, setEventStartAtInput] = useState("");
  const [eventDetailsUrlInput, setEventDetailsUrlInput] = useState("");
  const [eventRegistrationUrlInput, setEventRegistrationUrlInput] = useState("");
  const [eventHeroImageUrlInput, setEventHeroImageUrlInput] = useState("");
  const [eventMaxPlayersInput, setEventMaxPlayersInput] = useState("24");
  const [eventDirectorNameInput, setEventDirectorNameInput] = useState("");
  const [eventDirectorEmailInput, setEventDirectorEmailInput] = useState("");
  const [eventDirectorPhoneInput, setEventDirectorPhoneInput] = useState("");
  const [eventRulesTextInput, setEventRulesTextInput] = useState("");
  const [eventYoutubeUrlInput, setEventYoutubeUrlInput] = useState("");
  const [eventGalleryImages, setEventGalleryImages] = useState<string[]>([]);
  const [newGalleryImageUrl, setNewGalleryImageUrl] = useState("");
  const [draggedGalleryIndex, setDraggedGalleryIndex] = useState<number | null>(null);
  const [eventEntryFeeInput, setEventEntryFeeInput] = useState("");
  const [eventEntryFeeDetailsInput, setEventEntryFeeDetailsInput] = useState("");
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [isWaitlistLoading, setIsWaitlistLoading] = useState(false);
  const [isSavingEventDetails, setIsSavingEventDetails] = useState(false);
  const [isHandicapped, setIsHandicapped] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [importPayload, setImportPayload] = useState<any | null>(null);
  const [importCounts, setImportCounts] = useState<ImportCounts>({ players: 0, tournamentHistory: 0, settings: 0 });
  const [importConflicts, setImportConflicts] = useState<ImportConflict[]>([]);
  const [selectedSections, setSelectedSections] = useState<ImportSections>({ players: true, tournamentHistory: true, settings: true });
  const [conflictPolicy, setConflictPolicy] = useState<ImportConflictPolicy>("skip");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const { toast } = useToast();
  const importFullRef = useRef<HTMLInputElement>(null);
  const importTournamentRef = useRef<HTMLInputElement>(null);

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
        tournament.setIsDirector(true);
        tournament.setDirectorCredentials(directorPin);
        onTournamentSelected();
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
      onTournamentSelected();
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

  const toDateTimeLocalValue = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const fetchWaitlist = async (roomCode: string) => {
    setIsWaitlistLoading(true);
    try {
      const response = await fetch(`/api/tournaments/${roomCode}/waitlist?directorPin=${encodeURIComponent(directorPin)}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Could not load waitlist");
      }
      const data = await response.json();
      setWaitlistEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch (err) {
      console.error("Failed to load waitlist:", err);
      toast({ title: "Could not load waitlist", variant: "destructive" });
      setWaitlistEntries([]);
    } finally {
      setIsWaitlistLoading(false);
    }
  };

  const handleOpenEventDetails = (tournamentToEdit: TournamentSummary) => {
    setShowEventDetailsFor(tournamentToEdit.roomCode);
    setEventVenueInput(tournamentToEdit.eventVenue || "");
    setEventStartAtInput(toDateTimeLocalValue(tournamentToEdit.eventStartAt));
    setEventDetailsUrlInput(tournamentToEdit.eventDetailsUrl || "");
    setEventRegistrationUrlInput(tournamentToEdit.eventRegistrationUrl || "");
    setEventHeroImageUrlInput(tournamentToEdit.eventHeroImageUrl || "");
    setEventMaxPlayersInput(String(tournamentToEdit.eventMaxPlayers || 24));
    setEventDirectorNameInput(tournamentToEdit.eventDirectorName || "");
    setEventDirectorEmailInput(tournamentToEdit.eventDirectorEmail || "");
    setEventDirectorPhoneInput(tournamentToEdit.eventDirectorPhone || "");
    setEventRulesTextInput(tournamentToEdit.eventRulesText || "");
    setEventYoutubeUrlInput(tournamentToEdit.eventYoutubeUrl || "");
    setEventGalleryImages(Array.isArray(tournamentToEdit.eventGalleryImages) ? tournamentToEdit.eventGalleryImages : []);
    setNewGalleryImageUrl("");
    setDraggedGalleryIndex(null);
    setEventEntryFeeInput(
      typeof tournamentToEdit.eventEntryFee === "number" ? String(tournamentToEdit.eventEntryFee) : "",
    );
    setEventEntryFeeDetailsInput(tournamentToEdit.eventEntryFeeDetails || "");
    void fetchWaitlist(tournamentToEdit.roomCode);
  };

  const handleRemoveWaitlistEntry = async (roomCode: string, entryId: number) => {
    try {
      const response = await fetch(`/api/tournaments/${roomCode}/waitlist/${entryId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directorPin }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Could not remove waitlist entry");
      }
      await fetchWaitlist(roomCode);
      toast({ title: "Waitlist entry removed" });
    } catch (err) {
      console.error("Failed to remove waitlist entry:", err);
      toast({ title: "Could not remove waitlist entry", variant: "destructive" });
    }
  };

  const handleExportWaitlist = () => {
    if (!showEventDetailsFor || waitlistEntries.length === 0) return;
    const rows = [
      ["Name", "Email", "Joined At", "Status"],
      ...waitlistEntries.map((entry) => [entry.name, entry.email, new Date(entry.createdAt).toLocaleString(), entry.status]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tournament-${showEventDetailsFor.toLowerCase()}-waitlist.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleSaveEventDetails = async () => {
    if (!showEventDetailsFor) return;
    const parsedEntryFee = eventEntryFeeInput.trim() === "" ? null : Number(eventEntryFeeInput);
    if (parsedEntryFee !== null && (!Number.isFinite(parsedEntryFee) || parsedEntryFee < 0)) {
      toast({ title: "Entry fee must be a valid number", variant: "destructive" });
      return;
    }

    setIsSavingEventDetails(true);
    try {
      const response = await fetch(`/api/tournaments/${showEventDetailsFor}/event-details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directorPin,
          eventVenue: eventVenueInput.trim() || null,
          eventStartAt: eventStartAtInput ? new Date(eventStartAtInput).toISOString() : null,
          eventDetailsUrl: eventDetailsUrlInput.trim() || null,
          eventRegistrationUrl: eventRegistrationUrlInput.trim() || null,
          eventHeroImageUrl: eventHeroImageUrlInput.trim() || null,
          eventMaxPlayers: Math.max(1, Math.min(500, parseInt(eventMaxPlayersInput || "24", 10) || 24)),
          eventDirectorName: eventDirectorNameInput.trim() || null,
          eventDirectorEmail: eventDirectorEmailInput.trim() || null,
          eventDirectorPhone: eventDirectorPhoneInput.trim() || null,
          eventRulesText: eventRulesTextInput.trim() || null,
          eventYoutubeUrl: eventYoutubeUrlInput.trim() || null,
          eventGalleryImages,
          eventEntryFee: parsedEntryFee,
          eventEntryFeeDetails: eventEntryFeeDetailsInput.trim() || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast({ title: "Could not save event details", description: err.error || "Server error", variant: "destructive" });
        return;
      }

      toast({ title: "Event details saved" });
      setShowEventDetailsFor(null);
      await fetchTournaments();
    } catch (err) {
      console.error("Failed to save event details:", err);
      toast({ title: "Could not save event details", variant: "destructive" });
    } finally {
      setIsSavingEventDetails(false);
    }
  };

  const handleAddGalleryImage = () => {
    const url = newGalleryImageUrl.trim();
    if (!url) return;
    setEventGalleryImages((prev) => [...prev, url]);
    setNewGalleryImageUrl("");
  };

  const handleRemoveGalleryImage = (indexToRemove: number) => {
    setEventGalleryImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleDropGalleryImage = (toIndex: number) => {
    if (draggedGalleryIndex === null || draggedGalleryIndex === toIndex) return;
    setEventGalleryImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggedGalleryIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDraggedGalleryIndex(null);
  };

  const handleImportTournament = () => {
    importTournamentRef.current?.click();
  };

  const onImportTournamentFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
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
        const err = await response.json().catch(() => ({}));
        toast({ title: "Import Failed", description: err.error || "Server error", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Tournament import error:", err);
      toast({ title: "Import Failed", description: err?.message || "Could not read the file", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
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
    importFullRef.current?.click();
  };

  const calculateImportCounts = (data: any): ImportCounts => {
    const importedPlayers = Array.isArray(data?.universalPlayers) ? data.universalPlayers : [];
    const historyCount = importedPlayers.reduce((sum: number, entry: any) => {
      return sum + (Array.isArray(entry?.history) ? entry.history.length : 0);
    }, 0);
    const settingsCount = data?.settings && typeof data.settings === "object" && !Array.isArray(data.settings)
      ? Object.keys(data.settings).length
      : 0;

    return {
      players: importedPlayers.length,
      tournamentHistory: historyCount,
      settings: settingsCount,
    };
  };

  const onImportFullFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const text = await file.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        toast({ title: "Import Failed", description: "File is not valid JSON", variant: "destructive" });
        return;
      }

      if (!Array.isArray(data.universalPlayers)) {
        toast({ title: "Import Failed", description: "File is missing universalPlayers[]", variant: "destructive" });
        return;
      }

      setImportPayload(data);
      setSelectedSections({ players: true, tournamentHistory: true, settings: true });
      setConflictPolicy("skip");
      setImportCounts(calculateImportCounts(data));
      setImportConflicts([]);
      setShowImportOptions(true);

      setIsPreviewLoading(true);
      const previewResponse = await fetch("/api/import/full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directorPin,
          data,
          mode: "preview",
          selectedSections: { players: true, tournamentHistory: true, settings: true },
        }),
      });
      if (previewResponse.ok) {
        const preview = await previewResponse.json();
        if (preview.counts) setImportCounts(preview.counts);
        setImportConflicts(Array.isArray(preview.conflicts) ? preview.conflicts : []);
      } else {
        const err = await previewResponse.json().catch(() => ({}));
        toast({ title: "Preview unavailable", description: err.error || "Could not analyze conflicts", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Import error:", err);
      toast({ title: "Import Failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPayload) return;
    setIsImporting(true);
    try {
      const response = await fetch("/api/import/full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directorPin,
          data: importPayload,
          mode: "apply",
          selectedSections,
          conflictPolicy,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast({ title: "Import Failed", description: err.error || "Server error", variant: "destructive" });
        return;
      }

      const result = await response.json();
      const warnings = result.errors?.length ? ` (${result.errors.length} warning(s))` : "";
      toast({
        title: "Import Complete",
        description:
          `${result.playersImported} created, ${result.playersReplaced || 0} replaced, ${result.playersDuplicated || 0} kept-both, ${result.playersSkipped || 0} skipped, ${result.historyImported || 0} history imported${warnings}`,
      });
      if (result.errors?.length) {
        console.warn("Import warnings:", result.errors);
      }

      setShowImportOptions(false);
      setImportPayload(null);
      await fetchTournaments();
    } catch (err: any) {
      console.error("Import apply error:", err);
      toast({ title: "Import Failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const activeTournaments = tournaments.filter(t => t.isActive);
  const archivedTournaments = tournaments.filter(t => !t.isActive);

  return (
    <div className="flex flex-col p-4 space-y-6">
      <input
        ref={importFullRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={onImportFullFile}
      />
      <input
        ref={importTournamentRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={onImportTournamentFile}
      />
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
                          {t.stats?.playerCount ?? 0} players
                        </span>
                        {t.startedAt && (
                          <span className="flex items-center gap-1" data-testid={`text-runtime-${t.roomCode}`}>
                            <Clock className="w-3 h-3" />
                            {formatRuntime(t.startedAt, t.completedAt)}
                          </span>
                        )}
                      </div>
                      {(t.eventStartAt || t.eventVenue) && (
                        <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                          {t.eventStartAt && <p>Event time: {new Date(t.eventStartAt).toLocaleString()}</p>}
                          {t.eventVenue && <p>Location: {t.eventVenue}</p>}
                        </div>
                      )}
                      {(t.stats?.playersWithScores ?? 0) > 0 && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1" title="Holes completed range">
                            <Target className="w-3 h-3" />
                            {t.stats?.leastHolesCompleted === t.stats?.mostHolesCompleted 
                              ? `${t.stats?.mostHolesCompleted} holes`
                              : `${t.stats?.leastHolesCompleted}-${t.stats?.mostHolesCompleted} holes`}
                          </span>
                          {t.stats?.averageScore != null && (
                            <span className="flex items-center gap-1" title="Average score">
                              <BarChart3 className="w-3 h-3" />
                              Avg: {t.stats.averageScore}
                            </span>
                          )}
                          {t.stats?.averageRelativeToPar != null && (
                            <span className={`flex items-center gap-1 ${t.stats.averageRelativeToPar <= 0 ? 'text-green-600' : 'text-red-500'}`} title="Average relative to par">
                              <TrendingUp className="w-3 h-3" />
                              {t.stats.averageRelativeToPar > 0 ? '+' : ''}{t.stats.averageRelativeToPar}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEventDetails(t);
                        }}
                        data-testid={`button-event-details-${t.roomCode}`}
                      >
                        <Calendar className="w-4 h-4 mr-1" />
                        Edit Live Event
                      </Button>
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
                          {t.stats?.playerCount ?? 0} players
                        </span>
                        {t.startedAt && (
                          <span className="flex items-center gap-1" data-testid={`text-runtime-archived-${t.roomCode}`}>
                            <Clock className="w-3 h-3" />
                            {formatRuntime(t.startedAt, t.completedAt)}
                          </span>
                        )}
                      </div>
                      {(t.eventStartAt || t.eventVenue) && (
                        <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                          {t.eventStartAt && <p>Event time: {new Date(t.eventStartAt).toLocaleString()}</p>}
                          {t.eventVenue && <p>Location: {t.eventVenue}</p>}
                        </div>
                      )}
                      {(t.stats?.playersWithScores ?? 0) > 0 && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {t.stats?.mostHolesCompleted} holes
                          </span>
                          {t.stats?.averageScore != null && (
                            <span className="flex items-center gap-1">
                              <BarChart3 className="w-3 h-3" />
                              Avg: {t.stats.averageScore}
                            </span>
                          )}
                          {t.stats?.averageRelativeToPar != null && (
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
                        onClick={(e) => { e.stopPropagation(); handleOpenEventDetails(t); }}
                        data-testid={`button-event-details-archived-${t.roomCode}`}
                      >
                        <Calendar className="w-4 h-4" />
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

      <Dialog open={!!showEventDetailsFor} onOpenChange={() => setShowEventDetailsFor(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl h-[92dvh] overflow-hidden p-0 flex flex-col">
          <DialogHeader className="px-4 pt-6 pr-12 sm:px-6">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Event Details
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="space-y-4 pr-1">
            <div className="space-y-2">
              <Label htmlFor="event-start-at">Date & Time</Label>
              <Input
                id="event-start-at"
                type="datetime-local"
                value={eventStartAtInput}
                onChange={(e) => setEventStartAtInput(e.target.value)}
                data-testid="input-event-start-at"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-venue">Location / Venue</Label>
              <Input
                id="event-venue"
                value={eventVenueInput}
                onChange={(e) => setEventVenueInput(e.target.value)}
                placeholder="e.g., Sunset Mini Golf - Riverside, CA"
                data-testid="input-event-venue"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-details-url">Tournament Details URL</Label>
              <Input
                id="event-details-url"
                type="url"
                value={eventDetailsUrlInput}
                onChange={(e) => setEventDetailsUrlInput(e.target.value)}
                placeholder="https://portal.parforthecourse.com/events/..."
                data-testid="input-event-details-url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-registration-url">Registration URL Override (optional)</Label>
              <Input
                id="event-registration-url"
                type="url"
                value={eventRegistrationUrlInput}
                onChange={(e) => setEventRegistrationUrlInput(e.target.value)}
                placeholder="https://portal.parforthecourse.com/events/.../register"
                data-testid="input-event-registration-url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-hero-image-url">Hero Image URL</Label>
              <Input
                id="event-hero-image-url"
                type="url"
                value={eventHeroImageUrlInput}
                onChange={(e) => setEventHeroImageUrlInput(e.target.value)}
                placeholder="https://images.example.com/tournament-banner.jpg"
                data-testid="input-event-hero-image-url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-max-players">Max Players</Label>
              <Input
                id="event-max-players"
                type="number"
                min={1}
                max={500}
                value={eventMaxPlayersInput}
                onChange={(e) => setEventMaxPlayersInput(e.target.value)}
                data-testid="input-event-max-players"
              />
              <p className="text-xs text-muted-foreground">
                Online registration stops at this number. TDs can still add players manually beyond the cap.
              </p>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Public Contact Details</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="event-director-name">Director Name</Label>
                  <Input
                    id="event-director-name"
                    value={eventDirectorNameInput}
                    onChange={(e) => setEventDirectorNameInput(e.target.value)}
                    placeholder="Tournament Director"
                    data-testid="input-event-director-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-director-email">Director Email</Label>
                  <Input
                    id="event-director-email"
                    type="email"
                    value={eventDirectorEmailInput}
                    onChange={(e) => setEventDirectorEmailInput(e.target.value)}
                    placeholder="director@example.com"
                    data-testid="input-event-director-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-director-phone">Director Phone</Label>
                  <Input
                    id="event-director-phone"
                    value={eventDirectorPhoneInput}
                    onChange={(e) => setEventDirectorPhoneInput(e.target.value)}
                    placeholder="(000) 000-0000"
                    data-testid="input-event-director-phone"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Entry Fee Details</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="event-entry-fee">Public Entry Fee (USD)</Label>
                  <Input
                    id="event-entry-fee"
                    type="number"
                    min={0}
                    step="0.01"
                    value={eventEntryFeeInput}
                    onChange={(e) => setEventEntryFeeInput(e.target.value)}
                    placeholder="25"
                    data-testid="input-event-entry-fee"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-entry-fee-details">Fee Details</Label>
                  <Input
                    id="event-entry-fee-details"
                    value={eventEntryFeeDetailsInput}
                    onChange={(e) => setEventEntryFeeDetailsInput(e.target.value)}
                    placeholder="Includes green fee and prize pool contribution"
                    data-testid="input-event-entry-fee-details"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Official Rules</p>
              <div className="space-y-2">
                <Label htmlFor="event-rules-text">Rules Summary / Notes</Label>
                <Textarea
                  id="event-rules-text"
                  value={eventRulesTextInput}
                  onChange={(e) => setEventRulesTextInput(e.target.value)}
                  placeholder="Paste the official rules text or key highlights here"
                  rows={5}
                  data-testid="input-event-rules-text"
                />
              </div>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Media</p>
              <div className="space-y-2">
                <Label htmlFor="event-youtube-url">YouTube Video URL (optional)</Label>
                <Input
                  id="event-youtube-url"
                  type="url"
                  value={eventYoutubeUrlInput}
                  onChange={(e) => setEventYoutubeUrlInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  data-testid="input-event-youtube-url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-gallery-image-url">Gallery Images</Label>
                <div className="flex gap-2">
                  <Input
                    id="event-gallery-image-url"
                    type="url"
                    value={newGalleryImageUrl}
                    onChange={(e) => setNewGalleryImageUrl(e.target.value)}
                    placeholder="https://.../image.jpg"
                    data-testid="input-event-gallery-image-url"
                  />
                  <Button type="button" variant="outline" onClick={handleAddGalleryImage}>
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Drag and drop to reorder gallery images.</p>
                {eventGalleryImages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No gallery images added yet.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto rounded-md border p-2">
                    {eventGalleryImages.map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        draggable
                        onDragStart={() => setDraggedGalleryIndex(index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDropGalleryImage(index)}
                        className="flex items-center gap-2 rounded border bg-background p-2"
                        data-testid={`gallery-item-${index + 1}`}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                          <img src={url} alt={`Gallery ${index + 1}`} className="h-full w-full object-cover" />
                        </div>
                        <p className="min-w-0 flex-1 truncate text-xs">#{index + 1} {url}</p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveGalleryImage(index)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {showEventDetailsFor && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Sponsors & Logos</p>
                <SponsorSettingsPanel roomCode={showEventDetailsFor} directorPin={directorPin} />
              </div>
            )}
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Waitlist</p>
                  <p className="text-xs text-muted-foreground">
                    Public waitlist capacity is 10. Remove entries after you add players manually.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{waitlistEntries.length}/10</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleExportWaitlist}
                    disabled={waitlistEntries.length === 0}
                  >
                    Export CSV
                  </Button>
                </div>
              </div>
              {isWaitlistLoading ? (
                <p className="text-sm text-muted-foreground">Loading waitlist...</p>
              ) : waitlistEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No waitlist entries yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {waitlistEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start justify-between gap-3 rounded border p-2">
                      <div className="min-w-0 text-sm">
                        <p className="font-medium truncate">{entry.name}</p>
                        <p className="text-muted-foreground truncate">{entry.email}</p>
                        <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => showEventDetailsFor && handleRemoveWaitlistEntry(showEventDetailsFor, entry.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>
          <div className="border-t bg-background px-4 py-3 sm:px-6">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowEventDetailsFor(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveEventDetails}
                disabled={isSavingEventDetails}
                data-testid="button-save-event-details"
              >
                {isSavingEventDetails ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportOptions} onOpenChange={setShowImportOptions}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>import options</DialogTitle>
            <DialogDescription>
              Choose what to import and how to handle player conflicts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <label className="flex items-center justify-between rounded border p-3 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedSections.players}
                    onCheckedChange={(checked) => setSelectedSections((s) => ({ ...s, players: !!checked }))}
                  />
                  <span>Players</span>
                </div>
                <span className="text-sm text-muted-foreground">{importCounts.players}</span>
              </label>

              <label className="flex items-center justify-between rounded border p-3 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedSections.tournamentHistory}
                    onCheckedChange={(checked) => setSelectedSections((s) => ({ ...s, tournamentHistory: !!checked }))}
                  />
                  <span>Tournament History</span>
                </div>
                <span className="text-sm text-muted-foreground">{importCounts.tournamentHistory}</span>
              </label>

              <label className="flex items-center justify-between rounded border p-3 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedSections.settings}
                    onCheckedChange={(checked) => setSelectedSections((s) => ({ ...s, settings: !!checked }))}
                  />
                  <span>Settings</span>
                </div>
                <span className="text-sm text-muted-foreground">{importCounts.settings}</span>
              </label>
            </div>

            <div className="rounded border p-3 space-y-2">
              <p className="text-sm font-medium">Conflicts ({importConflicts.length})</p>
              {isPreviewLoading ? (
                <p className="text-sm text-muted-foreground">Analyzing import...</p>
              ) : importConflicts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No player conflicts detected.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Matches are detected by unique ID first, then player name.
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {importConflicts.slice(0, 5).map((conflict) => (
                      <p key={conflict.key} className="text-xs">
                        {conflict.importName}{" -> "}{conflict.existingName} ({conflict.matchReason})
                      </p>
                    ))}
                    {importConflicts.length > 5 && (
                      <p className="text-xs text-muted-foreground">+{importConflicts.length - 5} more</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">On conflict</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={conflictPolicy === "skip" ? "default" : "outline"}
                  onClick={() => setConflictPolicy("skip")}
                >
                  Skip
                </Button>
                <Button
                  type="button"
                  variant={conflictPolicy === "replace" ? "default" : "outline"}
                  onClick={() => setConflictPolicy("replace")}
                >
                  Replace
                </Button>
                <Button
                  type="button"
                  variant={conflictPolicy === "keep_both" ? "default" : "outline"}
                  onClick={() => setConflictPolicy("keep_both")}
                >
                  Keep Both
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowImportOptions(false);
                  setImportPayload(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmImport}
                disabled={isImporting || !selectedSections.players && !selectedSections.tournamentHistory && !selectedSections.settings}
              >
                {isImporting ? "Importing..." : "Import"}
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
