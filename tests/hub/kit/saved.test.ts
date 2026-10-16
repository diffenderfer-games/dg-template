// KIT suite (daily games): saved games on a real hub. A day in progress shows on the title as "Daily
// challenge · Oct 14", picks up where the player left it, and a win any time later credits that day.
import assert from 'node:assert/strict';
import { field, strField } from '../../../src/kit/core/json.ts';
import { shortDay } from '../../../src/kit/core/strings.ts';
import { api, e2e, env, game, ready, SLUG, today, unlessDeclared, until, waitScreen, type Player } from '../_kit.ts';

const e = env();

/** The player's days in progress on the hub: day → progress label. */
async function daysInProgress(p: Player): Promise<Record<string, string>> {
  const games = field((await api(p).get('/saved?kinds=daily')).body, 'games');
  const out: Record<string, string> = {};
  for (const g of Array.isArray(games) ? games : [])
    out[strField(field(g, 'daily'), 'day')] = strField(field(g, 'progress'), 'label');
  return out;
}

/** The days the hub has credited this game. */
async function credited(p: Player): Promise<string[]> {
  const completions = field((await api(p).get(`/games/${SLUG}/daily`)).body, 'completions');
  return typeof completions === 'object' && completions !== null ? Object.keys(completions) : [];
}

const inDaily = (p: Player): Promise<void> =>
  p.page.waitForFunction(() => window.__game?.mode() === 'daily', { timeout: 20_000 }).then(() => undefined);

e2e(
  "saved: leave yesterday's daily mid-game → the title's Continue row → back where it was → a win credits yesterday",
  e,
  async (t) => {
    const yesterday = today(-1);
    const a = await t.newPlayer(undefined, `/${SLUG}/?daily=${yesterday}`);
    await ready(a);
    await inDaily(a);
    await game.addScore(a, 3);
    await game.toTitle(a); // saves the day, then pauses it
    await waitScreen(a, 'title');
    await until(
      async () => ((await daysInProgress(a))[yesterday] ?? '') !== '' || null, // with the game's own label
      "yesterday's day saved",
    );
    assert.deepEqual(await credited(a), []);

    await a.goto(`/${SLUG}/`); // not a reload: the ?daily= link would start the day again
    await ready(a);
    await waitScreen(a, 'title');
    await a.click('[data-testid^="continue"]', `Daily challenge · ${shortDay(yesterday)}`);
    await inDaily(a);
    assert.equal((await game.snap(a)).score, 3, 'the day came back where the player left it');
    await game.solveNow(a);
    await waitScreen(a, 'result');
    await until(async () => (await credited(a)).includes(yesterday) || null, "yesterday's credit");
    assert.deepEqual(await daysInProgress(a), {});
  },
  { skip: unlessDeclared('dailyChallenges', 'the daily') },
);

e2e(
  'saved: a day opened from Your games (?hub_open=…&hub_kind=daily) goes straight into that day',
  e,
  async (t) => {
    const a = await t.newPlayer(undefined, `/${SLUG}/`);
    await ready(a);
    const day = today(-2);
    const started = await api(a).post(`/games/${SLUG}/daily/${day}/start`);
    assert.equal(started.status, 200);
    const id = strField(started.body, 'instanceId');
    assert.match(id, /^sg_/);
    await a.goto(`/${SLUG}/?hub_open=${id}&hub_kind=daily`);
    await ready(a);
    await inDaily(a);
    await game.toTitle(a);
    await waitScreen(a, 'title');
    assert.ok(Object.keys(await daysInProgress(a)).includes(day), 'leaving pauses the day: it stays in progress');
  },
  { skip: unlessDeclared('dailyChallenges', 'the daily') },
);
