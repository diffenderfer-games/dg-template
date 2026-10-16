/**
 * scripts/kit/shots: the premade scenarios every game gets (docs/plans/template-kit.md §7.2).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md § "Scenarios"
 *
 * Games add their own in scripts/shots.config.ts. Scenarios drive the game
 * through `window.__game` (the runner pre-defines `__HUB_TEST__`, so drivers
 * exist) and the hub through its own UI and URL params.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { waitsOn } from '../../../src/kit/testing/phases.ts';
import { ROOT } from '../lib/paths.ts';
import type { Scenario, ShotContext } from './types.ts';

const L = '#hub-social-layer >>> ';

/**
 * How long a screen's entrance takes to settle (cards that pop in, buttons that slide in 60 ms
 * apart, the title's panel after its wordmark: docs/kit/look.md). Scenarios that open a screen
 * wait this long, so the title, pause and result shots show them settled, never half-drawn.
 */
const SETTLE_MS = 1400;

/** This game's `game` block (package.json). */
const BLOCK: unknown = Reflect.get(Object(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))), 'game');

/** Skip a scenario for a feature the game doesn't have: `game.<key>` unset, or the file missing. */
function needs(key: string): { skip?: string } {
  if (key.startsWith('src/')) return existsSync(join(ROOT, key)) ? {} : { skip: `this game has no ${key}` };
  const v: unknown = typeof BLOCK === 'object' && BLOCK !== null ? Reflect.get(BLOCK, key) : undefined;
  return v === undefined || v === null || v === false ? { skip: `this game declares no game.${key}` } : {};
}
/** The title's bust: with src/game/avatar.ts, unless it says `titleDemo: false` (docs/kit/avatar.md). */
function needsBust(): { skip?: string } {
  const own = needs('src/game/avatar.ts');
  if (own.skip !== undefined) return own;
  const text = readFileSync(join(ROOT, 'src', 'game', 'avatar.ts'), 'utf8');
  return /\btitleDemo\s*:\s*false\b/.test(text)
    ? { skip: 'this game hides the title bust (avatar.titleDemo: false)' }
    : {};
}
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
    run: async (c) => {
      await c.open();
      await c.wait(SETTLE_MS);
    },
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
      await c.wait(SETTLE_MS);
    },
  },
  {
    name: 'settings',
    target: 'static',
    checks: 'the settings sheet with the game’s rows',
    run: async (c) => {
      await c.open();
      await c.press('settings');
      await c.wait(SETTLE_MS);
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
      await c.wait(SETTLE_MS);
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
      await c.wait(SETTLE_MS);
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
    ...needs('dailyChallenges'),
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
    ...needs('dailyChallenges'),
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
    ...needs('resumable'),
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
    ...needs('multiplayer'),
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
    ...needs('multiplayer'),
    target: 'hub',
    checks: 'the lobby: names with faces, Invite, the bell, chat',
    run: async (c) => {
      const b = await c.player();
      await c.open();
      await c.press('online');
      await c.screen('lobby');
      await c.wait(SETTLE_MS);
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
    ...needs('race'),
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
    ...needs('race'),
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
    ...needsBust(),
    target: 'hub',
    checks: 'your avatar’s bust under the title’s buttons with Edit avatar, covering nothing',
    run: async (c) => {
      await c.open();
      await c.screen('title');
      await bustDrawn(c);
      await c.wait(400);
    },
  },
  {
    name: 'avatar-designer',
    ...needsBust(),
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
    ...needs('dailyChallenges'),
    target: 'hub',
    checks:
      'the title lists every saved game: Continue (the saved game) and Daily challenge · <yesterday> (a day in progress)',
    run: async (c) => {
      await c.open(`?daily=${today(-1)}`);
      await c.page.waitForFunction(() => document.querySelector('[data-screen="play"]') !== null, { timeout: 20_000 });
      await c.drive('addScore', 3);
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
