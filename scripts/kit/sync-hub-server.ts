/**
 * `npm run sync-hub-server` (own-server games): copy the game-server SDK from the hub checkout.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/server.md
 *
 * Runs the hub's own sync tool from its workspace (the repo root after its
 * phase 12, `next/` before), which writes server/hub-server.mjs here.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { hubWorkspace, ROOT } from './lib/paths.ts';

const ws = hubWorkspace();
const tool = join(ws, 'tools', 'sync-hub-server.ts');
if (!existsSync(tool)) {
  console.error(`no tools/sync-hub-server.ts in ${ws}`);
  process.exit(1);
}
execFileSync('npx', ['tsx', '--conditions=source', tool, '--game', ROOT, ...process.argv.slice(2)], {
  cwd: ws,
  stdio: 'inherit',
  shell: true,
});
