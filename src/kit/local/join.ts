/**
 * kit/local: the join sheet: each player presses A (or Enter) to take a seat, then Start begins.
 * Source: dg-template src/kit/local/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/local.md § "Joining"
 *
 * - An unclaimed pad's A or Start takes the next seat (the hub claims it); Enter or Space, the keyboard's.
 * - A seated pad's B gives its seat up; Backspace, the keyboard's.
 * - A seated pad's Start, the keyboard player's Enter, or the Start button begins, once `min` are in.
 * - Esc, the Back button, or B on a pad while nobody is seated cancels.
 *
 * The sheet has no pad-navigable buttons, so a new player's A only ever joins. The game themes it:
 * `.kit-join`, `.kit-join-slot[data-state="open"|"joined"]` with `--seat-color`, `.kit-join-start`.
 */
import type { HubLike } from '../core/hub-like.ts';
import { t } from '../core/strings.ts';
import { face } from '../avatar/index.ts';
import { keyGlyph, padGlyph } from '../input/glyphs.ts';
import { PAD_BUTTON } from '@diffenderfer-games/hub/input';
import { h } from '../ui/dom.ts';
import { openModal } from '../ui/modal.ts';
import { LOCAL_COLORS, seatLimits, type LocalController, type LocalPlayer } from './play.ts';

/** What the sheet needs. */
export type JoinDeps = {
  hub: Pick<HubLike, 'input' | 'avatar' | 'userId'>;
  local: LocalController;
  /** A sheet title other than "Who's playing?". */
  title?: string;
};

/** One slot: an empty one asks for a press; a taken one shows the player and their device. */
function slotEl(deps: JoinDeps, index: number, player: LocalPlayer | undefined, color: string): HTMLElement {
  const state = player === undefined ? 'open' : 'joined';
  const badge =
    player?.me === true
      ? face(deps.hub, { userId: deps.hub.userId() ?? undefined, name: player.name }, 56)
      : h('span.kit-join-disc', { 'aria-hidden': 'true' }, String(index + 1));
  const device =
    player === undefined
      ? h('span.kit-join-device', {}, padGlyph(PAD_BUTTON.A, false), t('localJoinPress'))
      : h(
          'span.kit-join-device',
          {},
          player.device === 'pad' ? padGlyph(PAD_BUTTON.B, player.padStyle === 'ps') : keyGlyph('Backspace'),
          t(player.device === 'pad' ? 'localController' : 'localKeyboard'),
        );
  return h(
    'div.kit-join-slot',
    { 'data-state': state, 'data-seat': index, 'data-testid': `join-slot-${index}`, style: { '--seat-color': color } },
    badge,
    h('span.kit-join-name', {}, player?.name ?? t('localPlayer', { n: index + 1 })),
    device,
  );
}

/** Whether any pad pressed `button` since last frame (pads not seated included). */
function padRose(held: Map<number, boolean>, button: number): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return false;
  let rose = false;
  for (const pad of navigator.getGamepads()) {
    if (pad === null) continue;
    const isDown = pad.buttons[button]?.pressed === true;
    if (isDown && held.get(pad.index) !== true) rose = true;
    held.set(pad.index, isDown);
  }
  return rose;
}

/**
 * Open the join sheet. Resolves true when the players start (the controller's seats are taken, call
 * `local.start()`), false when cancelled (the seats are released).
 */
export function openJoin(deps: JoinDeps): Promise<boolean> {
  const { local } = deps;
  const seats = local.open();
  if (seats === null) return Promise.resolve(false);
  const { min, max } = seatLimits(local.spec);
  const palette = local.spec.colors ?? LOCAL_COLORS;
  return new Promise((resolve) => {
    let done = false;
    let frame = 0;
    const slots = h('div.kit-join-slots', { 'data-count': max });
    const start = h(
      'button.kit-btn.kit-primary.kit-join-start',
      { type: 'button', 'data-testid': 'join-start', disabled: true, onclick: () => finish(true) },
      h('span.kit-btn-label', {}, t('localStart')),
    );
    const back = h(
      'button.kit-btn.kit-join-back',
      { type: 'button', 'data-testid': 'join-back', onclick: () => finish(false) },
      h('span.kit-btn-label', {}, t('back')),
    );
    const hint = h('p.kit-join-hint', {}, t('localJoinHint', { n: min }));
    const body = h('div.kit-join', { 'data-testid': 'join' }, hint, slots, h('div.kit-join-buttons', {}, back, start));
    const draw = (): void => {
      const players = local.current();
      slots.replaceChildren(
        ...Array.from({ length: max }, (_, i) =>
          slotEl(deps, i, players[i], players[i]?.color ?? palette[i % palette.length] ?? 'currentColor'),
        ),
      );
      start.disabled = players.length < min;
      body.dataset['ready'] = String(players.length >= min);
    };
    const modal = openModal({ title: deps.title ?? t('localWho'), body, locked: true, testid: 'join-sheet' });
    const offChange = seats.on('change', draw);
    const bHeld = new Map<number, boolean>();
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      const keyboardSeat = seats.list.find((seat) => seat.device.kind === 'keyboard');
      if (e.key === 'Escape') {
        e.preventDefault(); // the sheet's: the world's box must not take it as "leave"
        finish(false);
      } else if (e.key === 'Backspace' && keyboardSeat !== undefined) {
        e.preventDefault();
        seats.remove(keyboardSeat.index);
      } else if (e.key === 'Enter' && keyboardSeat !== undefined && seats.count >= min) {
        e.preventDefault();
        finish(true);
      }
    };
    const tick = (): void => {
      if (done) return;
      const anyB = padRose(bHeld, PAD_BUTTON.B);
      for (let i = seats.count - 1; i >= 0; i -= 1) {
        const seat = seats.seat(i);
        if (seat.padDown(PAD_BUTTON.B)) {
          seats.remove(i);
          continue;
        }
        if (seat.padDown(PAD_BUTTON.START) && seats.count >= min) {
          finish(true);
          return;
        }
      }
      if (anyB && seats.count === 0) {
        finish(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const finish = (go: boolean): void => {
      if (done || (go && seats.count < min)) return;
      done = true;
      cancelAnimationFrame(frame);
      offChange();
      window.removeEventListener('keydown', onKey, true);
      modal.close();
      if (!go) local.close();
      resolve(go);
    };
    window.addEventListener('keydown', onKey, true);
    draw();
    // A press held as the sheet opens (the A that chose local play) doesn't join.
    seats.joining(true);
    frame = requestAnimationFrame(tick);
  });
}
