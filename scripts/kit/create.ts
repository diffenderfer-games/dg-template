/**
 * `npm run create -- <slug> [--title "My Game"] [--renderer pixi|three|none] [--no-daily] [--no-race] [--no-online] [--no-turns] [--no-world] [--no-avatar] [--dir ..] [--no-commit] [--no-pull]`
 * Source: dg-template scripts/kit/ (kit v1.4). Copy byte-identical; change it in the template first.
 * Docs: docs/getting-started.md § "Step 1"
 *
 * In the template only: makes a new game's folder beside it (`../<slug>`),
 * ready to build. First it fast-forwards the template from its remote (`git pull --ff-only`;
 * a failure, like being offline or a diverged branch, only warns; `--no-pull` skips it), so a
 * new game starts on the latest template. It copies the template's last commit (HEAD), never the
 * working tree, so another session's unfinished changes stay out; runs
 * `npm run new-game` there with the same flags (which runs `npm install`);
 * then `git init` and a first commit. No questions asked: an agent can run it.
 * Pick the final name first: the slug is the folder, the repo and the URL.
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isTemplate, ROOT } from './lib/paths.ts';
import { parseNewGameArgs } from './lib/scaffold.ts';

const args = process.argv.slice(2);
/** A flag's value (`--x v` or `--x=v`). */
const value = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : args.find((a) => a.startsWith(`${flag}=`))?.split('=')[1];
};
/** The flags that take a value (the word after them is not the slug). */
const TAKES_VALUE = new Set(['--title', '--renderer', '--dir']);
const slug = args.find((a, i) => !a.startsWith('-') && !TAKES_VALUE.has(args[i - 1] ?? ''));

function fail(msg: string): never {
  console.error(`create: ${msg}`);
  process.exit(1);
}

if (!isTemplate()) fail('run it in dg-template (it makes a new game from the template)');
if (slug === undefined || !/^[a-z0-9][a-z0-9-]*$/.test(slug))
  fail('give the game a slug: lowercase a-z, 0-9 and -, e.g. `npm run create -- word-pop --title "Word Pop"`');
const choice = parseNewGameArgs(args);
const title =
  choice.title ??
  slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
const dest = resolve(value('--dir') ?? join(ROOT, '..'), slug);
if (existsSync(dest)) fail(`${dest} already exists: pick another slug, or remove it first`);

const git = (cwd: string, ...a: string[]): string => execFileSync('git', a, { cwd, encoding: 'utf8' });
if (git(ROOT, 'status', '--porcelain').trim() !== '')
  console.warn('! dg-template has uncommitted changes: they are not copied (the new game starts from HEAD)');

// 0. the latest template (best effort: never blocks making the game)
if (!args.includes('--no-pull')) {
  try {
    git(ROOT, 'pull', '--ff-only', '--quiet');
    console.log('dg-template is on the latest.');
  } catch (e) {
    const why = e instanceof Error ? (e.message.split('\n')[0] ?? '') : String(e);
    console.warn(`! could not pull the latest dg-template (${why}): using the local HEAD`);
  }
}

// 1. the template's last commit, without its history
console.log(`Creating ${dest} from dg-template ${git(ROOT, 'rev-parse', '--short', 'HEAD').trim()}…`);
git(ROOT, 'clone', '--quiet', '--no-hardlinks', ROOT, dest);
rmSync(join(dest, '.git'), { recursive: true, force: true });
rmSync(join(dest, 'tools'), { recursive: true, force: true }); // the template's own Windows tools

// 2. new-game: the renderer, the features, the name; then npm install
const flags = ['--renderer', choice.renderer, '--title', title, ...choice.drop.map((f) => `--no-${f}`)];
execFileSync(process.execPath, [join('scripts', 'kit', 'new-game.ts'), ...flags], { cwd: dest, stdio: 'inherit' });

// 3. its own repo, with a first commit
if (!args.includes('--no-commit')) {
  git(dest, 'init', '--quiet', '--initial-branch=master');
  git(dest, 'add', '-A');
  execSync(`git commit --quiet -m "Start ${title.replace(/"/g, "'")}"`, { cwd: dest, stdio: 'inherit' });
}

console.log(`\n✓ ${title} is ready in ${dest}`);
console.log('Next, in that folder:');
console.log('  npm run check          # every local gate: it passes as created');
console.log('  npm run first-deploy   # the private repo in the org, its deploy secrets, the first push');
