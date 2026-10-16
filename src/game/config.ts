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

/** Tuning. TODO(game): your game's numbers. */
export const TUNING = {
  /** Seconds in a normal game. */
  normalSeconds: 30,
  /** Seconds to reach the daily's target. */
  dailySeconds: 20,
} as const;

/**
 * Leaderboards, the same keys as `game.leaderboards` in package.json.
 * TODO(game): your boards (kit:check fails when code uses an undeclared one).
 */
export const BOARDS = {
  high: { title: 'High score' },
} as const;

/** Race params: the defaults of `game.race.params` (keep both in step). TODO(game): your race options. */
export const RACE_DEFAULTS = { target: 20 } as const;
