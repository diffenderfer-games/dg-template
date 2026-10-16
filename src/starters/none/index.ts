/**
 * DOM starter (no renderer): the game drawn with plain elements, for word, typing and menu games.
 * (STARTER: `npm run new-game -- --renderer none` copies this folder to src/game/render/.)
 * Docs: docs/getting-started.md § "Renderers"
 *
 * A placeholder: the score in a disc that pops when the player scores, laid
 * out in the play region (`region()`, screen pixels). Replace it with your game.
 */
import type { View } from '../../game/view.ts';
import type { Region } from '../../kit/layout/index.ts';
import { h } from '../../kit/ui/dom.ts';

/** The renderer name. */
export const RENDERER = 'none';

/** Create the View. */
export function createView(o: { region: () => Region; slug: string }): View {
  const board = h('div.dom-board', {
    style: { position: 'absolute', display: 'grid', 'place-items': 'center', gap: '16px' },
  });
  const disc = h('div.dom-disc', {
    style: {
      width: 'min(40vw, 40vh)',
      height: 'min(40vw, 40vh)',
      'border-radius': '50%',
      background: '#ff5f3b',
      display: 'grid',
      'place-items': 'center',
      font: '700 min(12vw, 12vh) system-ui, sans-serif',
      color: '#fff',
      transition: 'transform 120ms ease-out',
    },
  });
  const players = h('div.dom-players', { style: { display: 'flex', gap: '12px', font: '600 20px system-ui' } });
  board.append(disc, players);
  let last = '';
  const place = (r: Region): void => {
    const key = `${r.x},${r.y},${r.width},${r.height}`;
    if (key === last) return;
    last = key;
    Object.assign(board.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
  };
  const text = (el: HTMLElement, s: string): void => {
    if (el.textContent !== s) el.textContent = s;
  };
  return {
    mount(stage) {
      stage.appendChild(board);
      return Promise.resolve();
    },
    draw(run) {
      place(o.region());
      disc.hidden = false;
      players.hidden = true;
      text(disc, run === null ? '' : String(run.score));
    },
    drawOnline(view, me) {
      place(o.region());
      disc.hidden = true;
      players.hidden = false;
      text(players, view ? view.players.map((p) => `${p.id === me ? 'You' : 'Player'}: ${p.score}`).join(' · ') : '');
    },
    scored() {
      disc.style.transform = 'scale(1.15)';
      setTimeout(() => (disc.style.transform = ''), 120);
    },
  };
}
