import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayerColorPicker } from "./PlayerColorPicker";
import { ChevronUp, ChevronDown, X, ArrowLeft } from "lucide-react";
import type { Player } from "@shared/schema";
import { LOGO_URL, MAX_PLAYERS } from "@/lib/constants";

interface PlayerSetupProps {
  players: Player[];
  onAddPlayer: (name: string, position?: number) => void;
  onRemovePlayer: (id: string) => void;
  onUpdatePlayerName: (id: string, name: string) => void;
  onUpdatePlayerColor: (id: string, color: string) => void;
  onMovePlayer: (id: string, direction: "up" | "down") => void;
  onStartGame: () => void;
  onBack?: () => void;
}

export function PlayerSetup({
  players,
  onAddPlayer,
  onRemovePlayer,
  onUpdatePlayerName,
  onUpdatePlayerColor,
  onMovePlayer,
  onStartGame,
  onBack,
}: PlayerSetupProps) {
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [insertPosition, setInsertPosition] = useState<string>("end");
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAddPlayer = () => {
    const name = newPlayerName.trim() || `Player ${players.length + 1}`;
    const position = insertPosition === "end" ? undefined : parseInt(insertPosition);
    onAddPlayer(name, position);
    setNewPlayerName("");
    setInsertPosition("end");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddPlayer();
    }
  };

  const namedPlayers = players.filter((p) => p.name.trim().length > 0);
  const canStart = players.length > 0 && namedPlayers.length === players.length;

  return (
    <div className="flex flex-col min-h-screen p-6 pb-8">
      {onBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="self-start mb-2 text-muted-foreground"
          data-testid="button-back-to-splash"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      )}
      <div className="flex flex-col items-center mb-4">
        <img 
          src={LOGO_URL} 
          alt="PftC logo" 
          className="w-24 h-auto mb-2"
        />
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground px-4">
          Enter Player Names from Tallest to Shortest Height
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Players: {players.length}
        </p>
      </div>

      <div className="space-y-3 flex-1">
        {players.map((player, index) => (
          <Card key={player.id} className="p-3" data-testid={`player-card-${player.id}`}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowColorPicker(showColorPicker === player.id ? null : player.id)}
                className="w-9 h-9 rounded-full border-2 flex-shrink-0 hover-elevate active-elevate-2"
                style={{ 
                  backgroundColor: player.color,
                  borderColor: showColorPicker === player.id ? "hsl(var(--foreground))" : "hsl(var(--border))"
                }}
                data-testid={`button-color-${player.id}`}
                aria-label="Change color"
              />

              <Input
                value={player.name}
                onChange={(e) => onUpdatePlayerName(player.id, e.target.value)}
                placeholder="Player name"
                className="flex-1"
                data-testid={`input-name-${player.id}`}
              />

              <div className="flex gap-1 flex-shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onMovePlayer(player.id, "up")}
                  disabled={index === 0}
                  data-testid={`button-move-up-${player.id}`}
                  aria-label="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onMovePlayer(player.id, "down")}
                  disabled={index === players.length - 1}
                  data-testid={`button-move-down-${player.id}`}
                  aria-label="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemovePlayer(player.id)}
                  data-testid={`button-remove-${player.id}`}
                  aria-label="Remove player"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {showColorPicker === player.id && (
              <div className="mt-3 pt-3 border-t">
                <PlayerColorPicker
                  selectedColor={player.color}
                  onColorSelect={(color) => {
                    onUpdatePlayerColor(player.id, color);
                    setShowColorPicker(null);
                  }}
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Player name"
            className="flex-1"
            data-testid="input-new-player"
          />
          <Select value={insertPosition} onValueChange={setInsertPosition}>
            <SelectTrigger className="w-28" data-testid="select-position">
              <SelectValue placeholder="Position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="end">At End</SelectItem>
              {players.map((player, index) => (
                <SelectItem key={player.id} value={index.toString()}>
                  Before {index + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            ref={addButtonRef}
            onClick={handleAddPlayer}
            disabled={players.length >= MAX_PLAYERS}
            variant="outline"
            data-testid="button-add-player"
          >
            Add
          </Button>
        </div>
        <Button
          onClick={onStartGame}
          disabled={!canStart}
          className="w-full h-12 text-lg font-semibold"
          data-testid="button-start-game"
        >
          Start
        </Button>
      </div>
    </div>
  );
}
