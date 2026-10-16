// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from '../../../src/kit/core/index.ts';
import { createSettings } from '../../../src/kit/save/settings.ts';
import { kitSettingsDefaults, settingsSheet } from '../../../src/kit/settings-ui/index.ts';
import { fakeClock, fakeStorage } from '../../../src/kit/testing/index.ts';
import {
  banner,
  button,
  closeTopModal,
  confetti,
  confirm,
  countUp,
  h,
  mountUi,
  openModal,
  Screens,
  segmented,
  toast,
  toggleRow,
  ui,
} from '../../../src/kit/ui/index.ts';

const clock = fakeClock(0);
beforeEach(() => {
  document.body.replaceChildren();
  while (closeTopModal());
  mountUi(undefined, clock);
});

describe("the kit's CSS", () => {
  it("goes first in <head>, so the game's theme.css wins every tie", () => {
    document.getElementById('kit-css')?.remove();
    const theme = document.head.appendChild(document.createElement('style'));
    mountUi(undefined, clock);
    expect(document.head.firstElementChild?.id).toBe('kit-css');
    expect(theme.previousElementSibling).not.toBeNull();
    theme.remove();
  });
});

describe('h(): text only, never HTML', () => {
  it('escapes text (player names, chat) and sets attributes, classes, styles and handlers', () => {
    const onclick = vi.fn();
    const el = h(
      'button.a.b',
      { 'data-x': 1, disabled: true, onclick, style: { color: 'red' } },
      '<img src=x onerror=alert(1)>',
    );
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(el.className).toBe('a b');
    expect(el.getAttribute('data-x')).toBe('1');
    expect(el.style.color).toBe('red');
    el.removeAttribute('disabled');
    el.click();
    expect(onclick).toHaveBeenCalled();
  });
});

describe('screens, modals, toasts', () => {
  it('Screens.show swaps the screen, tags the root and reports presence only when it changes', () => {
    const presence = vi.fn();
    const s = new Screens(presence);
    s.show('title', () => h('div', {}, 'T'));
    s.show('title', () => h('div', {}, 'T2'));
    s.show('play', () => h('div'));
    expect(ui().root.dataset.screen).toBe('play');
    expect(ui().root.querySelectorAll('.kit-screen')).toHaveLength(1);
    expect(presence.mock.calls).toEqual([[{ kind: 'menu' }], [{ kind: 'playing' }]]);
  });

  it('a locked modal ignores back and Esc; buttons close it and run onClose once', () => {
    const onClose = vi.fn();
    const m = openModal({ title: 'Choose', locked: true, buttons: [{ label: 'OK', testid: 'ok' }], onClose });
    expect(closeTopModal()).toBe(false);
    m.el.querySelector<HTMLElement>('[data-testid="ok"]')?.click();
    m.close();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(m.el.isConnected).toBe(false);
  });

  it('confirm resolves with the answer', async () => {
    const p = confirm({ title: 'Leave?', yes: 'Leave', no: 'Stay' });
    document.querySelector<HTMLElement>('[data-testid="confirm-yes"]')?.click();
    expect(await p).toBe(true);
  });

  it('toast actions fire and dismiss; toasts time out', () => {
    const act = vi.fn();
    toast('Found your saved game', { actions: [{ label: 'Continue', onClick: act, testid: 'go' }] });
    document.querySelector<HTMLElement>('[data-testid="go"]')?.click();
    expect(act).toHaveBeenCalled();
    expect(document.querySelectorAll('[data-testid="toast"]')).toHaveLength(0);
    toast('hi');
    clock.advance(3000);
    expect(document.querySelectorAll('[data-testid="toast"]')).toHaveLength(0);
  });

  it('the same message again replaces the one showing', () => {
    toast('Some progress could not be saved.');
    toast('Some progress could not be saved.');
    toast('Another');
    expect(document.querySelectorAll('[data-testid="toast"]')).toHaveLength(2);
    clock.advance(3000);
  });

  it('controls are navigable and named', () => {
    expect(button('Play now', () => undefined).dataset.testid).toBe('play-now');
    const picks: number[] = [];
    const seg = segmented(
      [
        { value: 1, label: 'Easy' },
        { value: 2, label: 'Hard' },
      ],
      1,
      (v) => picks.push(v),
      'level',
    );
    seg.querySelector<HTMLElement>('[data-testid="level-2"]')?.click();
    expect(picks).toEqual([2]);
    expect(seg.querySelector('[aria-checked="true"]')?.textContent).toBe('Hard');
    const changes: boolean[] = [];
    toggleRow('Sound', true, (on) => changes.push(on))
      .querySelector('button')
      ?.click();
    expect(changes).toEqual([false]);
  });
});

describe('juice respects reduced motion', () => {
  it('countUp is instant and confetti is skipped with reduced motion', () => {
    ui().reducedMotion = true;
    const el = h('span');
    countUp(el, 0, 42);
    expect(el.textContent).toBe('42');
    confetti();
    expect(document.querySelector('.kit-confetti')).toBeNull();
    banner('Level 2!');
    expect(document.querySelector('.kit-banner')?.getAttribute('data-still')).toBe('true');
    ui().reducedMotion = false;
    confetti();
    expect(document.querySelector('.kit-confetti')).not.toBeNull();
  });
});

describe('settings sheet', () => {
  it('toggles persist and reduced motion turns the juice off', () => {
    const kv = fakeStorage();
    const settings = createSettings(
      { key: 'g:settings', version: 1, defaults: kitSettingsDefaults },
      createStore(() => kv),
    );
    const sheet = settingsSheet({ settings, rows: () => [h('div', { 'data-testid': 'game-row' })] });
    sheet.el.querySelector<HTMLElement>('[data-testid="setting-music"]')?.click();
    sheet.el.querySelector<HTMLElement>('[data-testid="setting-reduced-motion"]')?.click();
    expect(settings.data.music).toBe(false);
    expect(ui().reducedMotion).toBe(true);
    expect(sheet.el.querySelector('[data-testid="game-row"]')).not.toBeNull();
    expect(
      createSettings(
        { key: 'g:settings', version: 1, defaults: kitSettingsDefaults },
        createStore(() => kv),
      ).data.music,
    ).toBe(false);
    expect([...sheet.el.querySelectorAll('[data-nav]')].length).toBeGreaterThan(5);
  });
});
