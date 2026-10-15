// KIT suite (online games): the multiplayer.md §12 scenarios against the stub game (Coin Party).
import assert from 'node:assert/strict';
import {
  befriend,
  e2e,
  env,
  game,
  L,
  mpdemoDir,
  openMenu,
  ready,
  settle,
  SLUG,
  until,
  waitScreen,
  type E2eTest,
  type Player,
} from '../_kit.ts';

const e = env({ apps: { mpdemo: await mpdemoDir() }, env: { HUB_LIMITS_JSON: JSON.stringify({ roomGraceMs: 4000 }) } });

/** Read the online test drivers. */
const room = (p: Player): Promise<string | null> => p.page.evaluate(() => window.__game?.online?.room() ?? null);
const seats = (p: Player): Promise<number> => p.page.evaluate(() => window.__game?.online?.seats() ?? 0);

/** A hosts a room; B joins it by code; A starts. Returns the code. */
async function startMatch(a: Player, b: Player): Promise<string> {
  await Promise.all([ready(a), ready(b)]);
  await a.tid('online');
  await waitScreen(a, 'lobby');
  const code = await until(() => room(a), 'a room code');
  await b.page.evaluate((c) => window.__game?.online?.join(c), code);
  await waitScreen(b, 'lobby');
  await until(async () => (await seats(a)) === 2, 'two seats');
  await a.tid('lobby-start');
  await Promise.all([waitScreen(a, 'play'), waitScreen(b, 'play')]);
  return code;
}

/** A player on our game's page. */
const onGame = (t: E2eTest): Promise<Player> => t.newPlayer(undefined, `/${SLUG}/`);

e2e('1. invite → jump → accept → lobby: both end up in the same room', e, async (t) => {
  const a = await onGame(t);
  const b = await t.newPlayer(undefined, '/mpdemo/');
  await befriend(a, b);
  await ready(a);
  await a.tid('online');
  await waitScreen(a, 'lobby');
  await a.tid('lobby-invite');
  await a.find(`${L}.so-dialog .so-dtitle`, 'Invite to play');
  await a.click(`${L}.so-dialog .so-row button`, 'Invite');
  await b.find(`${L}.so-toast`, `${a.name} invited you`);
  await b.click(`${L}.so-toast button`, 'Accept');
  await b.page.waitForFunction((slug) => location.pathname === `/${slug}/`, { timeout: 20_000 }, SLUG);
  await ready(b);
  await waitScreen(b, 'lobby', 20_000);
  assert.equal(await until(() => room(b), 'b in a room'), await room(a));
  await until(async () => (await seats(a)) === 2, 'two seats on the host');
});

e2e('2. a declined invite tells the inviter, and nobody moves', e, async (t) => {
  const a = await onGame(t);
  const b = await t.newPlayer(undefined, '/mpdemo/');
  await befriend(a, b);
  await ready(a);
  await a.tid('online');
  await waitScreen(a, 'lobby');
  await a.tid('lobby-invite');
  await a.click(`${L}.so-dialog .so-row button`, 'Invite');
  await b.find(`${L}.so-toast`, `${a.name} invited you`);
  await b.click(`${L}.so-toast button`, 'Decline');
  await a.find(`${L}.so-toast`, `${b.name} can't play right now`);
  assert.equal(new URL(b.page.url()).pathname, '/mpdemo/');
  assert.equal(await game.screen(a), 'lobby');
});

e2e('3. leave guard: a player in a live match is asked first; Stay keeps the match', e, async (t) => {
  const host = await onGame(t);
  const bob = await onGame(t);
  const code = await startMatch(host, bob);
  const alice = await t.newPlayer(undefined, '/mpdemo/');
  await befriend(alice, bob);
  await alice.page.evaluate((id) => {
    const sdk: unknown = Reflect.get(window, 'HubSDK');
    const hub: unknown = sdk ? Reflect.get(Object(sdk), 'hub') : undefined;
    const mp: unknown = hub ? Reflect.get(Object(hub), 'mp') : undefined;
    const invite: unknown = mp ? Reflect.get(Object(mp), 'invite') : undefined;
    if (typeof invite === 'function') void Reflect.apply(invite, mp, [id]);
  }, bob.id);
  await bob.find(`${L}.so-toast`, `${alice.name} invited you`);
  await bob.click(`${L}.so-toast button`, 'Accept');
  await bob.find(`${L}.so-dialog .so-dtitle`, 'Leave your match?');
  await bob.click(`${L}.so-dialog button`, 'Stay');
  await settle(500);
  assert.equal(await room(bob), code);
  assert.equal(await game.screen(bob), 'play');
});

e2e("4. Join from a friend's presence lands in their lobby", e, async (t) => {
  const a = await onGame(t);
  const b = await t.newPlayer(undefined, '/mpdemo/');
  await befriend(a, b);
  await ready(a);
  await a.tid('online');
  const code = await until(() => room(a), 'a room code');
  await b.openFriends();
  await b.find('.so-wcontent .so-friend .so-status', /In lobby/);
  await b.click('.so-wcontent .so-friend button', '▶ Join');
  await b.page.waitForFunction((slug) => location.pathname === `/${slug}/`, { timeout: 20_000 }, SLUG);
  await ready(b);
  assert.equal(await until(() => room(b), 'b joined'), code);
});

e2e('5. the hub menu pauses in the lobby, never during a live match', e, async (t) => {
  const a = await onGame(t);
  const b = await onGame(t);
  await startMatch(a, b);
  await openMenu(a);
  await a.find('.sect-social .so-strip', 'Your match is still going!');
  assert.equal(await game.paused(a), false);
  assert.equal(await game.screen(a), 'play');
  await a.closeMenu();
});

e2e('6. chat: a link is refused with the hint and the draft kept; a softened word shows softened', e, async (t) => {
  const a = await onGame(t);
  const b = await onGame(t);
  await befriend(a, b);
  await Promise.all([ready(a), ready(b)]);
  await a.tid('online');
  const code = await until(() => room(a), 'a room code');
  await b.page.evaluate((c) => window.__game?.online?.join(c), code);
  await waitScreen(a, 'lobby');
  const input = await a.page.waitForSelector('[data-testid="chat-input"]');
  await input?.type('visit example dot com');
  await a.tid('chat-send');
  await a.page.waitForFunction(() => (document.querySelector('[data-testid="chat-note"]')?.textContent ?? '') !== '', {
    timeout: 10_000,
  });
  assert.equal(
    await a.page.$eval('[data-testid="chat-input"]', (el) => (el instanceof HTMLInputElement ? el.value : '')),
    'visit example dot com',
  );
  await a.page.$eval('[data-testid="chat-input"]', (el) => {
    if (el instanceof HTMLInputElement) el.value = 'i got shot';
  });
  await a.tid('chat-send');
  await b.page.waitForFunction(
    () => /took damage/.test(document.querySelector('[data-testid="chat-lines"]')?.textContent ?? ''),
    { timeout: 10_000 },
  );
});

e2e('7. reconnect: a reload mid-match comes back to the same room and seat', e, async (t) => {
  const a = await onGame(t);
  const b = await onGame(t);
  const code = await startMatch(a, b);
  await b.page.reload();
  await ready(b);
  assert.equal(await until(() => room(b), 'b back in the room', 20_000), code);
  await waitScreen(b, 'play', 20_000);
});

e2e('8. a suspended player gets a friendly message and the game stays playable', e, async (t) => {
  const a = await onGame(t);
  await ready(a);
  await a.page.evaluate(async (id) => {
    await fetch('/_api/test/suspend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: id, ms: 60_000 }),
    });
  }, a.id);
  await a.tid('online');
  await a.page.waitForFunction(
    () => /switched off|connection|went wrong/.test(document.querySelector('[data-testid="toast"]')?.textContent ?? ''),
    { timeout: 20_000 },
  );
  await waitScreen(a, 'title');
  await game.newGame(a);
  await waitScreen(a, 'play');
});

e2e(
  '9. resilience: a player who drops is played by the computer; the match never ends; they come back',
  e,
  async (t) => {
    const a = await onGame(t);
    const b = await onGame(t);
    const code = await startMatch(a, b);
    // B's square, as A sees it.
    const bAt = (): Promise<string> =>
      a.page.evaluate((id) => {
        const v: unknown = window.__game?.online?.view();
        const players: unknown = typeof v === 'object' && v !== null ? Reflect.get(v, 'players') : [];
        const me: unknown = Array.isArray(players)
          ? players.find((p: unknown) => Reflect.get(Object(p), 'id') === id)
          : undefined;
        return JSON.stringify(me ?? null);
      }, b.id);
    await b.page.close();
    await settle(2500); // the seat goes away; the host's computer takes it
    const before = await bAt();
    await settle(1500);
    assert.equal(await game.screen(a), 'play', 'the match goes on');
    assert.notEqual(before, await bAt(), 'the computer moves the away seat');
    const tab = await b.newTab(`/${SLUG}/`);
    await ready(tab);
    assert.equal(await until(() => room(tab), 'b back in the room', 20_000), code);
  },
);

e2e('10. an invite link lets a stranger take a free seat', e, async (t) => {
  const a = await onGame(t);
  await ready(a);
  await a.tid('online');
  const code = await until(() => room(a), 'a room code');
  await a.tid('lobby-invite');
  await a.find(`${L}.so-dialog .so-dtitle`, 'Invite to play');
  await a.click(`${L}[data-testid="invite-link-share"]`, 'Share invite link');
  const link = await (
    await a.find(`${L}[data-testid="invite-link-url"]`)
  ).evaluate((el) => (el instanceof HTMLInputElement ? el.value : ''));
  assert.match(link, /hub_link=/);
  const c = await t.newPlayer(undefined, null);
  await c.page.goto(link.startsWith('http') ? link : `${t.url}${link}`);
  await ready(c);
  assert.equal(await until(() => room(c), 'c joined by link', 20_000), code);
});
