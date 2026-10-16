/**
 * `npm run new-game -- --renderer pixi|three|none [--no-daily] [--no-race] [--no-online] [--no-turns] [--no-world] [--no-avatar] [--title "My Game"] [--no-install]`
 * Source: dg-template scripts/kit/ (kit v1.4). Copy byte-identical; change it in the template first.
 * Docs: docs/getting-started.md § "Step 3"
 *
 * Run once, in a fresh copy of the template (`npm run create` in the template does it):
 * - copies the chosen starter into src/game/render/ and deletes src/starters/;
 * - removes the other renderers' npm packages and sets the `2d`/`3d` label;
 * - drops the optional features you don't want (their hook files, game-block
 *   entries and the lines tagged `// new-game:<feature>` in hooks.ts and shots.config.ts);
 * - names the game: package.json `name` (the folder, the slug), `description`,
 *   `author` (git's user.name), index.html's `<title>`, COPY.title, a short README
 *   and blank notes in docs/game.md;
 * - removes the template's own plans, then runs `npm install` (unless `--no-install`).
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJsonFile } from './lib/json-file.ts';
import { isTemplate, ROOT, slugOf } from './lib/paths.ts';
import {
  editPackage,
  FEATURE_FILES,
  gameNotes,
  gameReadme,
  parseNewGameArgs,
  setCopyTitle,
  setHtmlTitle,
  stripFeatureLines,
  TAGGED_FILES,
} from './lib/scaffold.ts';

if (!isTemplate()) {
  console.error('new-game runs once, in a fresh copy of the template (src/starters/ is already gone here).');
  process.exit(1);
}
const args = process.argv.slice(2);
const choice = parseNewGameArgs(args);
const slug = slugOf();
const title = choice.title ?? slug;

/** git's user.name, for package.json `author` (none when git has no name). */
function gitUser(): string | undefined {
  try {
    const name = execSync('git config user.name', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return name === '' ? undefined : name;
  } catch {
    return undefined;
  }
}

/** Rewrite a file in place (when it exists). */
function rewrite(file: string, edit: (text: string) => string): void {
  const path = join(ROOT, file);
  if (existsSync(path)) writeFileSync(path, edit(readFileSync(path, 'utf8')));
}

// 1. the renderer
const render = join(ROOT, 'src', 'game', 'render');
rmSync(render, { recursive: true, force: true });
cpSync(join(ROOT, 'src', 'starters', choice.renderer), render, { recursive: true });
rmSync(join(ROOT, 'src', 'starters'), { recursive: true, force: true });
console.log(`✓ renderer: ${choice.renderer} (src/game/render/ is yours now)`);

// 2. optional features
for (const f of choice.drop) for (const file of FEATURE_FILES[f]) rmSync(join(ROOT, file), { force: true });
for (const file of TAGGED_FILES) rewrite(file, (text) => stripFeatureLines(text, choice.drop));
if (choice.drop.length > 0) console.log(`✓ dropped: ${choice.drop.join(', ')}`);

// 3. package.json
const pkgPath = join(ROOT, 'package.json');
const author = gitUser();
const named = editPackage(readJsonFile(pkgPath), { ...choice, title }, { slug, title, ...(author ? { author } : {}) });
writeFileSync(pkgPath, `${JSON.stringify(named, null, 2)}\n`);
console.log(`✓ package.json: "${slug}", renderer packages, labels and the game block`);

// 4. the game's name everywhere a player or a reader sees it
rewrite(join('src', 'game', 'strings.ts'), (text) => setCopyTitle(text, title));
rewrite('index.html', (text) => setHtmlTitle(text, title));
writeFileSync(join(ROOT, 'README.md'), gameReadme(title, slug));
writeFileSync(join(ROOT, 'docs', 'game.md'), gameNotes(title));
console.log(`✓ "${title}": the title screen, the browser tab, README.md and docs/game.md`);

// 5. the template's own plans (docs/plans/ is the game's from now on)
const plans = join(ROOT, 'docs', 'plans');
if (existsSync(plans)) for (const plan of readdirSync(plans)) rmSync(join(plans, plan), { recursive: true });

// 6. install what package.json now lists
if (!args.includes('--no-install')) {
  console.log('\nnpm install…');
  execSync('npm install --no-audit --no-fund', { cwd: ROOT, stdio: 'inherit' });
}
console.log('\nNext: npm run check, then fill the TODO(game) stubs (npm run todo).');
