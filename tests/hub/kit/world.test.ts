// KIT suite (games with game.world): the game's own room in the hub's world, on a real hub (client next.9).
// The hub serves the room this game declares (game.<slug>) as a valid dg-world@1 map, made the way
// `npm run world:check` makes it; and a room drawn in Tiled, converted with the hub's `dg-world from-tiled`
// (what `npm run world:build` runs), is served from a game's map file. Skipped without game.world.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createWorldTypeRegistry, generateWorld, worldMapToTiled } from '@diffenderfer-games/world';
import { field, numField } from '../../../src/kit/core/json.ts';
import { generateRoom, parseGameWorld, roomProblems, worldKey } from '../../../src/kit/world/room.ts';
import { api, e2e, env, ROOT, SLUG } from '../_kit.ts';

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
