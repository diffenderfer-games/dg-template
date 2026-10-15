// KIT suite: the FakeHub behaves like the real hub for the same steps (overlay, daily), §4.22 "Keeping it honest".
import assert from 'node:assert/strict';
import { createFakeHub, type CallLog } from '../../../src/kit/testing/index.ts';
import { e2e, env, game, openMenu, overlayLog, ready, SLUG, today, waitScreen } from '../_kit.ts';

const e = env();

e2e('overlay: nested hub UI gives the same open/close log on the real hub and on FakeHub', e, async (t) => {
  const a = await t.newPlayer(undefined, `/${SLUG}/`);
  await ready(a);
  await game.newGame(a);
  await waitScreen(a, 'play');
  await openMenu(a);
  await a.closeMenu();
  await a.page.waitForFunction(() => window.__game?.screen() === 'pause');
  const real = (await overlayLog(a)).map((x) => [x.ev, x.reason, x.canPause]);

  const fake = createFakeHub({ events: new EventTarget() });
  fake.overlay.autoPause({ pause: () => undefined });
  fake.openOverlay('menu')();
  const log: CallLog = fake.log;
  const faked = log.calls
    .filter((c) => c.name.startsWith('overlay.') && c.name !== 'overlay.autoPause')
    .map((c): unknown[] => {
      const ev: unknown = c.args[0];
      return [c.name.replace('overlay.', ''), Reflect.get(Object(ev), 'reason'), Reflect.get(Object(ev), 'canPause')];
    });
  assert.deepEqual(real, faked);
});

e2e('daily: the same window events in the same order (started, then complete)', e, async (t) => {
  const a = await t.newPlayer(undefined, `/${SLUG}/?daily=${today()}`);
  await a.page.evaluate(() => {
    Reflect.set(window, '__ev', []);
    for (const ev of ['hub:daily-started', 'hub:daily-complete', 'hub:daily-queued']) {
      addEventListener(ev, () => {
        const list: unknown = Reflect.get(window, '__ev');
        if (Array.isArray(list)) list.push(ev);
      });
    }
  });
  await ready(a);
  await a.page.waitForFunction(() => window.__game?.mode() === 'daily', { timeout: 20_000 });
  await game.solveNow(a);
  await a.page.waitForFunction(() => {
    const list: unknown = Reflect.get(window, '__ev');
    return Array.isArray(list) && list.includes('hub:daily-complete');
  });
  const real: unknown = await a.page.evaluate((): unknown => Reflect.get(window, '__ev'));

  const target = new EventTarget();
  const faked: string[] = [];
  for (const ev of ['hub:daily-started', 'hub:daily-complete', 'hub:daily-queued'])
    target.addEventListener(ev, () => faked.push(ev));
  const fake = createFakeHub({ events: target });
  fake.daily.define({ play: () => undefined });
  await fake.daily.start(today());
  await fake.daily.complete({ score: 1 });
  // The real page may have missed `started` (it can fire before the listener); compare from `complete`.
  assert.ok(Array.isArray(real));
  assert.deepEqual(real.slice(real.indexOf('hub:daily-complete')), faked.slice(faked.indexOf('hub:daily-complete')));
  assert.deepEqual(faked, ['hub:daily-started', 'hub:daily-complete']);
});
