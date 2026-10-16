/**
 * Players' faces: which game events make them react. (GAME: yours to edit; `new-game --no-avatar` deletes it.)
 *
 * The hub draws every face (hub.md "Avatars"); the kit puts one beside every
 * name it shows (lobby seats, results). Show players' avatars wherever you
 * show their names; never draw your own faces for real players. A hero that
 * isn't the player (a dinosaur, a ship) is not an avatar. Faces in the canvas:
 * render/avatar-pixi.ts (or avatar-three.ts), the hub's typed adapters.
 */
import type { AvatarHooks } from '../kit/avatar/index.ts';

/** TODO(game): your events and the feeling each one shows. */
export const avatar: AvatarHooks = {
  feelOn: { score: 'bigPlay', win: 'win', lose: 'lose', waiting: 'waiting' },
};
