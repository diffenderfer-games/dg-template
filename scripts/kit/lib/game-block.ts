/**
 * scripts/kit/lib: checks on package.json's `game` block that hub-doctor doesn't make.
 * Source: dg-template scripts/kit/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/whats-new.md, docs/kit/world.md
 *
 * - `changes`: kid language (no jargon, no violent words), at most 280 characters;
 * - `labels`: only the hub's vocabulary;
 * - boards: every board the game's code uses is declared in `leaderboards`;
 * - `world`: the live `game.world` shape (a map file or a generated room).
 */
import { GAME_LABELS } from '@diffenderfer-games/hub-contract';
import { wordingProblems } from '../../../src/kit/core/wording.ts';
import { parseGameWorld } from '../../../src/kit/world/room.ts';
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
  const declared = new Set(arr(game.leaderboards).map((b) => str(rec(b)?.key)));
  return used
    .filter((b) => !declared.has(b))
    .map((b) => `leaderboards: the code submits to "${b}" but game.leaderboards doesn't declare it`);
}

/**
 * `game.world` (hub.md "The world"): the hub's own schema (hub-contract's
 * `GameWorld`: a `map` file, a `generate` block, or both). hub-doctor also
 * checks the map file itself; `npm run world:check` checks the room.
 */
export function checkWorld(world: JsonValue | undefined): string[] {
  return parseGameWorld(world).problems;
}

/** The `multiplayer.modes[].key` list. */
export function modeKeys(game: JsonRecord): string[] {
  return arr(rec(game.multiplayer)?.modes)
    .map((m) => str(rec(m)?.key))
    .filter((k): k is string => k !== undefined);
}
