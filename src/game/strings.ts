/**
 * The game's words. (GAME: yours to edit.)
 *
 * Kid-friendly, no violent words, and never "run", "turn game" or "instance"
 * (the lint rule checks this file). Kit words (Play, Continue, Paused…) are in
 * kit/core/strings.ts; override any of them with `KIT_OVERRIDES`.
 */
import type { KitStrings } from '../kit/core/strings.ts';

/** TODO(game): your tagline and how-to-play lines (`new-game --title` sets the title). */
export const COPY = {
  title: 'My Game',
  tagline: 'TODO(game): one line that makes a kid want to play.',
  howTo: ['TODO(game): how to play, in a few short lines.'],
} as const;

/** Kit words this game says differently (optional). */
export const KIT_OVERRIDES: Partial<KitStrings> = {};

/** The HUD's words. TODO(game): yours. */
export const HUD = {
  score: (n: number) => `Score ${n}`,
  best: (n: number) => `Best ${n}`,
};
