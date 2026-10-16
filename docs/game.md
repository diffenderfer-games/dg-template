# The template's skeleton: notes

GAME doc. In a new game, `new-game` replaces this file with blank notes to
fill in (Design, Modes, Controls, Test drivers, Known issues).

## Design

No game: `src/game/` is a skeleton of hooks with `TODO(game)` comments, and only
the lines the kit needs to run (a `score`, `addScore` and `solve` for the kit's
tests, a pass-the-turn placeholder for online games the hub runs). It plays as
an empty screen that shows the score; Pause, Quit and the kit's drivers end it.

## Modes

Every kit feature is declared and wired (normal, daily, races, online rooms,
online games the hub runs, a room in the world, playing in the box over the
world at a placeholder 960×640) so the kit's tests cover them all; `new-game --no-*`
drops the ones a game won't have.

## Controls

Escape or the gamepad's Start pauses; on the pause screen Escape goes back to
play. In the world's box, Escape on the title leaves the box. Nothing else yet.

## Test drivers

None of its own: the kit's (`addScore`, `solveNow`, `turnsMove`…) are in
[kit/test-hook.md](kit/test-hook.md).

## Known issues

None.
