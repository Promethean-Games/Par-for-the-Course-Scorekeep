import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DollarSign, Minus, Plus, GripVertical, Save, Loader2, Check } from "lucide-react";

const PLACE_COLORS = [
  "bg-yellow-500",
  "bg-gray-400",
  "bg-amber-700",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
  "bg-cyan-500",
  "bg-rose-500",
];

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

interface MultiHandleSliderProps {
  percentages: number[];
  onChange: (newPercentages: number[]) => void;
}

function MultiHandleSlider({ percentages, onChange }: MultiHandleSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startPercentsRef = useRef<number[]>([]);

  const cumulative = percentages.reduce<number[]>((acc, pct, i) => {
    acc.push((acc[i - 1] || 0) + pct);
    return acc;
  }, []);

  const handlePositions = cumulative.slice(0, -1);

  const getPercentFromX = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(100, (x / rect.width) * 100));
  }, []);

  const handlePointerDown = useCallback((handleIndex: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = handleIndex;
    startXRef.current = getPercentFromX(e.clientX);
    startPercentsRef.current = [...percentages];
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [percentages, getPercentFromX]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingRef.current === null) return;
    e.preventDefault();

    const handleIndex = draggingRef.current;
    const currentPercent = getPercentFromX(e.clientX);
    const delta = currentPercent - startXRef.current;
    const startPerc = startPercentsRef.current;

    const leftIdx = handleIndex;
    const rightIdx = handleIndex + 1;

    let newLeft = startPerc[leftIdx] + delta;
    let newRight = startPerc[rightIdx] - delta;

    if (newLeft < 1) {
      newRight += (newLeft - 1);
      newLeft = 1;
    }
    if (newRight < 1) {
      newLeft += (newRight - 1);
      newRight = 1;
    }

    newLeft = Math.max(1, Math.round(newLeft));
    newRight = Math.max(1, Math.round(newRight));

    const combined = startPerc[leftIdx] + startPerc[rightIdx];
    if (newLeft + newRight !== combined) {
      newRight = combined - newLeft;
    }
    if (newRight < 1) {
      newRight = 1;
      newLeft = combined - 1;
    }

    const updated = [...startPerc];
    updated[leftIdx] = newLeft;
    updated[rightIdx] = newRight;
    onChange(updated);
  }, [getPercentFromX, onChange]);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        className="relative h-12 rounded-md overflow-visible flex select-none touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        data-testid="slider-track"
      >
        {percentages.map((pct, i) => (
          <div
            key={i}
            className={cn(
              "h-full flex items-center justify-center relative",
              PLACE_COLORS[i % PLACE_COLORS.length],
              i === 0 && "rounded-l-md",
              i === percentages.length - 1 && "rounded-r-md"
            )}
            style={{ width: `${pct}%`, minWidth: pct > 0 ? "2px" : "0px" }}
          >
            {pct >= 8 && (
              <span className="text-xs font-bold text-white drop-shadow-md truncate px-1" data-testid={`text-segment-pct-${i}`}>
                {Math.round(pct)}%
              </span>
            )}
          </div>
        ))}

        {handlePositions.map((pos, i) => (
          <div
            key={`handle-${i}`}
            className="absolute top-0 h-full flex items-center z-10"
            style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
          >
            <div
              className="w-6 h-14 rounded-md bg-background border-2 border-foreground/30 flex items-center justify-center cursor-ew-resize shadow-md"
              onPointerDown={(e) => handlePointerDown(i, e)}
              data-testid={`handle-payout-${i}`}
            >
              <GripVertical className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TournamentOption {
  id: number;
  roomCode: string;
  name: string;
}

interface PayoutCalculatorProps {
  directorPin?: string;
  tournaments?: TournamentOption[];
  linkedRoomCode?: string;
  onClose?: () => void;
}

export function PayoutCalculator({ directorPin, tournaments, linkedRoomCode, onClose }: PayoutCalculatorProps) {
  const [numPlayers, setNumPlayers] = useState(16);
  const [entryFee, setEntryFee] = useState(20);
  const [addedPrize, setAddedPrize] = useState(0);
  const [numSpots, setNumSpots] = useState(3);
  const [percentages, setPercentages] = useState<number[]>([50, 30, 20]);
  const [selectedRoomCode, setSelectedRoomCode] = useState<string>(linkedRoomCode || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const totalPrizePool = numPlayers * entryFee + addedPrize;

  useEffect(() => {
    if (linkedRoomCode) {
      setSelectedRoomCode(linkedRoomCode);
    }
  }, [linkedRoomCode]);

  useEffect(() => {
    if (!selectedRoomCode || selectedRoomCode === "none" || !directorPin) return;
    setIsLoading(true);
    fetch(`/api/tournaments/${selectedRoomCode}/payout?directorPin=${encodeURIComponent(directorPin)}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.numPlayers) {
          setNumPlayers(data.numPlayers);
          setEntryFee(data.entryFee);
          setAddedPrize(data.addedPrize || 0);
          setNumSpots(data.numSpots);
          setPercentages(data.percentages);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [selectedRoomCode, directorPin]);

  const adjustSpots = (newCount: number) => {
    const clamped = Math.max(1, Math.min(10, newCount));
    const newPercentages: number[] = [];
    const basePercent = Math.floor(100 / clamped);
    let remainder = 100 - basePercent * clamped;
    for (let i = 0; i < clamped; i++) {
      newPercentages.push(basePercent + (i < remainder ? 1 : 0));
    }
    setNumSpots(clamped);
    setPercentages(newPercentages);
  };

  const handleSave = async () => {
    if (!selectedRoomCode || !directorPin) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/tournaments/${selectedRoomCode}/payout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directorPin,
          numPlayers,
          entryFee,
          addedPrize,
          numSpots,
          percentages,
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch {
    } finally {
      setIsSaving(false);
    }
  };

  const payouts = (() => {
    const rawAmounts = percentages.map(pct => (pct / 100) * totalPrizePool);
    const snapped = rawAmounts.map(a => Math.round(a / 5) * 5);
    const snappedTotal = snapped.reduce((s, v) => s + v, 0);
    const diff = totalPrizePool - snappedTotal;
    if (diff !== 0) {
      let maxIdx = 0;
      for (let i = 1; i < snapped.length; i++) {
        if (snapped[i] > snapped[maxIdx]) maxIdx = i;
      }
      snapped[maxIdx] += diff;
    }
    return percentages.map((pct, i) => ({
      place: i + 1,
      percentage: pct,
      amount: snapped[i],
    }));
  })();

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <DollarSign className="w-4 h-4" />
        Payout Calculator
        {onClose && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose} data-testid="button-close-payout">
            Close
          </Button>
        )}
      </h3>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {tournaments && tournaments.length > 0 && !linkedRoomCode && (
            <div>
              <Label className="text-xs">Link to Tournament</Label>
              <Select value={selectedRoomCode} onValueChange={setSelectedRoomCode}>
                <SelectTrigger data-testid="select-tournament-payout">
                  <SelectValue placeholder="Select tournament (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No tournament</SelectItem>
                  {tournaments.map(t => (
                    <SelectItem key={t.roomCode} value={t.roomCode}>
                      {t.name} ({t.roomCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {linkedRoomCode && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Linked to tournament {linkedRoomCode}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="numPlayers" className="text-xs">Number of Players</Label>
              <Input
                id="numPlayers"
                type="number"
                inputMode="numeric"
                min={1}
                value={numPlayers}
                onChange={(e) => setNumPlayers(Math.max(1, parseInt(e.target.value) || 0))}
                data-testid="input-num-players"
              />
            </div>
            <div>
              <Label htmlFor="entryFee" className="text-xs">Entry Fee ($)</Label>
              <Input
                id="entryFee"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={entryFee}
                onChange={(e) => setEntryFee(Math.max(0, parseFloat(e.target.value) || 0))}
                data-testid="input-entry-fee"
              />
            </div>
            <div>
              <Label htmlFor="addedPrize" className="text-xs">Added Prize Money ($)</Label>
              <Input
                id="addedPrize"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={addedPrize}
                onChange={(e) => setAddedPrize(Math.max(0, parseFloat(e.target.value) || 0))}
                data-testid="input-added-prize"
              />
            </div>
            <div>
              <Label className="text-xs">Spots to Pay</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => adjustSpots(numSpots - 1)}
                  disabled={numSpots <= 1}
                  data-testid="button-decrease-spots"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-lg font-bold w-8 text-center" data-testid="text-num-spots">{numSpots}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => adjustSpots(numSpots + 1)}
                  disabled={numSpots >= 10}
                  data-testid="button-increase-spots"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Prize Pool</p>
            <p className="text-2xl font-bold" data-testid="text-total-prize-pool">
              ${totalPrizePool.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            {addedPrize > 0 && (
              <p className="text-xs text-muted-foreground">
                ({numPlayers} x ${entryFee} + ${addedPrize} added)
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-semibold">Drag handles to adjust payout split</Label>
            <MultiHandleSlider
              percentages={percentages}
              onChange={setPercentages}
            />
          </div>

          <div className="space-y-2">
            {payouts.map((payout) => (
              <div key={payout.place} className="flex items-center gap-2">
                <div
                  className={cn("w-3 h-3 rounded-full flex-shrink-0", PLACE_COLORS[(payout.place - 1) % PLACE_COLORS.length])}
                />
                <span className="text-sm font-medium w-8">{ordinal(payout.place)}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", PLACE_COLORS[(payout.place - 1) % PLACE_COLORS.length])}
                    style={{ width: `${payout.percentage}%` }}
                  />
                </div>
                <span className="text-sm font-mono w-10 text-right text-muted-foreground" data-testid={`text-payout-pct-${payout.place - 1}`}>
                  {payout.percentage}%
                </span>
                <span className="text-sm font-bold w-20 text-right" data-testid={`text-payout-amount-${payout.place - 1}`}>
                  ${payout.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total distributed:</span>
              <span className={cn(
                "font-bold",
                percentages.reduce((s, v) => s + v, 0) === 100 ? "text-green-600" : "text-destructive"
              )} data-testid="text-total-distributed">
                {percentages.reduce((s, v) => s + v, 0)}%
                {" "}(${payouts.reduce((s, p) => s + p.amount, 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
              </span>
            </div>
          </div>

          {directorPin && (selectedRoomCode && selectedRoomCode !== "none") && (
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={isSaving}
              data-testid="button-save-payout"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saveSuccess ? "Saved" : "Save to Tournament"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
