// A new game passes its own checks as created (template only): `new-game` with every `--no-*` flag in a temp
// folder, then its typecheck and its unit tests, the kit's included. Games skip it (no src/starters/ to make one).
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { isTemplate, ROOT } from '../../scripts/kit/lib/paths.ts';

const temp = isTemplate() ? mkdtempSync(join(tmpdir(), 'dg-new-game-')) : '';
const game = join(temp, 'probe-game');

/** Run a tool in the new game; the output on failure. */
function run(script: string, ...args: string[]): { ok: boolean; out: string } {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith('VITEST') && k !== 'NODE_OPTIONS'),
  );
  const r = spawnSync(process.execPath, [script, ...args], { cwd: game, encoding: 'utf8', env, timeout: 240_000 });
  return { ok: r.status === 0, out: `${r.stdout}\n${r.stderr}`.trim().split('\n').slice(-40).join('\n') };
}

afterAll(() => {
  if (temp === '') return;
  try {
    rmdirSync(join(game, 'node_modules')); // the junction only, never the template's packages behind it
  } catch {
    // never made
  }
  rmSync(temp, { recursive: true, force: true });
});

describe.skipIf(!isTemplate())('a new game made with every --no-* flag', () => {
  it('passes its typecheck and its unit tests with no edits, and has no example names left', () => {
    // The template's files as git sees them (committed and new, not ignored), without its own tools.
    const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter((f) => f !== '' && !f.startsWith('tools/') && f !== 'tests/kit-skips.json');
    for (const f of files) {
      mkdirSync(dirname(join(game, f)), { recursive: true });
      try {
        copyFileSync(join(ROOT, f), join(game, f));
      } catch {
        // deleted in the working tree
      }
    }
    symlinkSync(join(ROOT, 'node_modules'), join(game, 'node_modules'), 'junction');
    const flags = ['--no-daily', '--no-race', '--no-online', '--no-turns', '--no-world', '--no-avatar'];
    const made = run(
      'scripts/kit/new-game.ts',
      '--renderer',
      'pixi',
      '--title',
      'Probe Game',
      '--no-install',
      ...flags,
    );
    expect(made.ok, made.out).toBe(true);

    for (const project of ['tsconfig.json', 'tsconfig.node.json']) {
      const tsc = run('node_modules/typescript/bin/tsc', '--noEmit', '-p', project);
      expect(tsc.ok, tsc.out).toBe(true);
    }
    const tests = run(
      'node_modules/vitest/vitest.mjs',
      'run',
      '--project',
      'kit',
      '--project',
      'hub-events',
      '--project',
      'game',
    );
    expect(tests.ok, tests.out).toBe(true);

    for (const f of ['package.json', 'index.html', 'README.md', 'docs/game.md', 'src/game/strings.ts'])
      expect(readFileSync(join(game, f), 'utf8'), f).not.toMatch(/coin/i);
    expect(readFileSync(join(game, 'index.html'), 'utf8')).toContain('<title>Probe Game</title>');
  }, 300_000);
});
