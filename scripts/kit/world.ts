/**
 * `npm run world:<check|generate|build|tiled>`: the game's own room in the hub's world (`game.world`), with `dg-world`.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/world.md § "Your room"
 *
 *   npm run world:check      # the room the hub would serve: the map file (dg-world check), else the generated one
 *   npm run world:generate   # write the generated room to game.world.map (commit it), else to .tmp/world/
 *   npm run world:tiled      # the map → <map>.tmj, to open and edit in Tiled (dg-world to-tiled)
 *   npm run world:build      # <map>.tmj from Tiled → the map (dg-world from-tiled), then check it
 *
 * The CLI and the generator are `@diffenderfer-games/world`, the hub's own;
 * the hub never runs a game's script, so a map made here is committed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { serializeWorldMap } from '@diffenderfer-games/world';
import { generateRoom, parseGameWorld, roomProblems, worldKey } from '../../src/kit/world/room.ts';
import { readJsonFile, rec } from './lib/json-file.ts';
import { ROOT, slugOf, TMP } from './lib/paths.ts';

const mode = process.argv[2] ?? 'check';
const slug = slugOf();
const game = rec(readJsonFile(join(ROOT, 'package.json')).game);
const { world, problems } = parseGameWorld(game?.world);

/** Run the hub's `dg-world` CLI (from @diffenderfer-games/world) with these arguments. */
function dgWorld(...args: string[]): number {
  const pkg = createRequire(import.meta.url).resolve('@diffenderfer-games/world/package.json');
  const cli = join(dirname(pkg), 'dist', 'cli', 'dg-world.mjs');
  return spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', cwd: ROOT }).status ?? 1;
}

if (problems.length > 0) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
if (world === null) {
  console.log('world: no game.world in package.json (the game has no room of its own; docs/kit/world.md)');
  process.exit(0);
}
const map = world.map === undefined ? null : join(ROOT, world.map);
const tmj = map?.replace(/\.json$/, '.tmj') ?? null;

if (mode === 'check') {
  if (map !== null && existsSync(map)) process.exit(dgWorld('check', map));
  const room = generateRoom(world, slug);
  if (room === null) {
    console.error(`✗ world.map ${world.map ?? ''} is missing and there is no generate block to fall back to`);
    process.exit(1);
  }
  const bad = roomProblems(serializeWorldMap(room));
  for (const p of bad) console.error(`✗ ${p}`);
  console.log(
    `${bad.length === 0 ? '✓' : '✗'} ${worldKey(slug)}: generated ${room.width}×${room.height} (${room.provenance?.generatorVersion ?? '?'})`,
  );
  process.exit(bad.length === 0 ? 0 : 1);
} else if (mode === 'generate') {
  const room = generateRoom(world, slug);
  if (room === null) {
    console.error('✗ game.world has no generate block');
    process.exit(1);
  }
  const out = map ?? join(TMP, 'world', `${slug}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${serializeWorldMap(room)}\n`);
  console.log(`✓ ${out}${map === null ? ' (no game.world.map: add one to ship this file)' : ''}`);
} else if (mode === 'tiled' || mode === 'build') {
  if (map === null || tmj === null) {
    console.error('✗ game.world has no map file (add "map": "world/lobby.json")');
    process.exit(1);
  }
  if (mode === 'tiled') process.exit(dgWorld('to-tiled', map, tmj));
  if (!existsSync(tmj)) {
    console.error(`✗ no ${tmj} (npm run world:tiled makes one from the map)`);
    process.exit(1);
  }
  const code = dgWorld('from-tiled', tmj, map);
  process.exit(code === 0 ? dgWorld('check', map) : code);
} else {
  console.error(`world: unknown command "${mode}" (check, generate, tiled, build)`);
  process.exit(1);
}
