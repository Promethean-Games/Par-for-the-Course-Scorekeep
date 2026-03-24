import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, CheckCircle, AlertCircle, Zap, Loader2, User, Users, Bell, BellOff, Clock, Search, ShieldAlert, X, Inbox, Timer, ArrowDownCircle, ArrowUpDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface NotificationsTabProps {
  directorPin: string;
  initialPlayerId?: number | null;
  initialPlayerName?: string | null;
}

interface Tournament {
  id: number;
  name: string;
  roomCode: string;
  isActive: boolean;
  isStarted: boolean;
}

interface TournamentPlayer {
  id: number;
  playerName: string;
  deviceId: string | null;
  groupName: string | null;
  universalPlayerId: number | null;
}

interface LeaderboardEntry {
  playerId: number;
  playerName: string;
  totalStrokes: number;
  totalPar: number;
  holesCompleted: number;
  relativeToPar: number;
}

interface PresetTemplate {
  id: string;
  label: string;
  title: string;
  bodyTemplate: string;
  requiresTournament: boolean;
  needsLeaderboard: boolean;
}

interface SentNotification {
  id: number;
  title: string;
  target: string;
  timestamp: Date;
}

interface CheatAlert {
  id: number;
  roomCode: string;
  playerName: string;
  hole: number;
  par: number;
  scratches: number;
  alertType: string;
  message: string;
  timestamp: string;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: "leaderboard_shakeup",
    label: "Leadership Shakeup!",
    title: "Leadership Shakeup!",
    bodyTemplate: "Your new leaders are:\n1st: {first}\n2nd: {second}\n3rd: {third}",
    requiresTournament: true,
    needsLeaderboard: true,
  },
  {
    id: "halftime",
    label: "Halftime Update",
    title: "Halftime Update",
    bodyTemplate: "We're at the halfway mark! Current leader: {first} ({firstScore}). Keep it up!",
    requiresTournament: true,
    needsLeaderboard: true,
  },
  {
    id: "final_holes",
    label: "Final Holes",
    title: "Final Holes!",
    bodyTemplate: "Players are approaching the final holes! Current standings: 1st {first}, 2nd {second}, 3rd {third}. It's anyone's game!",
    requiresTournament: true,
    needsLeaderboard: true,
  },
  {
    id: "tee_time",
    label: "Tee Time Reminder",
    title: "Tee Time Reminder",
    bodyTemplate: "Your tee time is coming up soon. Please head to the starting hole.",
    requiresTournament: true,
    needsLeaderboard: false,
  },
  {
    id: "weather_delay",
    label: "Weather Delay",
    title: "Weather Delay",
    bodyTemplate: "Play is temporarily suspended due to weather conditions. Please stand by for updates.",
    requiresTournament: false,
    needsLeaderboard: false,
  },
  {
    id: "play_resumed",
    label: "Play Resumed",
    title: "Play Resumed!",
    bodyTemplate: "Play has resumed! Please return to your assigned holes.",
    requiresTournament: false,
    needsLeaderboard: false,
  },
  {
    id: "food_drink",
    label: "Food & Drinks",
    title: "Refreshments Available",
    bodyTemplate: "Food and drinks are now available at the clubhouse. Come grab a bite between rounds!",
    requiresTournament: false,
    needsLeaderboard: false,
  },
  {
    id: "merchandise",
    label: "Merchandise",
    title: "Merch Alert!",
    bodyTemplate: "Hats, T-Shirts, and Towels are available now! Limited run \u2014 when they're gone, they're gone. Grab yours before they sell out!",
    requiresTournament: false,
    needsLeaderboard: false,
  },
  {
    id: "custom",
    label: "Custom Message",
    title: "",
    bodyTemplate: "",
    requiresTournament: false,
    needsLeaderboard: false,
  },
];

function formatScore(entry: LeaderboardEntry): string {
  if (entry.relativeToPar === 0) return "E";
  return entry.relativeToPar > 0 ? `+${entry.relativeToPar}` : `${entry.relativeToPar}`;
}

function applyLeaderboardData(template: string, leaderboard: LeaderboardEntry[]): string {
  const first = leaderboard[0];
  const second = leaderboard[1];
  const third = leaderboard[2];

  let result = template;
  result = result.replace("{first}", first?.playerName || "TBD");
  result = result.replace("{second}", second?.playerName || "TBD");
  result = result.replace("{third}", third?.playerName || "TBD");
  result = result.replace("{firstScore}", first ? formatScore(first) : "--");
  result = result.replace("{secondScore}", second ? formatScore(second) : "--");
  result = result.replace("{thirdScore}", third ? formatScore(third) : "--");

  return result;
}

type AlertSortField = "time" | "player" | "type";

function ReceivedPane({ directorPin }: { directorPin: string }) {
  const { data: alerts = [], isLoading } = useQuery<CheatAlert[]>({
    queryKey: ["/api/alerts", directorPin],
    queryFn: async () => {
      const res = await fetch(`/api/alerts?directorPin=${encodeURIComponent(directorPin)}`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000,
  });

  const [dismissing, setDismissing] = useState<number | null>(null);
  const [sortField, setSortField] = useState<AlertSortField>("time");

  const sortedAlerts = [...alerts].sort((a, b) => {
    if (sortField === "player") {
      const cmp = a.playerName.localeCompare(b.playerName);
      return cmp !== 0 ? cmp : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
    if (sortField === "type") {
      const cmp = a.alertType.localeCompare(b.alertType);
      return cmp !== 0 ? cmp : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const handleDismiss = async (id: number) => {
    setDismissing(id);
    try {
      await apiRequest("POST", `/api/alerts/${id}/dismiss`, { directorPin });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts", directorPin] });
    } catch {
    } finally {
      setDismissing(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {!isLoading && alerts.length > 0 && (
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Select value={sortField} onValueChange={(v) => setSortField(v as AlertSortField)}>
            <SelectTrigger className="w-40" data-testid="select-alert-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">Newest First</SelectItem>
              <SelectItem value="player">By Player</SelectItem>
              <SelectItem value="type">By Alert Type</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && alerts.length === 0 && (
        <Card className="p-6">
          <div className="flex flex-col items-center text-center gap-3">
            <Inbox className="w-10 h-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No alerts</p>
              <p className="text-sm text-muted-foreground">
                Cheat detection alerts will appear here when suspicious scores are submitted.
              </p>
            </div>
          </div>
        </Card>
      )}

      {sortedAlerts.map((alert) => {
        const alertConfig: Record<string, { icon: typeof ShieldAlert; color: string; label: string }> = {
          par_with_scratch: { icon: ShieldAlert, color: "text-amber-500", label: "Suspicious Score" },
          below_par_with_scratch: { icon: AlertCircle, color: "text-red-500", label: "Highly Suspicious" },
          rapid_scoring: { icon: Timer, color: "text-orange-500", label: "Rapid Scoring" },
          score_reduction: { icon: ArrowDownCircle, color: "text-blue-500", label: "Score Reduced" },
        };
        const config = alertConfig[alert.alertType] || alertConfig.par_with_scratch;
        const AlertIcon = config.icon;

        return (
          <Card
            key={alert.id}
            className="p-4"
            data-testid={`alert-${alert.id}`}
          >
            <div className="flex items-start gap-3">
              <AlertIcon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", config.color)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{config.label}</p>
                </div>
                <p className="text-sm mt-1">
                  <span className="font-medium">{alert.playerName}</span> &mdash; {alert.message}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span>Room: {alert.roomCode}</span>
                  <span>Hole {alert.hole}</span>
                  <span>{new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDismiss(alert.id)}
                disabled={dismissing === alert.id}
                data-testid={`button-dismiss-alert-${alert.id}`}
              >
                {dismissing === alert.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </Button>
            </div>
          </Card>
        );
      })}

      <Card className="p-4">
        <h3 className="font-semibold mb-2">Alert Types</h3>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span><span className="font-medium text-foreground">Suspicious Score</span> &mdash; Player scored par but had scratches.</span>
          </li>
          <li className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span><span className="font-medium text-foreground">Highly Suspicious</span> &mdash; Player scored below par with scratches.</span>
          </li>
          <li className="flex items-start gap-2">
            <Timer className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <span><span className="font-medium text-foreground">Rapid Scoring</span> &mdash; 3+ holes submitted within 2 minutes.</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowDownCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <span><span className="font-medium text-foreground">Score Reduced</span> &mdash; A previously submitted score was lowered.</span>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground mt-3">Alerts refresh automatically every 10 seconds. Dismiss after reviewing.</p>
      </Card>
    </div>
  );
}

function SendPane({ directorPin, initialPlayerId }: NotificationsTabProps) {
  // ── Shared state ───────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sentLog, setSentLog] = useState<SentNotification[]>([]);
  const sentIdCounter = useRef(0);

  // ── Mode ──────────────────────────────────────────────────────────
  const [sendMode, setSendMode] = useState<"broadcast" | "targeted">(
    initialPlayerId ? "targeted" : "broadcast"
  );

  // ── Broadcast state ───────────────────────────────────────────────
  const [targetRoom, setTargetRoom] = useState<string>("all");
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");
  const [loadingPreset, setLoadingPreset] = useState(false);

  // ── Targeted state ────────────────────────────────────────────────
  const [targetedRoomCode, setTargetedRoomCode] = useState<string>("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [playerFilter, setPlayerFilter] = useState("");

  // ── Data queries ──────────────────────────────────────────────────
  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ["/api/tournaments", directorPin],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments?directorPin=${directorPin}`);
      if (!res.ok) throw new Error("Failed to load tournaments");
      return res.json();
    },
  });

  const activeTournaments = tournaments.filter((t) => t.isActive);

  const { data: tournamentPlayers = [], isLoading: playersLoading } = useQuery<TournamentPlayer[]>({
    queryKey: ["/api/tournaments", targetedRoomCode, "players"],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${targetedRoomCode}/players`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!targetedRoomCode,
  });

  const { data: pushSubscriberInfo } = useQuery<{ deviceIds: string[]; universalPlayerIds: number[] }>({
    queryKey: ["/api/push/tournament-subscribers", targetedRoomCode, directorPin],
    queryFn: async () => {
      const res = await fetch(
        `/api/push/tournament-subscribers/${encodeURIComponent(targetedRoomCode)}?directorPin=${encodeURIComponent(directorPin)}`
      );
      if (!res.ok) return { deviceIds: [], universalPlayerIds: [] };
      return res.json();
    },
    enabled: !!targetedRoomCode,
    refetchInterval: 30000,
  });

  // ── Auto-select tournament & initialPlayerId ───────────────────────
  useEffect(() => {
    if (activeTournaments.length === 1 && !targetedRoomCode) {
      setTargetedRoomCode(activeTournaments[0].roomCode);
    }
  }, [activeTournaments.length]);

  useEffect(() => {
    if (initialPlayerId && tournamentPlayers.length > 0) {
      const player = tournamentPlayers.find((p) => p.universalPlayerId === initialPlayerId);
      if (player) {
        setSelectedPlayerIds((prev) => new Set([...Array.from(prev), player.id]));
      }
    }
  }, [initialPlayerId, tournamentPlayers]);

  // ── Player grouping & filtering ────────────────────────────────────
  const filteredPlayers = useMemo(() => {
    if (!playerFilter.trim()) return tournamentPlayers;
    const q = playerFilter.toLowerCase();
    return tournamentPlayers.filter((p) => p.playerName.toLowerCase().includes(q));
  }, [tournamentPlayers, playerFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, TournamentPlayer[]>();
    for (const p of filteredPlayers) {
      const key = p.groupName || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (!a && b) return 1;
      if (a && !b) return -1;
      return a.localeCompare(b);
    });
  }, [filteredPlayers]);

  // ── Push status helper ────────────────────────────────────────────
  const playerHasPush = (player: TournamentPlayer): boolean => {
    if (!pushSubscriberInfo) return false;
    if (player.universalPlayerId && pushSubscriberInfo.universalPlayerIds.includes(player.universalPlayerId)) return true;
    if (player.deviceId && pushSubscriberInfo.deviceIds.includes(player.deviceId)) return true;
    return false;
  };

  // ── Selection helpers ─────────────────────────────────────────────
  const togglePlayer = (id: number) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getGroupSelectionState = (players: TournamentPlayer[]): boolean | "indeterminate" => {
    const count = players.filter((p) => selectedPlayerIds.has(p.id)).length;
    if (count === 0) return false;
    if (count === players.length) return true;
    return "indeterminate";
  };

  const toggleGroup = (players: TournamentPlayer[]) => {
    const allSelected = players.every((p) => selectedPlayerIds.has(p.id));
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (allSelected) players.forEach((p) => next.delete(p.id));
      else players.forEach((p) => next.add(p.id));
      return next;
    });
  };

  // ── Broadcast preset helpers ──────────────────────────────────────
  const fetchLeaderboard = useCallback(async (roomCode: string): Promise<LeaderboardEntry[]> => {
    try {
      const res = await fetch(`/api/tournaments/${roomCode}/leaderboard`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.leaderboard || [];
    } catch {
      return [];
    }
  }, []);

  const handlePresetChange = useCallback(async (presetId: string) => {
    setSelectedPreset(presetId);
    setResult(null);
    const preset = PRESET_TEMPLATES.find((p) => p.id === presetId);
    if (!preset || presetId === "custom") { setTitle(""); setBody(""); return; }
    setTitle(preset.title);
    if (preset.needsLeaderboard) {
      const roomCode = targetRoom !== "all" ? targetRoom : activeTournaments[0]?.roomCode;
      if (!roomCode) { setBody(preset.bodyTemplate); return; }
      if (targetRoom === "all" && activeTournaments.length > 0) setTargetRoom(roomCode);
      setLoadingPreset(true);
      const leaderboard = await fetchLeaderboard(roomCode);
      setBody(applyLeaderboardData(preset.bodyTemplate, leaderboard));
      setLoadingPreset(false);
    } else {
      setBody(preset.bodyTemplate);
    }
  }, [targetRoom, activeTournaments, fetchLeaderboard]);

  const handleTargetChange = useCallback(async (newTarget: string) => {
    setTargetRoom(newTarget);
    setResult(null);
    const preset = PRESET_TEMPLATES.find((p) => p.id === selectedPreset);
    if (preset?.needsLeaderboard && newTarget !== "all") {
      setLoadingPreset(true);
      const leaderboard = await fetchLeaderboard(newTarget);
      setBody(applyLeaderboardData(preset.bodyTemplate, leaderboard));
      setLoadingPreset(false);
    }
  }, [selectedPreset, fetchLeaderboard]);

  // ── Send ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;

    if (sendMode === "targeted") {
      if (!targetedRoomCode || selectedPlayerIds.size === 0) return;
      setSending(true);
      setResult(null);
      try {
        const res = await apiRequest("POST", "/api/push/send-to-players", {
          directorPin,
          tournamentRoomCode: targetedRoomCode,
          tournamentPlayerIds: Array.from(selectedPlayerIds),
          title: title.trim(),
          body: body.trim(),
        });
        const data = await res.json();
        const tourName = activeTournaments.find((t) => t.roomCode === targetedRoomCode)?.name || targetedRoomCode;
        const targetLabel = `${selectedPlayerIds.size} player(s) — ${tourName}`;
        setResult({ success: true, message: data.message || `Sent to ${data.sentCount || 0} device(s)` });
        setSentLog((prev) => [{ id: ++sentIdCounter.current, title: title.trim(), target: targetLabel, timestamp: new Date() }, ...prev].slice(0, 20));
      } catch (err: any) {
        setResult({ success: false, message: err.message || "Failed to send" });
      } finally {
        setSending(false);
      }
      return;
    }

    // Broadcast
    setSending(true);
    setResult(null);
    try {
      const res = await apiRequest("POST", "/api/push/send", {
        directorPin,
        title: title.trim(),
        body: body.trim(),
        tournamentRoomCode: targetRoom === "all" ? null : targetRoom,
      });
      const data = await res.json();
      const targetLabel = targetRoom === "all"
        ? "All Subscribers"
        : activeTournaments.find((t) => t.roomCode === targetRoom)?.name || targetRoom;
      setResult({ success: true, message: data.message || `Notification sent to ${data.sentCount || 0} device(s)` });
      setSentLog((prev) => [{ id: ++sentIdCounter.current, title: title.trim(), target: targetLabel, timestamp: new Date() }, ...prev].slice(0, 20));
    } catch (err: any) {
      setResult({ success: false, message: err.message || "Failed to send notification" });
    } finally {
      setSending(false);
    }
  };

  const currentPreset = PRESET_TEMPLATES.find((p) => p.id === selectedPreset);
  const needsTournament = currentPreset?.requiresTournament && targetRoom === "all" && sendMode === "broadcast";

  const canSend =
    title.trim() &&
    body.trim() &&
    !sending &&
    (sendMode === "broadcast" || (sendMode === "targeted" && !!targetedRoomCode && selectedPlayerIds.size > 0));

  return (
    <div className="p-4 space-y-4">
      <Card className="p-4 space-y-4">
        <h3 className="font-semibold text-lg" data-testid="text-notifications-heading">Send Push Notification</h3>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            variant={sendMode === "broadcast" ? "default" : "outline"}
            className="flex-1"
            onClick={() => { setSendMode("broadcast"); setResult(null); }}
            data-testid="button-mode-broadcast"
          >
            <Users className="w-4 h-4 mr-1.5" />
            Broadcast
          </Button>
          <Button
            variant={sendMode === "targeted" ? "default" : "outline"}
            className="flex-1"
            onClick={() => { setSendMode("targeted"); setResult(null); }}
            data-testid="button-mode-targeted"
          >
            <User className="w-4 h-4 mr-1.5" />
            Targeted
          </Button>
        </div>

        {/* ── BROADCAST ────────────────────────────────────────────── */}
        {sendMode === "broadcast" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="notif-target">Send To</Label>
              <Select value={targetRoom} onValueChange={handleTargetChange}>
                <SelectTrigger id="notif-target" data-testid="select-notification-target">
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subscribers</SelectItem>
                  {activeTournaments.map((t) => (
                    <SelectItem key={t.roomCode} value={t.roomCode}>
                      {t.name} ({t.roomCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {needsTournament && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This preset works best when sent to a specific tournament.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notif-preset">Quick Presets</Label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger id="notif-preset" data-testid="select-notification-preset">
                  <SelectValue placeholder="Choose a preset..." />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_TEMPLATES.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      <span className="flex items-center gap-2">
                        {preset.id !== "custom" && <Zap className="w-3 h-3 text-amber-500" />}
                        {preset.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ── TARGETED ─────────────────────────────────────────────── */}
        {sendMode === "targeted" && (
          <div className="space-y-3">
            {/* Tournament picker */}
            <div className="space-y-1.5">
              <Label>Tournament</Label>
              <Select
                value={targetedRoomCode}
                onValueChange={(v) => {
                  setTargetedRoomCode(v);
                  setSelectedPlayerIds(new Set());
                  setPlayerFilter("");
                }}
              >
                <SelectTrigger data-testid="select-targeted-tournament">
                  <SelectValue placeholder="Select a tournament…" />
                </SelectTrigger>
                <SelectContent>
                  {activeTournaments.map((t) => (
                    <SelectItem key={t.roomCode} value={t.roomCode}>
                      {t.name} ({t.roomCode})
                    </SelectItem>
                  ))}
                  {activeTournaments.length === 0 && (
                    <SelectItem value="__none__" disabled>No active tournaments</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Player list */}
            {targetedRoomCode && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Players</Label>
                    {selectedPlayerIds.size > 0 && (
                      <button
                        className="text-xs text-muted-foreground underline"
                        onClick={() => setSelectedPlayerIds(new Set())}
                        data-testid="button-clear-selection"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Filter players…"
                      value={playerFilter}
                      onChange={(e) => setPlayerFilter(e.target.value)}
                      className="pl-9"
                      data-testid="input-player-filter"
                    />
                  </div>
                </div>

                {playersLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : groups.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-4">No players found</p>
                ) : (
                  <div className="border rounded-md overflow-hidden max-h-72 overflow-y-auto">
                    {groups.map(([groupName, players]) => {
                      const groupState = getGroupSelectionState(players);
                      const displayName = groupName || "No Group";
                      const selectedCount = players.filter((p) => selectedPlayerIds.has(p.id)).length;
                      return (
                        <div key={groupName || "__ungrouped__"} data-testid={`group-${groupName || "ungrouped"}`}>
                          {/* Group header row */}
                          <button
                            className="w-full flex items-center gap-3 px-3 py-2 bg-muted/60 hover-elevate text-left"
                            onClick={() => toggleGroup(players)}
                            data-testid={`button-toggle-group-${groupName || "ungrouped"}`}
                          >
                            <Checkbox
                              checked={groupState}
                              className="pointer-events-none flex-shrink-0"
                            />
                            <span className="font-semibold text-sm flex-1">{displayName}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {selectedCount}/{players.length}
                            </span>
                          </button>
                          {/* Player rows */}
                          {players.map((player) => (
                            <button
                              key={player.id}
                              className="w-full flex items-center gap-3 px-4 py-2 hover-elevate text-left border-t border-border/40"
                              onClick={() => togglePlayer(player.id)}
                              data-testid={`button-toggle-player-${player.id}`}
                            >
                              <Checkbox
                                checked={selectedPlayerIds.has(player.id)}
                                className="pointer-events-none flex-shrink-0"
                              />
                              <span className="flex-1 text-sm">{player.playerName}</span>
                              {playerHasPush(player) ? (
                                <Bell className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              ) : (
                                <BellOff className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedPlayerIds.size > 0 && (
                  <p className="text-sm text-muted-foreground" data-testid="text-selection-count">
                    {selectedPlayerIds.size} player{selectedPlayerIds.size !== 1 ? "s" : ""} selected
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Title + Body ──────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="notif-title">Title</Label>
          <Input
            id="notif-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title"
            maxLength={100}
            data-testid="input-notification-title"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label htmlFor="notif-body">Message</Label>
            {loadingPreset && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </div>
          <Textarea
            id="notif-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notification message"
            maxLength={500}
            className="resize-none"
            rows={4}
            data-testid="input-notification-body"
          />
          {selectedPreset !== "custom" && sendMode === "broadcast" && (
            <p className="text-xs text-muted-foreground">You can edit the text above before sending.</p>
          )}
        </div>

        {/* ── Send button ───────────────────────────────────────────── */}
        <Button
          onClick={handleSend}
          disabled={!canSend}
          className="w-full"
          data-testid="button-send-notification"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending…
            </>
          ) : sendMode === "targeted" && selectedPlayerIds.size > 0 ? (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send to {selectedPlayerIds.size} Player{selectedPlayerIds.size !== 1 ? "s" : ""}
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send Notification
            </>
          )}
        </Button>

        {result && (
          <div
            className={cn(
              "flex items-center gap-2 p-3 rounded-md text-sm",
              result.success
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-destructive/10 text-destructive"
            )}
            data-testid="text-notification-result"
          >
            {result.success ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {result.message}
          </div>
        )}
      </Card>

      {/* Recently sent log */}
      {sentLog.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Recently Sent
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {sentLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 text-sm border-b last:border-0 pb-2 last:pb-0"
                data-testid={`text-sent-log-${entry.id}`}
              >
                <Send className="w-3 h-3 mt-1 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{entry.title}</span>
                  <span className="text-muted-foreground"> &rarr; {entry.target}</span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="font-semibold mb-2">Tips</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>Players must enable notifications in their Settings to receive them.</li>
          <li>The bell icon shows which players have notifications enabled.</li>
          <li>Check a group header to select all players in that group at once.</li>
          <li>Notifications are sent automatically for tournament start, finish, and player events.</li>
          {sendMode === "broadcast" && <li>Presets with live data auto-fill when you select a specific tournament.</li>}
        </ul>
      </Card>
    </div>
  );
}

export function NotificationsTab({ directorPin, initialPlayerId, initialPlayerName }: NotificationsTabProps) {
  const [pane, setPane] = useState<"send" | "received">("received");

  const { data: alerts = [] } = useQuery<CheatAlert[]>({
    queryKey: ["/api/alerts", directorPin],
    queryFn: async () => {
      const res = await fetch(`/api/alerts?directorPin=${encodeURIComponent(directorPin)}`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000,
  });

  const alertCount = alerts.length;

  return (
    <div>
      <div className="flex gap-2 px-4 pt-4">
        <Button
          variant={pane === "send" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setPane("send")}
          data-testid="button-pane-send"
        >
          <Send className="w-4 h-4 mr-1.5" />
          Send
        </Button>
        <Button
          variant={pane === "received" ? "default" : "outline"}
          className={cn("flex-1 relative", alertCount > 0 && pane !== "received" && "border-amber-500")}
          onClick={() => setPane("received")}
          data-testid="button-pane-received"
        >
          <ShieldAlert className="w-4 h-4 mr-1.5" />
          Alerts
          {alertCount > 0 && (
            <span className="ml-1.5 bg-amber-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1" data-testid="text-alert-count">
              {alertCount}
            </span>
          )}
        </Button>
      </div>

      {pane === "send" && (
        <SendPane directorPin={directorPin} initialPlayerId={initialPlayerId} initialPlayerName={initialPlayerName} />
      )}
      {pane === "received" && (
        <ReceivedPane directorPin={directorPin} />
      )}
    </div>
  );
}
