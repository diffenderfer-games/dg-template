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

/** Who and what the new game is (package.json `name`, `description`, `author`). */
export type GameIdentity = { slug: string; title: string; author?: string };

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
export const TAGGED_FILES = ['src/game/hooks.ts', 'src/game/screens/title.ts', 'scripts/shots.config.ts'];

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

/** package.json after the choice: renderer deps, labels, the game block's optional features, its name. */
export function editPackage(pkg: JsonRecord, c: NewGameChoice, id?: GameIdentity): JsonRecord {
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
  const named: JsonRecord =
    id === undefined
      ? {}
      : {
          name: id.slug,
          description: `${id.title}: a diffenderfer.games game.`,
          ...(id.author === undefined ? {} : { author: id.author }),
        };
  return {
    ...pkg,
    ...named,
    dependencies: prune(pkg.dependencies),
    devDependencies: prune(pkg.devDependencies),
    game,
  };
}

/** Put the game's title into index.html's `<title>` (the browser tab). */
export function setHtmlTitle(html: string, title: string): string {
  const safe = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return html.replace(/<title>[^<]*<\/title>/, `<title>${safe}</title>`);
}

/** A new game's README: its name and where to read on (the kit's notes stay in docs/kit/README.md). */
export function gameReadme(title: string, slug: string): string {
  return [
    `# ${title}`,
    '',
    `A [diffenderfer.games](https://diffenderfer.games/${slug}/) game, built on the dg kit.`,
    '',
    '- [docs/game.md](docs/game.md): this game: its design, modes, controls and known issues.',
    '- [CLAUDE.md](CLAUDE.md): how to build and check it.',
    '- [docs/getting-started.md](docs/getting-started.md) and [docs/kit/README.md](docs/kit/README.md): the kit.',
    '',
    '```bash',
    'npm run dev      # play it',
    'npm run check    # every local gate (typecheck, tests, lint, format, kit files, hub-doctor, build)',
    '```',
    '',
  ].join('\n');
}

/** A new game's notes (docs/game.md): the headings to fill in. */
export function gameNotes(title: string): string {
  return [
    `# ${title}: the game's notes`,
    '',
    "GAME doc: yours to edit. Keep this game's own notes here (not in CLAUDE.md),",
    'so the brief stays short and the notes stay in one place.',
    '',
    '## Design',
    '',
    'TODO(game): what the game is, in a few lines, and what makes it fun.',
    '',
    '## Modes',
    '',
    'TODO(game): normal, the daily, races, online: what each one is.',
    '',
    '## Controls',
    '',
    "TODO(game): keys, gamepad and touch. Escape or the gamepad's Start pauses.",
    '',
    '## Test drivers',
    '',
    "TODO(game): your `__game.extra` drivers. The kit's are in [kit/test-hook.md](kit/test-hook.md).",
    '',
    '## Known issues',
    '',
    'None yet. Kit tests this game skips are listed with their reasons in',
    '`tests/kit-skips.json` ([kit/testing.md](kit/testing.md#kit-tests-that-dont-apply)).',
    '',
  ].join('\n');
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
