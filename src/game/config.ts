/**
 * The game's constants: save versions, boards, race params. (GAME: yours to edit.)
 *
 * Keep this file free of browser-only imports: `npm run kit:check` loads it
 * under Node to check that every board here is declared in package.json.
 */

/** Bump when the profile's shape changes (then add `migrate` in state.ts). */
export const PROFILE_VERSION = 1;

/** Bump when the saved game's shape changes: older saved games then read as none. */
export const RUN_VERSION = 1;

/** Tuning. TODO(game): your game's numbers (speeds, time limits, sizes). */
export const TUNING = {} as const;

/**
 * Leaderboards, the same keys as `game.leaderboards` in package.json.
 * TODO(game): your boards (kit:check fails when code uses an undeclared one).
 */
export const BOARDS = {
  high: { title: 'High score' },
} as const;

/*
 * package.json's `game` block (JSON takes no comments, so its notes live here; `npm run todo` lists them):
 *
 * TODO(game): `game.labels`, only from the hub's fixed list (hub.md "Labels and the home page"):
 *   genre `cards` `board` `puzzle` `arcade` `platformer` `real-time-strategy` `physics` `typing` `word` `sports` `racing`;
 *   look `2d` `3d`; plays on `phone` `controller` `desktop`; players `single-player` `multiplayer`.
 *   They filter the catalog, and the genre labels decide which rooms of the hub's world play the game (every
 *   room one fits; the arcade takes games with nowhere else). Its main family is the first genre label in the
 *   list's order above (cards, then board, then puzzle…): the room its door goes in (docs/kit/world.md#rooms-and-labels).
 * TODO(game): `game.embed.size`, the [width, height] in CSS px the game likes in the world's box over
 *   Adventure Mode (960×640 is a placeholder); `supported: false` if it can't play in a box (docs/kit/world.md#playing-over-the-world).
 * Optional: `game.world` gives the game its own room, with a door in its family's room (docs/kit/world.md#what-the-game-does);
 *   `game.embed.frame` draws a custom SVG frame round the box ("dg-frame", docs/kit/world.md#a-frame-of-your-own).
 */
