/**
 * `npm run check`: every local gate in parallel lanes (bfme check-quick).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "npm run check"
 *
 *   npm run check                    # typecheck, test, lint, format, kit:check, hub-doctor, build
 *   npm run check -- --only test,lint
 *
 * Each lane logs to .tmp/check/<lane>.log; a failing lane's error lines are echoed.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, TMP } from './lib/paths.ts';

type Lane = { name: string; cmd: string };

const LANES: Lane[] = [
  { name: 'typecheck', cmd: 'npm run typecheck' },
  { name: 'test', cmd: 'npm test' },
  { name: 'lint', cmd: 'npm run lint' },
  { name: 'format', cmd: 'npm run format:check' },
  { name: 'kit', cmd: 'npm run kit:check' },
  { name: 'hub-doctor', cmd: 'npm run hub-doctor' },
  { name: 'build', cmd: 'npm run build' },
];

const onlyArg = process.argv.find((a) => a.startsWith('--only'));
const only = onlyArg
  ? (onlyArg.split('=')[1] ?? process.argv[process.argv.indexOf(onlyArg) + 1] ?? '').split(',')
  : null;
const lanes = only ? LANES.filter((l) => only.includes(l.name)) : LANES;
const dir = join(TMP, 'check');
mkdirSync(dir, { recursive: true });

function run(lane: Lane): Promise<{ lane: Lane; ok: boolean; ms: number; out: string }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const child = spawn(lane.cmd, { cwd: ROOT, shell: true, env: { ...process.env, FORCE_COLOR: '0' } });
    let out = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (out += d.toString()));
    child.on('close', (code) => {
      writeFileSync(join(dir, `${lane.name}.log`), out);
      resolve({ lane, ok: code === 0, ms: Date.now() - start, out });
    });
  });
}

const results = await Promise.all(lanes.map(run));
let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.lane.name.padEnd(10)} ${(r.ms / 1000).toFixed(1)}s`);
  if (r.ok) continue;
  failed++;
  const lines = r.out.split(/\r?\n/).filter((l) => /error|✗|×|fail|problem|warn/i.test(l));
  for (const l of (lines.length > 0 ? lines : r.out.split(/\r?\n/).slice(-15)).slice(0, 30)) console.log(`    ${l}`);
  console.log(`    (full log: .tmp/check/${r.lane.name}.log)`);
}
console.log(failed === 0 ? 'check: all lanes passed' : `check: ${failed} lane(s) failed`);
process.exit(failed === 0 ? 0 : 1);
