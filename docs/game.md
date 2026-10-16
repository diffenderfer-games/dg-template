# The template's starter game: notes

GAME doc. In a new game, `new-game` replaces this file with blank notes to
fill in (Design, Modes, Controls, Test drivers, Known issues). In the template
it describes the placeholder every new game starts from.

## Design

A placeholder, not a game: each press of the action button scores a point.
It exists so every kit feature is wired and tested from the first commit,
with neutral names (`score`, `target`, `points`) a real game replaces.

## Modes

- **Normal:** as many points as you can in 30 seconds.
- **Daily:** reach a target (15–25, from the day's seed) in 20 seconds.
- **Race:** the first to reach the target (10, 20 or 30) wins.
- **Play now (Score party):** 2–4 players in a live hub room; the host runs the
  rules; a computer presses for a player who drops.
- **Play online (take the last one):** an online game the hub runs from
  `src/game/turns/rules.ts`; players take 1–3 from a pile in turn, and whoever
  takes the last one wins.

## Controls

Space, the gamepad's A or the on-screen button scores. Escape or the
gamepad's Start pauses.

## Room

`game.world` generates a lounge with 4 tables and the game's name on it
(`npm run world:check`; the hub serves it as `game.<slug>`, and players walk
it in Adventure Mode at `/world/game.<slug>`).

## Test drivers

None of its own: the kit's (`addScore`, `solveNow`, `turnsMove`…) are in
[kit/test-hook.md](kit/test-hook.md).

## Known issues

None.
