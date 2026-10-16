// KIT suite (games with game.world): the game's own room in the hub's world, on a real hub (client next.10).
// The hub serves the room this game declares (game.<slug>) as a valid dg-world@1 map, made the way
// `npm run world:check` makes it; a room drawn in Tiled, converted with the hub's `dg-world from-tiled`
// (what `npm run world:build` runs), is served from a game's map file; and Adventure Mode opens the room at
// /world/game.<slug> (roomPath), where a typed bubble reaches only friends, quick chat reaches everyone, and
// "Walk to" takes a player out through the room's door to a friend. Skipped without game.world.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createWorldTypeRegistry, generateWorld, worldMapToTiled } from '@diffenderfer-games/world';
import { field, numField } from '../../../src/kit/core/json.ts';
import { generateRoom, parseGameWorld, roomPath, roomProblems, worldKey } from '../../../src/kit/world/room.ts';
import { api, befriend, e2e, env, ROOT, SLUG, settle, type Player } from '../_kit.ts';

/** Adventure Mode's test handle (`window.__ADVENTURE__`, the hub's runtime), as far as this suite reads it. */
type AdventureHandle = {
  live: {
    current: { map: { key: string }; instance: string | number } | null;
    crowd: Map<number, { x: number; y: number }>;
  };
  session: { player: { x: number; y: number } };
  tips: { skip(): void };
};

declare global {
  interface Window {
    __ADVENTURE__?: { adventure?: AdventureHandle };
  }
}

const declared: unknown = field(field(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')), 'game'), 'world');
const { world } = parseGameWorld(declared);
const skip = world === null ? 'this game declares no game.world (docs/kit/world.md)' : false;

/** A second game whose room is a Tiled map converted with dg-world (world:build's step). */
const TILED_SLUG = 'roomdemo';
function tiledGame(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dg-roomdemo-'));
  mkdirSync(join(dir, 'world'));
  const map = generateWorld(createWorldTypeRegistry(), { type: 'park', seed: 'tiled', needs: { game: 'Room Demo' } });
  writeFileSync(join(dir, 'world', 'lobby.tmj'), JSON.stringify(worldMapToTiled(map)));
  const cli = join(
    dirname(createRequire(import.meta.url).resolve('@diffenderfer-games/world/package.json')),
    'dist',
    'cli',
    'dg-world.mjs',
  );
  const r = spawnSync(process.execPath, [cli, 'from-tiled', 'world/lobby.tmj', 'world/lobby.json'], {
    cwd: dir,
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`dg-world from-tiled failed: ${r.stderr}`);
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Room Demo</title>');
  const game = { type: 'static', title: 'Room Demo', serveDir: '.', world: { map: 'world/lobby.json' } };
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: TILED_SLUG, private: true, game }));
  return dir;
}

const e = skip ? env() : env({ apps: { [TILED_SLUG]: tiledGame() } });

/** GET a world's map file from the hub: its status and the map. */
async function served(
  t: Parameters<Parameters<typeof e2e>[2]>[0],
  key: string,
): Promise<{ status: number; map: unknown }> {
  const p = await t.newPlayer(undefined, null);
  const r = await api(p).get(`/world/maps/${encodeURIComponent(key)}`);
  return { status: r.status, map: field(r.body, 'map') };
}

e2e(
  "world: the hub serves this game's own room (game.<slug>), a valid dg-world@1 map made like world:check's",
  e,
  async (t) => {
    const r = await served(t, worldKey(SLUG));
    assert.equal(r.status, 200);
    assert.deepEqual(roomProblems(JSON.stringify(r.map)), []);
    assert.equal(field(r.map, 'id'), worldKey(SLUG));
    const local = world === null || world.map !== undefined ? null : generateRoom(world, SLUG);
    if (local !== null) {
      assert.equal(numField(r.map, 'width'), local.width, 'the same seed and needs make the same room');
      assert.equal(numField(r.map, 'height'), local.height);
    }
    assert.equal((await served(t, 'lounge')).status, 200, "the hub's own rooms are live too");
  },
  { skip },
);

e2e(
  'world: a room drawn in Tiled and converted with dg-world from-tiled (world:build) is served from its map file',
  e,
  async (t) => {
    const r = await served(t, worldKey(TILED_SLUG));
    assert.equal(r.status, 200);
    assert.deepEqual(roomProblems(JSON.stringify(r.map)), []);
    assert.equal(
      field(field(r.map, 'provenance'), 'generator'),
      'park',
      'the converted file, not a generated fallback',
    );
  },
  { skip },
);

/** Wait until Adventure Mode is in a world; its key. */
async function inWorld(p: Player): Promise<string> {
  await p.page.waitForFunction(() => window.__ADVENTURE__?.adventure?.live.current != null, { timeout: 45_000 });
  const key = await p.page.evaluate(() => window.__ADVENTURE__?.adventure?.live.current?.map.key ?? '');
  await p.page.evaluate(() => window.__ADVENTURE__?.adventure?.tips.skip());
  return key;
}

/** Does `p` see a bubble from `from` whose text matches? */
function sees(p: Player, from: Player, text: string): Promise<boolean> {
  return p.page.evaluate(
    (id, t) =>
      [...document.querySelectorAll<HTMLElement>('[data-testid="world-speech"]')].some(
        (el) => el.dataset.agent === `u${String(id)}` && (el.textContent ?? '').includes(t),
      ),
    from.id,
    text,
  );
}

e2e(
  "Adventure Mode: /world/game.<slug> opens this game's room; typed bubbles reach friends only, quick chat everyone",
  e,
  async (t) => {
    const ann = await t.newPlayer(undefined, null);
    const ben = await t.newPlayer(undefined, null);
    const cat = await t.newPlayer(undefined, null);
    await befriend(ann, ben);
    for (const p of [ann, ben, cat]) {
      await p.goto(roomPath(SLUG));
      assert.equal(await inWorld(p), worldKey(SLUG), 'the deep link opens the game room');
    }
    await ann.page.click('[data-testid="adventure-say"]');
    await ann.page.type('[data-testid="adventure-say-input"]', 'hello from the room');
    await ann.page.click('[data-testid="adventure-say-send"]');
    await ben.page.waitForFunction(
      (id) =>
        [...document.querySelectorAll<HTMLElement>('[data-testid="world-speech"]')].some(
          (el) => el.dataset.agent === `u${String(id)}` && (el.textContent ?? '').includes('hello from the room'),
        ),
      { timeout: 10_000 },
      ann.id,
    );
    await settle(1000);
    assert.equal(await sees(cat, ann, 'hello from the room'), false, 'a stranger never receives typed text');

    await ann.page.click('[data-testid="adventure-say"]');
    const chip = await ann.page.waitForSelector('[data-testid="adventure-say-box"] .adv-say-chip:not(.is-emote)');
    const phrase = (await chip?.evaluate((el) => el.textContent ?? '')) ?? '';
    assert.notEqual(phrase, '', 'the box offers the hub quick-chat phrases');
    await chip?.click();
    await cat.page.waitForFunction(
      (id) =>
        [...document.querySelectorAll<HTMLElement>('[data-testid="world-speech"]')].some(
          (el) => el.dataset.agent === `u${String(id)}`,
        ),
      { timeout: 10_000 },
      ann.id,
    );
  },
  { skip, timeout: 120_000 },
);

e2e(
  "Adventure Mode: Walk to takes a player out through this game's room's door to a friend in another room",
  e,
  async (t) => {
    const ann = await t.newPlayer(undefined, null);
    const ben = await t.newPlayer(undefined, null);
    await befriend(ann, ben);
    await ben.goto('/world/hall');
    assert.equal(await inWorld(ben), 'hall');
    await ann.goto(roomPath(SLUG));
    assert.equal(await inWorld(ann), worldKey(SLUG));
    await ann.page.click('[data-testid="adventure-friends"]');
    const walk = `[data-testid="adventure-friends-panel"] [data-user="${String(ben.id)}"] [data-testid="adventure-walk-to"]`;
    await ann.page.waitForSelector(walk, { timeout: 20_000 });
    await ann.page.click(walk);
    await ann.page.waitForFunction(() => window.__ADVENTURE__?.adventure?.live.current?.map.key === 'hall', {
      timeout: 60_000,
    });
    await ann.page.waitForFunction(
      () => document.querySelector<HTMLElement>('[data-testid="adventure-walking"]')?.hidden === true,
      { timeout: 60_000 },
    );
    const gap = await ann.page.evaluate((id) => {
      const a = window.__ADVENTURE__?.adventure;
      const friend = a?.live.crowd.get(id);
      if (a === undefined || friend === undefined) return null;
      const me = a.session.player;
      return Math.max(
        Math.abs(Math.floor(friend.x) - Math.floor(me.x)),
        Math.abs(Math.floor(friend.y) - Math.floor(me.y)),
      );
    }, ben.id);
    assert.equal(gap, 1, 'next to the friend');
  },
  { skip, timeout: 150_000 },
);
