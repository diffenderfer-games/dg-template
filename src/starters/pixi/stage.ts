/**
 * PixiJS 8 starter: the application, its layers and the two layouts.
 * (STARTER: `npm run new-game -- --renderer pixi` copies this folder into src/game/render/.)
 *
 * - The Application is created inside the async boot, never with a top-level
 *   `await` (that deadlocks Pixi 8's renderer chunks in the bundled build).
 * - The kit's loop drives frames: the Pixi ticker is stopped and `render()`
 *   draws once per kit frame, so there is one loop. Pixi pointer events
 *   (`eventMode = 'static'`, `pointerdown`) still work with the ticker
 *   stopped: buttons or an on-screen keyboard drawn in the canvas just work.
 * - Layers: `world` (the game), `fx` (in the world, above it) and `hud` (screen pixels).
 * - Two layouts; call one every frame (cheap when nothing changed):
 *   - `layout()`: the world in screen pixels at the play region's corner. Lay
 *     things out from the region's size: phone word and card games (a
 *     keyboard that fills the width). The starter scene uses it.
 *   - `fit(arena)`: a fixed arena in game units, letterboxed into the play
 *     region: action games with a fixed field.
 */
import { Application, Container } from 'pixi.js';
import { letterbox, type Region } from '../../kit/layout/index.ts';

/** The Pixi stage. */
export type PixiStage = {
  readonly app: Application;
  /** The game: screen pixels after `layout()`, arena units after `fit()`. */
  readonly world: Container;
  /** Effects in the world, above it. */
  readonly fx: Container;
  /** Screen pixels. */
  readonly hud: Container;
  /** The world in screen pixels at the play region's corner (scale 1). Returns the region. */
  layout(): Region;
  /** Fit a fixed arena (game units) into the play region, letterboxed. */
  fit(arena: { width: number; height: number }): void;
  render(): void;
};

/** The page's background colour (the `--kit-bg` CSS variable). */
function background(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--kit-bg').trim() || '#0d0f14';
}

/** Create the stage inside `host`. */
export async function createPixiStage(host: HTMLElement, region: () => Region): Promise<PixiStage> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    autoDensity: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    antialias: true,
    background: background(),
  });
  app.ticker.stop();
  host.appendChild(app.canvas);
  const world = new Container();
  const fx = new Container();
  const hud = new Container();
  world.addChild(fx);
  app.stage.addChild(world, hud);
  let last = '';
  /** Follow the window (on rotation `resizeTo` lags behind: tetrablox). */
  const resize = (): void => {
    if (
      app.renderer.width / app.renderer.resolution !== innerWidth ||
      app.renderer.height / app.renderer.resolution !== innerHeight
    ) {
      app.renderer.resize(innerWidth, innerHeight);
    }
  };
  return {
    app,
    world,
    fx,
    hud,
    layout() {
      resize();
      const r = region();
      const key = `px:${r.x},${r.y},${r.width},${r.height}`;
      if (key !== last) {
        last = key;
        world.scale.set(1);
        world.position.set(r.x, r.y);
      }
      return r;
    },
    fit(arena) {
      resize();
      const r = region();
      const key = `${arena.width}x${arena.height}:${r.x},${r.y},${r.width},${r.height}`;
      if (key === last) return;
      last = key;
      const fit = letterbox(r.width, r.height, arena.width, arena.height);
      world.scale.set(fit.scale);
      world.position.set(r.x + fit.x, r.y + fit.y);
    },
    render() {
      app.renderer.render(app.stage);
    },
  };
}
