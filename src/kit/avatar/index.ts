/**
 * kit/avatar: players' faces beside their names, reactions, and the title-screen demo.
 * Source: dg-template src/kit/avatar/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/avatar.md
 *
 * hub.md "Avatars". The hub draws every face (`<dg-avatar>`, render.svg, the
 * animator, the Pixi and three.js adapters); the kit only places them.
 * `<dg-avatar>` is the hub renderer's element: `avatarRenderer(hub)` loads
 * it once (`hub.avatar.load()` + `defineAvatarElement()`), and every helper
 * here calls it, so an element made before the renderer is ready upgrades
 * when it is. Rules: show players' avatars wherever you show their names;
 * never draw your own faces for real players; a character game's hero isn't
 * the player's face; a hidden player (`look: ''`) shows the silhouette.
 */
import type { AvatarModule, AvatarRef } from '@diffenderfer-games/hub';
import type { Animator } from '@diffenderfer-games/hub/avatar';
import type { HubLike } from '../core/hub-like.ts';
import { t } from '../core/strings.ts';
import { button } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import type { Feel } from './types.ts';

export type * from './types.ts';

/** A player as names come with them (room seats, racers, invites). */
export type Who = { userId?: number; name: string; look?: string; hidden?: boolean };

/** The hub renderer's custom element for a face. */
const TAG = 'dg-avatar';

/** `<dg-avatar>` once the renderer has upgraded it: its `animator` plays feelings. */
type AvatarElement = HTMLElement & { readonly animator: Pick<Animator, 'feel'> };

const loaded = new WeakMap<object, Promise<Pick<AvatarModule, 'defineAvatarElement'> | null>>();

/**
 * Load the hub's renderer (its art) and register `<dg-avatar>`, once per hub.
 * Resolves null if it can't load (offline before the first visit): faces
 * then stay empty boxes of the right size.
 */
export function avatarRenderer(
  hub: Pick<HubLike, 'avatar'>,
): Promise<Pick<AvatarModule, 'defineAvatarElement'> | null> {
  let p = loaded.get(hub.avatar);
  if (p === undefined) {
    p = hub.avatar.load().then(
      (mod) => {
        mod.defineAvatarElement();
        return mod;
      },
      () => null,
    );
    loaded.set(hub.avatar, p);
  }
  return p;
}

/** A `<dg-avatar>` for a ref (sized, so the layout doesn't jump when it renders). */
function avatarElement(hub: Pick<HubLike, 'avatar'>, ref: AvatarRef, size: number, o: FaceOptions): HTMLElement {
  void avatarRenderer(hub);
  const el = document.createElement(TAG);
  el.setAttribute('look', ref.hidden ? '' : ref.code);
  el.setAttribute('size', String(size));
  if (o.frame) el.setAttribute('frame', o.frame);
  if (o.animate === true) el.setAttribute('animate', '');
  if (o.title !== undefined) el.setAttribute('title', o.title);
  el.style.width = el.style.height = `${size}px`;
  el.dataset.face = ref.hidden || ref.code === '' ? 'silhouette' : 'avatar';
  return el;
}

/** How a face is drawn. */
export type FaceOptions = {
  /** `head` (a badge, the default), `bust` or `full`. */
  frame?: 'head' | 'bust' | 'full';
  /** Blink and idle (and play feelings with `showFeel`). Live faces cost a frame each: keep it to about 12. */
  animate?: boolean;
  /** The accessible name, only where the face stands alone ("Sam's avatar"); next to a name it is decorative. */
  title?: string;
};

/**
 * A face: `<dg-avatar>` with the player's look (the silhouette for a hidden player). Decorative beside a name.
 * With only a user id (no `look`), the hub's `from()` gives that id's stand-in face, not the player's
 * avatar: so the face asks for the real one (`mine()` for you, `of(id)` for anyone else) and follows
 * their changes while it is on the page.
 */
export function face(
  hub: Pick<HubLike, 'avatar'> & Partial<Pick<HubLike, 'userId'>>,
  who: Who,
  size = 40,
  o: FaceOptions = {},
): HTMLElement {
  if (who.hidden === true) return avatarElement(hub, hub.avatar.from({ look: '' }), size, o);
  if (who.look !== undefined || who.userId === undefined) {
    const ref = hub.avatar.from({
      ...(who.look === undefined ? {} : { look: who.look }),
      ...(who.userId === undefined ? {} : { userId: who.userId }),
    });
    return avatarElement(hub, ref, size, o);
  }
  const id = who.userId;
  const isMe = id === hub.userId?.();
  const first = (isMe ? hub.avatar.mineSync() : null) ?? hub.avatar.from({ look: '' });
  const el = avatarElement(hub, first, size, o);
  const show = (ref: AvatarRef): void => {
    el.setAttribute('look', ref.hidden ? '' : ref.code);
    el.dataset.face = ref.hidden || ref.code === '' ? 'silhouette' : 'avatar';
  };
  void (isMe ? hub.avatar.mine() : hub.avatar.of(id)).then(show, () => undefined);
  let placed = false;
  const off = hub.avatar.on('change', (c) => {
    if (el.isConnected) placed = true;
    else if (placed) return off();
    if (c.userId === id) show(c.ref);
  });
  return el;
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

/** A seat badge: a live face with a name plate (avatars.md §11 seatBadge). */
export function seatBadge(
  hub: Pick<HubLike, 'avatar'>,
  who: Who,
  o: { size?: number; nameplate?: boolean } = {},
): HTMLElement {
  return h(
    'div.kit-seat-badge',
    { 'data-user': who.userId ?? '' },
    face(hub, who, o.size ?? 56, { animate: true }),
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

/** Game events → feelings on a seat's face (hub.md "Expressions and gaze": `anim.feel`). */
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

/** Has the renderer upgraded this element (so it has an animator)? */
function isAvatarElement(el: Element): el is AvatarElement {
  return el instanceof HTMLElement && 'animator' in el;
}

/**
 * Show a feeling on a badge's face with the element's own animator
 * (`animator.feel`); the face animates from then on. False before the
 * renderer has upgraded the element.
 */
export function showFeel(badge: HTMLElement, feel: Feel): boolean {
  const el = badge.matches(TAG) ? badge : badge.querySelector(TAG);
  if (el === null || !isAvatarElement(el)) return false;
  el.setAttribute('animate', '');
  el.animator.feel(feel);
  return true;
}

/** A stable face for a computer player (`hub.avatar.bot`). */
export function botLook(hub: Pick<HubLike, 'avatar'>, seed: string): AvatarRef {
  return hub.avatar.bot(seed);
}

/**
 * The title-screen demo (avatars.md §11, on by default): the player's bust in
 * the title (under its buttons), blinking and looking at the pointer, with an "Edit avatar" button
 * that opens the hub's designer; it re-renders when their avatar changes
 * (`change` with their user id). Returns the remover.
 */
export function titleDemo(hub: Pick<HubLike, 'avatar' | 'userId'>, screen: HTMLElement): () => void {
  const avatar = hub.avatar;
  const mine = avatar.mineSync() ?? avatar.from({ look: '' });
  const bust = avatarElement(hub, mine, 96, { frame: 'bust', animate: true, title: t('yourAvatar') });
  // In the title's flow, under its buttons: a fixed corner would cover them on a phone with Continue rows.
  const corner = h(
    'div.kit-avatar-demo',
    {
      'data-testid': 'avatar-demo',
      style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexShrink: '0' },
    },
    bust,
    button(t('editAvatar'), () => void avatar.openDesigner({ reason: 'game' }), { testid: 'avatar-edit' }),
  );
  screen.append(corner);
  const show = (ref: AvatarRef): void => {
    bust.setAttribute('look', ref.code);
    bust.dataset.face = ref.code === '' ? 'silhouette' : 'avatar';
  };
  void avatar.mine().then(show);
  let off = (): void => undefined;
  const remove = (): void => {
    removeEventListener('pointermove', onMove);
    off();
    corner.remove();
  };
  /** The title redraws often: a demo whose screen is gone cleans itself up. */
  const alive = (): boolean => {
    if (corner.isConnected) return true;
    remove();
    return false;
  };
  const onMove = (e: PointerEvent): void => {
    if (!alive()) return;
    const r = bust.getBoundingClientRect();
    bust.setAttribute('look-x', String(Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / 300))));
    bust.setAttribute('look-y', String(Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / 300))));
  };
  addEventListener('pointermove', onMove);
  off = avatar.on('change', ({ userId, ref }) => {
    if (alive() && userId === hub.userId()) show(ref);
  });
  return remove;
}
