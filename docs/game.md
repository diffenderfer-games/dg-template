# Coin Dash: the game's notes

GAME doc: yours to edit. Keep this game's own notes here (not in CLAUDE.md),
so the brief stays short and the notes stay in one place.

## Design

Move the square onto the coin; a new coin appears elsewhere. TODO(game): what
your game is, in a few lines, and what makes it fun.

## Controls

WASD / arrows, a gamepad stick, or the on-screen stick on touch. Escape, P or
the gamepad's Start pauses.

## Modes

- **Normal:** as many coins as you can in 60 seconds.
- **Daily:** 5–10 coins in time; everyone gets the same coins today.
- **Race:** the first to collect them all (5, 10 or 20) wins.
- **Online (Coin Party):** 2–4 players in a hub room; the host runs the rules.
  A player who drops is moved by the computer until they come back.
- **Play over days (take the last coin):** an online game the hub runs from
  `src/game/turns/rules.ts`; 2–4 players take 1–3 coins in turn, and whoever
  takes the last one wins. With the computer, a friend (a link) or anyone.

## Room

`game.world` generates a lounge with 4 tables and the game's name on it
(`npm run world:check`; the hub serves it as `game.<slug>`).

## Test drivers

`__game.extra.addCoins(n)`. The kit's drivers are in
[kit/test-hook.md](kit/test-hook.md).

## Known issues

None yet.
