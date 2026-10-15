/**
 * `npm run new-game -- --renderer pixi|three|none [--no-daily] [--no-race] [--no-online] [--no-avatar] [--title "My Game"]`
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/getting-started.md § "Step 3"
 *
 * Run once, in a fresh copy of the template (tools/New-Game.ps1 does it):
 * - copies the chosen starter into src/game/render/ and deletes src/starters/;
 * - removes the other renderers' npm packages and sets the `2d`/`3d` label;
 * - drops the optional features you don't want (their hook files, game-block
 *   entries and the hooks.ts lines tagged `// new-game:<feature>`);
 * - removes the template's own plans; then run `npm install` and `npm run check`.
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJsonFile } from './lib/json-file.ts';
import { isTemplate, ROOT } from './lib/paths.ts';
import { editPackage, FEATURE_FILES, parseNewGameArgs, stripFeatureLines } from './lib/scaffold.ts';

if (!isTemplate()) {
  console.error('new-game runs once, in a fresh copy of the template (src/starters/ is already gone here).');
  process.exit(1);
}
const choice = parseNewGameArgs(process.argv.slice(2));

// 1. the renderer
const render = join(ROOT, 'src', 'game', 'render');
rmSync(render, { recursive: true, force: true });
cpSync(join(ROOT, 'src', 'starters', choice.renderer), render, { recursive: true });
rmSync(join(ROOT, 'src', 'starters'), { recursive: true, force: true });
console.log(`✓ renderer: ${choice.renderer} (src/game/render/ is yours now)`);

// 2. optional features
for (const f of choice.drop) for (const file of FEATURE_FILES[f]) rmSync(join(ROOT, file), { force: true });
const hooks = join(ROOT, 'src', 'game', 'hooks.ts');
writeFileSync(hooks, stripFeatureLines(readFileSync(hooks, 'utf8'), choice.drop));
if (choice.drop.length > 0) console.log(`✓ dropped: ${choice.drop.join(', ')}`);

// 3. package.json
const pkgPath = join(ROOT, 'package.json');
writeFileSync(pkgPath, `${JSON.stringify(editPackage(readJsonFile(pkgPath), choice), null, 2)}\n`);
console.log('✓ package.json: renderer packages, labels and the game block');

// 4. the template's own plans
for (const plan of ['template-kit.md', 'template-kit-migration.md', 'kit-retros.md']) {
  const p = join(ROOT, 'docs', 'plans', plan);
  if (existsSync(p)) rmSync(p);
}
console.log('\nNext: npm install, then npm run check, then fill the TODO(game) stubs (npm run todo).');
