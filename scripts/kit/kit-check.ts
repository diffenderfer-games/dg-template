/**
 * `npm run kit:check`: the kit files are unedited, and the `game` block follows the kit's rules.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/README.md § "Keeping up to date"
 *
 * Fails when a file listed in kit.json was edited or deleted (change it in
 * the template and `kit:sync`, or fork it out of src/kit/ and say so in
 * docs/game.md), when a `src/kit/` file isn't in kit.json, when the
 * `game` block breaks a rule hub-doctor doesn't check (lib/game-block.ts), or
 * when tests/kit-skips.json lists something that isn't a kit test.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkAges, checkBoards, checkChanges, checkLabels, checkWorld } from './lib/game-block.ts';
import { rec, readJsonFile } from './lib/json-file.ts';
import { driftedFiles, readKitManifest } from './lib/kit-manifest.ts';
import { KIT_SKIPS_FILE, readKitSkips } from './lib/kit-skips.ts';
import { expandPath } from './lib/modules.ts';
import { isTemplate, ROOT } from './lib/paths.ts';

const problems: string[] = [];
const warnings: string[] = [];

// 1. kit files unedited
const manifest = readKitManifest(ROOT);
if (!manifest) {
  problems.push('kit.json is missing (run `npm run kit:sync`, or `npm run kit:hash` in the template)');
} else {
  const listed = new Set<string>();
  for (const [name, entry] of Object.entries(manifest.modules)) {
    for (const f of Object.keys(entry.files)) listed.add(f);
    const { edited, missing } = driftedFiles(ROOT, entry);
    const fix = isTemplate()
      ? 'run `npm run kit:hash` (and bump the module version)'
      : 'undo it, or change it in the template and `npm run kit:sync`';
    for (const f of edited) problems.push(`${name}: ${f} differs from kit.json: ${fix}`);
    for (const f of missing) problems.push(`${name}: ${f} is missing: ${fix}`);
  }
  for (const f of expandPath(ROOT, 'src/kit')) {
    if (!listed.has(f)) {
      const msg = `${f} is in src/kit/ but not in kit.json`;
      if (isTemplate())
        problems.push(`${msg}: add it to a module in scripts/kit/lib/modules.ts and run \`npm run kit:hash\``);
      else problems.push(`${msg}: a forked file belongs outside src/kit/ (see docs/kit/README.md)`);
    }
  }
}

// 2. the game block
const pkg = readJsonFile(join(ROOT, 'package.json'));
const game = rec(pkg.game);
if (!game) {
  problems.push('package.json has no `game` block');
} else {
  problems.push(...checkChanges(game.changes), ...checkAges(game.ages), ...checkWorld(game.world));
  warnings.push(...checkLabels(game.labels));
  if (game.ages === undefined)
    warnings.push(
      `package.json: game.ages is missing: say who the game is for, e.g. { "min": 6 } (the home page's age filter leaves it out until then)`,
    );
  const configPath = join(ROOT, 'src', 'game', 'config.ts');
  if (existsSync(configPath)) {
    try {
      const config: unknown = await import(pathToFileURL(configPath).href);
      const boards: unknown = typeof config === 'object' && config !== null ? Reflect.get(config, 'BOARDS') : undefined;
      if (typeof boards === 'object' && boards !== null) problems.push(...checkBoards(game, Object.keys(boards)));
    } catch (e) {
      warnings.push(
        `couldn't load src/game/config.ts to check its BOARDS (${e instanceof Error ? e.message : String(e)}); keep it free of browser-only imports`,
      );
    }
  }
}

// 3. the kit tests this game skips (tests/kit-skips.json): kit test files that exist, each with a reason
const kitFiles = new Set(Object.values(manifest?.modules ?? {}).flatMap((m) => Object.keys(m.files)));
const listed = readKitSkips(ROOT);
problems.push(...listed.problems);
for (const s of listed.skips) {
  if (!kitFiles.has(s.file))
    problems.push(
      `${KIT_SKIPS_FILE}: ${s.file} is not a kit test file (your own tests are yours to change; kit tests are listed in kit.json)`,
    );
}
const skipNote = listed.skips.length === 0 ? '' : `, ${listed.skips.length} kit test(s) skipped in ${KIT_SKIPS_FILE}`;

// 4. leftovers from the template
if (!isTemplate() && existsSync(join(ROOT, 'src', 'game')) && readdirSync(join(ROOT, 'src', 'game')).length === 0) {
  warnings.push('src/game/ is empty');
}

for (const w of warnings) console.warn(`! ${w}`);
if (problems.length > 0) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error(`kit:check: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(
  `kit:check: ok (kit ${manifest?.kitVersion ?? '?'}, ${Object.keys(manifest?.modules ?? {}).length} modules${skipNote})`,
);
