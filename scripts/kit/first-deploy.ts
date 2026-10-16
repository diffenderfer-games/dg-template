/**
 * `npm run first-deploy [-- --key ~/.ssh/diffenderfer_deploy] [--host diffenderfer.games] [--public-description "…"] [--no-watch] [--dry-run]`
 * Source: dg-template scripts/kit/ (kit v1.4). Copy byte-identical; change it in the template first.
 * Docs: docs/repo-setup.md § "The first deploy"
 *
 * Puts a new game online, with the GitHub CLI (`gh`, signed in to an account
 * in the org). Each step is skipped when it's already done, so it can run again:
 * 1. the private repo `diffenderfer-games/<slug>` (description: `game.description`);
 * 2. its deploy secrets: DEPLOY_SSH_KEY (from the key file) and DEPLOY_HOST;
 * 3. the `origin` remote, and a push of the current branch (the gate runs
 *    `npm run check`, then deploys);
 * 4. watches the deploy run to the end.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { rec, readJsonFile } from './lib/json-file.ts';
import { isTemplate, ROOT, slugOf } from './lib/paths.ts';

const ORG = 'diffenderfer-games';
const args = process.argv.slice(2);
const value = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : args.find((a) => a.startsWith(`${flag}=`))?.split('=')[1];
};
const dry = args.includes('--dry-run');
const key = (value('--key') ?? join(homedir(), '.ssh', 'diffenderfer_deploy')).replace(/^~/, homedir());
const host = value('--host') ?? 'diffenderfer.games';
const slug = slugOf();
const repo = `${ORG}/${slug}`;

function fail(msg: string): never {
  console.error(`first-deploy: ${msg}`);
  process.exit(1);
}

/** Run a command (or print it with --dry-run); returns its output, or null when it failed. */
function run(cmd: string, a: string[], o: { input?: string; quiet?: boolean } = {}): string | null {
  const shown = `${cmd} ${a.map((x) => (/\s/.test(x) ? `"${x}"` : x)).join(' ')}`;
  if (dry) {
    console.log(`  (dry run) ${shown}`);
    return '';
  }
  const r = spawnSync(cmd, a, {
    cwd: ROOT,
    encoding: 'utf8',
    input: o.input,
    stdio: [o.input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    if (!o.quiet) console.error((r.stderr || r.stdout || '').trim());
    return null;
  }
  return r.stdout;
}

/** Does a command succeed (for "is it done already?")? */
const ok = (cmd: string, a: string[]): boolean => spawnSync(cmd, a, { cwd: ROOT, stdio: 'ignore' }).status === 0;

if (isTemplate()) fail('run it in a game made from the template (npm run create), not in dg-template');
if (!ok('gh', ['auth', 'status'])) fail('the GitHub CLI is not signed in: `gh auth login` first');
if (!existsSync(join(ROOT, '.git'))) fail('this folder is not a git repo: `git init` and commit first');
if (!dry && !existsSync(key)) fail(`no deploy key at ${key} (pass --key <file>)`);

const game = rec(readJsonFile(join(ROOT, 'package.json')).game);
const description = value('--public-description') ?? (typeof game?.description === 'string' ? game.description : '');
const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();

// 1. the repo
if (ok('gh', ['repo', 'view', repo])) console.log(`✓ ${repo} exists`);
else {
  console.log(`Creating ${repo} (private)…`);
  if (run('gh', ['repo', 'create', repo, '--private', '--description', description]) === null)
    fail(`couldn't create ${repo}`);
}

// 2. the deploy secrets (each repo has its own: org secrets need a paid plan for private repos)
console.log('Setting DEPLOY_SSH_KEY and DEPLOY_HOST…');
const keyText = dry ? '' : readFileSync(key, 'utf8');
if (run('gh', ['secret', 'set', 'DEPLOY_SSH_KEY', '-R', repo], { input: keyText }) === null)
  fail("couldn't set DEPLOY_SSH_KEY");
if (run('gh', ['secret', 'set', 'DEPLOY_HOST', '-R', repo, '-b', host]) === null) fail("couldn't set DEPLOY_HOST");

// 3. the remote and the push
const url = `https://github.com/${repo}.git`;
if (run('git', ['remote', 'get-url', 'origin'], { quiet: true }) === null) run('git', ['remote', 'add', 'origin', url]);
console.log(`Pushing ${branch} (the gate runs npm run check, then deploys)…`);
if (run('git', ['push', '-u', 'origin', branch]) === null) fail('the push failed');

// 4. watch the deploy
if (args.includes('--no-watch') || dry) {
  console.log(`\nWatch it: gh run watch -R ${repo}`);
} else {
  // The push's run appears after a moment: wait up to a minute for it.
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  let id = '';
  for (let i = 0; i < 20 && id === ''; i++) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
    id =
      run('gh', ['run', 'list', '-R', repo, '-c', sha, '--json', 'databaseId', '-q', '.[0].databaseId'], {
        quiet: true,
      })?.trim() ?? '';
  }
  if (id === '') console.log(`No run yet: gh run watch -R ${repo}`);
  else if (spawnSync('gh', ['run', 'watch', id, '-R', repo, '--exit-status'], { stdio: 'inherit' }).status !== 0)
    fail(`the deploy run failed: gh run view ${id} -R ${repo} --log-failed`);
}
console.log(`\nThen check https://${host}/${slug}/`);
