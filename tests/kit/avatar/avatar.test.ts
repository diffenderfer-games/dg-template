// Planned hub API adapter (kit/avatar), tested against the plan's shapes (FakeHub planned flags).
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { face, feelOn, nameAndFace, resultFaces, titleDemo } from '../../../src/kit/avatar/index.ts';
import { createFakeHub } from '../../../src/kit/testing/index.ts';

describe('kit/avatar', () => {
  it('without hub.avatar: an initial (a silhouette for a hidden player); with it: <dg-avatar> with the look', () => {
    const plain = createFakeHub({ events: new EventTarget() });
    expect(face(plain, { name: 'sam' }).textContent).toBe('S');
    expect(face(plain, { name: 'sam', hidden: true }).dataset.face).toBe('silhouette');
    const hub = createFakeHub({ events: new EventTarget(), planned: { avatars: true } });
    const f = face(hub, { userId: 4, name: 'Sam' });
    expect(f.tagName.toLowerCase()).toBe('dg-avatar');
    expect(f.getAttribute('look')).toBe('AV1user-4');
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

  it('the title demo appears only with hub avatars, and Edit opens the designer', () => {
    const screen = document.createElement('div');
    titleDemo(createFakeHub({ events: new EventTarget() }), screen)();
    expect(screen.children).toHaveLength(0);
    const hub = createFakeHub({ events: new EventTarget(), planned: { avatars: true } });
    const off = titleDemo(hub, screen);
    screen.querySelector<HTMLElement>('[data-testid="avatar-edit"]')?.click();
    expect(hub.log.count('avatar.openDesigner')).toBe(1);
    off();
    expect(screen.children).toHaveLength(0);
  });
});
