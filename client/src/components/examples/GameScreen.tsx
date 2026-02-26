import { useState } from "react";
import { GameScreen } from "../GameScreen";
import type { Player, HoleScore } from "@shared/schema";

export default function GameScreenExample() {
  const players: Player[] = [
    { id: "1", name: "Alice", color: "#ef4444", order: 0 },
    { id: "2", name: "Bob", color: "#3b82f6", order: 1 },
  ];

  const [scores, setScores] = useState<Record<string, HoleScore[]>>({
    "1": [{ hole: 1, par: 3, strokes: 4, scratches: 0, penalties: 0 }],
    "2": [],
  });

  return (
    <GameScreen
      players={players}
      currentPlayer={players[0]}
      currentHole={1}
      scores={scores}
      isLeader={true}
      leftHandedMode={false}
      onPreviousPlayer={() => console.log("Previous")}
      onNextPlayer={() => console.log("Next")}
      onUpdateScore={(score) => console.log("Update score", score)}
      onNextCard={() => console.log("Next card")}
      onUndo={() => console.log("Undo")}
      canUndo={true}
      onSetParForAll={(par) => console.log("Set par for all:", par)}
      onRecordSetupTime={(setupTime) => console.log("Setup time:", setupTime)}
    />
  );
}
