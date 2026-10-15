/**
 * three.js starter: players' faces as sprites (avatars.md §3.8, `@diffenderfer-games/hub/avatar/three`).
 * (STARTER. Waits on avatars phase 4: until then, show faces in the DOM with kit/avatar.)
 *
 * Once it ships:
 *
 *   import * as THREE from 'three';
 *   import { avatarSprite } from '@diffenderfer-games/hub/avatar/three';
 *   const sprite = avatarSprite(THREE, hub.avatar.from(seat), { size: 128 });
 *   sprite.position.set(x, 1.6, z); scene.add(sprite);
 */
import type { Sprite } from 'three';

/** The adapter's entry, as the hub will publish it (avatars.md §6). */
export type ThreeAvatarAdapter = (three: object, look: string, o?: { size?: number }) => Sprite;

/** Sprites for seats with the adapter, once the hub ships it (none before). */
export function seatSprites(
  adapter: ThreeAvatarAdapter | null,
  three: object,
  looks: readonly string[],
  size = 128,
): Sprite[] {
  return adapter === null ? [] : looks.map((look) => adapter(three, look, { size }));
}
