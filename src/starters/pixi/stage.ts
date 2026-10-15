/**
 * PixiJS 8 starter: the application, its layers and fitting the arena to the screen.
 * (STARTER: `npm run new-game -- --renderer pixi` copies this folder into src/game/render/.)
 *
 * - The Application is created inside the async boot, never with a top-level
 *   `await` (that deadlocks Pixi 8's renderer chunks in the bundled build).
 * - The kit's loop drives frames: the Pixi ticker is stopped and `render()`
 *   draws once per kit frame, so there is one loop.
 * - Layers: `world` (arena units, letterboxed into the play region), `fx`
 *   (in the world, above it) and `hud` (screen pixels).
 */
import { Application, Container } from 'pixi.js';
import { letterbox, type Region } from '../../kit/layout/index.ts';

/** The Pixi stage. */
export type PixiStage = {
  readonly app: Application;
  /** Arena units: put the game here. */
  readonly world: Container;
  /** Effects in arena units, above the world. */
  readonly fx: Container;
  /** Screen pixels. */
  readonly hud: Container;
  /** Fit the arena into the play region (call every frame; cheap when nothing changed). */
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
  return {
    app,
    world,
    fx,
    hud,
    fit(arena) {
      if (
        app.renderer.width / app.renderer.resolution !== innerWidth ||
        app.renderer.height / app.renderer.resolution !== innerHeight
      ) {
        app.renderer.resize(innerWidth, innerHeight); // rotation: resizeTo lags behind (tetrablox)
      }
      const r = region();
      const key = `${r.x},${r.y},${r.width},${r.height}`;
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
