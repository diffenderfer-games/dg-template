// Appendix B rows 1–8: hub UI over the game (overlay, intro, menu button).
import { describe, expect, it } from 'vitest';
import { bootGame } from './_support/harness.ts';

describe('hub UI over the game (multiplayer.md §4)', () => {
  it('row 1: opening hub UI pauses the game once, with the play group held by the hub', async () => {
    const g = await bootGame();
    await g.start();
    await g.frames(3);
    expect(g.fake.input.isEnabled('play')).toBe(true);
    g.fake.openOverlay('menu');
    await g.frames(1);
    expect(g.hook.paused()).toBe(true);
    expect(g.hook.screen()).toBe('pause');
    expect(g.calls.count('screen.pause')).toBe(1);
    expect(g.fake.input.isEnabled('play')).toBe(false);
  });

  it('row 2: an action game stays paused when hub UI closes; a turn-based one resumes only if the hub paused it', async () => {
    const action = await bootGame({ patch: { resumeOnClose: false } });
    await action.start();
    action.fake.openOverlay('menu')();
    await action.frames(1);
    expect(action.hook.screen()).toBe('pause');

    const calm = await bootGame({ patch: { resumeOnClose: true } });
    await calm.start();
    calm.fake.openOverlay('menu')();
    await calm.frames(1);
    expect(calm.hook.screen()).toBe('play');
    calm.hook.pause?.();
    calm.fake.openOverlay('chat')();
    expect(calm.hook.screen()).toBe('pause');
  });

  it('row 3: nested hub UI (menu → chat → close → close) is one pause and one resume', async () => {
    const g = await bootGame({ patch: { resumeOnClose: true } });
    await g.start();
    const menu = g.fake.openOverlay('menu');
    const chat = g.fake.openOverlay('chat');
    chat();
    expect(g.hook.paused()).toBe(true);
    menu();
    expect(g.hook.paused()).toBe(false);
    expect(g.calls.count('screen.pause')).toBe(1);
  });

  it('row 4: autoPause registered while hub UI is already open pauses at once', async () => {
    const g = await bootGame();
    await g.start();
    await g.frames(1);
    // The kit registers autoPause at boot; a game already playing when UI opens pauses straight away.
    g.fake.openOverlay('invite');
    expect(g.hook.paused()).toBe(true);
    expect(g.fake.log.count('overlay.autoPause')).toBe(1);
  });

  it('row 5: no pause while busy (canPause false) or on a menu', async () => {
    const g = await bootGame();
    g.fake.openOverlay('menu')();
    expect(g.hook.paused()).toBe(false); // on the title: nothing to pause
    await g.start();
    g.fake.mp.setBusy(true);
    g.fake.openOverlay('menu');
    expect(g.hook.paused()).toBe(false);
    expect(g.hook.screen()).toBe('play');
  });

  it('row 6: every reason pauses the same, except the on-screen keyboard (typing in the game)', async () => {
    for (const reason of ['menu', 'chat', 'dialog', 'invite', 'notify'] as const) {
      const g = await bootGame();
      await g.start();
      g.fake.openOverlay(reason);
      expect(g.hook.paused(), reason).toBe(true);
    }
    const k = await bootGame();
    await k.start();
    k.fake.openOverlay('keyboard');
    expect(k.hook.paused()).toBe(false);
  });

  it('row 7: the intro (overlay menu at load) never starts play under it and never double-pauses', async () => {
    const g = await bootGame({ before: (fake) => void fake.openOverlay('menu') });
    expect(g.hook.screen()).toBe('title');
    expect(g.hook.paused()).toBe(false);
    expect(g.calls.count('screen.pause')).toBe(0);
  });

  it('row 8: the menu button hides during play, shows when paused, and the kit re-asserts it after another bundle hides it', async () => {
    const g = await bootGame();
    expect(g.fake.menu.visible).toBe(true);
    await g.start();
    expect(g.fake.menu.visible).toBe(false);
    g.hook.pause?.();
    expect(g.fake.menu.visible).toBe(true);
    g.fake.menu.visible = false;
    g.fake.menuVisible(false);
    expect(g.fake.menu.visible).toBe(true);
  });
});
