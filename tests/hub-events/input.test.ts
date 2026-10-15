// Appendix B rows 9–10: the input system's events.
import { describe, expect, it } from 'vitest';
import { openModal } from '../../src/kit/ui/modal.ts';
import { bootGame } from './_support/harness.ts';

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

  it('the pause input (Escape / Start) pauses play', async () => {
    const g = await bootGame();
    await g.start();
    g.fake.input.tap('pause');
    await g.frames(2);
    expect(g.hook.screen()).toBe('pause');
  });
});
