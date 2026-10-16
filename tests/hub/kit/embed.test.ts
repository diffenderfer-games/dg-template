// KIT suite (games with game.embed.supported): playing in the box over Adventure Mode (hub.md "Playing over
// the world"), on a real hub. The world's play API opens this game in its box (an iframe of /<slug>/?hub_embed=1);
// inside, the game's own hub menu button is hidden and the kit marks the page `html[data-embed]`. Esc on the
// title leaves the box (the kit leaves it unhandled); Esc in play pauses and the box stays, Esc on the pause
// screen goes back to play; hub UI opening over the box pauses the game (autoPause). Skipped without
// `game.embed.supported: true`.
import assert from 'node:assert/strict';
import type { Frame } from 'puppeteer-core';
import { field } from '../../../src/kit/core/json.ts';
import { e2e, env, GAME_BLOCK, inWorld, settle, SLUG, until, type E2eTest, type Player } from '../_kit.ts';

const e = env();

const skip =
  field(field(GAME_BLOCK, 'embed'), 'supported') === true
    ? false
    : 'this game declares no game.embed.supported: true (docs/kit/world.md#playing-over-the-world)';

/** Wide enough for any box the 70 % rule takes (a desktop window). */
const VIEWPORT = { width: 1600, height: 1000 };

/** The game's state in the box (its test hook, read in the frame). */
const stateIn = (frame: Frame): Promise<{ ready: boolean; screen: string; paused: boolean }> =>
  frame.evaluate(() => ({
    ready: document.body.dataset.ready === '1' && window.__game !== undefined,
    screen: window.__game?.screen() ?? '',
    paused: window.__game?.paused() ?? false,
  }));

/** Wait until the game in the box is on `screen`. */
const waitScreenIn = (frame: Frame, screen: string): Promise<unknown> =>
  until(async () => (await stateIn(frame)).screen === screen, `the box's game on ${screen}`);

const boxOpen = (p: Player): Promise<boolean> =>
  p.page.evaluate(() => window.__ADVENTURE__?.adventure?.play.overlay.isOpen === true);

/** Open this game in the world's box; the player and the game's frame, mounted. */
async function openBox(t: E2eTest): Promise<{ p: Player; frame: Frame }> {
  const p = await t.newPlayer(undefined, '/world', { viewport: VIEWPORT });
  await inWorld(p);
  const kind = await p.page.evaluate(
    (slug) => window.__ADVENTURE__?.adventure?.play.play({ slug }).then((r) => r.kind),
    SLUG,
  );
  assert.equal(kind, 'overlay', `game.embed.size fits a ${VIEWPORT.width}×${VIEWPORT.height} window at 70 %`);
  const el = await p.page.waitForSelector('[data-testid="play-frame"]', { timeout: 20_000 });
  const frame = await el?.contentFrame();
  if (!frame) throw new Error('no play frame');
  assert.equal(new URL(frame.url()).searchParams.get('hub_embed'), '1');
  await until(async () => (await stateIn(frame)).ready, 'the game mounted in the box', 30_000);
  return { p, frame };
}

/**
 * Esc from inside the game (the frame has focus, as after the tap that opened it), held
 * for a few frames like a finger does: the game's inputs are read once a frame.
 */
async function esc(p: Player, frame: Frame): Promise<void> {
  await frame.focus('body');
  await p.page.keyboard.press('Escape', { delay: 120 });
}

e2e(
  "in the world's box: no menu button of its own; Esc on the title leaves the box",
  e,
  async (t) => {
    const { p, frame } = await openBox(t);
    const menu = (): Promise<{ embedded: boolean; display: string }> =>
      frame.evaluate(() => {
        const root = document.getElementById('hub-menu-root');
        return { embedded: root?.dataset.embedded === '1', display: root ? getComputedStyle(root).display : '' };
      });
    const shown = await until(async () => ((await menu()).embedded ? menu() : null), 'the menu in embed mode');
    assert.equal(shown.display, 'none', "the game's hub menu button is hidden (the world's menu is the one menu)");
    assert.equal(await frame.evaluate(() => document.documentElement.dataset.embed), '1', 'html[data-embed]');
    await waitScreenIn(frame, 'title');
    await esc(p, frame);
    await until(async () => !(await boxOpen(p)), 'Esc on the title to close the box', 5000);
  },
  { skip },
);

e2e(
  "in the world's box: Esc in play pauses and the box stays; hub UI over the box pauses the game",
  e,
  async (t) => {
    const { p, frame } = await openBox(t);
    await waitScreenIn(frame, 'title');
    await frame.evaluate(() => window.__game?.newGame?.());
    await waitScreenIn(frame, 'play');
    await esc(p, frame);
    await until(async () => (await stateIn(frame)).paused, 'Esc in play to pause', 5000);
    await settle(400); // the box's own Esc check runs after the key's listeners
    assert.equal(await boxOpen(p), true, "Esc in play is the game's: the box stays open");
    assert.equal((await stateIn(frame)).screen, 'pause');
    await esc(p, frame); // back to play
    await waitScreenIn(frame, 'play');
    await settle(400);
    assert.equal(await boxOpen(p), true, 'Esc on the pause screen went back to play');

    // The world's menu opens over the box: the game pauses (hub.overlay.autoPause, a `menu` entry).
    await p.page.evaluate(() => window.dispatchEvent(new Event('hub:menu-toggle')));
    await until(async () => (await stateIn(frame)).paused, 'hub UI over the box to pause the game', 10_000);
    assert.equal((await stateIn(frame)).screen, 'pause', 'an action game shows its pause card');
  },
  { skip },
);
