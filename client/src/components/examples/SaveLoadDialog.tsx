import { SaveLoadDialog } from "../SaveLoadDialog";
import type { GameSession } from "@shared/schema";

export default function SaveLoadDialogExample() {
  const savedGames: Record<string, GameSession> = {
    "Slot 1": {
      id: "1",
      players: [
        { id: "1", name: "Alice", color: "#ef4444", order: 0 },
        { id: "2", name: "Bob", color: "#3b82f6", order: 1 },
      ],
      currentHole: 5,
      currentPlayerIndex: 0,
      scores: {},
      isComplete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  return (
    <SaveLoadDialog
      mode="load"
      savedGames={savedGames}
      onSave={(slot) => console.log("Save to", slot)}
      onLoad={(slot) => console.log("Load from", slot)}
      onClose={() => console.log("Close")}
    />
  );
}
