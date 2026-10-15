/**
 * kit/turns: turn games the hub runs (hub.turns), the rules-module contract, and checkTurnRules.
 * Source: dg-template src/kit/turns/ (kit v1.0). Copy byte-identical; change it in the template first.
 * Docs: docs/kit/turns.md
 *
 * Planned hub API (saved-games.md §3.4 and §4.2, phase 3). The game writes a
 * PURE rules module (src/game/turns/rules.ts, bundled by `npm run build:rules`
 * into a self-contained dist-rules/rules.mjs); the hub runs it on its server
 * with its own RNG. `checkTurnRules` runs now, locally: it mirrors the hub's
 * planned conformance kit, so a game can be ready before the hub ships.
 */
import type { HubLike } from '../core/hub-like.ts';
import { isJson, jsonBytes, type Json } from '../core/json.ts';
import type { PlannedTurnGame } from '../core/planned.ts';
import { mulberry32, type Rng } from '../rng/index.ts';
import { checkStateSize } from './size.ts';

/** saved-games.md §4.2: the rules module. S state, M move, V view, E event, O options. */
export type TurnRules<S extends Json, M extends Json, V extends Json, E extends Json = Json, O extends Json = Json> = {
  readonly version: number;
  setup(ctx: { seats: number; options: O; mode: string | null; rng: Rng }): S;
  /** What `seat` sees (null: a spectator). MUST hide the other seats' secrets. */
  view(state: S, seat: number | null): V;
  /** Whose move it is. */
  toAct(state: S): number[];
  apply(state: S, seat: number, move: M, rng: Rng): { state: S; events?: E[] } | { error: string };
  eventView?(event: E, seat: number | null): E | null;
  outcome(state: S): null | { winners: number[]; places?: number[]; scores?: number[] };
  /** The "Your games" line (kid words, never "turn game"). */
  progress(state: S, seat: number): { label: string; fraction?: number };
  /** The computer's move (left seats, deadlines). Must always be legal. */
  autoMove?(state: S, seat: number, rng: Rng): M;
  migrate?(state: Json, fromVersion: number): S;
};

/** A problem `checkTurnRules` found, with the seed to reproduce it. */
export type RulesProblem = { seed: number; step: number; problem: string };

/**
 * Random playouts with the computer's moves (saved-games.md §8 conformance kit):
 * toAct never empty mid-game; autoMove always legal; apply never throws;
 * deterministic for a seed; state is JSON and at most 64 KB; views never leak
 * other seats' secrets (`secretsOf(state, seat)` lists strings that only
 * `seat` may see).
 */
export function checkTurnRules<S extends Json, M extends Json, V extends Json, E extends Json, O extends Json>(
  rules: TurnRules<S, M, V, E, O>,
  o: { seats: number; options: O; games?: number; maxSteps?: number; secretsOf?: (state: S, seat: number) => string[] },
): RulesProblem[] {
  const problems: RulesProblem[] = [];
  if (!rules.autoMove)
    return [{ seed: 0, step: 0, problem: 'no autoMove: checkTurnRules plays games with the computer' }];
  const autoMove = rules.autoMove.bind(rules);
  const play = (seed: number): string => {
    const rng = mulberry32(seed);
    let state = rules.setup({ seats: o.seats, options: o.options, mode: null, rng });
    const log: string[] = [];
    for (let step = 0; step < (o.maxSteps ?? 500); step++) {
      const report = (problem: string): void => void problems.push({ seed, step, problem });
      if (!isJson(state)) {
        report('state is not JSON');
        break;
      }
      const size = checkStateSize(jsonBytes(state));
      if (size) report(size);
      leaks(state, step, report);
      if (rules.outcome(state) !== null) break;
      const seats = rules.toAct(state);
      if (seats.length === 0) {
        report('toAct is empty before the game is over');
        break;
      }
      const seat = seats[0] ?? 0;
      let next;
      try {
        next = rules.apply(state, seat, autoMove(state, seat, rng), rng);
      } catch (e) {
        report(`apply threw: ${e instanceof Error ? e.message : String(e)}`);
        break;
      }
      if ('error' in next) {
        report(`autoMove made an illegal move (${next.error})`);
        break;
      }
      state = next.state;
      log.push(JSON.stringify(state));
    }
    return log.join('\n');
  };
  const leaks = (state: S, step: number, report: (p: string) => void): void => {
    if (!o.secretsOf) return;
    for (let seat = 0; seat < o.seats; seat++) {
      for (const secret of o.secretsOf(state, seat)) {
        for (let other = -1; other < o.seats; other++) {
          if (other === seat) continue;
          const seen = JSON.stringify(rules.view(state, other === -1 ? null : other));
          if (seen.includes(secret))
            report(
              `step ${step}: seat ${other === -1 ? 'spectator' : other} can see seat ${seat}'s secret "${secret}"`,
            );
        }
      }
    }
  };
  for (let g = 0; g < (o.games ?? 50); g++) {
    const seed = 1000 + g;
    if (play(seed) !== play(seed)) problems.push({ seed, step: 0, problem: 'not deterministic for the same seed' });
  }
  return problems;
}

/** The adapter over `hub.turns` (absent until saved-games phase 3). */
export type TurnsHandle = {
  readonly available: boolean;
  open(id: string): Promise<PlannedTurnGame | null>;
  create(opts: { mode?: string; invite?: number[]; link?: boolean; bots?: number }): Promise<PlannedTurnGame | null>;
};

/** Create the adapter (feature-checked). */
export function createTurns(hub: Pick<HubLike, 'turns'>): TurnsHandle {
  const turns = hub.turns;
  return {
    available: turns !== undefined,
    open: (id) => (turns ? turns.open(id) : Promise.resolve(null)),
    create: (opts) => (turns ? turns.create(opts) : Promise.resolve(null)),
  };
}

/**
 * "Remind them" (TurnGame.nudge), rate-limited in the UI to once per game per
 * day (the hub enforces it too); the alert's words come from the hub only.
 */
export function nudger(game: Pick<PlannedTurnGame, 'nudge' | 'id'>, now: () => number): () => boolean {
  let last = -Infinity;
  return () => {
    if (now() - last < 24 * 3600 * 1000) return false;
    last = now();
    void game.nudge();
    return true;
  };
}
