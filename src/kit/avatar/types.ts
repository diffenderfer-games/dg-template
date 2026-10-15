/**
 * kit/avatar: the hooks a game gives for players' faces.
 * Source: dg-template src/kit/avatar/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/avatar.md
 */

/** avatars.md §3.7: the semantic feelings a face can show. */
export type Feel = 'win' | 'lose' | 'bigPlay' | 'victim' | 'waiting' | 'yourTurn' | 'idle';

/** The game's avatar hooks (src/game/avatar.ts). */
export type AvatarHooks = {
  /** Which game events make faces react. */
  feelOn?: Record<string, Feel>;
  /** Show the player's bust on the title screen (on by default). */
  titleDemo?: boolean;
};
