/**
 * PixiJS 8 starter: loading art with paths that work under `/<slug>/`, and procedural textures.
 * (STARTER: keep what you use.)
 *
 * The catalog serves the game under `/<slug>/`, so every URL is relative to
 * `import.meta.env.BASE_URL` (HANDOFF.md § Path-handling). Games with no art
 * files draw textures once with `generateTexture` (bubblepop textures.ts).
 */
import { Assets, Graphics, type Renderer, type Texture } from 'pixi.js';

/** Your art, by name → file under public/ (e.g. `{ hero: 'art/hero.png' }`). TODO(game): your assets. */
export const MANIFEST: Record<string, string> = {};

/** Load every asset in MANIFEST, reporting progress 0..1. */
export async function loadAssets(onProgress: (p: number) => void = () => undefined): Promise<void> {
  await Assets.init({ basePath: import.meta.env.BASE_URL });
  const names = Object.keys(MANIFEST);
  if (names.length === 0) return onProgress(1);
  for (const [alias, src] of Object.entries(MANIFEST)) Assets.add({ alias, src });
  await Assets.load(names, onProgress);
}

/** Draw a texture once (a soft glow, a tile) instead of shipping a file. */
export function glowTexture(renderer: Renderer, radius: number, color: number): Texture {
  const g = new Graphics();
  for (let i = 8; i >= 1; i--) g.circle(radius, radius, (radius * i) / 8).fill({ color, alpha: 0.08 });
  const texture = renderer.generateTexture(g);
  g.destroy();
  return texture;
}

/** Shake a container for `ms` (screen juice; nothing with reduced motion). */
export function shake(target: { position: { x: number; y: number } }, ms: number, power = 8, reduced = false): void {
  if (reduced) return;
  const base = { x: target.position.x, y: target.position.y };
  const start = performance.now();
  const tick = (): void => {
    const t = performance.now() - start;
    if (t >= ms) {
      target.position.x = base.x;
      target.position.y = base.y;
      return;
    }
    const k = power * (1 - t / ms);
    target.position.x = base.x + Math.sin(t * 0.09) * k;
    target.position.y = base.y + Math.cos(t * 0.11) * k;
    requestAnimationFrame(tick);
  };
  tick();
}
