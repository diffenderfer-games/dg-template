// Appendix B rows 9–10: the input system's events.
import { describe, expect, it } from 'vitest';
import { openModal } from '../../src/kit/ui/modal.ts';
import { bootGame } from './_support/harness.ts';

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
    const g = await bootGame();
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
});
