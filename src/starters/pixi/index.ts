/**
 * PixiJS 8 starter: the game's View. (STARTER: `new-game --renderer pixi` copies this folder to src/game/render/.)
 * Docs: docs/getting-started.md § "Renderers"
 */
import { ARENA } from '../../game/config.ts';
import type { View } from '../../game/view.ts';
import type { Region } from '../../kit/layout/index.ts';
import { createCoinScene, type CoinScene } from './scene.ts';
import { createPixiStage, type PixiStage } from './stage.ts';

/** The renderer name (`__game.snap()` and the screenshot manifest show it). */
export const RENDERER = 'pixi';

/** Create the View; `region` is where gameplay may draw (kit ctx.region). */
export function createView(o: { region: () => Region; slug: string }): View {
  let stage: PixiStage | null = null;
  let scene: CoinScene | null = null;
  let t = 0;
  return {
    async mount(host) {
      stage = await createPixiStage(host, o.region);
      scene = createCoinScene(stage.world, stage.fx);
    },
    draw(run) {
      if (!stage || !scene) return;
      t += 1 / 60;
      stage.fit(ARENA);
      scene.draw(run, t);
      stage.render();
    },
    drawOnline(view, me) {
      if (!stage || !scene) return;
      t += 1 / 60;
      stage.fit(ARENA);
      scene.drawOnline(view, me, t);
      stage.render();
    },
    collected(at) {
      scene?.burst(at);
    },
  };
}
