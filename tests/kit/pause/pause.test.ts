// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installPause,
  SETTLE_MS,
  syncMenuButton,
  type PauseHandle,
  type PauseReason,
} from '../../../src/kit/pause/index.ts';
import { createFakeHub, type FakeHub } from '../../../src/kit/testing/index.ts';

let fake: FakeHub;
let shown: PauseReason[];
let hidden: number;
let canPause: boolean;
const installed: PauseHandle[] = [];

function install(resumeOnClose = false): PauseHandle {
  const p = installPause(
    fake,
    { canPause: () => canPause, show: (w) => shown.push(w), hide: () => hidden++, resumeOnClose },
    { clock: fake.clock },
  );
  installed.push(p);
  return p;
}

afterEach(() => {
  for (const p of installed.splice(0)) p.dispose();
});

beforeEach(() => {
  fake = createFakeHub({ events: new EventTarget() });
  shown = [];
  hidden = 0;
  canPause = true;
});

describe('pause', () => {
  it('registers autoPause exactly once', () => {
    const p = install();
    expect(fake.log.count('overlay.autoPause')).toBe(1);
    p.dispose();
    expect(fake.overlay.listenerCount('open')).toBe(0);
  });

  it('hub UI opening pauses with why=hub; an action game stays paused on close', () => {
    const p = install(false);
    const close = fake.openOverlay('menu');
    expect(p.why).toBe('hub');
    expect(shown).toEqual(['hub']);
    close();
    expect(p.paused).toBe(true);
    expect(hidden).toBe(0);
  });

  it('a turn-based game resumes on close, but only if the hub paused it (skipbo pausedByHub)', () => {
    const p = install(true);
    fake.openOverlay()();
    expect(p.paused).toBe(false);
    expect(hidden).toBe(1);
    p.pause('player');
    fake.openOverlay()();
    expect(p.why).toBe('player');
  });

  it('a player pause during hub UI stays a player pause after close', () => {
    const p = install(true);
    const close = fake.openOverlay();
    p.pause('player');
    close();
    expect(p.paused).toBe(true);
  });

  it('nested hub UI pauses once', () => {
    install();
    const a = fake.openOverlay('menu');
    const b = fake.openOverlay('chat');
    b();
    a();
    expect(shown).toEqual(['hub']);
  });

  it('registering while hub UI is already open pauses at once (the intro at load)', () => {
    fake.openOverlay('menu');
    const p = install();
    expect(p.why).toBe('hub');
  });

  it('never pauses when canPause is false (a race, a live match)', () => {
    canPause = false;
    const p = install();
    fake.openOverlay();
    expect(p.paused).toBe(false);
    expect(p.pause('player')).toBe(false);
    expect(shown).toEqual([]);
  });

  it('pauses when the page is hidden', () => {
    const p = install();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(p.why).toBe('hidden');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    p.dispose();
  });

  it('swallows the click that closed the hub menu (bubblepop settleT)', () => {
    const p = install();
    let clicks = 0;
    document.body.addEventListener('click', () => clicks++);
    fake.openOverlay()();
    document.body.click();
    expect(clicks).toBe(0);
    fake.clock.advance(SETTLE_MS);
    document.body.click();
    expect(clicks).toBe(1);
    p.dispose();
  });

  it('the menu button hides during play and shows when paused or on menus (bfme hubMenu)', () => {
    syncMenuButton(fake, { playing: true, paused: false });
    expect(fake.menu.visible).toBe(false);
    syncMenuButton(fake, { playing: true, paused: true });
    expect(fake.menu.visible).toBe(true);
    syncMenuButton(fake, { playing: false, paused: false });
    syncMenuButton(fake, { playing: false, paused: false });
    expect(fake.log.count('menu.setVisible')).toBe(2);
  });
});
