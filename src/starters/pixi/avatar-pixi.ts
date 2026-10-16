/**
 * PixiJS starter: players' faces on the canvas, with the hub's typed Pixi adapter (hub.md "PixiJS").
 * (STARTER: `new-game --renderer pixi` copies this folder to src/game/render/.)
 *
 * The adapter takes pixi's own classes (the hub has no pixi dependency) and
 * gives back pixi's own `Sprite`, so faces go into a `Container` with no
 * cast. It draws with paths, never `arc()`. For DOM UI (lobby seats, results)
 * use kit/avatar `face()` / `seatBadge()` instead.
 *
 *   const faces = await seatFaces(ctx.hub, room.info.seats);   // RoomSeat carries `look`
 *   for (const f of faces) layer.addChild(f.view);
 *   app.ticker.add(() => faces.forEach((f) => f.update(performance.now())));
 *   hub.avatar.on('change', ({ userId, ref }) => facesByUser.get(userId)?.setLook(ref.code));
 */
import { pixiAvatar, type PixiAvatar } from '@diffenderfer-games/hub/avatar/pixi';
import { animator } from '@diffenderfer-games/hub/avatar';
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { avatarRenderer } from '../../kit/avatar/index.ts';
import type { HubLike } from '../../kit/core/index.ts';

/** The named imports the adapter needs (or pass `import * as PIXI from 'pixi.js'`). */
const PIXI_FOR_AVATARS = { Container, Rectangle, Sprite, Texture };

/** A seat as rooms, races and online games carry it. */
export type FaceSeat = { userId: number | null; look: string };

/** A live face per seat (blinking and idling), once the hub's renderer has its art. */
export async function seatFaces(
  hub: Pick<HubLike, 'avatar'>,
  seats: readonly FaceSeat[],
  size = 64,
): Promise<PixiAvatar<Sprite>[]> {
  await avatarRenderer(hub);
  return seats.map((s) =>
    pixiAvatar(PIXI_FOR_AVATARS, s.look, { size, animator: animator(s.look, { seed: s.userId ?? s.look }) }),
  );
}
