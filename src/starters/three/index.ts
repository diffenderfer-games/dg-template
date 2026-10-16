/**
 * three.js starter: the game's View. (STARTER: `new-game --renderer three` copies this folder to src/game/render/.)
 * Docs: docs/getting-started.md § "Renderers"
 */
import type { View } from '../../game/view.ts';
import type { Region } from '../../kit/layout/index.ts';
import { warmup } from './loader.ts';
import { createStarterScene, type StarterScene } from './scene.ts';
import { createThreeStage, type ThreeStage } from './stage.ts';

/** The renderer name. */
export const RENDERER = 'three';

/** Create the View. The 3D camera frames the scene itself, so `region` is unused here. */
export function createView(o: { region: () => Region; slug: string }): View {
  let stage: ThreeStage | null = null;
  let scene: StarterScene | null = null;
  let t = 0;
  return {
    async mount(host) {
      stage = createThreeStage(host, o.slug);
      scene = createStarterScene(stage);
      await warmup(stage.renderer, stage.scene, stage.camera);
    },
    draw(run) {
      t += 1 / 60;
      scene?.draw(run, t);
    },
    drawOnline(view, me) {
      t += 1 / 60;
      scene?.drawOnline(view, me, t);
    },
    scored() {
      scene?.pop();
    },
  };
}
