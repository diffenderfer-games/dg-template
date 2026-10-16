/**
 * scripts/kit/lib: the kit's modules and the files each one owns.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/README.md § "Changing the kit"
 *
 * `npm run kit:hash` (template only) expands these into kit.json. When you
 * change a module: bump its `version` (and `KIT_VERSION`), add a line to
 * docs/kit/CHANGELOG.md, then run `npm run kit:hash`.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** The kit's version: `major.minor`. A major means a hook signature changed (see the CHANGELOG). */
export const KIT_VERSION = '1.2';

/** A module: its version and the paths (files or folders) it owns. */
export type KitModuleDef = { version: string; paths: string[] };

/** The source module (`src/kit/<name>/`) plus its tests and doc. */
function srcModule(name: string, version = '1.0'): KitModuleDef {
  return { version, paths: [`src/kit/${name}`, `tests/kit/${name}`, `docs/kit/${name}.md`] };
}

/** Every module. */
export const KIT_MODULES: Record<string, KitModuleDef> = {
  core: srcModule('core', '1.2'),
  testing: srcModule('testing', '1.2'),
  rng: srcModule('rng'),
  'daily-puzzle': srcModule('daily-puzzle'),
  save: srcModule('save'),
  resume: srcModule('resume', '1.1'),
  daily: srcModule('daily', '1.1'),
  pause: srcModule('pause'),
  scores: srcModule('scores'),
  'test-hook': srcModule('test-hook', '1.1'),
  boot: srcModule('boot', '1.2'),
  input: srcModule('input'),
  layout: srcModule('layout', '1.1'),
  loop: srcModule('loop'),
  ui: srcModule('ui', '1.1'),
  'settings-ui': srcModule('settings-ui'),
  race: srcModule('race'),
  online: srcModule('online', '1.1'),
  audio: srcModule('audio'),
  haptics: srcModule('haptics'),
  server: srcModule('server', '1.2'),
  saved: srcModule('saved', '1.2'),
  turns: srcModule('turns', '1.2'),
  avatar: srcModule('avatar', '1.2'),
  world: srcModule('world', '1.2'),
  'hub-events': { version: '1.2', paths: ['tests/hub-events'] },
  'hub-suites': { version: '1.2', paths: ['tests/hub/_kit.ts', 'tests/hub/kit'] },
  scripts: { version: '1.2', paths: ['scripts/kit', 'tests/scripts'] },
  ci: { version: '1.0', paths: ['.github/workflows/deploy.yml'] },
  config: { version: '1.0', paths: ['eslint.config.ts', 'tsconfig.base.json', '.prettierrc.json', '.prettierignore'] },
  docs: {
    version: '1.2',
    paths: [
      'docs/getting-started.md',
      'docs/repo-setup.md',
      'docs/kit/README.md',
      'docs/kit/CHANGELOG.md',
      'docs/kit/screenshots.md',
      'docs/kit/whats-new.md',
      'docs/kit/hooks.md',
    ],
  },
};

/** Every file under `path` (a file or a folder), relative to `root`, with `/` separators. */
export function expandPath(root: string, path: string): string[] {
  const abs = join(root, path);
  if (!existsSync(abs)) return [];
  if (statSync(abs).isFile()) return [path];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else out.push(relative(root, p).replace(/\\/g, '/'));
    }
  };
  walk(abs);
  return out.sort();
}

/** The files a module owns, today. */
export function moduleFiles(root: string, def: KitModuleDef): string[] {
  return [...new Set(def.paths.flatMap((p) => expandPath(root, p)))].sort();
}
