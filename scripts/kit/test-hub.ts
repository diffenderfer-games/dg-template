/**
 * `npm run test:hub`: the browser hub suites (tests/hub/) on a real hub test host, one file at a time.
 * Source: dg-template scripts/kit/ (kit v1.4). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "Browser hub suites"
 *
 *   npm run test:hub                                   # every file (~20–25 min: one host per file)
 *   npm run test:hub -- tests/hub/kit/progress.test.ts # one file
 *
 * Files listed whole in tests/kit-skips.json are left out (and said so); listed
 * tests are skipped by `e2e()` in tests/hub/_kit.ts. Don't edit the game while
 * it runs: the test host rebuilds the game from source for each file.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { listedPath, readKitSkips, skippedFiles } from './lib/kit-skips.ts';
import { ROOT } from './lib/paths.ts';

/** Every `*.test.ts` under tests/hub/, relative to the root. */
function suites(): string[] {
  const dir = join(ROOT, 'tests', 'hub');
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => listedPath(ROOT, join(dir, f)))
    .sort();
}

const asked = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const flags = process.argv.slice(2).filter((a) => a.startsWith('-'));
const { skips } = readKitSkips(ROOT);
const skipped = new Set(skippedFiles(skips));
const files = (asked.length > 0 ? asked.map((f) => listedPath(ROOT, f)) : suites()).filter((f) => {
  if (!skipped.has(f)) return true;
  console.log(
    `- ${f}: skipped (tests/kit-skips.json: ${skips.find((s) => s.file === f && s.test === null)?.reason ?? ''})`,
  );
  return false;
});
if (files.length === 0) {
  console.log('test:hub: no suites to run');
  process.exit(0);
}
const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...flags, ...files], {
  cwd: ROOT,
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
