/**
 * kit/turns: the hub's size rule for turn-game state.
 * Source: dg-template src/kit/turns/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/turns.md
 */

/** saved-games.md §4.2: state is JSON, at most 64 KB. */
export const MAX_TURN_STATE_BYTES = 64 * 1024;

/** A problem with a state of `bytes`, or null. */
export function checkStateSize(bytes: number): string | null {
  return bytes > MAX_TURN_STATE_BYTES ? `state is ${bytes} bytes (at most ${MAX_TURN_STATE_BYTES})` : null;
}
