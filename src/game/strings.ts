/**
 * The game's words. (GAME: yours to edit.)
 *
 * Kid-friendly, no violent words, and never "run", "turn game" or "instance"
 * (the lint rule checks this file). Kit words (Play, Continue, Paused…) are in
 * kit/core/strings.ts; override any of them with `KIT_OVERRIDES`.
 */
import type { KitStrings } from '../kit/core/strings.ts';

/** TODO(game): your title, tagline and how-to-play lines (`new-game --title` sets the title). */
export const COPY = {
  title: 'My Game',
  tagline: 'Score as many points as you can!',
  howTo: [
    'Press Space, the gamepad’s A button or the on-screen button to score a point.',
    'Daily challenge: reach the target before time is up. Everyone gets the same target today.',
    'Race: the first to reach the target wins.',
  ],
} as const;

/** Kit words this game says differently (optional). */
export const KIT_OVERRIDES: Partial<KitStrings> = {};

/** The HUD's words. */
export const HUD = {
  score: (n: number, target: number) => (target > 0 ? `Score ${n} / ${target}` : `Score ${n}`),
  time: (s: number) => `Time ${s}`,
  best: (n: number) => `Best ${n}`,
};
