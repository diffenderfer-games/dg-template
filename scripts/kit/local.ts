/**
 * `npm run local`: this game on a real local hub (the hub's `npm run local -- --only <slug>`), on a free port.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md § "A local hub"
 *
 *   npm run local                 # picks a free port block, prints the URL, writes .tmp/local.json
 *   npm run local -- --port 8490  # a fixed port (never 8099)
 *
 * The hub's local tool finds sibling repos under GitHub/, so this repo must
 * sit next to the hub checkout (DG_HOST). `npm run probe` and
 * `npm run shots:hub -- --url` read .tmp/local.json. Ctrl+C stops it.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { freeBlock, portFree } from './lib/ports.ts';
import { HUB, ROOT, TMP } from './lib/paths.ts';
import { forget, remember } from './lib/procs.ts';

const i = process.argv.indexOf('--port');
const asked = i >= 0 ? Number(process.argv[i + 1]) : null;
if (asked === 8099) throw new Error('port 8099 is the main local instance; pick another');
const port = asked ?? (await freeBlock(8400));
if (!(await portFree(port))) throw new Error(`port ${port} is busy`);

const url = `http://localhost:${port}`;
const only = basename(ROOT);
mkdirSync(TMP, { recursive: true });
writeFileSync(join(TMP, 'local.json'), JSON.stringify({ port, url, game: `${url}/${only.toLowerCase()}/` }, null, 2));
console.log(`local hub for ${only}: ${url} (game at ${url}/${only.toLowerCase()}/)`);

const child = spawn('npm', ['run', 'local', '--', '--only', only, '--port', String(port)], {
  cwd: HUB,
  stdio: 'inherit',
  shell: true,
});
remember(child.pid, 'local hub');
const stop = (): void => {
  child.kill('SIGINT');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => {
  forget(child.pid);
  process.exit(code ?? 0);
});
