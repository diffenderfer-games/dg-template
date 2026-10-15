/**
 * kit/online: the lobby screen (multiplayer.md §6 checklist).
 * Source: dg-template src/kit/online/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/online.md § "Lobby"
 *
 * An Invite button (`social.openInvite`), a bell (`social.openNotify` for this
 * game), the room code, every seat's name opening the player card
 * (`social.openPlayer`) with a face beside it, Start for the host once enough
 * players sit, and Leave.
 */
import type { RoomInfo, RoomSeat } from '@diffenderfer-games/hub';
import { t } from '../core/strings.ts';
import { button } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';

/** What the lobby's buttons do. */
export type LobbyActions = {
  start: () => void;
  leave: () => void;
  invite: () => void;
  bell: () => void;
  player: (userId: number) => void;
};

/** The lobby. */
export function lobbyScreen(
  o: {
    info: RoomInfo;
    isHost: boolean;
    me: number;
    minPlayers: number;
    chat: HTMLElement | null;
    face?: (seat: RoomSeat) => Node;
  },
  a: LobbyActions,
): HTMLElement {
  const seats = h(
    'ul.kit-seats',
    { 'data-testid': 'seats' },
    ...o.info.seats.map((s) =>
      h(
        'li.kit-seat',
        { 'data-user': s.userId, 'data-connected': s.connected ? 'true' : 'false' },
        o.face?.(s) ?? null,
        s.userId === o.me
          ? h('span', {}, s.name)
          : h(
              'button.kit-btn',
              {
                type: 'button',
                'data-nav': true,
                'data-testid': `player-${s.userId}`,
                onclick: () => a.player(s.userId),
              },
              s.name,
            ),
        s.connected ? null : h('span.kit-tagline', {}, t('waitingFor', { name: s.name })),
      ),
    ),
  );
  const enough = o.info.seats.length >= o.minPlayers;
  const menu = h(
    'div.kit-menu',
    {},
    o.isHost ? button(t('play'), a.start, { cls: 'kit-primary', testid: 'lobby-start', disabled: !enough }) : null,
    button(t('invite'), a.invite, { testid: 'lobby-invite' }),
    button(t('bell'), a.bell, { testid: 'lobby-bell', icon: '🔔' }),
    button(t('leave'), a.leave, { testid: 'lobby-leave' }),
  );
  return h(
    'div.kit-dim.kit-lobby',
    {},
    h('h2.kit-title', {}, t('online')),
    h('p.kit-tagline', { 'data-testid': 'room-code' }, o.info.code),
    seats,
    menu,
    o.chat,
  );
}
