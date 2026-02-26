import { useState } from "react";
import { PlayerSetup } from "../PlayerSetup";
import type { Player } from "@shared/schema";

export default function PlayerSetupExample() {
  const [players, setPlayers] = useState<Player[]>([
    { id: "1", name: "Alice", color: "#ef4444", order: 0 },
    { id: "2", name: "Bob", color: "#3b82f6", order: 1 },
  ]);

  return (
    <PlayerSetup
      players={players}
      onAddPlayer={(name) => {
        setPlayers([...players, {
          id: crypto.randomUUID(),
          name,
          color: "#22c55e",
          order: players.length
        }]);
      }}
      onRemovePlayer={(id) => setPlayers(players.filter(p => p.id !== id))}
      onUpdatePlayerName={(id, name) => {
        setPlayers(players.map(p => p.id === id ? { ...p, name } : p));
      }}
      onUpdatePlayerColor={(id, color) => {
        setPlayers(players.map(p => p.id === id ? { ...p, color } : p));
      }}
      onMovePlayer={(id, direction) => {
        const index = players.findIndex(p => p.id === id);
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex >= 0 && newIndex < players.length) {
          const newPlayers = [...players];
          [newPlayers[index], newPlayers[newIndex]] = [newPlayers[newIndex], newPlayers[index]];
          setPlayers(newPlayers);
        }
      }}
      onStartGame={() => console.log("Start game")}
    />
  );
}
