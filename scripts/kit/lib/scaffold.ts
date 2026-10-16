/**
 * scripts/kit/lib: the pure parts of `new-game` (what to keep, what to change).
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/getting-started.md § "Step 3"
 */
import { arr, isRecord, rec, type JsonRecord, type JsonValue } from './json-file.ts';

/** A renderer starter. */
export type Renderer = 'pixi' | 'three' | 'none';

/** The optional features a new game may drop. */
export type Feature = 'daily' | 'race' | 'online' | 'avatar' | 'turns' | 'world';

/** What `new-game` was asked for. */
export type NewGameChoice = { renderer: Renderer; drop: Feature[]; title?: string };

/**
 * Remove, for each dropped feature, the lines tagged `// new-game:<feature>`
 * and every line from `// new-game:<feature>:start` to `// new-game:<feature>:end`.
 */
export function stripFeatureLines(text: string, drop: readonly Feature[]): string {
  const out: string[] = [];
  let skipping: Feature | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (skipping !== null) {
      if (line.includes(`// new-game:${skipping}:end`)) skipping = null;
      continue;
    }
    const start = drop.find((f) => line.includes(`// new-game:${f}:start`));
    if (start !== undefined) {
      skipping = start;
      continue;
    }
    if (drop.some((f) => line.includes(`// new-game:${f}`))) continue;
    out.push(line);
  }
  return out.join('\n');
}

/** The files whose `// new-game:<feature>` lines are stripped for dropped features. */
export const TAGGED_FILES = ['src/game/hooks.ts', 'scripts/shots.config.ts'];

/** The source files each optional feature owns (deleted when dropped). */
export const FEATURE_FILES: Record<Feature, string[]> = {
  daily: ['src/game/daily.ts'],
  race: ['src/game/race.ts'],
  online: ['src/game/online.ts', 'tests/game/online.test.ts'],
  avatar: ['src/game/avatar.ts'],
  turns: ['src/game/turns/rules.ts', 'src/game/turns/board.ts', 'tests/game/turns.test.ts'],
  world: [],
};

/** The npm dependency each renderer needs (the others are removed). */
const RENDERER_DEPS: Record<Renderer, string[]> = { pixi: ['pixi.js'], three: ['three'], none: [] };
const ALL_RENDERER_DEPS = ['pixi.js', 'three', '@types/three'];

/** package.json after the choice: renderer deps, labels, the game block's optional features. */
export function editPackage(pkg: JsonRecord, c: NewGameChoice): JsonRecord {
  const keep = new Set(RENDERER_DEPS[c.renderer]);
  if (c.renderer === 'three') keep.add('@types/three');
  const prune = (deps: JsonValue | undefined): JsonRecord => {
    const out: JsonRecord = {};
    for (const [k, v] of Object.entries(rec(deps) ?? {})) if (!ALL_RENDERER_DEPS.includes(k) || keep.has(k)) out[k] = v;
    return out;
  };
  const game: JsonRecord = { ...(rec(pkg.game) ?? {}) };
  const dims = c.renderer === 'three' ? '3d' : '2d';
  let labels = arr(game.labels).filter((l): l is string => typeof l === 'string' && l !== '2d' && l !== '3d');
  labels = [...labels.slice(0, 1), dims, ...labels.slice(1)];
  const solo = (['race', 'online', 'turns'] as const).every((f) => c.drop.includes(f));
  if (solo) labels = labels.filter((l) => l !== 'multiplayer');
  game.labels = labels;
  if (c.drop.includes('daily')) delete game.dailyChallenges;
  if (c.drop.includes('race')) delete game.race;
  if (c.drop.includes('online')) delete game.multiplayer;
  if (c.drop.includes('turns')) delete game.turns;
  if (c.drop.includes('world')) delete game.world;
  if (c.title !== undefined) {
    game.title = c.title;
    const copy: unknown = game.world === undefined ? undefined : JSON.parse(JSON.stringify(game.world));
    const needs = isRecord(copy) ? rec(rec(copy.generate)?.needs) : undefined;
    if (isRecord(copy) && needs !== undefined && typeof needs.game === 'string') {
      needs.game = c.title; // the room's sign
      game.world = copy;
    }
  }
  game.changes = [];
  return { ...pkg, dependencies: prune(pkg.dependencies), devDependencies: prune(pkg.devDependencies), game };
}

/** Put the game's title into src/game/strings.ts (`COPY.title`), so the title screen says it too. */
export function setCopyTitle(strings: string, title: string): string {
  const quoted = `'${title.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return strings.replace(/^(\s*title: )'[^'\n]*',$/m, (_m, lead: string) => `${lead}${quoted},`);
}

/** Parse `new-game` arguments (`--renderer pixi --no-daily --no-race --no-online --no-turns --no-world --no-avatar --title "X"`). */
export function parseNewGameArgs(argv: readonly string[]): NewGameChoice {
  const value = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : argv.find((a) => a.startsWith(`${flag}=`))?.split('=')[1];
  };
  const renderer = value('--renderer') ?? 'pixi';
  if (renderer !== 'pixi' && renderer !== 'three' && renderer !== 'none') {
    throw new Error(`--renderer must be pixi, three or none (got "${renderer}")`);
  }
  const drop: Feature[] = [];
  for (const f of ['daily', 'race', 'online', 'avatar', 'turns', 'world'] as const)
    if (argv.includes(`--no-${f}`)) drop.push(f);
  const title = value('--title');
  return title === undefined ? { renderer, drop } : { renderer, drop, title };
}
