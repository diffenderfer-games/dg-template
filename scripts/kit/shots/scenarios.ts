/**
 * scripts/kit/shots: the premade scenarios every game gets (docs/plans/template-kit.md §7.2).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md § "Scenarios"
 *
 * Games add their own in scripts/shots.config.ts. Scenarios drive the game
 * through `window.__game` (the runner pre-defines `__HUB_TEST__`, so drivers
 * exist) and the hub through its own UI and URL params.
 */
import { waitsOn } from '../../../src/kit/testing/phases.ts';
import type { Scenario, ShotContext } from './types.ts';

const L = '#hub-social-layer >>> ';
const today = (offset = 0): string => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** Wait until the hub's renderer has drawn the title's bust (`<dg-avatar>` upgraded, with its drawing). */
const bustDrawn = (c: ShotContext): Promise<unknown> =>
  c.page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="avatar-demo"] dg-avatar');
      return el !== null && 'animator' in el && el.childElementCount > 0;
    },
    { timeout: 15_000 },
  );

export const KIT_SCENARIOS: Scenario[] = [
  {
    name: 'title',
    target: 'static',
    checks: 'the title, Continue rows, room for the menu button',
    run: (c) => c.open(),
  },
  {
    name: 'menu',
    target: 'static',
    checks: 'the focus ring on the first menu button (keyboard / gamepad)',
    run: async (c) => {
      await c.open();
      await c.page.keyboard.press('Tab');
      await c.page.evaluate(() => document.documentElement.setAttribute('data-hub-input', 'keys'));
      await c.page.focus('[data-testid="play"]');
    },
  },
  {
    name: 'howto',
    target: 'static',
    checks: 'the how-to-play sheet',
    run: async (c) => {
      await c.open();
      await c.press('howto');
    },
  },
  {
    name: 'settings',
    target: 'static',
    checks: 'the settings sheet with the game’s rows',
    run: async (c) => {
      await c.open();
      await c.press('settings');
    },
  },
  {
    name: 'play',
    target: 'static',
    checks: 'gameplay, the HUD clear of the menu button and the safe area',
    run: async (c) => {
      await c.open();
      await c.drive('newGame');
      await c.drive('autoplay', true);
      await c.wait(2000);
    },
  },
  {
    name: 'pause',
    target: 'static',
    checks: 'the pause screen, with the hub menu button shown',
    run: async (c) => {
      await c.open();
      await c.drive('newGame');
      await c.wait(300);
      await c.drive('pause');
      await c.screen('pause');
    },
  },
  {
    name: 'gameover',
    target: 'static',
    checks: 'the result screen',
    run: async (c) => {
      await c.open();
      await c.drive('newGame');
      await c.drive('autoplay', true);
      await c.wait(1500);
      await c.drive('loseNow');
      await c.screen('result');
      await c.wait(700);
    },
  },
  {
    name: 'toast',
    target: 'static',
    checks: 'a toast with actions, placed clear of the touch controls on a phone',
    run: async (c) => {
      await c.open();
      await c.drive('newGame');
      await c.drive('toast', 'Found your saved game');
      await c.wait(300);
    },
  },
  {
    name: 'offline',
    target: 'static',
    checks: 'the game keeps working offline, with no errors',
    run: async (c) => {
      await c.open();
      await c.page.setOfflineMode(true);
      await c.drive('newGame');
      await c.wait(800);
      await c.page.setOfflineMode(false);
    },
  },
  {
    name: 'intro',
    target: 'hub',
    checks: 'the hub intro over the loading game (localhost only)',
    run: async (c) => {
      await c.page.goto(`${c.base}?hub_intro=spin`, { waitUntil: 'domcontentloaded' });
      await c.wait(600);
    },
  },
  {
    name: 'hub-menu',
    target: 'hub',
    checks: 'the game paused under the open hub menu',
    run: async (c) => {
      await c.open();
      await c.drive('newGame');
      await c.wait(300);
      await c.page.evaluate(() => {
        const peek = document.querySelector('#hub-menu-root')?.shadowRoot?.querySelector<HTMLElement>('.peek');
        peek?.click();
      });
      await c.wait(200);
      await c.page.evaluate(() =>
        document.querySelector('#hub-menu-root')?.shadowRoot?.querySelector<HTMLElement>('.toggle')?.click(),
      );
      await c.screen('pause');
      await c.wait(500);
    },
  },
  {
    name: 'daily-start',
    target: 'hub',
    checks: 'today’s daily, started from its deep link',
    run: async (c) => {
      await c.open(`?daily=${today()}`);
      await c.page.waitForFunction(
        () => Reflect.get(window, '__game') !== undefined && document.querySelector('[data-screen="play"]') !== null,
        { timeout: 20_000 },
      );
      await c.wait(500);
    },
  },
  {
    name: 'daily-done',
    target: 'hub',
    checks: 'the win screen and the menu button’s calendar turned green',
    run: async (c) => {
      await c.open(`?daily=${today()}`);
      await c.page.waitForFunction(() => document.querySelector('[data-screen="play"]') !== null, { timeout: 20_000 });
      await c.drive('solveNow');
      await c.screen('result');
      await c.wait(1500);
    },
  },
  {
    name: 'continue',
    target: 'hub',
    checks: 'the title’s Continue row after a reload',
    run: async (c) => {
      await c.open();
      await c.drive('newGame');
      await c.wait(800);
      await c.drive('pause');
      await c.wait(1000);
      await c.open();
      await c.page.waitForSelector('[data-testid="continue"]', { timeout: 10_000 });
    },
  },
  {
    name: 'invite',
    target: 'hub',
    checks: 'an invite toast over the game',
    run: async (c) => {
      const a = await c.me();
      const b = await c.player();
      await c.befriend(a, b);
      await c.open();
      await c.open('', b.page);
      await c.press('online', b.page);
      await c.screen('lobby', b.page);
      await c.press('lobby-invite', b.page);
      await c.hubClick(`${L}.so-dialog .so-row button`, 'Invite', b.page);
      await c.hubFind(`${L}.so-toast`, 'invited you');
    },
  },
  {
    name: 'lobby',
    target: 'hub',
    checks: 'the lobby: names with faces, Invite, the bell, chat',
    run: async (c) => {
      const b = await c.player();
      await c.open();
      await c.press('online');
      await c.screen('lobby');
      const code = await c.page.evaluate(() => document.querySelector('[data-testid="room-code"]')?.textContent ?? '');
      await c.open('', b.page);
      await b.page.evaluate((code) => {
        const g: unknown = Reflect.get(window, '__game');
        const online: unknown = g ? Reflect.get(Object(g), 'online') : undefined;
        const join: unknown = online ? Reflect.get(Object(online), 'join') : undefined;
        if (typeof join === 'function') Reflect.apply(join, online, [code]);
      }, code);
      await c.page.waitForFunction(() => document.querySelectorAll('.kit-seat').length === 2, { timeout: 15_000 });
    },
  },
  {
    name: 'race-hud',
    target: 'hub',
    checks: 'the race HUD clear of the game’s HUD',
    run: async (c) => {
      const b = await c.player();
      await c.open();
      await c.open('', b.page);
      await c.press('race');
      await c.hubFind(`${L}.so-dialog .so-rcode b`);
      await c.press('race-browse', b.page);
      await c.hubClick(`${L}.so-dialog .so-row button`, 'Join', b.page);
      await c.hubFind(`${L}.so-hud .so-hudrow`);
      await c.wait(1500);
    },
  },
  {
    name: 'race-result',
    target: 'hub',
    checks: 'the hub’s race result card',
    run: async (c) => {
      const b = await c.player();
      await c.open();
      await c.open('', b.page);
      await c.press('race');
      await c.hubFind(`${L}.so-dialog .so-rcode b`);
      await c.press('race-browse', b.page);
      await c.hubClick(`${L}.so-dialog .so-row button`, 'Join', b.page);
      await c.hubFind(`${L}.so-hud .so-hudrow`);
      await c.wait(1500);
      await c.drive('solveNow');
      await c.hubFind(`${L}.so-dialog .so-dtitle`, 'You won');
    },
  },
  {
    name: 'cover',
    target: 'static',
    checks: 'the catalog tile (npm run cover copies it to cover.png)',
    run: async (c) => {
      await c.open();
      await c.drive('newGame');
      await c.drive('autoplay', true);
      await c.wait(2500);
      await c.page.evaluate(() => document.documentElement.classList.add('kit-cover'));
    },
  },
  {
    name: 'avatar',
    target: 'hub',
    checks: 'your avatar’s bust on the title (bottom-left) with Edit avatar, clear of the menu and the buttons',
    run: async (c) => {
      await c.open();
      await c.screen('title');
      await bustDrawn(c);
      await c.wait(400);
    },
  },
  {
    name: 'avatar-designer',
    target: 'hub',
    checks: 'Edit avatar opens the hub’s designer over the game',
    run: async (c) => {
      await c.open();
      await c.screen('title');
      await bustDrawn(c);
      await c.press('avatar-edit');
      await c.hubFind(`${L}.so-design`);
      await c.wait(600);
    },
  },
  {
    name: 'table-launch',
    target: 'hub',
    checks: 'a lobby opened from a world table',
    skip: waitsOn('worldW2'),
    run: (c) => c.open(),
  },
  {
    name: 'your-games',
    target: 'hub',
    checks:
      'the title lists every saved game: Continue (the saved game) and Daily challenge · <yesterday> (a day in progress)',
    run: async (c) => {
      await c.open(`?daily=${today(-1)}`);
      await c.page.waitForFunction(() => document.querySelector('[data-screen="play"]') !== null, { timeout: 20_000 });
      await c.drive('extra.addCoins', 3);
      await c.drive('toTitle'); // saves the day, then pauses it: it stays in progress
      await c.screen('title');
      await c.drive('newGame');
      await c.wait(800);
      await c.drive('pause'); // saves the normal game
      await c.wait(1500);
      await c.open();
      await c.page.waitForFunction(() => document.querySelectorAll('[data-testid^="continue"]').length >= 2, {
        timeout: 15_000,
      });
    },
  },
];
