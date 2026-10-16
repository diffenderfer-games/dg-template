/**
 * PixiJS 8 starter: the scene. (STARTER: build your game's look here.)
 *
 * TODO(game): your scene. Build display objects once (in `createScene`) and
 * move them in `draw`; `region` is the play area in screen pixels (from
 * `stage.layout()`). The placeholder shows the score so you can see it run.
 * Never `Graphics.arc()`: it draws a stray line from the origin in this Pixi;
 * use `circle()`, `rect()`, `poly()` or point polylines.
 */
import { Text, type Container } from 'pixi.js';
import type { Region } from '../../kit/layout/index.ts';
import type { OnlineView, Run } from '../../game/state.ts';

/** The scene's display objects. */
export type StarterScene = {
  draw(run: Run | null, region: Region): void;
  drawOnline(view: OnlineView | null, me: number, region: Region): void;
};

/** Build the scene into `world` (screen pixels). */
export function createScene(world: Container): StarterScene {
  const label = new Text({ text: '', style: { fill: 0xffffff, fontSize: 48, fontFamily: 'system-ui' } });
  label.anchor.set(0.5);
  world.addChild(label);
  const show = (text: string, r: Region): void => {
    if (label.text !== text) label.text = text;
    label.position.set(r.width / 2, r.height / 2);
  };
  return {
    draw: (run, r) => show(run === null ? '' : String(run.score), r),
    drawOnline: (view, _me, r) => show(view?.players.map((p) => p.score).join(' · ') ?? '', r),
  };
}
