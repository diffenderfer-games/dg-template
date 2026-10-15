/**
 * PixiJS starter: players' faces on the canvas (avatars.md §3.8, `@diffenderfer-games/hub/avatar/pixi`).
 * (STARTER. Waits on avatars phase 4: until the pinned hub client has the Pixi
 * adapter, draw faces in the DOM with kit/avatar `face()` / `seatBadge()`.)
 *
 * The hub's adapter takes the Pixi namespace as an argument (the hub has no
 * Pixi dependency) and draws with paths, never `arc()`. Once it ships:
 *
 *   import * as PIXI from 'pixi.js';
 *   import { pixiAvatar } from '@diffenderfer-games/hub/avatar/pixi';
 *   const face = pixiAvatar(PIXI, hub.avatar.from(seat), { size: 64 });
 *   layer.addChild(face.view);  // each frame: face.update(nowMs)
 */
import type { Container } from 'pixi.js';

/** What the hub's Pixi adapter returns (avatars.md §6). */
export type PixiAvatar = { view: Container; update(nowMs: number): void; setLook(look: string): void; destroy(): void };

/** The adapter's entry, as the hub will publish it. */
export type PixiAvatarAdapter = (pixi: object, look: string, o?: { size?: number }) => PixiAvatar;

/** Place faces for seats with the adapter, once the hub ships it (null before). */
export function seatFaces(
  adapter: PixiAvatarAdapter | null,
  pixi: object,
  looks: readonly string[],
  size = 64,
): PixiAvatar[] {
  return adapter === null ? [] : looks.map((look) => adapter(pixi, look, { size }));
}
