/**
 * `npm run kit:sync [module…]`: copy kit modules from the template, byte-identical.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/README.md § "Keeping up to date"
 *
 *   npm run kit:sync                 # every module, from ../dg-template (or DG_TEMPLATE)
 *   npm run kit:sync -- save daily   # just these
 *   npm run kit:sync -- --dry-run    # show what would change
 *   npm run kit:sync -- --force      # overwrite local edits (a fork belongs outside src/kit/)
 *   npm run kit:sync -- --no-check   # skip `npm run check` afterwards
 *
 * It prints the CHANGELOG entries newer than this game's kit version, refuses
 * a module whose local copy was edited, copies, updates kit.json and runs
 * `npm run check`.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  compareVersions,
  driftedFiles,
  readKitManifest,
  writeKitManifest,
  type KitManifest,
} from './lib/kit-manifest.ts';
import { isTemplate, ROOT, TEMPLATE } from './lib/paths.ts';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const wanted = args.filter((a) => !a.startsWith('--'));
const dryRun = flags.has('--dry-run');

if (isTemplate()) {
  console.error('kit:sync runs in a game; the template is the source.');
  process.exit(1);
}
const source = readKitManifest(TEMPLATE);
if (!source) {
  console.error(`no kit.json in ${TEMPLATE} (set DG_TEMPLATE to the dg-template checkout)`);
  process.exit(1);
}
const local: KitManifest = readKitManifest(ROOT) ?? { kitVersion: '0.0', modules: {} };
const names = wanted.length > 0 ? wanted : Object.keys(source.modules);
const unknown = names.filter((n) => !source.modules[n]);
if (unknown.length > 0) {
  console.error(`unknown module(s): ${unknown.join(', ')} (known: ${Object.keys(source.modules).join(', ')})`);
  process.exit(1);
}

printChangelogSince(local.kitVersion);

let refused = 0;
let changed = 0;
for (const name of names) {
  const from = source.modules[name];
  if (!from) continue;
  const mine = local.modules[name];
  if (mine) {
    const { edited } = driftedFiles(ROOT, mine);
    if (edited.length > 0 && !flags.has('--force')) {
      console.error(
        `✗ ${name}: edited locally (${edited.join(', ')}); undo the edits, or --force (fork it out of src/kit/ first)`,
      );
      refused++;
      continue;
    }
  }
  const stale = Object.keys(mine?.files ?? {}).filter((f) => !(f in from.files));
  const differs = Object.entries(from.files).filter(([f, h]) => mine?.files[f] !== h || !existsSync(join(ROOT, f)));
  if (differs.length === 0 && stale.length === 0) continue;
  changed++;
  console.log(
    `${dryRun ? '~' : '✓'} ${name} ${mine?.version ?? '(new)'} → ${from.version}: ${differs.length} file(s) copied, ${stale.length} removed`,
  );
  if (dryRun) continue;
  for (const [file] of differs) {
    mkdirSync(dirname(join(ROOT, file)), { recursive: true });
    copyFileSync(join(TEMPLATE, file), join(ROOT, file));
  }
  for (const file of stale) rmSync(join(ROOT, file), { force: true });
  local.modules[name] = { version: from.version, files: { ...from.files } };
}

if (!dryRun && changed > 0) {
  if (wanted.length === 0 && refused === 0) local.kitVersion = source.kitVersion;
  writeKitManifest(ROOT, local);
}
console.log(
  `kit:sync: ${changed} module(s) ${dryRun ? 'would change' : 'updated'}${refused ? `, ${refused} refused` : ''}; kit ${local.kitVersion}`,
);
if (refused > 0) process.exit(1);
if (!dryRun && changed > 0 && !flags.has('--no-check')) execSync('npm run check', { cwd: ROOT, stdio: 'inherit' });

/** Print the template CHANGELOG sections newer than `version`. */
function printChangelogSince(version: string): void {
  const path = join(TEMPLATE, 'docs', 'kit', 'CHANGELOG.md');
  if (!existsSync(path)) return;
  const sections = readFileSync(path, 'utf8').split(/^## /m).slice(1);
  const newer = sections.filter((s) => compareVersions(s.split(/\s/)[0] ?? '0', version) > 0);
  if (newer.length === 0) return;
  console.log(`What changed in the kit since ${version}:\n`);
  for (const s of newer) console.log(`## ${s.trim()}\n`);
}
