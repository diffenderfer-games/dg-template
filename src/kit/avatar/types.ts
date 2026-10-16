/**
 * kit/avatar: the hooks a game gives for players' faces.
 * Source: dg-template src/kit/avatar/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/avatar.md
 */
import type { Feeling } from '@diffenderfer-games/hub/avatar';

/** The feelings a face can show (the animator's `feel()`, hub.md "Expressions and gaze"). */
export type Feel = Feeling;

/** The game's avatar hooks (src/game/avatar.ts). */
export type AvatarHooks = {
  /** Which game events make faces react. */
  feelOn?: Record<string, Feel>;
  /** Show the player's bust on the title screen (on by default). */
  titleDemo?: boolean;
};
