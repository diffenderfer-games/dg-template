/**
 * This game's own screenshot scenarios, on top of the kit's (docs/kit/screenshots.md). (GAME: yours to edit.)
 *
 * Each scenario gets to a scene through `window.__game` drivers and the hub's
 * UI; the runner shoots it at phone and desktop sizes into the contact sheet.
 */
import type { Scenario } from './kit/shots/types.ts';

/** TODO(game): the screens worth checking after every change (a level select, a boss, the shop…). */
export const scenarios: Scenario[] = [
  {
    name: 'many-coins',
    target: 'static',
    checks: 'the HUD with a two-digit score',
    run: async (c) => {
      await c.open();
      await c.drive('newGame');
      await c.drive('extra.addCoins', 42);
      await c.wait(300);
    },
  },
  // new-game:turns:start
  {
    name: 'turns',
    target: 'hub',
    checks: 'an online game over days with the computer: whose move it is, the seats, the pile, the takes, chat',
    run: async (c) => {
      await c.open();
      await c.press('turns-new');
      await c.press('turns-computer');
      await c.screen('turns');
      await c.page.waitForSelector('[data-testid="take-1"]:not([disabled])', { timeout: 15_000 });
      await c.press('take-2');
      await c.page.waitForSelector('[data-testid="take-1"]:not([disabled])', { timeout: 15_000 });
      await c.wait(300);
    },
  },
  // new-game:turns:end
];

/** Kit scenarios this game doesn't need (e.g. 'race-hud' for a game without races). */
export const exclude: string[] = [];
