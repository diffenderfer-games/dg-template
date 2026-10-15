// KIT suites: saves (every game with a profile), Continue (resumable games) and the daily (daily games).
import assert from 'node:assert/strict';
import { e2e, env, game, ready, SLUG, today, waitScreen, type Player } from '../_kit.ts';

const e = env();

/** Play a normal game to the end with `coins` collected. */
async function finishWith(p: Player, coins: number): Promise<void> {
  await game.newGame(p);
  await waitScreen(p, 'play');
  await p.page.evaluate((n) => window.__game?.extra?.addCoins?.(n), coins);
  await p.page.evaluate(() => window.__game?.loseNow?.());
  await waitScreen(p, 'result');
}

e2e('save: progress survives a reload and reaches another device of the same account', e, async (t) => {
  const a = await t.newPlayer(undefined, `/${SLUG}/`);
  await ready(a);
  await finishWith(a, 7);
  await a.page.waitForFunction(() => document.querySelector('[data-testid="result-best"]')?.textContent === 'Best 7');
  await new Promise((r) => setTimeout(r, 1500)); // the profile push is debounced (1 s)
  await a.page.reload();
  await ready(a);
  await a.page.waitForFunction(() => document.querySelector('[data-testid="title-best"]')?.textContent === 'Best 7', {
    timeout: 10_000,
  });
  const tab = await a.newTab(`/${SLUG}/`);
  await ready(tab);
  await tab.page.waitForFunction(() => document.querySelector('[data-testid="title-best"]')?.textContent === 'Best 7', {
    timeout: 10_000,
  });
});

e2e('resume: a game in progress comes back after a reload with ?hub_resume=1 (Continue)', e, async (t) => {
  const a = await t.newPlayer(undefined, `/${SLUG}/`);
  await ready(a);
  await game.newGame(a);
  await waitScreen(a, 'play');
  await a.page.evaluate(() => window.__game?.extra?.addCoins?.(4));
  await game.pause(a); // pausing saves and flushes
  await new Promise((r) => setTimeout(r, 1000));
  await a.goto(`/${SLUG}/?hub_resume=1`);
  await ready(a);
  await waitScreen(a, 'play', 20_000);
  const snap = await game.snap(a);
  assert.equal(snap.score, 4);
  // Win → the saved game is gone: the title has no Continue row.
  await a.page.evaluate(() => window.__game?.loseNow?.());
  await waitScreen(a, 'result');
  await game.toTitle(a);
  await waitScreen(a, 'title');
  assert.equal(await a.page.$('[data-testid="continue"]'), null);
});

e2e('daily: ?daily=today starts the day; a win completes it once; quitting a day cancels it', e, async (t) => {
  const a = await t.newPlayer(undefined, `/${SLUG}/?daily=${today()}`);
  await ready(a);
  await a.page.evaluate(() => {
    const w = window;
    Reflect.set(w, '__dailyEvents', []);
    for (const ev of ['hub:daily-started', 'hub:daily-complete', 'hub:daily-queued', 'hub:daily-error']) {
      w.addEventListener(ev, () => {
        const list: unknown = Reflect.get(w, '__dailyEvents');
        if (Array.isArray(list)) list.push(ev);
      });
    }
  });
  await a.page.waitForFunction(() => window.__game?.mode() === 'daily', { timeout: 20_000 });
  await game.solveNow(a);
  await waitScreen(a, 'result');
  await a.page.waitForFunction(
    () => {
      const list: unknown = Reflect.get(window, '__dailyEvents');
      return Array.isArray(list) && list.includes('hub:daily-complete');
    },
    { timeout: 10_000 },
  );
  // The day is marked done on the hub.
  const done = await a.page.evaluate(async (day) => {
    const r = await fetch(`/_api/games/${location.pathname.split('/')[1] ?? ''}/daily`);
    const body: unknown = await r.json();
    const completions: unknown = Reflect.get(Object(body), 'completions');
    return typeof completions === 'object' && completions !== null && day in completions;
  }, today());
  assert.equal(done, true);
  // Play the day again and quit mid-day: the daily is left, and a normal game saves for Continue again.
  await game.toTitle(a);
  await a.tid('daily');
  await a.page.waitForFunction(() => window.__game?.mode() === 'daily', { timeout: 20_000 });
  await game.toTitle(a);
  await waitScreen(a, 'title');
  assert.equal(await game.mode(a), null);
  await game.newGame(a);
  await waitScreen(a, 'play');
  await game.pause(a);
  await new Promise((r) => setTimeout(r, 800));
  await game.toTitle(a);
  await a.page.waitForSelector('[data-testid="continue"]', { timeout: 10_000 });
});
