/**
 * `npm run cover`: the `cover` screenshot at desktop size, copied to cover.png (set `game.image` to it).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md § "Cover"
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/paths.ts';

execFileSync(
  process.execPath,
  [join(ROOT, 'scripts', 'kit', 'shots.ts'), 'cover', '--size', 'desk', ...process.argv.slice(2)],
  { cwd: ROOT, stdio: 'inherit' },
);
copyFileSync(join(ROOT, 'shots', 'cover-desk.png'), join(ROOT, 'cover.png'));
console.log('→ cover.png (package.json game.image: "cover.png")');
