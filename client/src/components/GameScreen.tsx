import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Undo2, Home } from "lucide-react";
import type { Player, HoleScore, SetupTime } from "@shared/schema";
import { PAR_OPTIONS, LEADER_ICON_URL, MAX_HOLES } from "@/lib/constants";
import { getScoreCallout } from "@/lib/game-utils";
import { cn } from "@/lib/utils";
import { DrawDialog } from "./DrawDialog";
import { TableSetupDialog } from "./TableSetupDialog";
import { useTournament } from "@/contexts/TournamentContext";

interface GameScreenProps {
  players: Player[];
  currentPlayer: Player;
  currentHole: number;
  scores: Record<string, HoleScore[]>;
  isLeader: boolean;
  leftHandedMode?: boolean;
  onPreviousPlayer: () => void;
  onNextPlayer: () => void;
  onUpdateScore: (score: Partial<HoleScore>) => void;
  onNextCard: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onSetParForAll: (par: number) => void;
  onRecordSetupTime: (setupTime: SetupTime) => void;
  onHome?: () => void;
}

export function GameScreen({
  players,
  currentPlayer,
  currentHole,
  scores,
  isLeader,
  leftHandedMode = false,
  onPreviousPlayer,
  onNextPlayer,
  onUpdateScore,
  onNextCard,
  onUndo,
  canUndo,
  onSetParForAll,
  onRecordSetupTime,
  onHome,
}: GameScreenProps) {
  const [showDrawDialog, setShowDrawDialog] = useState(false);
  const [showTableSetupDialog, setShowTableSetupDialog] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [pendingPar, setPendingPar] = useState<number | null>(null);
  const [drawConfirmTime, setDrawConfirmTime] = useState<number | null>(null);
  const [lastHole, setLastHole] = useState(currentHole);
  const isInitialMount = useRef(true);
  const lastPlayerId = useRef(currentPlayer.id);
  const tournament = useTournament();
  
  // Swipe gesture handling
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      onNextPlayer();
    } else if (isRightSwipe) {
      onPreviousPlayer();
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };
  
  const currentScore = scores[currentPlayer.id]?.find((s) => s.hole === currentHole) || {
    hole: currentHole,
    par: 0,
    strokes: 0,
    scratches: 0,
    penalties: 0,
  };

  const [par, setPar] = useState(currentScore.par || 0);
  const [strokes, setStrokes] = useState(currentScore.strokes || 0);
  const [scratches, setScratches] = useState(currentScore.scratches || 0);
  const [penalties, setPenalties] = useState(currentScore.penalties || 0);

  // Show DRAW dialog when hole changes
  useEffect(() => {
    if (currentHole !== lastHole) {
      setLastHole(currentHole);
      // Check if par is already set for this hole
      const existingPar = scores[currentPlayer.id]?.find((s) => s.hole === currentHole)?.par;
      if (!existingPar || existingPar === 0) {
        setShowDrawDialog(true);
      }
    }
  }, [currentHole, lastHole, scores, currentPlayer.id]);

  // Show DRAW dialog on initial load if no par set
  useEffect(() => {
    if (currentScore.par === 0) {
      setShowDrawDialog(true);
    }
  }, []);

  useEffect(() => {
    // Track player changes to avoid updating score during player switch
    if (currentPlayer.id !== lastPlayerId.current) {
      lastPlayerId.current = currentPlayer.id;
      isInitialMount.current = true;
    }
    setPar(currentScore.par || 0);
    setStrokes(currentScore.strokes || 0);
    setScratches(currentScore.scratches || 0);
    setPenalties(currentScore.penalties || 0);
  }, [currentPlayer.id, currentHole, currentScore]);

  useEffect(() => {
    // Skip the initial mount and player switches to avoid double updates
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onUpdateScore({ par, strokes, scratches, penalties });
  }, [par, strokes, scratches, penalties]);

  // Sync scores to tournament server when connected (only on meaningful changes)
  const lastSyncedScore = useRef<string>("");
  
  useEffect(() => {
    if (!tournament.isConnected || isInitialMount.current || par === 0) return;
    
    // Find matching tournament player by name (case-insensitive)
    const tournamentPlayer = tournament.myPlayers.find(
      tp => tp.playerName.toLowerCase().trim() === currentPlayer.name.toLowerCase().trim()
    );
    
    if (!tournamentPlayer) return;
    
    // Create a score key to avoid duplicate syncs
    const scoreKey = `${tournamentPlayer.id}-${currentHole}-${par}-${strokes}-${scratches}-${penalties}`;
    if (scoreKey === lastSyncedScore.current) return;
    
    // Debounce: only sync when strokes > 0 (hole has been played)
    if (strokes > 0) {
      lastSyncedScore.current = scoreKey;
      tournament.syncScore(
        tournamentPlayer.id,
        currentHole,
        par,
        strokes,
        scratches,
        penalties
      );
    }
  }, [par, strokes, scratches, penalties, tournament.isConnected, currentHole, currentPlayer.name, tournament.myPlayers]);

  const playerStats = (scores[currentPlayer.id] || []).reduce((acc, score) => ({
    scratches: acc.scratches + score.scratches,
    strokes: acc.strokes + score.strokes + score.scratches + score.penalties,
    penalties: acc.penalties + score.penalties,
  }), { scratches: 0, strokes: 0, penalties: 0 });

  const handleMercy = () => {
    if (par > 0) {
      setStrokes(par + 5);
      setTimeout(() => onNextCard(), 300);
    }
  };

  const handleDrawPar = (selectedPar: number) => {
    // Store the selected par and start timing
    setPendingPar(selectedPar);
    setDrawConfirmTime(Date.now());
    setShowDrawDialog(false);
    // Show table setup dialog (except for first hole where table isn't set up yet)
    if (currentHole === 1) {
      // First hole - apply par immediately without table setup confirmation
      onSetParForAll(selectedPar);
      setPar(selectedPar);
    } else {
      // Subsequent holes - show table setup confirmation
      setShowTableSetupDialog(true);
    }
  };

  const handleTableReady = () => {
    if (pendingPar !== null && drawConfirmTime !== null) {
      const setupTimeMs = Date.now() - drawConfirmTime;
      // Record the setup time
      onRecordSetupTime({
        hole: currentHole,
        par: pendingPar,
        setupTimeMs,
        timestamp: new Date().toISOString(),
      });
      // Apply the par
      onSetParForAll(pendingPar);
      setPar(pendingPar);
    }
    // Reset state
    setPendingPar(null);
    setDrawConfirmTime(null);
    setShowTableSetupDialog(false);
  };

  // Check if all players have non-zero scores for current hole
  const allPlayersHaveScores = players.every((player) => {
    const playerScore = scores[player.id]?.find((s) => s.hole === currentHole);
    return playerScore && playerScore.strokes > 0;
  });

  const canAdvance = par > 0 && strokes > 0 && allPlayersHaveScores;
  const isLastHole = currentHole >= MAX_HOLES;
  const isLastPlayer = players.indexOf(currentPlayer) === players.length - 1;
  const isFinishingGame = isLastHole && isLastPlayer && allPlayersHaveScores;

  // Count players remaining with zero score for current hole
  const shootersRemaining = players.filter((player) => {
    const playerScore = scores[player.id]?.find((s) => s.hole === currentHole);
    return !playerScore || playerScore.strokes === 0;
  }).length;
  
  const shooterInfo = `${shootersRemaining} shooter${shootersRemaining !== 1 ? "s" : ""} remaining`;

  return (
    <div 
      className={cn("flex flex-col p-4 pb-4", leftHandedMode && "left-handed")}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Player Navigation */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          size="icon"
          variant="outline"
          onClick={onPreviousPlayer}
          className="w-20 h-11 text-xl"
          data-testid="button-prev-player"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        
        <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border relative" style={{
          borderColor: currentPlayer.color,
          borderWidth: "2px"
        }}>
          {isLeader && (
            <img src={LEADER_ICON_URL} alt="Leader" className="w-5 h-5" data-testid="img-leader" />
          )}
          <span className="text-2xl font-bold" data-testid="text-player-name">{currentPlayer.name}</span>
        </div>
        
        <Button
          size="icon"
          variant="outline"
          onClick={onNextPlayer}
          className="w-20 h-11 text-xl"
          data-testid="button-next-player"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-xs uppercase text-muted-foreground font-semibold">Scratches</div>
          <div className="text-2xl font-bold" data-testid="text-scratches">{playerStats.scratches}</div>
        </div>
        <div className="text-center">
          <div className="text-xs uppercase text-muted-foreground font-semibold">Total Strokes</div>
          <div className="text-2xl font-bold" data-testid="text-total-strokes">{playerStats.strokes}</div>
        </div>
        <div className="text-center">
          <div className="text-xs uppercase text-muted-foreground font-semibold">Penalties</div>
          <div className="text-2xl font-bold" data-testid="text-penalties">{playerStats.penalties}</div>
        </div>
      </div>

      <div className="h-0.5 mb-4" style={{ backgroundColor: currentPlayer.color }} />

      {/* Hole & Shooters Remaining */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-lg font-bold" data-testid="text-hole">Hole {currentHole}</div>
        <div className="text-sm text-muted-foreground" data-testid="text-shooters-remaining">{shooterInfo}</div>
      </div>

      {/* Par Selection */}
      {par === 0 ? (
        <button
          className="w-full mb-3 p-4 rounded-md border-2 border-dashed border-primary text-center"
          onClick={() => setShowDrawDialog(true)}
          data-testid="button-set-par-banner"
        >
          <span className="text-lg font-bold text-primary">Tap to Set Par</span>
          <span className="block text-sm text-muted-foreground mt-1">Par must be set before scoring</span>
        </button>
      ) : (
        <div className={cn("flex items-center gap-3 mb-3", leftHandedMode && "flex-row-reverse")}>
          <label htmlFor="par-select" className="text-base font-medium">Par:</label>
          <Select value={par.toString()} onValueChange={(v) => setPar(parseInt(v))}>
            <SelectTrigger className="w-32 h-11" id="par-select" data-testid="select-par">
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent>
              {(tournament.isConnected ? [1, 2, 3, 4] : PAR_OPTIONS).map((p) => (
                <SelectItem key={p} value={p.toString()}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {strokes >= par + 5 && (
            <Button
              variant="outline"
              onClick={handleMercy}
              className="h-11 px-4"
              data-testid="button-mercy"
            >
              Mercy (+5)
            </Button>
          )}
        </div>
      )}

      {/* Scratch & Penalty */}
      <div className={cn("flex gap-3 mb-4", leftHandedMode && "flex-row-reverse")}>
        <Button
          variant="destructive"
          className="flex-1 h-12"
          onClick={() => setScratches(scratches + 1)}
          data-testid="button-scratch"
        >
          Scratch (+1)
        </Button>
        {!tournament.isConnected && (
          <Button
            variant="destructive"
            className="flex-1 h-12"
            onClick={() => setPenalties(penalties + 1)}
            data-testid="button-penalty"
          >
            Penalty (+1)
          </Button>
        )}
      </div>

      {/* Score Display & Controls */}
      <div className={cn("flex gap-4 items-center mb-4", leftHandedMode && "flex-row-reverse")}>
        <div className="flex-1 text-center">
          <div className="text-8xl font-extrabold leading-none" data-testid="text-score">
            {strokes + scratches + penalties}
          </div>
          {(scratches > 0 || penalties > 0) && (
            <div className="text-xs text-muted-foreground" data-testid="text-score-breakdown">
              {strokes} + {scratches > 0 && `${scratches}S`}{scratches > 0 && penalties > 0 && " + "}{penalties > 0 && `${penalties}P`}
            </div>
          )}
          <div className="text-sm font-bold min-h-[20px] mt-1" data-testid="text-callout">
            {par > 0 && strokes > 0 && getScoreCallout(strokes + scratches + penalties, par)}
          </div>
        </div>
        <div className="flex flex-col gap-3 w-28">
          <Button
            className="h-20 text-3xl"
            onClick={() => setStrokes(Math.max(0, strokes + 1))}
            data-testid="button-score-plus"
          >
            ▲
          </Button>
          <Button
            className="h-20 text-3xl"
            onClick={() => setStrokes(Math.max(0, strokes - 1))}
            data-testid="button-score-minus"
          >
            ▼
          </Button>
        </div>
      </div>

      {/* Undo & Next Card */}
      <div className={cn("flex gap-3", leftHandedMode && "flex-row-reverse")}>
        <Button
          variant="destructive"
          className="flex-1 h-12 text-base"
          onClick={onUndo}
          disabled={!canUndo}
          data-testid="button-undo"
        >
          <Undo2 className="w-5 h-5 mr-2" />
          Undo
        </Button>
        <div className="flex-1 flex flex-col gap-1">
          <Button
            className={cn(
              "w-full h-12 text-base",
              allPlayersHaveScores && par > 0 && strokes > 0 && "animate-pulse"
            )}
            onClick={() => {
              if (isFinishingGame) {
                setShowFinishConfirm(true);
              } else {
                onNextCard();
              }
            }}
            disabled={!canAdvance}
            data-testid="button-next-card"
          >
            {isFinishingGame ? "Finish Game" : "Next Card"}
          </Button>
          {!canAdvance && par === 0 && (
            <span className="text-xs text-center text-destructive" data-testid="text-par-required">Set par to continue</span>
          )}
        </div>
      </div>

      {onHome && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onHome}
            data-testid="button-home"
          >
            <Home className="w-4 h-4 mr-1" />
            Home
          </Button>
        </div>
      )}

      {showDrawDialog && (
        <DrawDialog
          onSelectPar={handleDrawPar}
          isFirstDraw={currentHole === 1}
          isTournament={tournament.isConnected}
        />
      )}

      {showTableSetupDialog && pendingPar !== null && (
        <TableSetupDialog
          hole={currentHole}
          par={pendingPar}
          onConfirm={handleTableReady}
        />
      )}

      <Dialog open={showFinishConfirm} onOpenChange={setShowFinishConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Finish Game</DialogTitle>
            <DialogDescription className="pt-2">
              To finalize and submit your score(s), click continue. This action cannot be undone. Any questions can be directed towards your Tournament Director.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setShowFinishConfirm(false)}
              data-testid="button-finish-cancel"
            >
              Go Back
            </Button>
            <Button
              onClick={() => {
                setShowFinishConfirm(false);
                onNextCard();
              }}
              data-testid="button-finish-confirm"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
