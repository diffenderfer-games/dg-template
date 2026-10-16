/**
 * PixiJS 8 starter: a placeholder scene. (STARTER: replace it with your game's look.)
 *
 * A disc in the middle of the play region that pops when the player scores,
 * with a ring of dots that fills toward the target. Laid out in screen pixels
 * from the region (`stage.layout()`), so it fits phones and desktops alike.
 * Shapes are built once and moved each frame. Never `Graphics.arc()`: it
 * draws a stray line from the origin in this Pixi; use `circle()`, `rect()`,
 * `poly()` or point polylines.
 */
import { Container, Graphics } from 'pixi.js';
import type { Region } from '../../kit/layout/index.ts';
import type { OnlineView, Run } from '../../game/state.ts';

/** The scene's display objects. */
export type StarterScene = {
  draw(run: Run | null, region: Region, t: number): void;
  drawOnline(view: OnlineView | null, me: number, region: Region, t: number): void;
  pop(): void;
};

const DOTS = 24;

/** Build the scene into `world` (screen pixels) and `fx`. */
export function createStarterScene(world: Container, fx: Container): StarterScene {
  const disc = new Graphics()
    .circle(0, 0, 100)
    .fill({ color: 0xff5f3b })
    .circle(-28, -32, 26)
    .fill({ color: 0xffb199 });
  const ring = new Container();
  const dots = Array.from({ length: DOTS }, () => {
    const d = new Graphics().circle(0, 0, 8).fill({ color: 0xffffff });
    ring.addChild(d);
    return d;
  });
  world.addChildAt(ring, 0);
  world.addChildAt(disc, 1);
  world.setChildIndex(fx, world.children.length - 1);
  const bars: Graphics[] = [];
  const bar = (i: number): Graphics => {
    let g = bars[i];
    if (!g) {
      g = new Graphics().roundRect(-30, -1, 60, 1, 6).fill({ color: 0xffffff });
      world.addChild(g);
      bars[i] = g;
    }
    return g;
  };
  let popT = 0;
  return {
    draw(run, r, t) {
      const cx = r.width / 2;
      const cy = r.height / 2;
      const size = Math.min(r.width, r.height) / 500;
      popT = Math.max(0, popT - 1 / 60);
      const bounce = 1 + Math.sin(popT * 20) * popT * 0.8;
      disc.visible = true;
      ring.visible = true;
      // On menus (no game) the scene idles faintly behind the kit's buttons.
      disc.alpha = run === null ? 0.3 : 1;
      ring.alpha = disc.alpha;
      disc.position.set(cx, cy);
      disc.scale.set(size * (run === null ? 1 + Math.sin(t * 2) * 0.04 : bounce));
      const filled = run === null ? 0 : run.target > 0 ? (run.score / run.target) * DOTS : run.score % (DOTS + 1);
      dots.forEach((d, i) => {
        const a = (i / DOTS) * Math.PI * 2 - Math.PI / 2;
        d.position.set(cx + Math.cos(a) * 160 * size, cy + Math.sin(a) * 160 * size);
        d.scale.set(size);
        d.tint = i < filled ? 0x38d6ff : 0x2a3142;
      });
      bars.forEach((g) => (g.visible = false));
    },
    drawOnline(view, me, r) {
      disc.visible = false;
      ring.visible = false;
      if (!view) return;
      const n = view.players.length;
      view.players.forEach((p, i) => {
        const g = bar(i);
        g.visible = true;
        g.position.set((r.width * (i + 1)) / (n + 1), r.height * 0.85);
        g.scale.set(1, Math.max(1, (p.score / Math.max(1, view.target)) * r.height * 0.7));
        g.tint = p.id === me ? 0xff5f3b : 0xffd166;
      });
      bars.slice(n).forEach((g) => (g.visible = false));
    },
    pop() {
      popT = 0.3;
    },
  };
}
