/**
 * three.js starter: players' faces as sprites, with the hub's typed three.js adapter (hub.md "three.js").
 * (STARTER: `new-game --renderer three` copies this folder to src/game/render/.)
 *
 * The adapter takes three's own classes (the hub has no three dependency)
 * and gives back three's own `Sprite`, ready for `scene.add`. For DOM UI
 * (lobby seats, results) use kit/avatar `face()` / `seatBadge()` instead.
 *
 *   const faces = await seatSprites(ctx.hub, room.info.seats);
 *   faces.forEach((f, i) => { f.sprite.position.set(i - 1, 1.6, 0); scene.add(f.sprite); });
 *   each frame: faces.forEach((f) => f.avatar.update(performance.now()));
 */
import { avatarSprite, type ThreeAvatarTexture } from '@diffenderfer-games/hub/avatar/three';
import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';
import { avatarRenderer } from '../../kit/avatar/index.ts';
import type { HubLike } from '../../kit/core/index.ts';

/** The named imports the adapter needs (or pass `import * as THREE from 'three'`). */
const THREE_FOR_AVATARS = { CanvasTexture, SpriteMaterial, Sprite, SRGBColorSpace };

/** A seat as rooms, races and online games carry it. */
export type FaceSeat = { look: string };

/** A face sprite and its texture (three's own classes). */
export type SeatSprite = { readonly sprite: Sprite; readonly avatar: ThreeAvatarTexture<CanvasTexture<unknown>> };

/** A billboard face per seat, `height` world units tall. Redraw with `avatar.update(t)` (at most 30 fps). */
export async function seatSprites(
  hub: Pick<HubLike, 'avatar'>,
  seats: readonly FaceSeat[],
  o: { size?: number; height?: number } = {},
): Promise<SeatSprite[]> {
  await avatarRenderer(hub);
  return seats.map((s) =>
    avatarSprite(THREE_FOR_AVATARS, s.look, { frame: 'head', size: o.size ?? 128, height: o.height ?? 0.4 }),
  );
}
