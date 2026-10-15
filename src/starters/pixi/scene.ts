/**
 * PixiJS 8 starter: the example scene, "collect the coins". (STARTER: replace it with your game's look.)
 *
 * Shapes are built once and moved each frame. Never `Graphics.arc()`: it
 * draws a stray line from the origin in this Pixi; use `circle()`, `rect()`,
 * `poly()` or point polylines.
 */
import { Graphics, type Container } from 'pixi.js';
import { ARENA, TUNING } from '../../game/config.ts';
import type { OnlineView, Run } from '../../game/state.ts';

/** The scene's display objects. */
export type CoinScene = {
  draw(run: Run | null, t: number): void;
  drawOnline(view: OnlineView | null, me: number, t: number): void;
  burst(at: { x: number; y: number }): void;
};

/** Build the scene into `world` (arena units) and `fx`. */
export function createCoinScene(world: Container, fx: Container): CoinScene {
  const floor = new Graphics()
    .roundRect(0, 0, ARENA.width, ARENA.height, 28)
    .fill({ color: 0x161b26 })
    .stroke({ color: 0x2a3142, width: 6 });
  const grid = new Graphics();
  for (let x = 100; x < ARENA.width; x += 100) grid.moveTo(x, 0).lineTo(x, ARENA.height);
  for (let y = 100; y < ARENA.height; y += 100) grid.moveTo(0, y).lineTo(ARENA.width, y);
  grid.stroke({ color: 0x1f2533, width: 2 });
  const coin = new Graphics()
    .circle(0, 0, TUNING.coinRadius)
    .fill({ color: 0x38d6ff })
    .circle(-6, -7, 7)
    .fill({ color: 0xc8f4ff });
  const half = TUNING.playerHalf;
  const player = new Graphics().roundRect(-half, -half, half * 2, half * 2, 8).fill({ color: 0xff5f3b });
  world.addChildAt(floor, 0);
  world.addChildAt(grid, 1);
  world.addChild(coin, player);
  world.setChildIndex(fx, world.children.length - 1);
  const sparks: { g: Graphics; life: number }[] = [];
  const others: Graphics[] = [];
  const other = (i: number): Graphics => {
    let g = others[i];
    if (!g) {
      g = new Graphics().roundRect(-half, -half, half * 2, half * 2, 8).fill({ color: 0xffd166 });
      world.addChildAt(g, world.getChildIndex(player));
      others[i] = g;
    }
    return g;
  };
  return {
    draw(run, t) {
      const r = run ?? {
        player: { x: ARENA.width / 2 + Math.cos(t) * 200, y: ARENA.height / 2 },
        coin: { x: ARENA.width / 2, y: ARENA.height / 2 - 160 },
      };
      player.position.set(r.player.x, r.player.y);
      coin.position.set(r.coin.x, r.coin.y);
      coin.scale.set(1 + Math.sin(t * 6) * 0.08);
      for (const s of sparks) {
        s.life -= 1 / 60;
        s.g.alpha = Math.max(0, s.life * 2);
        s.g.scale.set(1 + (0.5 - s.life) * 4);
      }
      while (sparks.length > 0 && (sparks[0]?.life ?? 0) <= 0) sparks.shift()?.g.destroy();
    },
    drawOnline(view, me, t) {
      if (!view) return;
      let i = 0;
      for (const p of view.players) {
        if (p.id === me) player.position.set(p.x, p.y);
        else other(i++).position.set(p.x, p.y);
      }
      others.forEach((g, j) => (g.visible = j < i));
      coin.position.set(view.coin.x, view.coin.y);
      coin.scale.set(1 + Math.sin(t * 6) * 0.08);
    },
    burst(at) {
      const g = new Graphics().circle(0, 0, 26).stroke({ color: 0xc8f4ff, width: 5 });
      g.position.set(at.x, at.y);
      fx.addChild(g);
      sparks.push({ g, life: 0.5 });
    },
  };
}
