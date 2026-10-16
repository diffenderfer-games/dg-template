/**
 * PixiJS 8 starter: the game's View. (STARTER: `new-game --renderer pixi` copies this folder to src/game/render/.)
 * Docs: docs/getting-started.md § "Renderers"
 */
import type { View } from '../../game/view.ts';
import type { Region } from '../../kit/layout/index.ts';
import { createScene, type StarterScene } from './scene.ts';
import { createPixiStage, type PixiStage } from './stage.ts';

/** The renderer name (`__game.snap()` and the screenshot manifest show it). */
export const RENDERER = 'pixi';

/** Create the View; `region` is where gameplay may draw (kit ctx.region). */
export function createView(o: { region: () => Region; slug: string }): View {
  let stage: PixiStage | null = null;
  let scene: StarterScene | null = null;
  return {
    async mount(host) {
      stage = await createPixiStage(host, o.region);
      scene = createScene(stage.world);
    },
    draw(run) {
      if (!stage || !scene) return;
      // Screen pixels from the play region; a fixed arena instead: stage.fit({ width: 1600, height: 1000 }).
      scene.draw(run, stage.layout());
      stage.render();
    },
    drawOnline(view, me) {
      if (!stage || !scene) return;
      scene.drawOnline(view, me, stage.layout());
      stage.render();
    },
  };
}
