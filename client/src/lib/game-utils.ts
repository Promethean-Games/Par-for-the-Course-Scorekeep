import type { Player, HoleScore } from "@shared/schema";

export function calculatePlayerTotal(scores: HoleScore[]): {
  totalStrokes: number;
  totalScratches: number;
  totalPenalties: number;
} {
  return scores.reduce(
    (acc, score) => ({
      totalStrokes: acc.totalStrokes + score.strokes + score.scratches + score.penalties,
      totalScratches: acc.totalScratches + score.scratches,
      totalPenalties: acc.totalPenalties + score.penalties,
    }),
    { totalStrokes: 0, totalScratches: 0, totalPenalties: 0 }
  );
}

export function getScoreCallout(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff === -4) return "Condor";
  if (diff === -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double Bogey";
  if (diff === 3) return "Triple Bogey";
  return `+${diff}`;
}

export function getLeaderboard(
  players: Player[],
  scores: Record<string, HoleScore[]>
): Array<{ player: Player; total: number }> {
  return players
    .map((player) => ({
      player,
      total: calculatePlayerTotal(scores[player.id] || []).totalStrokes,
    }))
    .sort((a, b) => a.total - b.total);
}

export function isLeader(
  playerId: string,
  players: Player[],
  scores: Record<string, HoleScore[]>
): boolean {
  const leaderboard = getLeaderboard(players, scores);
  return leaderboard.length > 0 && leaderboard[0].player.id === playerId;
}
