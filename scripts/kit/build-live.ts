/**
 * `npm run build:live` (live games): bundle src/game/live/sim.ts into a self-contained dist-live/sim.mjs.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/live.md § "The sim module"
 *
 * The hub's live server loads `game.live.sim` as an ESM bundle with no
 * imports, in a sandbox of plain JavaScript: no Math.random, timers, fetch,
 * or Node and browser globals. The build fails if the bundle still imports
 * anything or touches those. `npm run build` runs it after vite; a game
 * without `game.live` in package.json skips it.
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJsonFile, rec, str } from './lib/json-file.ts';
import { ROOT } from './lib/paths.ts';

const sim = str(rec(rec(readJsonFile(join(ROOT, 'package.json')).game)?.live)?.sim);
if (sim === undefined) {
  console.log('build:live: no game.live in package.json (this game plays no live games)');
  process.exit(0);
}
const out = join(ROOT, sim);
mkdirSync(join(out, '..'), { recursive: true });
await build({
  entryPoints: [join(ROOT, 'src', 'game', 'live', 'sim.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  minify: false,
  legalComments: 'none',
});
const text = readFileSync(out, 'utf8');
const problems = [
  [/^\s*import\s/m, 'an import (the bundle must be self-contained)'],
  [/Math\.random/, 'Math.random (use ctx.rng)'],
  [/\b(setTimeout|setInterval|fetch|Date\.now|performance\.now)\b/, 'timers, fetch or a clock (not in the sandbox)'],
  [
    /\b(structuredClone|queueMicrotask|Buffer|document|window)\b/,
    'a Node or browser global (the sandbox is plain JavaScript)',
  ],
] as const;
const found = problems.filter(([re]) => re.test(text)).map(([, why]) => why);
if (found.length > 0) {
  console.error(`✗ ${sim} has ${found.join('; ')}`);
  process.exit(1);
}
console.log(`✓ ${sim} (${text.length} bytes), self-contained`);
