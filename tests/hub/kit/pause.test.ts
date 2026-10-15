// KIT suite (every game): pausing when the hub opens (multiplayer.md §4, §12 scenario 5).
import assert from 'node:assert/strict';
import { e2e, env, game, openMenu, overlayLog, ready, SLUG, waitScreen } from '../_kit.ts';

const e = env();

e2e('opening the hub menu pauses the game; closing it leaves the pause screen (action game)', e, async (t) => {
  const a = await t.newPlayer(undefined, `/${SLUG}/`);
  await ready(a);
  await waitScreen(a, 'title');
  await game.newGame(a);
  await waitScreen(a, 'play');
  await openMenu(a);
  await a.page.waitForFunction(() => window.__game?.paused() === true);
  const log = await overlayLog(a);
  assert.ok(
    log.some((x) => x.ev === 'open' && x.reason === 'menu' && x.canPause),
    JSON.stringify(log),
  );
  assert.equal(await game.screen(a), 'pause');
  await a.closeMenu();
  await waitScreen(a, 'pause');
  assert.equal(await game.paused(a), true);
});

e2e('the menu button hides during play and shows on the pause screen', e, async (t) => {
  const a = await t.newPlayer(undefined, `/${SLUG}/`);
  await ready(a);
  await game.newGame(a);
  await waitScreen(a, 'play');
  await a.page.waitForFunction(() => window.__HUB_MENU_VISIBLE__ === false);
  await game.pause(a);
  await a.page.waitForFunction(() => window.__HUB_MENU_VISIBLE__ !== false);
});
