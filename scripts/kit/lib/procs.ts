/**
 * scripts/kit/lib: remember the processes a script starts, and clean up only those (bfme procs.mjs).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/screenshots.md § "Cleaning up"
 *
 * Every browser and server the kit scripts start is listed in .tmp/procs.json
 * (and Chrome is tagged `--dg-shots=<repo>`), so `npm run clean:procs` stops
 * exactly what this repo's scripts left behind, never another instance's.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, TMP } from './paths.ts';

const FILE = join(TMP, 'procs.json');

/** The Chrome flag that marks this repo's browsers. */
export const CHROME_TAG = `--dg-shots=${ROOT.replace(/\\/g, '/')}`;

type Entry = { pid: number; what: string; at: string };

function read(): Entry[] {
  if (!existsSync(FILE)) return [];
  const parsed: unknown = JSON.parse(readFileSync(FILE, 'utf8'));
  return Array.isArray(parsed)
    ? parsed.filter(
        (e: unknown): e is Entry => typeof e === 'object' && e !== null && typeof Reflect.get(e, 'pid') === 'number',
      )
    : [];
}

/** Note a process this repo started. */
export function remember(pid: number | undefined, what: string): void {
  if (pid === undefined) return;
  mkdirSync(TMP, { recursive: true });
  writeFileSync(FILE, JSON.stringify([...read(), { pid, what, at: new Date().toISOString() }], null, 2));
}

/** Forget a process that ended cleanly. */
export function forget(pid: number | undefined): void {
  if (pid === undefined || !existsSync(FILE)) return;
  writeFileSync(
    FILE,
    JSON.stringify(
      read().filter((e) => e.pid !== pid),
      null,
      2,
    ),
  );
}

function kill(pid: number): boolean {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

/** Chrome processes carrying this repo's tag (left by a crashed run). */
function taggedChromes(): number[] {
  try {
    if (process.platform !== 'win32') {
      return execFileSync('pgrep', ['-f', CHROME_TAG], { encoding: 'utf8' }).split(/\s+/).filter(Boolean).map(Number);
    }
    const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${CHROME_TAG}*' } | ForEach-Object { $_.ProcessId }`;
    return execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
  } catch {
    return [];
  }
}

/** Stop what this repo's scripts started; returns how many. */
export function cleanUp(): number {
  let n = 0;
  for (const e of read()) if (kill(e.pid)) n++;
  for (const pid of taggedChromes()) if (kill(pid)) n++;
  if (existsSync(FILE)) writeFileSync(FILE, '[]');
  return n;
}
