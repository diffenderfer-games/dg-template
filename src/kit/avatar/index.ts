/**
 * kit/avatar: players' faces beside their names, reactions, and the title-screen demo.
 * Source: dg-template src/kit/avatar/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/avatar.md
 *
 * Planned hub API (avatars.md §6, §11; phases 0–2, the Pixi/three adapters
 * in phase 4). The hub draws faces (`<dg-avatar>`, render.svg, the animator);
 * the kit only places them. Rules: show players' avatars wherever you show
 * their names; never draw your own faces for real players; a character game's
 * hero isn't the player's face. Until the pinned client has `hub.avatar`,
 * every helper falls back to an initial in a circle and the demo stays hidden.
 */
import type { HubLike } from '../core/hub-like.ts';
import type { AvatarRef } from '../core/planned.ts';
import { t } from '../core/strings.ts';
import { button } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import type { Feel } from './types.ts';

export type * from './types.ts';

/** A player as names come with them (room seats, racers, invites). */
export type Who = { userId?: number; name: string; look?: string; hidden?: boolean };

/** The hub's custom element for a face (registered by the hub's avatar module). */
const TAG = 'dg-avatar';

/** A face: `<dg-avatar>` with the player's look, or the fallback initial. */
export function face(hub: Pick<HubLike, 'avatar'>, who: Who, size = 40): HTMLElement {
  const ref: AvatarRef | null =
    hub.avatar && who.hidden !== true
      ? hub.avatar.from({
          ...(who.look === undefined ? {} : { look: who.look }),
          ...(who.userId === undefined ? {} : { userId: who.userId }),
        })
      : null;
  if (ref !== null && !ref.hidden) {
    const el = document.createElement(TAG);
    el.setAttribute('look', ref.code);
    el.setAttribute('size', String(size));
    el.setAttribute('title', who.name);
    el.dataset.face = 'avatar';
    return el;
  }
  // The silhouette for a hidden player, an initial otherwise (no hub avatars yet).
  const initial = who.hidden === true ? '' : (who.name.trim()[0] ?? '?').toUpperCase();
  return h(
    'span.kit-face',
    {
      'data-face': who.hidden === true ? 'silhouette' : 'initial',
      'aria-hidden': 'true',
      style: { width: `${size}px`, height: `${size}px` },
    },
    initial,
  );
}

/** A face and a name that opens the player card (multiplayer.md §11). */
export function nameAndFace(hub: Pick<HubLike, 'avatar' | 'social'>, who: Who, size = 32): HTMLElement {
  const name =
    who.userId === undefined
      ? h('span', {}, who.name)
      : h(
          'button.kit-link',
          {
            type: 'button',
            'data-nav': true,
            onclick: () => who.userId !== undefined && hub.social.openPlayer({ userId: who.userId }),
          },
          who.name,
        );
  return h('span.kit-who', {}, face(hub, who, size), name);
}

/** A seat badge: a face with a name plate (avatars.md §11 seatBadge). */
export function seatBadge(
  hub: Pick<HubLike, 'avatar'>,
  who: Who,
  o: { size?: number; nameplate?: boolean } = {},
): HTMLElement {
  return h(
    'div.kit-seat-badge',
    { 'data-user': who.userId ?? '' },
    face(hub, who, o.size ?? 56),
    o.nameplate === false ? null : h('span.kit-nameplate', {}, who.name),
  );
}

/** Every face looks toward the active seat (avatars.md §11 useSeatLook). Call on every turn change. */
export function lookAtActive(badges: readonly HTMLElement[], active: number | null): void {
  const target = active === null ? null : badges[active];
  const tr = target?.getBoundingClientRect();
  for (const b of badges) {
    const f = b.querySelector(TAG);
    if (!f) continue;
    if (!tr || b === target) {
      f.removeAttribute('look-x');
      continue;
    }
    const r = b.getBoundingClientRect();
    const dx = tr.left + tr.width / 2 - (r.left + r.width / 2);
    f.setAttribute('look-x', String(Math.max(-1, Math.min(1, dx / 300))));
  }
}

/** Game events → feelings on a seat's face (avatars.md §3.7 `anim.feel`). */
export function feelOn<E extends string>(
  map: Readonly<Record<E, Feel>>,
  show: (seat: number, feel: Feel) => void,
): (event: E, seat: number) => void {
  return (event, seat) => show(seat, map[event]);
}

/** After a match: the winner cheers, the others look happy (a close one) or sad. */
export function resultFaces(
  results: readonly { seat: number; won: boolean }[],
  show: (seat: number, feel: Feel) => void,
): void {
  for (const r of results) show(r.seat, r.won ? 'win' : 'lose');
}

/** Show a feeling on a `<dg-avatar>` (the hub's element plays it). */
export function showFeel(badge: HTMLElement, feel: Feel): void {
  badge.querySelector(TAG)?.setAttribute('feel', feel);
}

/** A stable face for a computer player (`hub.avatar.bot`), or null before the hub has avatars. */
export function botLook(hub: Pick<HubLike, 'avatar'>, seed: string): AvatarRef | null {
  return hub.avatar?.bot(seed) ?? null;
}

/**
 * The title-screen demo (avatars.md §11, on by default): the player's bust in
 * a corner, blinking and looking at the pointer, with an Edit button that
 * opens the hub's designer; it re-renders when the look changes. Returns the
 * remover; does nothing until the hub has avatars.
 */
export function titleDemo(hub: Pick<HubLike, 'avatar'>, screen: HTMLElement): () => void {
  const avatar = hub.avatar;
  if (!avatar) return () => undefined;
  const corner = h('div.kit-corner.kit-avatar-demo', {
    'data-testid': 'avatar-demo',
    style: { bottom: 'var(--kit-bottom)', left: '16px' },
  });
  const bust = document.createElement(TAG);
  bust.setAttribute('size', '96');
  bust.setAttribute('animate', '');
  corner.append(
    bust,
    button(t('edit'), () => void avatar.openDesigner({ reason: 'game' }), { testid: 'avatar-edit' }),
  );
  screen.append(corner);
  const show = (ref: AvatarRef): void => bust.setAttribute('look', ref.code);
  void avatar.mine().then(show);
  const onMove = (e: PointerEvent): void => {
    const r = bust.getBoundingClientRect();
    bust.setAttribute('look-x', String(Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / 300))));
    bust.setAttribute('look-y', String(Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / 300))));
  };
  addEventListener('pointermove', onMove);
  const off = avatar.on('change', () => void avatar.mine().then(show));
  return () => {
    removeEventListener('pointermove', onMove);
    off();
    corner.remove();
  };
}
