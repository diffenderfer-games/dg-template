// kit/avatar on the FakeHub's hub.avatar (the renderer itself is the hub's; see the hub suites).
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  avatarRenderer,
  face,
  feelOn,
  nameAndFace,
  resultFaces,
  seatBadge,
  showFeel,
  titleDemo,
} from '../../../src/kit/avatar/index.ts';
import { createFakeHub } from '../../../src/kit/testing/index.ts';

describe('kit/avatar', () => {
  it('a face is <dg-avatar> with the player’s look; a hidden player is the silhouette', async () => {
    const hub = createFakeHub({ events: new EventTarget() });
    const f = face(hub, { userId: 4, name: 'Sam' });
    expect(f.tagName.toLowerCase()).toBe('dg-avatar');
    await Promise.resolve();
    expect(f.getAttribute('look')).toBe('AV1user-4'); // the player's avatar (of), never the id's stand-in
    expect(face(hub, { name: 'Ava', look: 'AV1ava' }).getAttribute('look')).toBe('AV1ava');
    const hidden = face(hub, { userId: 4, name: 'Sam', hidden: true });
    expect(hidden.dataset.face).toBe('silhouette');
    expect(hidden.getAttribute('look')).toBe('');
    expect(f.hasAttribute('title')).toBe(false); // beside a name it is decorative
  });

  it('your face by user id is your avatar at once, and follows your changes', () => {
    const hub = createFakeHub({ events: new EventTarget() });
    const me = hub.userId();
    expect(me).not.toBeNull();
    if (me === null) return;
    const f = face(hub, { userId: me, name: 'You' });
    document.body.append(f);
    expect(f.getAttribute('look')).toBe(`AV1me-${me}`);
    hub.avatar.change(me, 'new');
    expect(f.getAttribute('look')).toBe('AV1new');
    hub.avatar.change(me + 1, 'other');
    expect(f.getAttribute('look')).toBe('AV1new');
    f.remove();
  });

  it('loads the renderer once (hub.avatar.load, then defineAvatarElement) before any face draws', async () => {
    const hub = createFakeHub({ events: new EventTarget() });
    face(hub, { userId: 4, name: 'Sam' });
    face(hub, { userId: 5, name: 'Ava' });
    await avatarRenderer(hub);
    expect(hub.log.count('avatar.load')).toBe(1);
    expect(hub.log.count('avatar.define')).toBe(1);
  });

  it('every name opens the player card', () => {
    const hub = createFakeHub({ events: new EventTarget() });
    nameAndFace(hub, { userId: 9, name: 'Ava' }).querySelector('button')?.click();
    expect(hub.log.last('social.openPlayer')?.args[0]).toEqual({ userId: 9 });
  });

  it('feelOn maps events to feelings; result faces cheer the winner', () => {
    const shown: string[] = [];
    const feel = feelOn({ coin: 'bigPlay', hit: 'victim' }, (seat, f) => shown.push(`${seat}:${f}`));
    feel('hit', 2);
    resultFaces(
      [
        { seat: 0, won: true },
        { seat: 1, won: false },
      ],
      (seat, f) => shown.push(`${seat}:${f}`),
    );
    expect(shown).toEqual(['2:victim', '0:win', '1:lose']);
  });

  it('showFeel plays the feeling on the element’s animator (never a `feel` attribute)', () => {
    const hub = createFakeHub({ events: new EventTarget() });
    const badge = seatBadge(hub, { userId: 2, name: 'Sam' });
    expect(showFeel(badge, 'win')).toBe(false); // not upgraded yet
    const el = badge.querySelector('dg-avatar');
    const felt: string[] = [];
    if (el) Object.defineProperty(el, 'animator', { value: { feel: (f: string) => felt.push(f) } });
    expect(showFeel(badge, 'bigPlay')).toBe(true);
    expect(felt).toEqual(['bigPlay']);
    expect(el?.hasAttribute('feel')).toBe(false);
    expect(el?.hasAttribute('animate')).toBe(true);
  });

  it('the title demo shows your bust at once, Edit avatar opens the designer, and your changes re-render it', () => {
    const screen = document.body.appendChild(document.createElement('div'));
    const hub = createFakeHub({ events: new EventTarget() });
    const off = titleDemo(hub, screen);
    const bust = screen.querySelector('[data-testid="avatar-demo"] dg-avatar');
    expect(bust?.getAttribute('look')).toBe('AV1me-1');
    expect(bust?.getAttribute('frame')).toBe('bust');
    screen.querySelector<HTMLElement>('[data-testid="avatar-edit"]')?.click();
    expect(hub.log.count('avatar.openDesigner')).toBe(1);
    hub.avatar.change(2, 'someone-else');
    expect(bust?.getAttribute('look')).toBe('AV1me-1');
    hub.avatar.change(1, 'new-me');
    expect(bust?.getAttribute('look')).toBe('AV1new-me');
    off();
    expect(screen.children).toHaveLength(0);
  });

  it('a title demo whose screen is gone cleans itself up on the next change', () => {
    const screen = document.body.appendChild(document.createElement('div'));
    const hub = createFakeHub({ events: new EventTarget() });
    titleDemo(hub, screen);
    screen.remove();
    hub.avatar.change(1, 'new-me');
    expect(screen.children).toHaveLength(0);
  });
});
