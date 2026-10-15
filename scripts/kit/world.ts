/**
 * `npm run world:build` / `npm run world:check` (opt-in room file): Tiled world/room.tmj → world/room.json (dg-room@1).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/world.md § "Room files"
 *
 * world.md §7: the converter (`dg-room from-tiled`) and the validator live in
 * the hub's package and arrive with world W4. Until the installed hub client
 * ships them, this script says so and exits 0 (most games ship no room file:
 * the hub makes a themed room).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/paths.ts';

const mode = process.argv[2] === 'check' ? 'check' : 'build';
const tmj = join(ROOT, 'world', 'room.tmj');
const json = join(ROOT, 'world', 'room.json');
const bin = join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'dg-room.cmd' : 'dg-room');

if (!existsSync(bin)) {
  console.log(
    'world: the room-file tools arrive with world W4 (dg-room in @diffenderfer-games/hub); nothing to do yet.',
  );
  process.exit(0);
}
if (mode === 'build' && !existsSync(tmj)) {
  console.log('world: no world/room.tmj (the hub makes a themed room).');
  process.exit(0);
}
const args = mode === 'build' ? ['from-tiled', tmj, '--out', json] : ['check', json];
const r = spawnSync(bin, args, { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
