/**
 * kit/online: the lobby screen (multiplayer.md §6 checklist).
 * Source: dg-template src/kit/online/ (kit v1.35). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md § "Lobby"
 *
 * The room code in big letters (anyone can join with it) with an Invite link (`shareLink`) and Invite
 * friends (`social.openInvite`), a status line saying what happens next, every seat with its face, name
 * (opening the player card), a crown on the host and a chip (Host, Ready ✓, Not ready / Ready in 0:42,
 * Away), the host's Make host on the others (a hub with `setHost`), then Play for the host (enabled when
 * enough players sit and every guest is ready) or I'm ready! for a guest, a bell, Leave and the chat.
 *
 * Countdowns tick in place ({@link tickLobby}): the lobby is drawn again only when the room changes.
 */
import type { RoomInfo, RoomSeat } from '@diffenderfer-games/hub';
import { t } from '../core/strings.ts';
import { button } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import { ui } from '../ui/root.ts';
import { clockText, lobbyReadiness, seatReady, type SeatReady } from './ready.ts';

/** What the lobby's buttons do. */
export type LobbyActions = {
  start: () => void;
  leave: () => void;
  invite: () => void;
  bell: () => void;
  player: (userId: number) => void;
  /** A guest says it is ready (or not). */
  ready?: (on: boolean) => void;
  /** Share an invite link (`shareLink`). */
  share?: () => void;
  /** The host gives the host role to `userId` (only on a hub with `setHost`). */
  makeHost?: (userId: number) => void;
};

/** "Ann", "Ann and Bo", "Ann, Bo and Cy". */
export function nameList(names: readonly string[]): string {
  const last = names.at(-1) ?? '';
  return names.length <= 1 ? last : t('lobbyAnd', { list: names.slice(0, -1).join(', '), last });
}

/** A seat's chip: its words and kind (the CSS colours it). */
function chip(s: SeatReady, now: number, userId: number): HTMLElement {
  const words =
    s.kind === 'host'
      ? t('seatHost')
      : s.kind === 'ready' || s.kind === 'auto'
        ? t('seatReady')
        : s.kind === 'away'
          ? t('seatAway')
          : s.readyAt === null
            ? t('seatNotReady')
            : t('seatReadyIn', { time: clockText(s.readyAt - now) });
  return h(
    'span.kit-chip.kit-seat-chip',
    {
      'data-kind': s.kind,
      'data-testid': `seat-status-${String(userId)}`,
      ...(s.readyAt === null ? {} : { 'data-ready-at': String(s.readyAt) }),
    },
    words,
  );
}

/**
 * Tick the lobby's countdowns in place. True when a wait is over (someone counts as ready now):
 * draw the lobby again then, so Play and the status line follow.
 */
export function tickLobby(el: HTMLElement, now: number): boolean {
  let over = false;
  for (const c of el.querySelectorAll<HTMLElement>('[data-ready-at]')) {
    const at = Number(c.dataset['readyAt']);
    if (now >= at) over = true;
    else c.textContent = t('seatReadyIn', { time: clockText(at - now) });
  }
  return over;
}

/** Whether the lobby has a countdown to tick. */
export function lobbyTicks(el: HTMLElement): boolean {
  return el.querySelector('[data-ready-at]') !== null;
}

/** The seats. */
function seatList(
  o: { info: RoomInfo; isHost: boolean; me: number; now: number; face?: (seat: RoomSeat) => Node },
  a: LobbyActions,
): HTMLElement {
  return h(
    'ul.kit-seats',
    { 'data-testid': 'seats' },
    ...o.info.seats.map((s) => {
      const ready = seatReady(s, o.info.hostId, o.now);
      const handOver =
        o.isHost && a.makeHost !== undefined && s.userId !== o.me && s.connected
          ? button(t('makeHost'), () => a.makeHost?.(s.userId), {
              cls: 'kit-seat-host',
              testid: `make-host-${String(s.userId)}`,
            })
          : null;
      return h(
        'li.kit-seat',
        { 'data-user': s.userId, 'data-connected': s.connected ? 'true' : 'false', 'data-ready': ready.kind },
        o.face?.(s) ?? null,
        h(
          'span.kit-seat-name',
          {},
          s.userId === o.info.hostId ? h('span.kit-crown', { 'aria-hidden': 'true' }, '👑') : null,
          s.userId === o.me
            ? h('span', {}, s.name)
            : h(
                'button.kit-btn.kit-seat-player',
                {
                  type: 'button',
                  'data-nav': true,
                  'data-testid': `player-${String(s.userId)}`,
                  onclick: () => a.player(s.userId),
                },
                s.name,
              ),
        ),
        chip(ready, o.now, s.userId),
        handOver,
      );
    }),
  );
}

/** The status line: what happens next, for the host or a guest. */
function statusText(o: {
  info: RoomInfo;
  isHost: boolean;
  me: number;
  minPlayers: number;
  now: number;
  watching: boolean;
}): string {
  const r = lobbyReadiness(o.info, o.minPlayers, o.now);
  const hostName = o.info.seats.find((s) => s.userId === o.info.hostId)?.name ?? t('someone');
  if (o.isHost) {
    if (!r.enough) return t('lobbyNeedPlayers');
    return r.canStart ? t('lobbyHostGo') : t('lobbyHostWaiting', { names: nameList(r.waiting.map((s) => s.name)) });
  }
  if (o.watching) return t('lobbyWatching', { name: hostName });
  const mine = o.info.seats.find((s) => s.userId === o.me);
  const ready = mine === undefined ? null : seatReady(mine, o.info.hostId, o.now).kind;
  return ready === 'ready' || ready === 'auto' ? t('lobbyGuestReady', { name: hostName }) : t('lobbyGuestPress');
}

/** The guest's big Ready toggle (flips at once; the room's next change confirms it). */
function readyButton(on: boolean, a: LobbyActions): HTMLButtonElement {
  let ready = on;
  const b = button(
    '',
    () => {
      ready = !ready;
      paint();
      a.ready?.(ready);
    },
    { cls: 'kit-primary kit-ready', testid: 'lobby-ready' },
  );
  const paint = (): void => {
    const label = b.querySelector('.kit-btn-label');
    if (label) label.textContent = ready ? t('lobbyReadyDone') : t('lobbyReady');
    b.setAttribute('aria-pressed', ready ? 'true' : 'false');
    b.classList.toggle('kit-pulse', !ready && !ui().reducedMotion);
  };
  paint();
  b.dataset.autofocus = '';
  return b;
}

/** The lobby. */
export function lobbyScreen(
  o: {
    info: RoomInfo;
    isHost: boolean;
    me: number;
    minPlayers: number;
    chat: HTMLElement | null;
    face?: (seat: RoomSeat) => Node;
    /** The game's own part (a live game's options, as the host picked them). */
    extra?: HTMLElement | null;
    /** Now (epoch ms), for the auto-ready countdowns. */
    now?: number;
    /** Watching, not playing (no Ready button). */
    watching?: boolean;
    /** This room is a rematch (a line says so). */
    rematch?: boolean;
  },
  a: LobbyActions,
): HTMLElement {
  const now = o.now ?? 0;
  const watching = o.watching === true;
  const r = lobbyReadiness(o.info, o.minPlayers, now);
  const mine = o.info.seats.find((s) => s.userId === o.me);
  let main: HTMLElement | null = null;
  if (o.isHost) {
    const sub = !r.enough
      ? t('lobbyStartNeed', { n: o.minPlayers })
      : r.canStart
        ? t('lobbyStartGo')
        : t('lobbyStartWait', { n: r.waiting.length });
    main = button(t('play'), () => (r.canStart ? a.start() : undefined), {
      cls: 'kit-primary',
      testid: 'lobby-start',
      disabled: !r.canStart,
      sub,
    });
    main.dataset.autofocus = '';
  } else if (!watching && a.ready !== undefined) {
    main = readyButton(mine?.ready === true, a);
  }
  const codePanel = h(
    'div.kit-room-code-panel',
    {},
    h('span.kit-room-code-label', {}, t('lobbyCodeLabel')),
    h('strong.kit-room-code', { 'data-testid': 'room-code' }, o.info.code),
    h('p.kit-room-code-how', {}, t('lobbyCodeHow')),
    h(
      'div.kit-room-code-buttons',
      {},
      a.share === undefined ? null : button(t('lobbyShare'), a.share, { testid: 'lobby-share', icon: '🔗' }),
      button(t('lobbyInviteFriends'), a.invite, { testid: 'lobby-invite', icon: '✉' }),
    ),
  );
  const menu = h(
    'div.kit-menu',
    {},
    main,
    button(t('bell'), a.bell, { testid: 'lobby-bell', icon: '🔔' }),
    button(t('leave'), a.leave, { testid: 'lobby-leave' }),
  );
  return h(
    'div.kit-dim.kit-lobby',
    {},
    h('h2.kit-title', {}, t('online')),
    o.rematch === true ? h('p.kit-lobby-rematch', { 'data-testid': 'lobby-rematch' }, t('lobbyRematch')) : null,
    codePanel,
    o.extra ?? null,
    h(
      'p.kit-lobby-status',
      { 'data-testid': 'lobby-status', 'aria-live': 'polite', 'data-go': r.canStart ? 'true' : 'false' },
      statusText({ ...o, now, watching }),
    ),
    seatList({ ...o, now }, a),
    menu,
    o.chat,
  );
}
