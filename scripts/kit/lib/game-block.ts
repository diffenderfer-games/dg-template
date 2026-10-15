/**
 * scripts/kit/lib: checks on package.json's `game` block that hub-doctor doesn't make.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/whats-new.md, docs/kit/world.md
 *
 * - `changes`: kid language (no jargon, no violent words), at most 280 characters;
 * - `labels`: only the hub's vocabulary;
 * - boards: every board the game's code uses is declared in `leaderboards`;
 * - `world` (world.md §3.1): keys, titles, player ranges and counts.
 */
import { GAME_LABELS } from '@diffenderfer-games/hub-contract';
import { wordingProblems } from '../../../src/kit/core/wording.ts';
import { arr, isRecord, rec, str, type JsonRecord, type JsonValue } from './json-file.ts';

const JARGON =
  /\b(refactor\w*|fix #\d*|PR|pull request|bug ?fix|commit|merge|lint|typescript|ci|api|regression|deps?)\b/i;

/** Problems with the "What's new" list. */
export function checkChanges(changes: JsonValue | undefined): string[] {
  const problems: string[] = [];
  arr(changes).forEach((c, i) => {
    const text = typeof c === 'string' ? c : isRecord(c) ? str(c.text) : undefined;
    if (text === undefined) {
      problems.push(`changes[${i}]: a string or { id, text }`);
      return;
    }
    if (text.length > 280) problems.push(`changes[${i}]: longer than 280 characters`);
    const jargon = JARGON.exec(text);
    if (jargon) problems.push(`changes[${i}]: "${jargon[0]}" is developer talk; write it for a kid`);
    for (const p of wordingProblems(text, 280).filter((x) => x.startsWith('violent')))
      problems.push(`changes[${i}]: ${p}`);
  });
  return problems;
}

/** Labels outside the hub's vocabulary. */
export function checkLabels(labels: JsonValue | undefined): string[] {
  const known = new Set<string>(GAME_LABELS);
  return arr(labels)
    .filter((l): l is string => typeof l === 'string' && !known.has(l))
    .map((l) => `labels: "${l}" is not one of ${GAME_LABELS.join(', ')}`);
}

/** Boards used in code but not declared in `game.leaderboards`. */
export function checkBoards(game: JsonRecord, used: readonly string[]): string[] {
  const declared = new Set(Object.keys(rec(game.leaderboards) ?? {}));
  return used
    .filter((b) => !declared.has(b))
    .map((b) => `leaderboards: the code submits to "${b}" but game.leaderboards doesn't declare it`);
}

const KEY = /^[A-Za-z0-9_-]{1,32}$/;

/** world.md §3.1 validation (warnings; the hub's registry has the last word). */
export function checkWorld(world: JsonValue | undefined, modes: readonly string[]): string[] {
  if (world === undefined) return [];
  const w = rec(world);
  if (!w) return ['world: must be an object'];
  const problems: string[] = [];
  const tables = arr(w.tables);
  if (tables.length > 8) problems.push(`world.tables: ${tables.length} table types (at most 8)`);
  let total = 0;
  tables.forEach((t, i) => {
    const table = rec(t);
    if (!table) return void problems.push(`world.tables[${i}]: must be an object`);
    const key = str(table.key) ?? '';
    if (!KEY.test(key)) problems.push(`world.tables[${i}].key: [A-Za-z0-9_-]{1,32}`);
    const title = str(table.title) ?? '';
    if (title.length === 0 || title.length > 24) problems.push(`world.tables[${i}].title: 1 to 24 characters`);
    const players = arr(table.players);
    const [lo, hi] = [players[0], players[1]];
    if (typeof lo !== 'number' || typeof hi !== 'number' || lo < 1 || hi > 8 || lo > hi)
      problems.push(`world.tables[${i}].players: [min, max] within 1..8`);
    const mode = str(table.mode);
    if (mode !== undefined && mode !== 'race' && !modes.includes(mode))
      problems.push(`world.tables[${i}].mode: "${mode}" isn't a declared mode`);
    const count = typeof table.count === 'number' ? table.count : 1;
    if (count < 1 || count > 6) problems.push(`world.tables[${i}].count: 1 to 6`);
    total += count;
    const options = table.options;
    if (options !== undefined && JSON.stringify(options).length > 1024)
      problems.push(`world.tables[${i}].options: at most 1 KB`);
  });
  if (total > 16) problems.push(`world.tables: ${total} tables in all (at most 16)`);
  return problems;
}

/** The `multiplayer.modes[].key` list. */
export function modeKeys(game: JsonRecord): string[] {
  return arr(rec(game.multiplayer)?.modes)
    .map((m) => str(rec(m)?.key))
    .filter((k): k is string => k !== undefined);
}
