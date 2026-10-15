/**
 * daily-puzzle kit: the engine adapter interface and the winning-line search.
 *
 * Source: dg-template `src/kit/daily-puzzle/` (github.com/diffenderfer-games/dg-template).
 * Games copy this folder byte-identical; change it in the template first, then re-copy.
 *
 * A game plugs its own rules engine in through `PuzzleRules`. The search walks
 * every legal line from a start state (depth first, in `moves` order, so it is
 * deterministic) and collects the distinct winning lines. Equivalent lines
 * (two equal cards played in either order…) merge through `stepKey`.
 */
import { stableStringify, type Json } from './json.ts';

/** A game's rules engine, as the kit sees it. `S` is a state, `A` an action. */
export type PuzzleRules<S, A extends Json> = {
  /**
   * The actions worth searching from `state`, in a fixed order. Return `[]`
   * once the attempt is over (won or lost). It may leave out actions that can
   * never win (a toss that ends the turn); `apply` must still accept them.
   */
  moves(state: S): readonly A[];
  /** The state after `action`, or `null` when it is illegal. Must not change `state`. */
  apply(state: S, action: A): S | null;
  /** The puzzle's goal is met in `state`. */
  won(state: S): boolean;
};

/** Search limits. All are deterministic units: the search never reads a clock. */
export type SearchOptions<S, A extends Json> = {
  /** Stop once this many distinct winning lines are found (to test "at most N", ask for N + 1). */
  limit?: number;
  /** The longest line searched (default 64 actions). */
  maxDepth?: number;
  /** The most states visited (default 200 000); past it the result is not `complete`. */
  maxNodes?: number;
  /**
   * The canonical key of taking `action` in `state`, so equivalent lines merge
   * (a line's key is its steps' keys joined). Default: the action's JSON. A
   * step keyed `''` is left out of its line's identity: lines that differ only
   * in such steps (cards played on the way, in any order) are one line.
   */
  stepKey?: (state: S, action: A) => string;
  /**
   * A canonical key of a state. When set, a state already searched is not
   * searched again (a transposition: the same position reached by playing the
   * same cards in another order): the winning ways on from it are remembered
   * and joined to each route that reaches it, so the count stays exact and
   * searches with many orderings stay small. Two states may share a key only
   * when every action does the same thing from both (the remembered actions
   * are reused as they are), and it assumes `maxDepth` doesn't cut a line short.
   */
  stateKey?: (state: S) => string;
};

/** What a search found. */
export type SearchResult<A extends Json> = {
  /** The distinct winning lines, in search order. */
  lines: A[][];
  /** States visited. */
  nodes: number;
  /** Why the search stopped early: `limit` (enough lines found), `nodes` (the cap), or `null` (it saw everything). */
  stopped: 'limit' | 'nodes' | null;
};

const DEFAULT_DEPTH = 64;
const DEFAULT_NODES = 200_000;

/** A winning way on from a state: its actions and the step keys that name it. */
type Suffix<A> = { keys: string[]; line: A[] };
const SEP = '';

/** Every distinct winning line from `start` (up to `limit`). */
export function findWinningLines<S, A extends Json>(rules: PuzzleRules<S, A>, start: S, opts: SearchOptions<S, A> = {}): SearchResult<A> {
  const limit = opts.limit ?? Number.POSITIVE_INFINITY;
  const maxDepth = opts.maxDepth ?? DEFAULT_DEPTH;
  const maxNodes = opts.maxNodes ?? DEFAULT_NODES;
  const stepKey = opts.stepKey ?? ((_s: S, a: A) => stableStringify(a));
  /** With a stateKey: the winning ways on from each state already searched. */
  const memo = new Map<string, Suffix<A>[]>();
  let nodes = 0;
  let nodesOut = false;

  /** The distinct winning ways on from `state` (at most `limit`: that's all a caller ever needs). */
  const walk = (state: S, depth: number): Suffix<A>[] => {
    if (nodesOut) return [];
    if (++nodes > maxNodes) { nodesOut = true; return []; }
    if (rules.won(state)) return [{ keys: [], line: [] }];
    if (depth >= maxDepth) return [];
    const at = opts.stateKey ? opts.stateKey(state) : null;
    if (at !== null) {
      const known = memo.get(at);
      if (known) return known;
      memo.set(at, []); // (being searched: a way back to it adds nothing)
    }
    const out: Suffix<A>[] = [];
    const ids = new Set<string>();
    for (const action of rules.moves(state)) {
      const next = rules.apply(state, action);
      if (next === null) continue;
      const k = stepKey(state, action);
      for (const suffix of walk(next, depth + 1)) {
        const keys = k === '' ? suffix.keys : [k, ...suffix.keys];
        const id = keys.join(SEP);
        if (ids.has(id)) continue;
        ids.add(id);
        out.push({ keys, line: [action, ...suffix.line] });
        if (out.length >= limit) break;
      }
      if (out.length >= limit || nodesOut) break;
    }
    // a search cut short by the node cap is not remembered as complete
    if (at !== null && !nodesOut) memo.set(at, out);
    return out;
  };
  const found = walk(start, 0);
  const lines = found.map((s) => s.line);
  return { lines, nodes, stopped: nodesOut ? 'nodes' : lines.length >= limit ? 'limit' : null };
}

/** Is the puzzle still winnable from `state`? (The instant-fail check.) */
export function hasWinningLine<S, A extends Json>(rules: PuzzleRules<S, A>, state: S, opts: SearchOptions<S, A> = {}): boolean {
  return findWinningLines(rules, state, { ...opts, limit: 1 }).lines.length > 0;
}

/** Each first move from `start`, and whether some winning line begins with it. */
export function firstMoveOutcomes<S, A extends Json>(rules: PuzzleRules<S, A>, start: S, opts: SearchOptions<S, A> = {}): { action: A; wins: boolean }[] {
  const out: { action: A; wins: boolean }[] = [];
  for (const action of rules.moves(start)) {
    const next = rules.apply(start, action);
    out.push({ action, wins: next !== null && hasWinningLine(rules, next, opts) });
  }
  return out;
}

/** The distinct choices in `state`: its moves, with equivalent ones (same `stepKey`) counted once. */
export function choiceCount<S, A extends Json>(rules: PuzzleRules<S, A>, state: S, opts: SearchOptions<S, A> = {}): number {
  const stepKey = opts.stepKey ?? ((_s: S, a: A) => stableStringify(a));
  return new Set(rules.moves(state).map((a) => stepKey(state, a))).size;
}

/**
 * How many distinct choices the player had before each step of `line`
 * (`choiceCount`). A step with 2 or more is a decision point. Throws if the
 * line is illegal.
 */
export function choicesAlong<S, A extends Json>(rules: PuzzleRules<S, A>, start: S, line: readonly A[], opts: SearchOptions<S, A> = {}): number[] {
  const out: number[] = [];
  let state = start;
  for (const action of line) {
    out.push(choiceCount(rules, state, opts));
    const next = rules.apply(state, action);
    if (next === null) throw new Error(`choicesAlong: illegal action ${stableStringify(action)}`);
    state = next;
  }
  return out;
}
