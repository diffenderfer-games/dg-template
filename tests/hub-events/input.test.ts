// Appendix B rows 9–10: the input system's events.
import { describe, expect, it } from 'vitest';
import { RESUME_INPUT } from '../../src/kit/input/controls.ts';
import { BACK_GUARD_CLASS } from '../../src/kit/ui/back-guard.ts';
import { openModal } from '../../src/kit/ui/modal.ts';
import { bootGame } from './_support/harness.ts';

/** Play inputs that put a game action on the pad's A (like a racer's USE). */
const A_IN_PLAY = {
  groups: {
    play: { inputs: { pause: { keys: ['escape'], gamepad: { button: 9 } }, use: { gamepad: { button: 0 } } } },
  },
};

/** Let the browser's own tasks run (jsdom delivers a history back's popstate in a later task). */
const browserTasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

const guarded = (): boolean => document.documentElement.classList.contains(BACK_GUARD_CLASS);

/** Press Esc on the window; true when someone called preventDefault (the world's box then stays open). */
function esc(): boolean {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
}

describe('input events (hub.md "Input system")', () => {
  it('row 9: sourcechange switches the control hints (html[data-controls])', async () => {
    const g = await bootGame();
    expect(document.documentElement.dataset.controls).toBe('keys');
    g.fake.input.switchSource('touch');
    expect(document.documentElement.dataset.controls).toBe('touch');
    g.fake.input.switchSource('gamepad');
    expect(document.documentElement.dataset.controls).toBe('pad');
  });

  it('row 10: menus are navigable; back respects a locked modal, closes an open one, and pauses or resumes play', async () => {
    // (pad navigation on in play too: a game whose play uses A or B has none there, tested below)
    const g = await bootGame({ patch: { nav: { active: () => true } } });
    expect(g.fake.log.count('input.autoNavigate')).toBe(1);
    const targets = g.fake.input.nav?.targets() ?? [];
    expect(targets.length).toBeGreaterThan(2);
    const locked = openModal({ title: 'Pick one', locked: true, buttons: [{ label: 'A' }] });
    g.fake.input.pressBack();
    expect(locked.el.isConnected).toBe(true);
    expect(g.fake.input.nav?.targets()).toHaveLength(1); // only the modal's controls
    locked.setLocked(false);
    g.fake.input.pressBack();
    expect(locked.el.isConnected).toBe(false);
    await g.start();
    g.fake.input.pressBack();
    expect(g.hook.screen()).toBe('pause');
    g.fake.input.pressBack();
    expect(g.hook.screen()).toBe('play');
  });

  it("Esc is handled only when it goes back or play reads it (the world's box), so on the title it leaves", async () => {
    const g = await bootGame();
    expect(g.hook.screen()).toBe('title');
    expect(esc()).toBe(false); // nothing to go back to: the box closes
    const sheet = openModal({ title: 'Settings', buttons: [{ label: 'OK' }] });
    expect(esc()).toBe(true);
    expect(sheet.el.isConnected).toBe(false);
    const locked = openModal({ title: 'Pick one', locked: true, buttons: [{ label: 'A' }] });
    expect(esc()).toBe(false); // a locked modal ignores it
    locked.close();
    await g.start();
    expect(esc()).toBe(true); // the `pause` input reads Esc
    g.fake.input.tap('pause');
    await g.frames(2);
    expect(g.hook.screen()).toBe('pause');
    expect(esc()).toBe(true); // back to play
    expect(g.hook.screen()).toBe('play');
    const close = g.fake.openOverlay('menu');
    expect(esc()).toBe(false); // hub UI is up: the kit leaves Esc alone
    close();
  });

  it('the pause input (Escape / Start) pauses play', async () => {
    const g = await bootGame();
    await g.start();
    g.fake.input.tap('pause');
    await g.frames(2);
    expect(g.hook.screen()).toBe('pause');
  });

  it('Start (the pause input) resumes from the pause screen once it was let go', async () => {
    const g = await bootGame();
    await g.start();
    g.fake.input.tap('pause');
    await g.frames(2);
    expect(g.hook.screen()).toBe('pause');
    expect(g.fake.input.isEnabled('kit:resume')).toBe(true);
    await g.frames(4);
    g.fake.input.tap(RESUME_INPUT);
    await g.frames(2);
    expect(g.hook.screen()).toBe('play');
    expect(g.fake.input.isEnabled('kit:resume')).toBe(false);
  });

  it("the kit draws its own focus: the hub's ring is off over the kit's menus unless the game asks for it", async () => {
    const g = await bootGame();
    expect(g.fake.input.nav?.ring).toBe(false);
    const ringed = await bootGame({ patch: { nav: { hubRing: true } } });
    expect(ringed.fake.input.nav?.ring).toBe(true);
  });
});

describe('the pad in play (docs/kit/input.md § "Menus")', () => {
  it("when A or B are the game's in play, the pad navigates nothing there (no HUD button is clicked); the pause screen is navigable", async () => {
    const g = await bootGame({ patch: { input: A_IN_PLAY } });
    expect(g.fake.input.nav?.targets().length).toBeGreaterThan(0); // the title
    await g.start();
    expect(g.fake.input.nav?.targets()).toHaveLength(0);
    g.fake.input.pressBack();
    expect(g.hook.screen()).toBe('play'); // B is the game's
    g.fake.input.tap('pause');
    await g.frames(2);
    expect(g.hook.screen()).toBe('pause');
    expect(g.fake.input.nav?.targets().length).toBeGreaterThan(0);
  });

  it('nav.active overrides it (a game with pad-driven buttons in play)', async () => {
    const g = await bootGame({ patch: { input: A_IN_PLAY, nav: { active: () => true } } });
    await g.start();
    expect(g.fake.input.nav?.targets().length).toBeGreaterThan(0);
  });

  it('a game whose play leaves A and B alone keeps the play screen navigable', async () => {
    const g = await bootGame({
      patch: { input: { groups: { play: { inputs: { pause: { keys: ['escape'], gamepad: { button: 9 } } } } } } },
    });
    await g.start();
    expect(g.fake.input.nav?.targets().length).toBeGreaterThan(0);
  });
});

describe('the back guard (docs/kit/ui.md § "The back guard")', () => {
  it('is on in play and off at the result and the title', async () => {
    const g = await bootGame({ patch: { backGuard: true } });
    expect(guarded()).toBe(false);
    await g.start();
    expect(guarded()).toBe(true);
    g.handle.session.finish('lost');
    await g.settle();
    expect(g.hook.screen()).toBe('result');
    expect(guarded()).toBe(false);
    await g.start();
    expect(guarded()).toBe(true);
    g.handle.session.toTitle();
    await g.settle();
    expect(guarded()).toBe(false);
  });

  it('a back while playing pauses instead of leaving the page', async () => {
    const g = await bootGame({ patch: { backGuard: true } });
    await g.start();
    expect(history.state).toMatchObject({ kitBackGuard: true });
    await browserTasks(); // (an earlier test's guard may still be taking its entry off)
    history.back();
    await browserTasks();
    await g.settle();
    expect(g.hook.screen()).toBe('pause');
    expect(history.state).toMatchObject({ kitBackGuard: true });
    g.handle.session.toTitle();
  });

  it('is off with backGuard: false, and by default for games that resume when hub UI closes', async () => {
    const off = await bootGame({ patch: { backGuard: false } });
    await off.start();
    expect(guarded()).toBe(false);
    off.handle.session.toTitle();
    const calm = await bootGame({ patch: { resumeOnClose: true, backGuard: undefined } });
    await calm.start();
    expect(guarded()).toBe(false);
    calm.handle.session.toTitle();
  });
});

describe('button prompts through the booted game (docs/kit/input.md "Button prompts")', () => {
  const key = (k: string): boolean => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  };

  it("the kit's screens get chips; the source picks them; a bound key presses its control, never in active play", async () => {
    const g = await bootGame();
    const html = document.documentElement;
    expect(html.dataset.prompts).toBe('keys');
    g.fake.input.switchSource('gamepad');
    expect(html.dataset.prompts).toBe('pad');
    g.fake.input.switchSource('touch');
    expect(html.dataset.prompts).toBe('none');
    g.fake.input.switchSource('keyboard');
    await g.start();
    // In play: the pause screen's actions answer to nothing yet.
    expect(key('r')).toBe(false);
    expect(g.hook.screen()).toBe('play');
    g.fake.input.tap('pause');
    await g.frames(2);
    expect(g.hook.screen()).toBe('pause');
    await Promise.resolve();
    const resume = document.querySelector('[data-testid="resume"]');
    expect(resume?.getAttribute('data-action')).toBe('back');
    expect(resume?.querySelector('.kit-glyph')).not.toBeNull();
    // Paused: Esc presses Resume (bound to back).
    expect(key('Escape')).toBe(true);
    expect(g.hook.screen()).toBe('play');
  });
});
