import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { TournamentPlayer, LeaderboardEntry } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface TournamentInfo {
  id: number;
  name: string;
  roomCode: string;
  isActive: boolean;
  isStarted: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

interface TournamentContextValue {
  roomCode: string | null;
  tournamentInfo: TournamentInfo | null;
  myPlayers: TournamentPlayer[];
  allPlayers: TournamentPlayer[];
  leaderboard: LeaderboardEntry[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  deviceId: string;
  isDirector: boolean;
  directorPin: string | null;

  joinRoom: (code: string, allowInactive?: boolean) => Promise<boolean>;
  leaveRoom: () => void;
  setIsDirector: (value: boolean) => void;
  setDirectorCredentials: (pin: string) => void;
  assignPlayersToDevice: (playerIds: number[]) => Promise<void>;
  syncScore: (tournamentPlayerId: number, hole: number, par: number, strokes: number, scratches: number, penalties: number) => Promise<void>;
  refreshLeaderboard: () => Promise<void>;
  refreshPlayers: () => Promise<void>;
  verifyDirectorPin: (pin: string) => Promise<boolean>;
  createTournament: (name: string, directorPin: string, isHandicapped?: boolean) => Promise<TournamentInfo | null>;
  addPlayerToTournament: (playerName: string, groupName?: string, universalId?: string, contactInfo?: string) => Promise<TournamentPlayer | null>;
  updatePlayer: (playerId: number, data: { playerName?: string; groupName?: string; universalId?: string; contactInfo?: string }) => Promise<TournamentPlayer | null>;
  removePlayerFromTournament: (playerId: number) => Promise<void>;
  closeTournament: () => Promise<void>;
  startTournament: () => Promise<boolean>;
  batchUpdatePlayerGroups: (updates: { playerId: number; groupName: string | null }[]) => Promise<boolean>;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) throw new Error("useTournament must be used within TournamentProvider");
  return context;
}

function getDeviceId(): string {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [roomCode, setRoomCode] = useState<string | null>(() => {
    return localStorage.getItem("tournamentRoomCode");
  });
  const [tournamentInfo, setTournamentInfo] = useState<TournamentInfo | null>(null);
  const [myPlayers, setMyPlayers] = useState<TournamentPlayer[]>([]);
  const [allPlayers, setAllPlayers] = useState<TournamentPlayer[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirector, setIsDirector] = useState(false);
  const [directorPin, setDirectorPin] = useState<string | null>(null);
  const deviceId = getDeviceId();

  const refreshLeaderboard = useCallback(async () => {
    if (!roomCode) return;
    try {
      const response = await fetch(`/api/tournaments/${roomCode}/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setTournamentInfo(data.tournament);
        setLeaderboard(data.leaderboard);
      }
    } catch (err) {
      console.error("Failed to refresh leaderboard:", err);
    }
  }, [roomCode]);

  const refreshPlayers = useCallback(async () => {
    if (!roomCode) return;
    try {
      const [allRes, myRes] = await Promise.all([
        fetch(`/api/tournaments/${roomCode}/players`),
        fetch(`/api/tournaments/${roomCode}/my-players?deviceId=${deviceId}`)
      ]);
      if (allRes.ok) {
        setAllPlayers(await allRes.json());
      }
      if (myRes.ok) {
        setMyPlayers(await myRes.json());
      }
    } catch (err) {
      console.error("Failed to refresh players:", err);
    }
  }, [roomCode, deviceId]);

  useEffect(() => {
    if (roomCode) {
      refreshLeaderboard();
      refreshPlayers();
    }
  }, [roomCode, refreshLeaderboard, refreshPlayers]);

  const joinRoom = async (code: string, allowInactive?: boolean): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tournaments/${code.toUpperCase()}`);
      if (!response.ok) {
        setError("Tournament not found");
        setIsLoading(false);
        return false;
      }
      const tournament = await response.json();
      if (!tournament.isActive && !allowInactive) {
        setError("Tournament has ended");
        setIsLoading(false);
        return false;
      }
      setRoomCode(code.toUpperCase());
      setTournamentInfo(tournament);
      localStorage.setItem("tournamentRoomCode", code.toUpperCase());
      await refreshPlayers();
      await refreshLeaderboard();
      setIsLoading(false);
      return true;
    } catch (err) {
      setError("Failed to join tournament");
      setIsLoading(false);
      return false;
    }
  };

  const leaveRoom = () => {
    if (roomCode) {
      apiRequest("POST", `/api/tournaments/${roomCode}/leave`, { deviceId }).catch(() => {});
    }
    setRoomCode(null);
    setTournamentInfo(null);
    setMyPlayers([]);
    setAllPlayers([]);
    setLeaderboard([]);
    setIsDirector(false);
    localStorage.removeItem("tournamentRoomCode");
  };

  const assignPlayersToDevice = async (playerIds: number[]) => {
    if (!roomCode) return;
    try {
      for (const playerId of playerIds) {
        await apiRequest("POST", `/api/tournaments/${roomCode}/players/${playerId}/assign`, { deviceId });
      }
      await refreshPlayers();
    } catch (err) {
      console.error("Failed to assign players:", err);
    }
  };

  const syncScore = async (
    tournamentPlayerId: number,
    hole: number,
    par: number,
    strokes: number,
    scratches: number,
    penalties: number
  ) => {
    if (!roomCode) return;
    try {
      await apiRequest("POST", `/api/tournaments/${roomCode}/scores`, {
        tournamentPlayerId,
        hole,
        par,
        strokes,
        scratches,
        penalties,
      });
    } catch (err) {
      console.error("Failed to sync score:", err);
    }
  };

  const verifyDirectorPin = async (pin: string): Promise<boolean> => {
    if (!roomCode) return false;
    try {
      const response = await apiRequest("POST", `/api/tournaments/${roomCode}/verify-director`, { pin });
      const data = await response.json();
      if (data.isValid) {
        setIsDirector(true);
        setDirectorPin(pin); // Store for subsequent director operations
      }
      return data.isValid;
    } catch (err) {
      return false;
    }
  };

  const createTournament = async (name: string, pin: string, isHandicapped: boolean = false): Promise<TournamentInfo | null> => {
    try {
      const response = await apiRequest("POST", "/api/tournaments", { name, directorPin: pin, isHandicapped });
      const tournament = await response.json();
      setRoomCode(tournament.roomCode);
      setTournamentInfo(tournament);
      setIsDirector(true);
      setDirectorPin(pin); // Store for subsequent director operations
      localStorage.setItem("tournamentRoomCode", tournament.roomCode);
      return tournament;
    } catch (err) {
      setError("Failed to create tournament");
      return null;
    }
  };

  const addPlayerToTournament = async (playerName: string, groupName?: string, universalId?: string, contactInfo?: string): Promise<TournamentPlayer | null> => {
    if (!roomCode) return null;
    try {
      const response = await apiRequest("POST", `/api/tournaments/${roomCode}/players`, {
        playerName,
        groupName,
        universalId,
        contactInfo,
      });
      const player = await response.json();
      await refreshPlayers();
      return player;
    } catch (err) {
      console.error("Failed to add player:", err);
      return null;
    }
  };

  const updatePlayer = async (playerId: number, data: { playerName?: string; groupName?: string; universalId?: string; contactInfo?: string }): Promise<TournamentPlayer | null> => {
    if (!roomCode || !directorPin) return null;
    try {
      const response = await apiRequest("PATCH", `/api/tournaments/${roomCode}/players/${playerId}`, {
        ...data,
        directorPin, // Include PIN for server-side verification
      });
      const player = await response.json();
      await refreshPlayers();
      return player;
    } catch (err) {
      console.error("Failed to update player:", err);
      return null;
    }
  };

  const removePlayerFromTournament = async (playerId: number) => {
    if (!roomCode || !directorPin) return;
    try {
      await apiRequest("DELETE", `/api/tournaments/${roomCode}/players/${playerId}?directorPin=${encodeURIComponent(directorPin)}`);
      await refreshPlayers();
      await refreshLeaderboard();
    } catch (err) {
      console.error("Failed to remove player:", err);
    }
  };

  const closeTournament = async () => {
    if (!roomCode || !directorPin) return;
    try {
      await apiRequest("POST", `/api/tournaments/${roomCode}/close`, { directorPin });
      if (tournamentInfo) {
        setTournamentInfo({ ...tournamentInfo, isActive: false, completedAt: new Date().toISOString() });
      }
    } catch (err) {
      console.error("Failed to close tournament:", err);
    }
  };

  const startTournament = async (): Promise<boolean> => {
    if (!roomCode || !directorPin) return false;
    try {
      await apiRequest("POST", `/api/tournaments/${roomCode}/start`, { directorPin });
      if (tournamentInfo) {
        setTournamentInfo({ ...tournamentInfo, isStarted: true, startedAt: new Date().toISOString() });
      }
      return true;
    } catch (err) {
      console.error("Failed to start tournament:", err);
      return false;
    }
  };

  const batchUpdatePlayerGroups = async (updates: { playerId: number; groupName: string | null }[]): Promise<boolean> => {
    if (!roomCode || !directorPin) return false;
    try {
      await apiRequest("POST", `/api/tournaments/${roomCode}/players/batch-update-groups`, {
        directorPin,
        updates,
      });
      await refreshPlayers();
      return true;
    } catch (err) {
      console.error("Failed to batch update players:", err);
      return false;
    }
  };

  return (
    <TournamentContext.Provider
      value={{
        roomCode,
        tournamentInfo,
        myPlayers,
        allPlayers,
        leaderboard,
        isConnected: !!roomCode && !!tournamentInfo,
        isLoading,
        error,
        deviceId,
        isDirector,
        directorPin,
        joinRoom,
        leaveRoom,
        setIsDirector,
        setDirectorCredentials: (pin: string) => setDirectorPin(pin),
        assignPlayersToDevice,
        syncScore,
        refreshLeaderboard,
        refreshPlayers,
        verifyDirectorPin,
        createTournament,
        addPlayerToTournament,
        updatePlayer,
        removePlayerFromTournament,
        closeTournament,
        startTournament,
        batchUpdatePlayerGroups,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}
