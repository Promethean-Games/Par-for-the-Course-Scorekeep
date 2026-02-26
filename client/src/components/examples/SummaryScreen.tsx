import { SummaryScreen } from "../SummaryScreen";
import type { Player, HoleScore } from "@shared/schema";

export default function SummaryScreenExample() {
  const players: Player[] = [
    { id: "1", name: "Alice", color: "#ef4444", order: 0 },
    { id: "2", name: "Bob", color: "#3b82f6", order: 1 },
    { id: "3", name: "Charlie", color: "#22c55e", order: 2 },
  ];

  const scores: Record<string, HoleScore[]> = {
    "1": [
      { hole: 1, par: 3, strokes: 4, scratches: 0, penalties: 0 },
      { hole: 2, par: 4, strokes: 5, scratches: 1, penalties: 0 },
      { hole: 3, par: 3, strokes: 3, scratches: 0, penalties: 1 },
    ],
    "2": [
      { hole: 1, par: 3, strokes: 3, scratches: 0, penalties: 0 },
      { hole: 2, par: 4, strokes: 6, scratches: 1, penalties: 1 },
      { hole: 3, par: 3, strokes: 4, scratches: 0, penalties: 0 },
    ],
    "3": [
      { hole: 1, par: 3, strokes: 5, scratches: 0, penalties: 1 },
      { hole: 2, par: 4, strokes: 4, scratches: 0, penalties: 0 },
      { hole: 3, par: 3, strokes: 5, scratches: 1, penalties: 0 },
    ],
  };

  return (
    <SummaryScreen
      players={players}
      scores={scores}
      onNewGame={() => console.log("New game")}
      onSubmitToSheets={() => console.log("Submit to sheets")}
      isGameOver={true}
    />
  );
}
