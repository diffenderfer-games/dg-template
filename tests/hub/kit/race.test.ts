// KIT suite (race games): two players race the same game (multiplayer.md §14.5).
import assert from 'node:assert/strict';
import { e2e, env, game, L, ready, SLUG, waitScreen, type Player } from '../_kit.ts';

const e = env({ env: { HUB_LIMITS_JSON: JSON.stringify({ raceCountdownMs: 1200 }) } });

const mode = (p: Player): Promise<void> =>
  p.page.waitForFunction(() => window.__game?.mode() === 'race', { timeout: 20_000 }).then(() => undefined);

e2e(
  'race: create → Open races → join → same game from the same seed → live HUD → finish → result → done',
  e,
  async (t) => {
    const alice = await t.newPlayer(undefined, `/${SLUG}/`);
    const bob = await t.newPlayer(undefined, `/${SLUG}/`);
    await Promise.all([ready(alice), ready(bob)]);
    await alice.tid('race');
    await alice.find(`${L}.so-dialog .so-rcode b`);
    await bob.tid('race-browse');
    await bob.click(`${L}.so-dialog .so-row button`, 'Join');
    await Promise.all([mode(alice), mode(bob)]);
    const [sa, sb] = await Promise.all([game.snap(alice), game.snap(bob)]);
    assert.equal(sa.seed, sb.seed);
    assert.equal(sa.target, 10);
    // The live HUD; the pause button asks "Leave race?" instead of pausing.
    await alice.find(`${L}.so-hud .so-hudrow`, `${alice.name} (you)`);
    await alice.gone(`${L}.so-dialog .so-rcode`);
    await new Promise((r) => setTimeout(r, 1500)); // the countdown
    await alice.tid('pause');
    await alice.page.waitForSelector('[data-testid="confirm"]');
    await alice.tid('confirm-no');
    assert.equal(await game.paused(alice), false);
    await game.autoplay(bob);
    await game.solveNow(alice);
    await alice.find(`${L}.so-dialog .so-dtitle`, 'You won! 🏆');
    await bob.find(`${L}.so-dialog .so-dtitle`, `${alice.name} won`);
    // Done: back to the title (race.exit), no boards or stats written.
    await alice.click(`${L}.so-dialog button`, 'Done');
    await waitScreen(alice, 'title');
  },
);
