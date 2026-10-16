/**
 * `npm run build:rules` (turn games): bundle src/game/turns/rules.ts into a self-contained dist-rules/rules.mjs.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/turns.md § "The rules module"
 *
 * saved-games.md §4.1: the hub loads `game.turns.rules` as an ESM bundle with
 * no imports, in a sandbox of plain JavaScript (`vm.createContext({})`):
 * no Math.random, timers, fetch, or Node and browser globals such as
 * structuredClone. The build fails if the bundle still imports anything or
 * touches those. `npm run
 * build` runs it after vite; a game without the rules module skips it.
 */
import { build } from 'esbuild';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/paths.ts';

const entry = join(ROOT, 'src', 'game', 'turns', 'rules.ts');
const out = join(ROOT, 'dist-rules', 'rules.mjs');
if (!existsSync(entry)) {
  console.log('build:rules: no src/game/turns/rules.ts (this game plays no online games the hub runs)');
  process.exit(0);
}
mkdirSync(join(ROOT, 'dist-rules'), { recursive: true });
await build({
  entryPoints: [entry],
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
  [/Math\.random/, 'Math.random (the hub passes its own RNG)'],
  [/\b(setTimeout|setInterval|fetch|Date\.now)\b/, 'timers, fetch or Date (not in the sandbox)'],
  [
    /\b(structuredClone|queueMicrotask|TextEncoder|TextDecoder|Buffer)\b/,
    'a Node or browser global (the sandbox is plain JavaScript; copy objects by hand)',
  ],
] as const;
const found = problems.filter(([re]) => re.test(text)).map(([, why]) => why);
if (found.length > 0) {
  console.error(`✗ dist-rules/rules.mjs has ${found.join('; ')}`);
  process.exit(1);
}
console.log(`✓ dist-rules/rules.mjs (${text.length} bytes), self-contained`);
