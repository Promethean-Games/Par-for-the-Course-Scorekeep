---
title: Round-robin starting hole support
---
# Round-Robin Starting Hole Support

## What & Why
In tournament play, groups don't all start at hole 1. Each group is assigned a different starting hole and rotates through all 18 in order, wrapping from hole 18 back to hole 1. The app currently hardcodes hole 1 as the start and ends the game at hole 18, which breaks round-robin format entirely. This change makes the app correct for how the game is actually played at events.

## Done looks like
- Local game setup has a "Starting Hole" selector (1–18, defaults to 1)
- Tournament Director can assign a starting hole per group/table in the group management screen
- The game screen shows "Hole X · Y/18" so players always know how far along they are in their rotation
- After hole 18, the game correctly continues to hole 1, then 2, etc., wrapping around
- The game completes after 18 holes have been played (counted), not when hole 18 is reached
- The mid-game leaderboard shows each player's "holes completed" count so observers understand standings are live
- A subtle note on the live leaderboard ("Groups may be on different holes — standings are live") prevents confusion when comparing groups

## Out of scope
- Changing how par is drawn (each group still draws their own par per hole, same as now)
- Handicap recalculation changes
- Reordering the final summary to display holes in played order (holes still display 1–18 in score history)
- Pre-assigning par per hole by the TD (par is still drawn live per group)

## Tasks
1. **Add starting hole to game state and local setup** — Add a `startingHole` field to `GameState` in the schema and `GameContext`. Wire up a "Starting Hole" selector (1–18) in the local player setup screen. Initialize `currentHole` to the selected starting hole when a game begins.

2. **Implement wrap-around hole progression** — Modify the `nextCard` logic in `GameContext` so advancing past hole 18 wraps to hole 1. Track a separate `holesCompleted` counter (incremented each time all players finish a hole). Use `holesCompleted === 18` (not `currentHole === 18`) to detect game completion.

3. **Add starting hole per group in tournament setup** — Add a starting hole field to the group/table assignment UI in the Director Portal. Store it alongside the group assignment so each group knows where to start. When a group's game session is initialized, use their assigned starting hole.

4. **Update GameScreen progress display** — Show "Hole X · Y/18 played" instead of just "Hole X" throughout the game screen. This applies to both local and tournament modes.

5. **Update leaderboard to show holes completed** — In the live tournament leaderboard (Director Portal + in-game leaderboard widget), show each player's `holesCompleted / 18` alongside their score. Add a small note indicating standings are live when not all players have finished.

## Relevant files
- `client/src/contexts/GameContext.tsx`
- `client/src/components/PlayerSetup.tsx`
- `client/src/components/GameScreen.tsx`
- `client/src/components/DirectorPortal.tsx`
- `shared/schema.ts`
- `server/storage.ts:360-399`