/**
 * kit/turns: the screen of an online game the hub runs (lobby, play, the end), built from kit/ui.
 * Source: dg-template src/kit/turns/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/turns.md § "The screen"
 *
 * The status line ("Your turn", "Ann is playing", "Waiting for Ann…"), the
 * seats with their faces (a name opens the player card), the game's own
 * board (`turns.draw`), the buttons the moment allows (Start, Copy the link,
 * Remind them, Let the computer play for Ann, Rematch, Leave, Back), the
 * invite link to share while the game waits for players, and the
 * chat. `update` redraws the parts that changed, so a draft in the chat box
 * and the focused button survive live events. The root carries
 * `data-phase`, `data-kind` and `data-seq` for tests and screenshots.
 */
import type { TurnGameLike } from '../core/hub-like.ts';
import { t } from '../core/strings.ts';
import { button } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import { dueOthers, handOverNames, turnStatus, type TurnSeat } from './status.ts';

/** What the screen's buttons do. */
export type TurnScreenActions = {
  start: () => void;
  copyLink: () => void;
  nudge: () => void;
  handOver: () => void;
  rematch: () => void;
  leave: () => void;
  back: () => void;
  player: (userId: number) => void;
  /** Invite friends to the free seats (the lobby). */
  invite: () => void;
  /** The creator takes the player in a seat out. */
  remove: (seat: number, name: string) => void;
};

/** The screen and its redraw. */
export type TurnScreen = {
  readonly el: HTMLElement;
  /** Where the game draws its board. */
  readonly board: HTMLElement;
  /** Redraw for the game as it is now (`now` decides the hand-over button). */
  update(game: TurnGameLike, now: number): void;
  /** Put another chat panel in (the chat mode changed: a friend joined, a guest sat down). */
  setChat(chat: HTMLElement | null): void;
};

/** Build the screen. `face` draws a seat's avatar; `chat` is the chat panel (or null). */
export function turnsScreen(
  o: { title: string; face(seat: TurnSeat): Node; chat: HTMLElement | null },
  a: TurnScreenActions,
): TurnScreen {
  const status = h('p.kit-tagline.kit-turn-status', { 'data-testid': 'turn-status', 'aria-live': 'polite' });
  const seats = h('ul.kit-seats', { 'data-testid': 'turn-seats' });
  const board = h('div.kit-turn-board', { 'data-testid': 'turn-board' });
  const link = h('p.kit-tagline.kit-turn-link', { 'data-testid': 'turn-link' });
  const menu = h('div.kit-menu');
  let chatEl = o.chat;
  const el = h('div.kit-dim.kit-turns', {}, h('h2.kit-title', {}, o.title), status, seats, link, board, menu, chatEl);
  let seatKeys: string[] = [];
  let menuKey = '';

  const seatName = (s: TurnSeat): HTMLElement => {
    const id = s.userId;
    if (s.isMe || id === null) return h('span', {}, s.name);
    return h(
      'button.kit-btn',
      { type: 'button', 'data-nav': true, 'data-testid': `player-${id}`, onclick: () => a.player(id) },
      s.name,
    );
  };
  const removeButton = (s: TurnSeat): HTMLElement =>
    h(
      'button.kit-btn.kit-seat-remove',
      {
        type: 'button',
        'data-nav': true,
        'data-testid': `turns-remove-${s.seat}`,
        'aria-label': `${t('turnsRemove')}: ${s.name}`,
        onclick: () => a.remove(s.seat, s.name),
      },
      t('turnsRemove'),
    );
  const seatRow = (s: TurnSeat, due: boolean, removable: boolean): HTMLElement =>
    h(
      'li.kit-seat',
      {
        'data-seat': s.seat,
        'data-status': s.status,
        'data-due': due ? 'true' : 'false',
        'data-connected': s.connected === undefined ? 'unknown' : String(s.connected),
      },
      s.status === 'joined' ? o.face(s) : null,
      seatName(s),
      removable ? removeButton(s) : null,
    );

  return {
    el,
    board,
    setChat(chat) {
      if (chatEl !== null && chat !== null) chatEl.replaceWith(chat);
      else if (chatEl !== null) chatEl.remove();
      else if (chat !== null) el.append(chat);
      chatEl = chat;
    },
    update(game, now) {
      const { summary } = game;
      const st = turnStatus(game);
      status.textContent = st.text;
      el.dataset.phase = summary.phase;
      el.dataset.kind = st.kind;
      el.dataset.seq = String(summary.seq);
      const shareable = summary.phase === 'lobby' ? game.link : null;
      // The link itself isn't shown (a long address is no help): Share the invite link hands it on. It stays in the DOM for tests.
      link.textContent = shareable ?? '';
      link.hidden = true;

      const due = new Set(dueOthers(summary, game.mySeat).map((s) => s.seat));
      if (summary.isMyTurn && game.mySeat !== null) due.add(game.mySeat);
      // The creator may take another player out (hub client next.12+): in the lobby (seated or invited), or in play.
      const removable = (s: TurnSeat): boolean =>
        summary.isMine &&
        game.kick !== undefined &&
        !s.isMe &&
        s.userId !== null &&
        ((summary.phase === 'lobby' && (s.status === 'joined' || s.status === 'invited')) ||
          (summary.phase === 'playing' && s.status === 'joined'));
      // Whose turn it is changes every move: that flips the row's data-due in place. A row is drawn
      // again only when its seat changed, so a game's entrance animation on .kit-seat plays once.
      const rowKey = (s: TurnSeat): string =>
        JSON.stringify([s.seat, s.name, s.status, s.connected, s.look, removable(s)]);
      const nextKeys = summary.seats.map(rowKey);
      const rows = [...seats.children];
      if (rows.length === nextKeys.length && seatKeys.length === rows.length) {
        nextKeys.forEach((key, i) => {
          const s = summary.seats[i];
          if (s && key !== seatKeys[i]) rows[i]?.replaceWith(seatRow(s, due.has(s.seat), removable(s)));
        });
      } else {
        seats.replaceChildren(...summary.seats.map((s) => seatRow(s, due.has(s.seat), removable(s))));
      }
      seatKeys = nextKeys;
      for (const row of seats.children) {
        if (row instanceof HTMLElement) row.dataset.due = due.has(Number(row.dataset.seat)) ? 'true' : 'false';
      }

      const seated = game.mySeat !== null;
      const buttons: [string, () => HTMLElement][] = [];
      if (summary.phase === 'lobby' && summary.isMine)
        buttons.push(['start', () => button(t('turnsStart'), a.start, { cls: 'kit-primary', testid: 'turns-start' })]);
      if (summary.phase === 'lobby' && seated && summary.seats.some((s) => s.status === 'open'))
        buttons.push(['invite', () => button(t('turnsInvite'), a.invite, { testid: 'turns-invite' })]);
      if (summary.phase === 'lobby' && game.link !== null)
        buttons.push(['link', () => button(t('turnsCopyLink'), a.copyLink, { testid: 'turns-copy-link' })]);
      if (summary.phase === 'playing' && !summary.isMyTurn && seated)
        buttons.push(['nudge', () => button(t('remindThem'), a.nudge, { testid: 'turns-nudge' })]);
      if (game.canLetComputerPlay(now)) {
        const name = handOverNames(summary, game.mySeat);
        buttons.push([
          `hand-over:${name}`,
          () => button(t('letComputerPlay', { name }), a.handOver, { cls: 'kit-primary', testid: 'turns-hand-over' }),
        ]);
      }
      if (summary.phase === 'ended' && seated)
        buttons.push([
          'rematch',
          () => button(t('turnsRematch'), a.rematch, { cls: 'kit-primary', testid: 'turns-rematch' }),
        ]);
      if (summary.phase !== 'ended' && seated)
        buttons.push(['leave', () => button(t('turnsLeave'), a.leave, { testid: 'turns-leave' })]);
      buttons.push(['back', () => button(t('back'), a.back, { testid: 'turns-back' })]);
      const nextMenu = buttons.map(([k]) => k).join('|');
      if (nextMenu !== menuKey) {
        menuKey = nextMenu;
        menu.replaceChildren(...buttons.map(([, make]) => make()));
      }
    },
  };
}
