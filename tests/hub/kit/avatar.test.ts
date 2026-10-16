// KIT suite: avatars on a real hub. The title's bust is the player's own face, drawn by the hub's
// renderer, and follows a change live; Edit avatar opens the hub's designer; lobby seats show faces.
import assert from 'node:assert/strict';
import { field, isJsonObject, strField, type JsonObject } from '../../../src/kit/core/json.ts';
import { api, e2e, env, L, ready, SLUG, until, waitScreen, type Player } from '../_kit.ts';

const e = env();

/** The player's avatar on the hub: its code and its look. */
async function mine(p: Player): Promise<{ code: string; look: JsonObject }> {
  const body = (await api(p).get('/avatar/me')).body;
  const look = field(body, 'look');
  return { code: strField(body, 'code'), look: isJsonObject(look) ? look : {} };
}

const BUST = '[data-testid="avatar-demo"] dg-avatar';

e2e(
  'avatar: the title bust is your face, drawn by the hub, and a change re-renders it live (no reload)',
  e,
  async (t) => {
    const a = await t.newPlayer(undefined, `/${SLUG}/`);
    await ready(a);
    await waitScreen(a, 'title');
    const before = await mine(a);
    await a.page.waitForSelector(`${BUST}[look="${before.code}"]`, { timeout: 15_000 });
    await a.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el !== null && 'animator' in el && el.childElementCount > 0; // upgraded by the renderer, and drawn
      },
      { timeout: 15_000 },
      BUST,
    );
    const saved = await api(a).put('/avatar/me', {
      look: { ...before.look, hair: { style: 'hair.mohawk', colour: 'p:hair-pink' } },
    });
    const code = strField(saved.body, 'code');
    assert.notEqual(code, before.code);
    await a.page.waitForSelector(`${BUST}[look="${code}"]`, { timeout: 15_000 });
  },
);

e2e('avatar: Edit avatar opens the hub’s designer over the game', e, async (t) => {
  const a = await t.newPlayer(undefined, `/${SLUG}/`);
  await ready(a);
  await waitScreen(a, 'title');
  await a.tid('avatar-edit');
  await a.find(`${L}.so-design`);
});

e2e('avatar: every human seat in the lobby shows that player’s face', e, async (t) => {
  const a = await t.newPlayer(undefined, `/${SLUG}/`);
  const b = await t.newPlayer(undefined, `/${SLUG}/`);
  await Promise.all([ready(a), ready(b)]);
  await a.tid('online');
  await waitScreen(a, 'lobby');
  const code = await until(() => a.page.evaluate(() => window.__game?.online?.room() ?? null), 'a room code');
  await b.page.evaluate((c) => window.__game?.online?.join(c), code);
  await waitScreen(b, 'lobby');
  const [ma, mb] = await Promise.all([mine(a), mine(b)]);
  for (const look of [ma.code, mb.code]) {
    await a.page.waitForSelector(`.kit-seat dg-avatar[look="${look}"]`, { timeout: 15_000 });
  }
});
