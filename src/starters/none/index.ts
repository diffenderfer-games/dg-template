/**
 * DOM starter (no renderer): the game drawn with plain elements, for word, typing and menu games.
 * (STARTER: `npm run new-game -- --renderer none` copies this folder to src/game/render/.)
 * Docs: docs/getting-started.md § "Renderers"
 */
import { ARENA, TUNING } from '../../game/config.ts';
import type { View } from '../../game/view.ts';
import { letterbox, type Region } from '../../kit/layout/index.ts';
import { h } from '../../kit/ui/dom.ts';

/** The renderer name. */
export const RENDERER = 'none';

/** Create the View. */
export function createView(o: { region: () => Region; slug: string }): View {
  const arena = h('div.dom-arena', {
    style: {
      position: 'absolute',
      background: '#161b26',
      'border-radius': '28px',
      border: '6px solid #2a3142',
      'transform-origin': '0 0',
    },
  });
  const half = TUNING.playerHalf;
  const player = h('div', {
    style: {
      position: 'absolute',
      width: `${half * 2}px`,
      height: `${half * 2}px`,
      background: '#ff5f3b',
      'border-radius': '8px',
    },
  });
  const r = TUNING.coinRadius;
  const coin = h('div', {
    style: {
      position: 'absolute',
      width: `${r * 2}px`,
      height: `${r * 2}px`,
      background: '#38d6ff',
      'border-radius': '50%',
    },
  });
  arena.append(coin, player);
  let t = 0;
  let last = '';
  return {
    mount(stage) {
      arena.style.width = `${ARENA.width}px`;
      arena.style.height = `${ARENA.height}px`;
      stage.appendChild(arena);
      return Promise.resolve();
    },
    draw(run) {
      t += 1 / 60;
      const reg = o.region();
      const key = `${reg.x},${reg.y},${reg.width},${reg.height}`;
      if (key !== last) {
        last = key;
        const fit = letterbox(reg.width, reg.height, ARENA.width, ARENA.height);
        arena.style.transform = `translate(${reg.x + fit.x}px, ${reg.y + fit.y}px) scale(${fit.scale})`;
      }
      const p = run?.player ?? { x: ARENA.width / 2 + Math.cos(t) * 200, y: ARENA.height / 2 };
      const c = run?.coin ?? { x: ARENA.width / 2, y: ARENA.height / 2 - 160 };
      player.style.transform = `translate(${p.x - half}px, ${p.y - half}px)`;
      coin.style.transform = `translate(${c.x - r}px, ${c.y - r}px)`;
    },
  };
}
