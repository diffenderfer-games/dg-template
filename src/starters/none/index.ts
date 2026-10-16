/**
 * DOM starter (no renderer): the game drawn with plain elements, for word, typing and menu games.
 * (STARTER: `npm run new-game -- --renderer none` copies this folder to src/game/render/.)
 * Docs: docs/getting-started.md § "Renderers"
 *
 * TODO(game): your board, built with `h()` inside the play region (`region()`, screen
 * pixels). The placeholder shows the score so you can see it run.
 */
import type { View } from '../../game/view.ts';
import type { Region } from '../../kit/layout/index.ts';
import { h } from '../../kit/ui/dom.ts';

/** The renderer name. */
export const RENDERER = 'none';

/** Create the View. */
export function createView(o: { region: () => Region; slug: string }): View {
  const board = h('div.dom-board', {
    style: {
      position: 'absolute',
      display: 'grid',
      'place-items': 'center',
      font: '700 48px system-ui',
      color: '#fff',
    },
  });
  let last = '';
  const show = (text: string): void => {
    const r = o.region();
    const key = `${r.x},${r.y},${r.width},${r.height}`;
    if (key !== last) {
      last = key;
      Object.assign(board.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
    }
    if (board.textContent !== text) board.textContent = text;
  };
  return {
    mount(stage) {
      stage.appendChild(board);
      return Promise.resolve();
    },
    draw: (run) => show(run === null ? '' : String(run.score)),
    drawOnline: (view) => show(view?.players.map((p) => p.score).join(' · ') ?? ''),
  };
}
