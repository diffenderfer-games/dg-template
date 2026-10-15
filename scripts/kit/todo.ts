/**
 * `npm run todo`: the `TODO(game)` stubs still left to fill.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/getting-started.md
 */
import { readFileSync } from 'node:fs';
import { expandPath } from './lib/modules.ts';
import { ROOT } from './lib/paths.ts';
import { join } from 'node:path';

const files = [
  ...expandPath(ROOT, 'src/game'),
  ...expandPath(ROOT, 'scripts/shots.config.ts'),
  ...expandPath(ROOT, 'scripts/sim.ts'),
  ...expandPath(ROOT, 'tests/game'),
];
let count = 0;
for (const file of files.filter((f) => f.endsWith('.ts'))) {
  readFileSync(join(ROOT, file), 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      const m = /TODO\(game\):?\s*(.*)/.exec(line);
      if (!m) return;
      count++;
      console.log(`${file}:${i + 1}  ${m[1] ?? ''}`);
    });
}
console.log(count === 0 ? 'No TODO(game) left.' : `\n${count} TODO(game) left.`);
