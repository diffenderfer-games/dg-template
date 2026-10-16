/**
 * scripts/kit/lib: the kit tests this game skips, and why (`tests/kit-skips.json`, the GAME's file).
 * Source: dg-template scripts/kit/ (kit v1.4). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/testing.md § "Kit tests that don't apply"
 *
 *   { "skip": {
 *       "tests/hub/kit/world.test.ts": "no room in the world yet",
 *       "tests/hub-events/overlay.test.ts > row 2: …": "the reason"
 *   } }
 *
 * A key is a kit test file (every test in it), or a file, ` > `, and a test's
 * name: its own title or its full name (`describe > … > it`). The kit's suites
 * never run what is listed: vitest leaves skipped files out and skips listed
 * tests with the reason; `npm run test:hub` and `e2e()` do the same. Nothing
 * is deleted, so `npm run kit:sync` keeps every file and `kit:check` stays clean.
 * Features the game doesn't declare (online, races…) are skipped on their own.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

/** The file, relative to the game's root. */
export const KIT_SKIPS_FILE = 'tests/kit-skips.json';

/** One listed skip. */
export type KitSkip = { file: string; test: string | null; reason: string };

/** Read the list (none when the file is missing); bad entries are problems, not skips. */
export function readKitSkips(root: string): { skips: KitSkip[]; problems: string[] } {
  const path = join(root, KIT_SKIPS_FILE);
  if (!existsSync(path)) return { skips: [], problems: [] };
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { skips: [], problems: [`${KIT_SKIPS_FILE}: not JSON (${e instanceof Error ? e.message : String(e)})`] };
  }
  const map: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'skip') : undefined;
  if (typeof map !== 'object' || map === null || Array.isArray(map))
    return { skips: [], problems: [`${KIT_SKIPS_FILE}: needs a "skip" object of "test" → "reason"`] };
  const skips: KitSkip[] = [];
  const problems: string[] = [];
  for (const [key, reason] of Object.entries(map)) {
    if (typeof reason !== 'string' || reason.trim() === '') {
      problems.push(`${KIT_SKIPS_FILE}: "${key}" needs a reason`);
      continue;
    }
    const at = key.indexOf(' > ');
    const file = (at < 0 ? key : key.slice(0, at)).trim().replace(/\\/g, '/');
    skips.push({ file, test: at < 0 ? null : key.slice(at + 3).trim(), reason });
  }
  return { skips, problems };
}

/** A path as the list writes it: relative to the root, with forward slashes. */
export function listedPath(root: string, file: string): string {
  return (isAbsolute(file) ? relative(root, file) : file).replace(/\\/g, '/');
}

/** The files skipped whole. */
export function skippedFiles(skips: readonly KitSkip[]): string[] {
  return skips.filter((s) => s.test === null).map((s) => s.file);
}

/** Why this test is skipped, or null. `names`: the test's own title and its full name. */
export function skipReason(skips: readonly KitSkip[], file: string, names: readonly string[]): string | null {
  for (const s of skips) {
    if (s.file !== file) continue;
    if (s.test === null || names.includes(s.test)) return s.reason;
  }
  return null;
}
