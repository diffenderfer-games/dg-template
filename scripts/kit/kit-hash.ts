/**
 * `npm run kit:hash` (template only): write kit.json from the module list.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/README.md § "Changing the kit"
 *
 *   npm run kit:hash              # hash the working tree
 *   npm run kit:hash -- --staged  # hash what git will commit (the index), for files it tracks
 *
 * It warns when a module's files changed but its version didn't (bump it in
 * scripts/kit/lib/modules.ts and add a CHANGELOG line).
 */
import { execFileSync } from 'node:child_process';
import { ROOT, isTemplate } from './lib/paths.ts';
import { hashFile, hashText, parseKitManifest, writeKitManifest, type KitManifest } from './lib/kit-manifest.ts';
import { KIT_MODULES, KIT_VERSION, moduleFiles } from './lib/modules.ts';
import { join } from 'node:path';

if (!isTemplate()) {
  console.error('kit:hash runs in the template only (games get kit.json from kit:sync).');
  process.exit(1);
}

const staged = process.argv.includes('--staged');

/** The staged text of a tracked file, or null (untracked: hash the working tree). */
function stagedText(file: string): string | null {
  return stagedOrHead(`:${file}`);
}

/** `git show <spec>`, or null. */
function stagedOrHead(spec: string): string | null {
  try {
    return execFileSync('git', ['show', spec], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function hashOf(file: string): string | null {
  if (staged) {
    const text = stagedText(file);
    if (text !== null) return hashText(text);
  }
  return hashFile(join(ROOT, file));
}

// Compare with the committed kit.json: a module whose files changed since the last commit needs a version bump.
const committed = stagedOrHead('HEAD:kit.json');
const before = committed === null ? null : parseKitManifest(committed);
const next: KitManifest = { kitVersion: KIT_VERSION, modules: {} };
let warnings = 0;
for (const [name, def] of Object.entries(KIT_MODULES)) {
  const files: Record<string, string> = {};
  for (const file of moduleFiles(ROOT, def)) {
    const h = hashOf(file);
    if (h !== null) files[file] = h;
  }
  if (Object.keys(files).length === 0) continue;
  next.modules[name] = { version: def.version, files };
  const old = before?.modules[name];
  if (old && old.version === def.version && JSON.stringify(old.files) !== JSON.stringify(files)) {
    const changed = Object.keys(files).filter((f) => old.files[f] !== files[f]).length;
    console.warn(
      `! ${name}: ${changed} file(s) changed but its version is still ${def.version}; bump it in scripts/kit/lib/modules.ts`,
    );
    warnings++;
  }
}
writeKitManifest(ROOT, next);
const fileCount = Object.values(next.modules).reduce((n, m) => n + Object.keys(m.files).length, 0);
console.log(
  `kit.json: kit ${KIT_VERSION}, ${Object.keys(next.modules).length} modules, ${fileCount} files${warnings ? `, ${warnings} warning(s)` : ''}`,
);
