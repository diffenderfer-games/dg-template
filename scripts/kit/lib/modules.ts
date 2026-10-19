/**
 * scripts/kit/lib: the kit's modules and the files each one owns.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/README.md § "Changing the kit"
 *
 * `npm run kit:hash` (template only) expands these into kit.json. When you
 * change a module: bump its `version` (and `KIT_VERSION` in src/kit/core/version.ts), add a line to
 * docs/kit/CHANGELOG.md, then run `npm run kit:hash`.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** The kit's version (src/kit/core/version.ts, which the test hook reports too). */
export { KIT_VERSION } from '../../../src/kit/core/version.ts';

/** A module: its version and the paths (files or folders) it owns. */
export type KitModuleDef = { version: string; paths: string[] };

/** The source module (`src/kit/<name>/`) plus its tests and doc. */
function srcModule(name: string, version = '1.0'): KitModuleDef {
  return { version, paths: [`src/kit/${name}`, `tests/kit/${name}`, `docs/kit/${name}.md`] };
}

/** Every module. */
export const KIT_MODULES: Record<string, KitModuleDef> = {
  core: srcModule('core', '1.10'),
  testing: srcModule('testing', '1.10'),
  rng: srcModule('rng'),
  'daily-puzzle': srcModule('daily-puzzle', '1.1'),
  save: srcModule('save', '1.1'),
  resume: srcModule('resume', '1.2'),
  daily: srcModule('daily', '1.2'),
  pause: srcModule('pause', '1.2'),
  scores: srcModule('scores', '1.1'),
  'test-hook': srcModule('test-hook', '1.2'),
  boot: srcModule('boot', '1.9'),
  input: srcModule('input', '1.3'),
  layout: srcModule('layout', '1.3'),
  loop: srcModule('loop', '1.1'),
  ui: srcModule('ui', '1.5'),
  'settings-ui': srcModule('settings-ui'),
  race: srcModule('race', '1.2'),
  online: srcModule('online', '1.4'),
  audio: srcModule('audio', '1.1'),
  haptics: srcModule('haptics'),
  server: srcModule('server', '1.2'),
  saved: srcModule('saved', '1.3'),
  turns: srcModule('turns', '1.8'),
  live: srcModule('live'),
  avatar: srcModule('avatar', '1.5'),
  world: srcModule('world', '1.5'),
  'hub-events': { version: '1.8', paths: ['tests/hub-events'] },
  'hub-suites': { version: '1.11', paths: ['tests/hub/_kit.ts', 'tests/hub/kit'] },
  scripts: { version: '1.19', paths: ['scripts/kit', 'tests/scripts'] },
  ci: { version: '1.0', paths: ['.github/workflows/deploy.yml'] },
  agents: { version: '1.0', paths: ['.claude/agents'] },
  config: {
    version: '1.2',
    paths: [
      'eslint.config.ts',
      'vitest.config.ts',
      'tsconfig.base.json',
      '.prettierrc.json',
      '.prettierignore',
      '.gitattributes',
    ],
  },
  docs: {
    version: '1.18',
    paths: [
      'docs/kit/look.md',
      'docs/kit/look',
      'docs/getting-started.md',
      'docs/repo-setup.md',
      'docs/kit/README.md',
      'docs/kit/CHANGELOG.md',
      'docs/kit/screenshots.md',
      'docs/kit/whats-new.md',
      'docs/kit/hooks.md',
      'docs/kit/polish.md',
      'docs/kit/covers.md',
      'docs/kit/card-games.md',
      'docs/kit/playing-together.md',
      'docs/kit/review.md',
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
