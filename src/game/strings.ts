/**
 * The game's words. (GAME: yours to edit.)
 *
 * Kid-friendly, no violent words, and never "run", "turn game" or "instance"
 * (the lint rule checks this file). Kit words (Play, Continue, Paused…) are in
 * kit/core/strings.ts; override any of them with `KIT_OVERRIDES`.
 */
import type { KitStrings } from '../kit/core/strings.ts';

/** TODO(game): your title, tagline and how-to-play lines. */
export const COPY = {
  title: 'Coin Dash',
  tagline: 'Grab the coins before time is up!',
  howTo: [
    'Move with the arrow keys, WASD, a gamepad stick, or the on-screen stick.',
    'Touch a coin to collect it. A new one appears somewhere else.',
    'Daily challenge: collect the target number of coins in time. Everyone gets the same coins today.',
    'Race: the first to collect them all wins.',
  ],
} as const;

/** Kit words this game says differently (optional). */
export const KIT_OVERRIDES: Partial<KitStrings> = {};

/** The HUD's words. */
export const HUD = {
  coins: (n: number, target: number) => (target > 0 ? `Coins ${n} / ${target}` : `Coins ${n}`),
  time: (s: number) => `Time ${s}`,
  best: (n: number) => `Best ${n}`,
};
