import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Save, FolderOpen, Pencil, Check, Trash2, Clock, Flag, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { GameSession } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SaveLoadDialogProps {
  mode: "save" | "load";
  savedGames: Record<string, GameSession>;
  onSave?: (slot: string) => void;
  onLoad?: (slot: string) => void;
  onRename?: (oldSlot: string, newSlot: string) => void;
  onDelete?: (slot: string) => void;
  onEndGame?: () => void;
  onNewGame?: () => void;
  onClose: () => void;
}

const AUTOSAVE_KEY = "__autosave__";
const MANUAL_SLOTS = ["Slot 1", "Slot 2", "Slot 3"];

export function SaveLoadDialog({ mode, savedGames, onSave, onLoad, onRename, onDelete, onEndGame, onNewGame, onClose }: SaveLoadDialogProps) {
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "overwrite" | "delete" | "endGame" | "newGame"; slot: string } | null>(null);
  const { toast } = useToast();

  const autosave = savedGames[AUTOSAVE_KEY];
  
  // Only show the 3 fixed manual slots
  const slots = MANUAL_SLOTS;

  const handleRename = (oldSlot: string) => {
    const newName = editingName.trim();
    if (newName && newName !== oldSlot && newName !== AUTOSAVE_KEY && onRename) {
      onRename(oldSlot, newName);
      toast({ title: "Slot Renamed", description: `Renamed to "${newName}"` });
    }
    setEditingSlot(null);
    setEditingName("");
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    
    if (confirmAction.type === "overwrite") {
      onSave?.(confirmAction.slot);
      toast({ title: "Game Overwritten", description: `Overwrote ${confirmAction.slot}` });
      onClose();
    } else if (confirmAction.type === "delete") {
      onDelete?.(confirmAction.slot);
      toast({ title: "Save Deleted", description: `Deleted ${confirmAction.slot}` });
    } else if (confirmAction.type === "endGame") {
      onEndGame?.();
      toast({ title: "Game Ended", description: "Game has been completed" });
      onClose();
    } else if (confirmAction.type === "newGame") {
      onNewGame?.();
      toast({ title: "New Game", description: "Starting a new game" });
    }
    setConfirmAction(null);
  };

  return (
    <div className="flex flex-col min-h-screen pb-16">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">{mode === "save" ? "Save Game" : "Load Game"}</h2>
        </div>

        <div className="space-y-3">
          {/* Autosave Section - Load Only */}
          {autosave && (
            <Card className="p-4 border-dashed" data-testid="slot-autosave">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold">Autosave</h3>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(autosave.updatedAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {autosave.players.length} players • Hole {autosave.currentHole}
              </p>
              <Button
                variant="outline"
                className="w-full h-12"
                onClick={() => {
                  onLoad?.(AUTOSAVE_KEY);
                  toast({ title: "Game Loaded", description: "Loaded from autosave" });
                  onClose();
                }}
                disabled={mode === "save"}
                data-testid="button-load-autosave"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                {mode === "save" ? "Autosave (Load Only)" : "Load Autosave"}
              </Button>
            </Card>
          )}

          {/* Manual Save Slots */}
          <div className="pt-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              {mode === "save" ? "Save Slots" : "Saved Games"}
            </h3>
          </div>

          {/* Game Actions - Save mode only */}
          {mode === "save" && (
            <div className="pt-4 border-t space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Game Actions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => setConfirmAction({ type: "endGame", slot: "" })}
                  data-testid="button-end-game"
                >
                  <Flag className="w-4 h-4 mr-2" />
                  End Game
                </Button>
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => setConfirmAction({ type: "newGame", slot: "" })}
                  data-testid="button-new-game"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Game
                </Button>
              </div>
            </div>
          )}

          {slots.map((slot) => {
            const savedGame = savedGames[slot];
            const isEmpty = !savedGame;
            const isEditing = editingSlot === slot;

            return (
              <Card key={slot} className="p-4" data-testid={`slot-${slot}`}>
                <div className="flex items-center justify-between mb-2 gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(slot);
                          if (e.key === "Escape") {
                            setEditingSlot(null);
                            setEditingName("");
                          }
                        }}
                        data-testid={`input-rename-${slot}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRename(slot)}
                        data-testid={`button-confirm-rename-${slot}`}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{slot}</h3>
                        {!isEmpty && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditingSlot(slot);
                              setEditingName(slot);
                            }}
                            data-testid={`button-rename-${slot}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isEmpty && (
                          <>
                            <span className="text-xs text-muted-foreground">
                              {new Date(savedGame.updatedAt).toLocaleDateString()}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => setConfirmAction({ type: "delete", slot })}
                              data-testid={`button-delete-${slot}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                {isEmpty ? (
                  <Button
                    variant="outline"
                    className="w-full h-14"
                    onClick={() => {
                      if (mode === "save") {
                        onSave?.(slot);
                        toast({ title: "Game Saved", description: `Saved to ${slot}` });
                        onClose();
                      }
                    }}
                    disabled={mode === "load"}
                    data-testid={`button-${mode}-${slot}`}
                  >
                    {mode === "save" ? "Save Here" : "Empty Slot"}
                  </Button>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {savedGame.players.length} players • Hole {savedGame.currentHole}
                    </p>
                    <Button
                      className="w-full h-12"
                      onClick={() => {
                        if (mode === "save") {
                          setConfirmAction({ type: "overwrite", slot });
                        } else {
                          onLoad?.(slot);
                          toast({ title: "Game Loaded", description: `Loaded from ${slot}` });
                          onClose();
                        }
                      }}
                      data-testid={`button-${mode}-${slot}`}
                    >
                      {mode === "save" ? (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Overwrite
                        </>
                      ) : (
                        <>
                          <FolderOpen className="w-4 h-4 mr-2" />
                          Load
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "overwrite" && "Overwrite Save?"}
              {confirmAction?.type === "delete" && "Delete Save?"}
              {confirmAction?.type === "endGame" && "End Game?"}
              {confirmAction?.type === "newGame" && "Start New Game?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "overwrite" && `This will overwrite the saved game in "${confirmAction.slot}". This action cannot be undone.`}
              {confirmAction?.type === "delete" && `This will permanently delete the saved game "${confirmAction?.slot}". This action cannot be undone.`}
              {confirmAction?.type === "endGame" && "This will mark the current game as complete. You can still view the summary."}
              {confirmAction?.type === "newGame" && "This will start a new game. Make sure to save your current game first if you want to keep it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={confirmAction?.type === "delete" || confirmAction?.type === "newGame" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              data-testid="button-confirm-action"
            >
              {confirmAction?.type === "overwrite" && "Overwrite"}
              {confirmAction?.type === "delete" && "Delete"}
              {confirmAction?.type === "endGame" && "End Game"}
              {confirmAction?.type === "newGame" && "Start New Game"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
